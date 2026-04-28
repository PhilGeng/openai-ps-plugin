let app = null;
let core = null;
let action = null;
let fs = null;
let formats = null;
let uxpLoadError = null;

try {
    if (typeof require !== "function") throw new Error("当前环境没有 UXP require()，Photoshop 专属功能不可用。");
    const photoshop = require("photoshop");
    const uxp = require("uxp");
    app = photoshop.app;
    core = photoshop.core;
    action = photoshop.action;
    fs = uxp.storage.localFileSystem;
    formats = uxp.storage.formats;
} catch (error) {
    uxpLoadError = error;
}

function ensurePhotoshopAvailable(featureName) {
    if (app && core && fs && formats) return;
    throw new Error(`${featureName} 需要在 Photoshop UXP 环境中运行。${uxpLoadError ? uxpLoadError.message : ""}`);
}

function ensurePhotoshopActionAvailable(featureName) {
    ensurePhotoshopAvailable(featureName);
    if (!action) throw new Error(`${featureName} 需要 Photoshop action.batchPlay 支持。`);
}

const DEFAULT_PROXY_URL = "http://127.0.0.1:18317";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const MAX_IMAGE_EDGE = 3840;
const logPrefix = "[设计排版AI助手]";

let tpUrl = localStorage.getItem("gemini_tp_url") || DEFAULT_PROXY_URL;
let tpModel = localStorage.getItem("gemini_tp_model") || DEFAULT_IMAGE_MODEL;
let tpKey = localStorage.getItem("gemini_tp_key") || "";
let currentGeneratedImage = null;
let selectedImageSize = "selection";
