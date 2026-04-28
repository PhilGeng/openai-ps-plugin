function selectedImageSizeOption() {
    return selectedImageSize;
}

async function getSelectedImageSize() {
    const selected = selectedImageSizeOption();
    if (selected === "selection") return getCurrentSelectionOrCanvasSize();
    if (selected !== "custom") return selected;

    const width = Number(customWidthInput.value);
    const height = Number(customHeightInput.value);
    if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("自定义尺寸必须填写整数宽高。");
    if (width < 64 || width > MAX_IMAGE_EDGE || height < 64 || height > MAX_IMAGE_EDGE) throw new Error(`自定义尺寸范围必须在 64 到 ${MAX_IMAGE_EDGE} 像素之间。`);
    const normalized = normalizeImageSize(width, height);
    if (normalized.width !== width || normalized.height !== height) {
        appendRuntimeLog("自定义尺寸已自动调整为 16 的倍数。", { original: `${width}x${height}`, adjusted: normalized.size });
    }
    return normalized.size;
}

function updateCustomSizeVisibility() {
    const selected = selectedImageSizeOption();
    const isCustom = selected === "custom";
    customSizeRow.classList.toggle("active", isCustom);
    customSizeRow.style.display = isCustom ? "flex" : "none";
    document.querySelectorAll(".size-option").forEach(option => {
        option.classList.toggle("active", option.getAttribute("data-size") === selected);
    });
}

function showOptimizedPrompt(promptText) {
    optimizedPromptValue = promptText || "";
    optimizedPromptText.textContent = optimizedPromptValue;
    optimizedPromptArea.style.display = optimizedPromptValue ? "block" : "none";
    optimizedPromptTip.textContent = "点击复制";
}

function showGeneratedImage(imageData, message, optimizedPrompt) {
    currentGeneratedImage = imageData;
    generatedImage.src = imageData.src;
    generatedImage.style.display = "block";
    imagePlaceholder.style.display = "none";
    imageMetaArea.style.display = "flex";
    imageDimensions.textContent = imageData.sourceType === "url" ? "来源：图片 URL" : `格式：${imageData.extension.toUpperCase()}`;
    showOptimizedPrompt(optimizedPrompt);
    moduleImageOutput.style.display = "flex";
    appendRuntimeLog(message || "图片生成成功，已在上方显示预览。");
}

function renderImageProgressValue(value) {
    imageProgressValue = Math.max(0, Math.min(100, value));
    imageProgressBar.style.width = `${imageProgressValue}%`;
}

function setImageProgressValue(value) {
    imageProgressTargetValue = Math.max(0, Math.min(100, value));
    if (imageProgressAnimationTimer) clearInterval(imageProgressAnimationTimer);
    imageProgressAnimationTimer = setInterval(() => {
        const distance = imageProgressTargetValue - imageProgressValue;
        if (Math.abs(distance) < 0.4) {
            clearInterval(imageProgressAnimationTimer);
            imageProgressAnimationTimer = null;
            renderImageProgressValue(imageProgressTargetValue);
            return;
        }
        renderImageProgressValue(imageProgressValue + distance * 0.18);
    }, 24);
}

function resetImageProgressValue() {
    if (imageProgressAnimationTimer) {
        clearInterval(imageProgressAnimationTimer);
        imageProgressAnimationTimer = null;
    }
    imageProgressTargetValue = 0;
    renderImageProgressValue(0);
}

function getRandomProgressStep(min, max) {
    return min + Math.random() * (max - min);
}

function startImageProgress() {
    if (imageProgressTimer) clearInterval(imageProgressTimer);
    imageProgress.classList.add("active");
    setImageProgressValue(getRandomProgressStep(2, 5));
    imageProgressTimer = setInterval(() => {
        const step = imageProgressValue < 25
            ? getRandomProgressStep(2.4, 4.8)
            : imageProgressValue < 60
                ? getRandomProgressStep(1.2, 3.2)
                : getRandomProgressStep(0.4, 1.6);
        setImageProgressValue(Math.min(imageProgressValue + step, 88));
    }, 1200);
}

