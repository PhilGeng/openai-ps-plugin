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
const DEFAULT_IMAGE_PROMPT_TEMPLATE = "图片生成任务：{{prompt}}\n\n请在生成图片时优化构图、主体、光线、材质、色彩和氛围，让画面更完整、更适合设计排版使用。增强要求：主体明确，构图干净，层次清晰，细节丰富，柔和自然光，色彩协调，质感高级，无文字，无水印，无 Logo，无边框。";
const DEFAULT_IMAGE_EDIT_PROMPT_TEMPLATE = "图片生成任务：{{prompt}}\n\n请在生成图片时优化构图、主体、光线、材质、色彩和氛围，让画面更完整、更适合设计排版使用。增强要求：主体明确，构图干净，层次清晰，细节丰富，柔和自然光，色彩协调，质感高级，无文字，无水印，无 Logo，无边框。\n\n图片编辑要求：请严格参考原图的整体风格、光线方向、透视关系、色彩氛围、材质质感和画面颗粒感；生成内容需要自然融入原图环境，边缘过渡柔和，周围区域与原图保持协调、连续、无明显拼接痕迹。";
const MAX_IMAGE_EDGE = 3840;
const MIN_IMAGE_PIXELS = 3145728;
const logPrefix = "[设计排版AI助手]";

let tpUrl = localStorage.getItem("gemini_tp_url") || DEFAULT_PROXY_URL;
let tpModel = localStorage.getItem("gemini_tp_model") || DEFAULT_IMAGE_MODEL;
let tpKey = localStorage.getItem("gemini_tp_key") || "";
let imagePromptTemplate = localStorage.getItem("gemini_image_prompt_template") || "";
let imageEditPromptTemplate = localStorage.getItem("gemini_image_edit_prompt_template") || "";
let currentGeneratedImage = null;
let selectedImageSize = "selection";
