function normalizeBaseUrl(url) {
    logInfo("规范化第三方接口地址开始", { hasUrl: Boolean(url && url.trim()) });
    let cleanUrl = url.trim();
    if (!cleanUrl) throw new Error("请先填写 OpenAI 兼容接口地址。");
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `http://${cleanUrl}`;

    let parsedUrl;
    try {
        parsedUrl = new URL(cleanUrl);
    } catch (error) {
        logError("第三方接口地址格式错误", error);
        throw new Error("OpenAI 兼容接口地址格式不正确，请填写类似 http://127.0.0.1:18317 的地址。");
    }

    const normalizedUrl = parsedUrl.toString().replace(/\/v1\/?$/, "").replace(/\/+$/, "");
    logInfo("规范化第三方接口地址完成", { origin: parsedUrl.origin, normalizedUrl });
    return normalizedUrl;
}

function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

function parseDataImageUrl(imageUrl) {
    const match = String(imageUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return { contentType: match[1], buffer: base64ToArrayBuffer(match[2]) };
}

function getImageExtension(contentType, imageUrl, bytes) {
    if (bytes && bytes.length >= 12) {
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "png";
        if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "jpg";
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
    }

    if (/image\/png/i.test(contentType)) return "png";
    if (/image\/webp/i.test(contentType)) return "webp";
    if (/image\/jpe?g/i.test(contentType)) return "jpg";

    const match = String(imageUrl || "").match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
    const ext = match ? match[1].toLowerCase() : "png";
    return ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext.replace("jpeg", "jpg") : "png";
}

function mimeTypeFromExtension(extension) {
    if (extension === "jpg") return "image/jpeg";
    if (extension === "webp") return "image/webp";
    return "image/png";
}

function dataUrlFromBuffer(buffer, mimeType) {
    return `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
}

function normalizeImageDimension(value) {
    return Math.max(64, Math.floor(value / 16) * 16);
}

function normalizeImageSize(width, height) {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
    const normalizedWidth = normalizeImageDimension(width * scale);
    const normalizedHeight = normalizeImageDimension(height * scale);
    return { width: normalizedWidth, height: normalizedHeight, size: `${normalizedWidth}x${normalizedHeight}` };
}

function buildPromptForRequest(promptText) {
    return `图片生成任务：${promptText}\n\n请在生成图片时优化构图、主体、光线、材质、色彩和氛围，让画面更完整、更适合设计排版使用。增强要求：主体明确，构图干净，层次清晰，细节丰富，柔和自然光，色彩协调，质感高级，无文字，无水印，无 Logo，无边框。`;
}

function dataUrlToBlob(dataUrl) {
    const parsed = parseDataImageUrl(dataUrl);
    if (!parsed) throw new Error("参考图 data URL 格式不正确。");
    return new Blob([parsed.buffer], { type: parsed.contentType });
}