function finishImageProgress() {
    if (imageProgressTimer) {
        clearInterval(imageProgressTimer);
        imageProgressTimer = null;
    }
    setImageProgressValue(100);
    setTimeout(() => {
        imageProgress.classList.remove("active");
        resetImageProgressValue();
    }, 450);
}

function resetGeneratedImage() {
    currentGeneratedImage = null;
    generatedImage.src = "";
    generatedImage.style.display = "none";
    imagePlaceholder.style.display = "flex";
    imageMetaArea.style.display = "none";
    imageDimensions.textContent = "尚无图片";
    showOptimizedPrompt("");
}

function initializeTabs() {
    document.querySelectorAll(".tab-btn").forEach(button => {
        const activateTab = () => {
            const tab = button.getAttribute("data-tab");
            document.querySelectorAll(".tab-btn").forEach(item => item.classList.toggle("active", item === button));
            document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.getAttribute("data-panel") === tab));
            logInfo("切换页面", { tab });
        };
        button.addEventListener("click", activateTab);
        button.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") activateTab();
        });
    });
}

const SIDEBAR_TOGGLE_NORMAL = {
    width: 4,
    radius: 2,
    iconOpacity: 0,
    iconScale: 0.75,
    shadow: 0,
    bgAlpha: 0.85
};

const SIDEBAR_TOGGLE_HOVER = {
    width: 36,
    radius: 8,
    iconOpacity: 1,
    iconScale: 1,
    shadow: 1,
    bgAlpha: 1
};

const SIDEBAR_TOGGLE_HEIGHT = 36;
const SIDEBAR_TOGGLE_ANIMATION_MS = 180;
const SIDEBAR_TOGGLE_COLLAPSE_DELAY_MS = 500;
const SIDEBAR_EXPANDED_WIDTH = 52;
const SIDEBAR_COLLAPSED_WIDTH = 10;
const SIDEBAR_ANIMATION_MS = 180;

function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
}

function lerpValue(start, end, amount) {
    return start + (end - start) * amount;
}

function applySidebarToggleState(state) {
    sidebarToggleState = { ...state };
    sidebarToggle.style.width = `${state.width}px`;
    sidebarToggle.style.height = `${SIDEBAR_TOGGLE_HEIGHT}px`;
    sidebarToggle.style.borderRadius = `${Math.min(state.radius, state.width / 2)}px`;
    sidebarToggle.style.background = `rgba(31, 124, 255, ${state.bgAlpha})`;
    sidebarToggle.style.boxShadow = state.shadow > 0.01
        ? `0 4px ${Math.round(14 * state.shadow)}px rgba(0, 0, 0, ${0.35 * state.shadow})`
        : "none";
    sidebarToggleIcon.style.opacity = String(state.iconOpacity);
    sidebarToggleIcon.style.transform = `scale(${state.iconScale})`;
}

function animateSidebarToggleTo(target) {
    if (sidebarToggleAnimationFrame !== null) {
        cancelAnimationFrame(sidebarToggleAnimationFrame);
        sidebarToggleAnimationFrame = null;
    }

    const start = { ...sidebarToggleState };
    const startTime = performance.now();

    const frame = now => {
        const raw = Math.min((now - startTime) / SIDEBAR_TOGGLE_ANIMATION_MS, 1);
        const eased = easeOutCubic(raw);
        applySidebarToggleState({
            width: lerpValue(start.width, target.width, eased),
            radius: lerpValue(start.radius, target.radius, eased),
            iconOpacity: lerpValue(start.iconOpacity, target.iconOpacity, eased),
            iconScale: lerpValue(start.iconScale, target.iconScale, eased),
            shadow: lerpValue(start.shadow, target.shadow, eased),
            bgAlpha: lerpValue(start.bgAlpha, target.bgAlpha, eased)
        });

        if (raw < 1) {
            sidebarToggleAnimationFrame = requestAnimationFrame(frame);
        } else {
            sidebarToggleAnimationFrame = null;
            applySidebarToggleState(target);
        }
    };

    sidebarToggleAnimationFrame = requestAnimationFrame(frame);
}

