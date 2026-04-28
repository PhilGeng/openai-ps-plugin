function unitValueToNumber(value) {
    if (value === undefined || value === null) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "object") return Number(value._value ?? value.value ?? 0);
    return Number(value) || 0;
}

function normalizeBounds(bounds) {
    if (!bounds) return null;
    const left = unitValueToNumber(bounds.left);
    const top = unitValueToNumber(bounds.top);
    const right = unitValueToNumber(bounds.right);
    const bottom = unitValueToNumber(bounds.bottom);
    if (right <= left || bottom <= top) return null;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function getDocumentBounds() {
    const doc = app.activeDocument;
    const width = unitValueToNumber(doc.width);
    const height = unitValueToNumber(doc.height);
    return { left: 0, top: 0, right: width, bottom: height, width, height };
}

async function getCurrentSelectionOrCanvasSize() {
    ensurePhotoshopAvailable("读取当前选取尺寸");
    if (!app.activeDocument) throw new Error("PS 中没有打开的文档，无法读取当前选取尺寸。");
    const selectionBounds = await getSelectionBoundsOrNull();
    const bounds = selectionBounds || getDocumentBounds();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const normalized = normalizeImageSize(width, height);
    appendRuntimeLog(selectionBounds ? "已使用当前选区尺寸。" : "没有检测到选区，已使用当前画布尺寸。", { size: `${width}x${height}` });
    if (normalized.width !== width || normalized.height !== height) {
        appendRuntimeLog("请求尺寸已自动调整为 16 的倍数。", { original: `${width}x${height}`, adjusted: normalized.size });
    }
    return normalized.size;
}

async function getSelectionBoundsOrNull() {
    if (!action) return null;
    try {
        const result = await action.batchPlay([{
            _obj: "get",
            _target: [
                { _property: "selection" },
                { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
            ],
            _options: { dialogOptions: "dontDisplay" }
        }], { synchronousExecution: true });
        return normalizeBounds(result?.[0]?.selection || result?.[0]);
    } catch (error) {
        logInfo("未检测到 Photoshop 当前选区", { message: error.message || error.toString() });
        return null;
    }
}

async function getCanvasBase64() {
    logInfo("提取画布开始");
    ensurePhotoshopAvailable("画布诊断");
    if (!app.activeDocument) throw new Error("PS 中没有打开的文档，无法获取画面。");
    let base64Image = "";
    await core.executeAsModal(async () => {
        const pluginFolder = await fs.getDataFolder();
        const tempFile = await pluginFolder.createFile("temp_canvas.jpg", { overwrite: true });
        await app.activeDocument.saveAs.jpg(tempFile, { quality: 8 }, true);
        const buffer = await tempFile.read({ format: formats.binary });
        base64Image = arrayBufferToBase64(buffer);
        logInfo("提取画布完成", { bytes: buffer.byteLength, base64Length: base64Image.length });
        await tempFile.delete();
    }, { commandName: "提取画面给 AI" });
    return base64Image;
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("无法读取 Photoshop 参考图。"));
        image.src = dataUrl;
    });
}

async function cropDataUrlToBounds(dataUrl, bounds) {
    const image = await loadImageFromDataUrl(dataUrl);
    const canvas = document.createElement("canvas");
    const left = Math.max(0, Math.round(bounds.left));
    const top = Math.max(0, Math.round(bounds.top));
    const width = Math.min(Math.round(bounds.width), image.naturalWidth - left);
    const height = Math.min(Math.round(bounds.height), image.naturalHeight - top);
    if (width <= 0 || height <= 0) throw new Error("选区范围超出导出画面，无法裁切。");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, left, top, width, height, 0, 0, width, height);
    return canvas.toDataURL("image/png");
}

async function getPhotoshopReferenceImage() {
    ensurePhotoshopAvailable("携带 PS 画面");
    if (!app.activeDocument) throw new Error("PS 中没有打开的文档，无法携带画面。");
    appendRuntimeLog("正在提取 Photoshop 参考图...");
    const selectionBounds = await getSelectionBoundsOrNull();
    const fullDataUrl = `data:image/jpeg;base64,${await getCanvasBase64()}`;

    if (!selectionBounds) {
        appendRuntimeLog("未检测到选区，使用当前可见画面作为参考图。");
        return { dataUrl: fullDataUrl, mimeType: "image/jpeg", boundsType: "canvas", bounds: getDocumentBounds() };
    }

    try {
        const croppedDataUrl = await cropDataUrlToBounds(fullDataUrl, selectionBounds);
        appendRuntimeLog("检测到选区，使用选区范围裁切参考图。", selectionBounds);
        return { dataUrl: croppedDataUrl, mimeType: "image/png", boundsType: "selection", bounds: selectionBounds };
    } catch (error) {
        logError("选区参考图裁切失败，回退当前可见画面", error, selectionBounds);
        appendRuntimeLog("选区裁切失败，已回退当前可见画面。", { error: error.message || error.toString() });
        return { dataUrl: fullDataUrl, mimeType: "image/jpeg", boundsType: "canvas", bounds: getDocumentBounds() };
    }
}

