function buildHeaders(contentType) {
    const headers = {};
    if (contentType) headers["Content-Type"] = contentType;
    if (tpKey) headers.Authorization = `Bearer ${tpKey}`;
    return headers;
}

function buildLoggedHeaders(headers) {
    const loggedHeaders = { ...headers };
    if (loggedHeaders.Authorization) loggedHeaders.Authorization = "Bearer [已隐藏]";
    return loggedHeaders;
}

function getRevisedPromptFromImage(image) {
    if (!image || typeof image !== "object") return "";
    return image.revised_prompt || image.revisedPrompt || image.prompt || image.output_text || "";
}

function withRevisedPrompt(imageData, revisedPrompt) {
    imageData.revisedPrompt = revisedPrompt || "";
    return imageData;
}

function extractGeneratedImageFromJson(data) {
    const image = data.data?.[0] || data.images?.[0] || data.output?.[0] || data.image;
    if (!image) throw new Error("图片接口没有返回可识别的图片数据。需要 data[0].url 或 data[0].b64_json。 ");

    const revisedPrompt = getRevisedPromptFromImage(image);

    if (typeof image === "string") {
        if (image.startsWith("data:")) return withRevisedPrompt(normalizeGeneratedImageSource(image, "data-url"), revisedPrompt);
        if (/^https?:\/\//i.test(image)) return withRevisedPrompt(normalizeGeneratedImageSource(image, "url"), revisedPrompt);
        return withRevisedPrompt(normalizeGeneratedImageSource(`data:image/png;base64,${image}`, "base64"), revisedPrompt);
    }

    const imageUrl = image.url || image.image_url?.url || image.output_url;
    if (imageUrl) return withRevisedPrompt(normalizeGeneratedImageSource(imageUrl, imageUrl.startsWith("data:") ? "data-url" : "url"), revisedPrompt);

    const base64Image = image.b64_json || image.base64 || image.image_base64;
    if (base64Image) return withRevisedPrompt(normalizeGeneratedImageSource(`data:${image.mime_type || "image/png"};base64,${base64Image}`, "base64"), revisedPrompt);

    throw new Error("图片接口没有返回 url 或 b64_json 图片数据。");
}

function normalizeGeneratedImageSource(src, sourceType) {
    const dataImage = parseDataImageUrl(src);
    if (dataImage) {
        const bytes = new Uint8Array(dataImage.buffer);
        const extension = getImageExtension(dataImage.contentType, src, bytes);
        return { src, sourceType, contentType: dataImage.contentType, extension, arrayBuffer: dataImage.buffer };
    }
    const extension = getImageExtension("", src, null);
    return { src, sourceType, contentType: mimeTypeFromExtension(extension), extension, arrayBuffer: null };
}

async function parseImageResponse(response, actionName) {
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.toLowerCase().startsWith("image/")) {
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const extension = getImageExtension(contentType, "", bytes);
        const src = dataUrlFromBuffer(buffer, mimeTypeFromExtension(extension));
        logInfo(`${actionName} 返回二进制图片`, { contentType, bytes: buffer.byteLength, extension });
        return { src, sourceType: "binary", contentType: mimeTypeFromExtension(extension), extension, arrayBuffer: buffer, revisedPrompt: "" };
    }

    const text = await readResponseText(response, actionName);
    const data = parseJsonText(text, actionName);
    logInfo(`${actionName} 响应 JSON`, summarizeResponseBody(data));
    appendRuntimeLog(`${actionName} 响应 JSON`, summarizeResponseBody(data));
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return extractGeneratedImageFromJson(data);
}

async function requestImageGeneration(cleanBaseUrl, promptText, size, signal) {
    const requestBody = { model: tpModel, prompt: promptText, n: 1, size };
    const endpoint = `${cleanBaseUrl}/v1/images/generations`;
    const headers = buildHeaders("application/json");

    logInfo("图片生成请求信息", { endpoint, method: "POST", headers: buildLoggedHeaders(headers), body: summarizeRequestBody(requestBody) });
    appendRuntimeLog("图片生成请求", { endpoint, size, model: tpModel });

    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(requestBody), signal });
    logInfo("图片生成响应信息", { status: response.status, ok: response.ok, statusText: response.statusText });
    appendRuntimeLog("图片生成响应", { status: response.status, ok: response.ok, statusText: response.statusText });
    return parseImageResponse(response, "图片生成");
}

async function requestImageEdit(cleanBaseUrl, promptText, size, referenceImage, signal) {
    if (typeof FormData !== "function" || typeof Blob !== "function") {
        throw new Error("当前 UXP 环境不支持 FormData/Blob，无法调用 /v1/images/edits 携带 PS 画面。请取消勾选“携带 PS 画面”后使用生成接口。");
    }

    const endpoint = `${cleanBaseUrl}/v1/images/edits`;
    const formData = new FormData();
    formData.append("model", tpModel);
    formData.append("prompt", promptText);
    formData.append("n", "1");
    formData.append("size", size);
    formData.append("image", dataUrlToBlob(referenceImage.dataUrl), referenceImage.mimeType === "image/png" ? "photoshop-reference.png" : "photoshop-reference.jpg");

    const headers = buildHeaders(null);
    logInfo("图片编辑请求信息", {
        endpoint,
        method: "POST",
        headers: buildLoggedHeaders(headers),
        body: { model: tpModel, promptChars: promptText.length, n: 1, size, image: "[参考图文件]", boundsType: referenceImage.boundsType }
    });
    appendRuntimeLog("图片编辑请求", { endpoint, size, model: tpModel, boundsType: referenceImage.boundsType });

    let response;
    try {
        response = await fetch(endpoint, { method: "POST", headers, body: formData, signal });
    } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new Error(`图片编辑请求失败：${error.message || error.toString()}。当前 UXP 环境或代理可能不支持 FormData 图片上传，可取消“携带 PS 画面”后重试。`);
    }
    logInfo("图片编辑响应信息", { status: response.status, ok: response.ok, statusText: response.statusText });
    appendRuntimeLog("图片编辑响应", { status: response.status, ok: response.ok, statusText: response.statusText });
    return parseImageResponse(response, "图片编辑");
}

async function fetchImageAsArrayBuffer(src) {
    const dataImage = parseDataImageUrl(src);
    if (dataImage) {
        const bytes = new Uint8Array(dataImage.buffer);
        const extension = getImageExtension(dataImage.contentType, src, bytes);
        return { buffer: dataImage.buffer, contentType: dataImage.contentType, extension };
    }

    logInfo("请求远程图片开始", { imageUrl: src });
    appendRuntimeLog("请求远程图片", { imageUrl: src });
    const imageResponse = await fetch(src);
    logInfo("请求远程图片完成", { status: imageResponse.status, ok: imageResponse.ok, statusText: imageResponse.statusText });
    if (!imageResponse.ok) throw new Error(`图片请求失败，HTTP 状态码：${imageResponse.status}`);

    const contentType = imageResponse.headers.get("Content-Type") || "";
    const buffer = await imageResponse.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const extension = getImageExtension(contentType, src, bytes);
    if (!["png", "jpg", "webp"].includes(extension)) throw new Error("该链接返回的不是可识别的图片内容，无法发送到 Photoshop。");
    return { buffer, contentType: mimeTypeFromExtension(extension), extension };
}