function applySidebarWidth(width) {
    sidebarWidthValue = width;
    tabNavElement.style.width = `${width}px`;
    tabNavElement.style.flexBasis = `${width}px`;
}

function animateSidebarWidthTo(targetWidth) {
    if (sidebarAnimationFrame !== null) {
        cancelAnimationFrame(sidebarAnimationFrame);
        sidebarAnimationFrame = null;
    }

    const startWidth = sidebarWidthValue;
    const startTime = performance.now();

    const frame = now => {
        const raw = Math.min((now - startTime) / SIDEBAR_ANIMATION_MS, 1);
        const eased = easeOutCubic(raw);
        applySidebarWidth(lerpValue(startWidth, targetWidth, eased));

        if (raw < 1) {
            sidebarAnimationFrame = requestAnimationFrame(frame);
        } else {
            sidebarAnimationFrame = null;
            applySidebarWidth(targetWidth);
        }
    };

    sidebarAnimationFrame = requestAnimationFrame(frame);
}

function setSidebarCollapsed(collapsed) {
    isSidebarCollapsed = collapsed;
    tabNavElement.classList.toggle("collapsed", isSidebarCollapsed);
    sidebarToggle.setAttribute("aria-label", isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏");
    sidebarToggleIcon.textContent = isSidebarCollapsed ? "»" : "«";
    animateSidebarWidthTo(isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH);
}

function cancelSidebarToggleCollapseDelay() {
    if (!sidebarToggleCollapseTimer) return;
    clearTimeout(sidebarToggleCollapseTimer);
    sidebarToggleCollapseTimer = null;
}

function expandSidebarToggleHandle() {
    cancelSidebarToggleCollapseDelay();
    animateSidebarToggleTo(SIDEBAR_TOGGLE_HOVER);
}

function collapseSidebarToggleHandleDelayed() {
    cancelSidebarToggleCollapseDelay();
    sidebarToggleCollapseTimer = setTimeout(() => {
        sidebarToggleCollapseTimer = null;
        animateSidebarToggleTo(SIDEBAR_TOGGLE_NORMAL);
    }, SIDEBAR_TOGGLE_COLLAPSE_DELAY_MS);
}

function toggleSidebarCollapsed(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    setSidebarCollapsed(!isSidebarCollapsed);
    logInfo("切换侧边栏", { collapsed: isSidebarCollapsed });
}

function initSidebarCollapse() {
    applySidebarToggleState(SIDEBAR_TOGGLE_NORMAL);
    sidebarToggleHitarea.addEventListener("mouseenter", expandSidebarToggleHandle);
    sidebarToggleHitarea.addEventListener("mouseleave", collapseSidebarToggleHandleDelayed);
    sidebarToggle.addEventListener("focus", expandSidebarToggleHandle);
    sidebarToggle.addEventListener("blur", collapseSidebarToggleHandleDelayed);
    sidebarToggle.addEventListener("click", toggleSidebarCollapsed);
    sidebarToggle.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") toggleSidebarCollapsed(event);
    });
}

function initializeOutputArea() {
    outputAreaElement.addEventListener("mousedown", () => outputAreaElement.focus());
    outputAreaElement.addEventListener("click", () => outputAreaElement.focus());
    outputAreaElement.addEventListener("beforeinput", event => event.preventDefault());
    outputAreaElement.addEventListener("input", () => {
        outputAreaElement.value = lockedOutputValue;
    });
    outputAreaElement.addEventListener("keydown", event => {
        const allowedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Tab", "Shift", "Control", "Meta", "Alt", "Escape"];
        if (event.ctrlKey || event.metaKey || allowedKeys.includes(event.key)) return;
        event.preventDefault();
    });
    outputAreaElement.addEventListener("paste", event => event.preventDefault());
    outputAreaElement.addEventListener("drop", event => event.preventDefault());
}

