function sanitizeLogDetails(details) {
    if (!details || typeof details !== "object") return details;
    if (Array.isArray(details)) return details.map(item => sanitizeLogDetails(item));
    const safeDetails = {};
    Object.keys(details).forEach(key => {
        const value = details[key];
        if (/key|token|secret|authorization|base64|b64_json/i.test(key)) {
            safeDetails[key] = "[已隐藏]";
        } else if (typeof value === "string" && value.length > 300) {
            safeDetails[key] = `[长文本已隐藏，长度 ${value.length}]`;
        } else if (key === "url" && typeof value === "string" && value.startsWith("data:")) {
            safeDetails[key] = "[base64 data url 已隐藏]";
        } else if (key === "src" && typeof value === "string" && value.startsWith("data:")) {
            safeDetails[key] = "[base64 data url 已隐藏]";
        } else if (typeof value === "object" && value !== null) {
            safeDetails[key] = sanitizeLogDetails(value);
        } else {
            safeDetails[key] = value;
        }
    });
    return safeDetails;
}

function stringifyLogDetails(details) {
    if (details === undefined || details === null || details === "") return "";
    if (typeof details !== "object") return String(details);
    try {
        return JSON.stringify(sanitizeLogDetails(details));
    } catch (error) {
        return String(details);
    }
}

function formatLogMessage(actionName, details) {
    const detailText = stringifyLogDetails(details);
    return detailText ? `${logPrefix} ${actionName} ${detailText}` : `${logPrefix} ${actionName}`;
}

const MAX_OUTPUT_CHARS = 12000;

function trimOutputText(text) {
    const value = String(text);
    if (value.length <= MAX_OUTPUT_CHARS) return value;
    return `...前面日志已省略...\n${value.slice(-MAX_OUTPUT_CHARS)}`;
}

function getOutputText() {
    return lockedOutputValue;
}

function updateOutputHeight() {
    outputAreaElement.style.height = "auto";
    const lineHeight = 15;
    const estimatedHeight = lockedOutputValue.split("\n").length * lineHeight + 20;
    outputAreaElement.style.height = `${Math.max(outputScrollElement.clientHeight, outputAreaElement.scrollHeight, estimatedHeight)}px`;
}

function scrollOutputToBottom() {
    const scroll = () => {
        outputScrollElement.scrollTop = outputScrollElement.scrollHeight;
    };
    scroll();
    setTimeout(scroll, 0);
    requestAnimationFrame(scroll);
    setTimeout(() => requestAnimationFrame(scroll), 0);
    setTimeout(scroll, 50);
}

function setLockedOutputText(text) {
    lockedOutputValue = trimOutputText(text);
    outputAreaElement.value = lockedOutputValue;
    updateOutputHeight();
    scrollOutputToBottom();
}

function appendOutputText(text) {
    setLockedOutputText(getOutputText() + String(text));
}

function setOutputText(text) {
    setLockedOutputText(text);
}

function appendRuntimeLog(message, details) {
    appendOutputText(`\n${message}${details ? ` ${stringifyLogDetails(details)}` : ""}`);
}

function logInfo(actionName, details) {
    console.info(formatLogMessage(actionName, details));
}

function logWarn(actionName, details) {
    console.warn(formatLogMessage(actionName, details));
}

function logError(actionName, error, details) {
    const errorMessage = error && (error.message || error.toString()) || "未知错误";
    console.error(formatLogMessage(actionName, { error: errorMessage, ...sanitizeLogDetails(details || {}) }));
}

function summarizeRequestBody(body) {
    return sanitizeLogDetails(body);
}

function summarizeResponseBody(data) {
    const summary = sanitizeLogDetails(data);
    if (Array.isArray(data?.data)) {
        summary.data = data.data.map(item => ({
            hasUrl: Boolean(item?.url || item?.image_url?.url || item?.output_url),
            hasBase64: Boolean(item?.b64_json || item?.base64 || item?.image_base64),
            revisedPrompt: item?.revised_prompt ? "[已省略]" : undefined
        }));
    }
    if (Array.isArray(data?.output)) summary.output = `[已省略 ${data.output.length} 个 output 项]`;
    return summary;
}

async function readResponseText(response, actionName) {
    const text = await response.text();
    logInfo(`${actionName} 响应原文`, { textLength: text.length });
    appendRuntimeLog(`${actionName} 响应原文`, { textLength: text.length });
    return text;
}

function parseJsonText(text, actionName) {
    if (!text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`${actionName} 返回的不是 JSON：${text.slice(0, 500)}`);
    }
}

function showError(message) {
    logWarn("显示错误", { message });
    setOutputText(`请求出错啦：\n${message}`);
}

function renderAiText(text) {
    return String(text)
        .replace(/```(?:[a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, "$1")
        .replace(/^###\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