async function writeImageTempFile(buffer, extension) {
    const pluginFolder = await fs.getDataFolder();
    const bytes = new Uint8Array(buffer);
    const realExtension = getImageExtension("", "", bytes);
    const tempFile = await pluginFolder.createFile(`generated_image_to_ps.${realExtension || extension}`, { overwrite: true });
    await tempFile.write(buffer, { format: formats.binary });
    return tempFile;
}

async function getTargetBoundsForPlacement() {
    const selectionBounds = await getSelectionBoundsOrNull();
    if (selectionBounds) return { bounds: selectionBounds, type: "selection" };
    return { bounds: getDocumentBounds(), type: "canvas" };
}

async function getActiveLayerBounds() {
    const result = await action.batchPlay([{
        _obj: "get",
        _target: [
            { _property: "bounds" },
            { _ref: "layer", _enum: "ordinal", _value: "targetEnum" }
        ],
        _options: { dialogOptions: "dontDisplay" }
    }], { synchronousExecution: true });
    return normalizeBounds(result?.[0]?.bounds || result?.[0]);
}

async function fitActiveLayerToBounds(targetBounds) {
    const layerBounds = await getActiveLayerBounds();
    if (!layerBounds) throw new Error("无法读取放置图层的边界。");
    const scaleX = targetBounds.width / layerBounds.width * 100;
    const scaleY = targetBounds.height / layerBounds.height * 100;
    const layerCenterX = layerBounds.left + layerBounds.width / 2;
    const layerCenterY = layerBounds.top + layerBounds.height / 2;
    const targetCenterX = targetBounds.left + targetBounds.width / 2;
    const targetCenterY = targetBounds.top + targetBounds.height / 2;

    await action.batchPlay([{
        _obj: "transform",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
        width: { _unit: "percentUnit", _value: scaleX },
        height: { _unit: "percentUnit", _value: scaleY },
        offset: {
            _obj: "offset",
            horizontal: { _unit: "pixelsUnit", _value: targetCenterX - layerCenterX },
            vertical: { _unit: "pixelsUnit", _value: targetCenterY - layerCenterY }
        },
        _options: { dialogOptions: "dontDisplay" }
    }], {});
}

async function createMaskFromSelection() {
    await action.batchPlay([{
        _obj: "make",
        new: { _class: "channel" },
        at: { _ref: "channel", _enum: "channel", _value: "mask" },
        using: { _enum: "userMaskEnabled", _value: "revealSelection" },
        _options: { dialogOptions: "dontDisplay" }
    }], {});
}

async function placeImageInActiveDocument(tempFile) {
    ensurePhotoshopActionAvailable("发送到 PS");
    const token = typeof fs.createSessionToken === "function" ? fs.createSessionToken(tempFile) : tempFile.nativePath;
    await action.batchPlay([{
        _obj: "placeEvent",
        null: { _path: token, _kind: "local" },
        linked: false,
        _options: { dialogOptions: "dontDisplay" }
    }], {});
}

async function sendImageToPhotoshop() {
    if (!currentGeneratedImage) {
        showError("当前没有可发送到 Photoshop 的生成图。");
        return;
    }

    logInfo("发送生成图到 Photoshop 开始", { src: currentGeneratedImage.src, sourceType: currentGeneratedImage.sourceType });
    appendRuntimeLog("正在发送生成图到 Photoshop...");

    try {
        ensurePhotoshopAvailable("发送到 PS");
        const imageFileData = currentGeneratedImage.arrayBuffer
            ? { buffer: currentGeneratedImage.arrayBuffer, contentType: currentGeneratedImage.contentType, extension: currentGeneratedImage.extension }
            : await fetchImageAsArrayBuffer(currentGeneratedImage.src);

        const tempFile = await writeImageTempFile(imageFileData.buffer, imageFileData.extension);

        await core.executeAsModal(async () => {
            if (!app.activeDocument) {
                await app.openAsNew(tempFile);
                appendRuntimeLog("PS 中没有活动文档，已作为新文档打开。");
                return;
            }

            try {
                const target = await getTargetBoundsForPlacement();
                await placeImageInActiveDocument(tempFile);
                appendRuntimeLog("生成图已作为新图层放入当前文档。", { target: target.type, bounds: target.bounds });

            } catch (error) {
                logError("放入当前文档失败，回退打开新文档", error);
                appendRuntimeLog("放入当前文档失败，回退作为新文档打开。", { error: error.message || error.toString() });
                await app.openAsNew(tempFile);
            }
        }, { commandName: "发送生成图到 Photoshop" });

        try { await tempFile.delete(); } catch (error) { logWarn("删除临时图片失败", { message: error.message || error.toString() }); }
        logInfo("发送生成图到 Photoshop 完成", { extension: imageFileData.extension });
        appendRuntimeLog("发送到 Photoshop 完成。");
    } catch (error) {
        logError("发送生成图到 Photoshop 失败", error);
        appendRuntimeLog("发送到 Photoshop 失败。", { error: error.message || error.toString() });
        showError(error.message || error.toString());
    }
}