function initializeSizeSelector() {
    document.querySelectorAll(".size-option").forEach(button => {
        button.addEventListener("click", () => {
            selectedImageSize = button.getAttribute("data-size") || "1024x1024";
            updateCustomSizeVisibility();
        });
    });
    updateCustomSizeVisibility();
}

function showSettingsSaveTip(message) {
    if (settingsSaveTipTimer) clearTimeout(settingsSaveTipTimer);
    settingsSaveTip.textContent = message;
    settingsSaveTip.classList.add("active");
    settingsSaveTipTimer = setTimeout(() => {
        settingsSaveTip.classList.remove("active");
    }, 1800);
}

function saveSettings() {
    tpUrl = tpUrlInput.value.trim() || DEFAULT_PROXY_URL;
    tpModel = tpModelInput.value.trim() || DEFAULT_IMAGE_MODEL;
    tpKey = tpKeyInput.value.trim();
    localStorage.setItem("gemini_tp_url", tpUrl);
    localStorage.setItem("gemini_tp_model", tpModel);
    localStorage.setItem("gemini_tp_key", tpKey);
    tpUrlInput.value = tpUrl;
    tpModelInput.value = tpModel;
    logInfo("保存接口配置完成", { hasThirdpartyUrl: Boolean(tpUrl), tpModel, hasThirdpartyKey: Boolean(tpKey) });
    showSettingsSaveTip("配置已保存");
    setOutputText("配置已保存。");
}

function initializeSettings() {
    tpUrlInput.value = tpUrl;
    tpModelInput.value = tpModel;
    tpKeyInput.value = tpKey;
}

function focusPromptInput() {
    const promptInput = document.getElementById("prompt-input");
    promptInput.focus();
    promptInput.select();
}

function setGenerateBusy(isBusy) {
    isGeneratingImage = isBusy;
    const sendBtn = document.getElementById("send-btn");
    sendBtn.classList.toggle("danger", isBusy);
    sendBtn.setAttribute("aria-label", isBusy ? "终止生成" : "发送生成");
    sendBtn.innerHTML = isBusy
        ? "终止"
        : '<img src="assets/icons/send.png" class="btn-icon" alt="">发送 / 生成';
}

function abortImageGeneration() {
    if (!imageGenerationAbortController) return;
    imageGenerationAbortController.abort();
    appendRuntimeLog("正在终止当前图片生成请求...");
}

async function handleGenerateClick() {
    if (isGeneratingImage) {
        abortImageGeneration();
        return;
    }
    const promptText = document.getElementById("prompt-input").value.trim();
    const includeCanvas = document.getElementById("include-canvas").checked;
    if (!promptText) {
        logWarn("发送 AI 请求被阻止：提示词为空");
        setOutputText("提示：请先输入生成需求。");
        return;
    }
    if (!tpUrl || !tpModel) {
        logWarn("发送 AI 请求被阻止：OpenAI 兼容配置不完整", { hasThirdpartyUrl: Boolean(tpUrl), hasModel: Boolean(tpModel) });
        setOutputText("提示：请先在设置页完善 OpenAI 兼容接口地址和模型名称。");
        return;
    }

    resetGeneratedImage();
    imageGenerationAbortController = new AbortController();
    setGenerateBusy(true);
    startImageProgress();

    try {
        const size = await getSelectedImageSize();
        const cleanBaseUrl = normalizeBaseUrl(tpUrl);
        const requestPromptText = buildPromptForRequest(promptText);
        setOutputText(`正在请求图片生成...\n模型：${tpModel}\n尺寸：${size}\n接口：${cleanBaseUrl}`);
        logInfo("发送图片请求按钮点击", { includeCanvas, promptChars: promptText.length, requestPromptChars: requestPromptText.length, size, model: tpModel });

        let imageData;
        if (includeCanvas) {
            const referenceImage = await getPhotoshopReferenceImage();
            imageData = await requestImageEdit(cleanBaseUrl, requestPromptText, size, referenceImage, imageGenerationAbortController.signal);
        } else {
            imageData = await requestImageGeneration(cleanBaseUrl, requestPromptText, size, imageGenerationAbortController.signal);
        }

        showGeneratedImage(imageData, `图片生成成功，已在生成结果区域显示预览。 尺寸：${size} 来源：${imageData.sourceType}`, imageData.revisedPrompt || requestPromptText);
        logInfo("图片请求流程完成", { sourceType: imageData.sourceType, extension: imageData.extension, size, hasRevisedPrompt: Boolean(imageData.revisedPrompt) });
    } catch (error) {
        if (error.name === "AbortError") {
            logWarn("图片请求已终止");
            setOutputText("图片生成已终止。");
        } else {
            logError("图片请求流程失败", error, { includeCanvas, promptChars: promptText.length });
            showError(error.message || error.toString());
        }
    } finally {
        imageGenerationAbortController = null;
        finishImageProgress();
        setGenerateBusy(false);
    }
}

async function writeTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    outputAreaElement.focus();
    outputAreaElement.value = text;
    outputAreaElement.select();
    document.execCommand("copy");
    outputAreaElement.value = lockedOutputValue;
}

async function copyOutputText() {
    const text = getOutputText();
    if (!text) return;
    try {
        await writeTextToClipboard(text);
        appendRuntimeLog("日志已复制。");
    } catch (error) {
        logError("复制日志失败", error);
        appendRuntimeLog("复制日志失败。", { error: error.message || error.toString() });
    }
}

async function copyOptimizedPrompt() {
    if (!optimizedPromptValue) return;
    try {
        await writeTextToClipboard(optimizedPromptValue);
        optimizedPromptTip.textContent = "已复制";
        appendRuntimeLog("参考优化输入词已复制。");
    } catch (error) {
        logError("复制参考优化输入词失败", error);
        optimizedPromptTip.textContent = "复制失败";
    }
}

function handleClearClick() {
    logInfo("清空表单");
    document.getElementById("prompt-input").value = "";
    document.getElementById("include-canvas").checked = false;
    resetGeneratedImage();
    setOutputText("等待生成...");
}

function bindActionControl(id, handler) {
    const element = document.getElementById(id);
    element.addEventListener("click", handler);
    element.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") handler();
    });
}

function initializeApp() {
    initializeTabs();
    initSidebarCollapse();
    initializeOutputArea();
    initializeSizeSelector();
    initializeSettings();
    resetGeneratedImage();
    setTimeout(focusPromptInput, 0);
    logInfo("插件脚本初始化", { photoshopAvailable: Boolean(app && core && fs && formats), actionAvailable: Boolean(action), tpUrl, tpModel });
    if (uxpLoadError) logWarn("Photoshop UXP 模块加载失败", { message: uxpLoadError.message || uxpLoadError.toString() });

    bindActionControl("send-btn", handleGenerateClick);
    document.getElementById("send-to-ps-btn").addEventListener("click", sendImageToPhotoshop);
    bindActionControl("clear-btn", handleClearClick);
    bindActionControl("copy-output-btn", copyOutputText);
    bindActionControl("clear-output-btn", () => setOutputText(""));
    optimizedPromptArea.addEventListener("click", copyOptimizedPrompt);
    optimizedPromptArea.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") copyOptimizedPrompt();
    });
    bindActionControl("save-key-btn", saveSettings);
}
