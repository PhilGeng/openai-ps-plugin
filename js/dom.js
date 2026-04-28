const tabNavElement = document.getElementById("tab-nav");
const sidebarToggleHitarea = document.getElementById("sidebar-toggle-hitarea");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarToggleIcon = document.getElementById("sidebar-toggle-icon");
const saveKeyBtn = document.getElementById("save-key-btn");
const moduleImageOutput = document.getElementById("module-image-output");
const offKeyInput = null;
const tpUrlInput = document.getElementById("tp-url-input");
const tpModelInput = document.getElementById("tp-model-input");
const tpKeyInput = document.getElementById("tp-key-input");
const imagePromptTemplateInput = document.getElementById("image-prompt-template-input");
const imageEditPromptTemplateInput = document.getElementById("image-edit-prompt-template-input");
const outputScrollElement = document.getElementById("output-scroll");
const outputAreaElement = document.getElementById("output-area");
let lockedOutputValue = outputAreaElement.value || "";
let optimizedPromptValue = "";
const imagePlaceholder = document.getElementById("image-placeholder");
const generatedImage = document.getElementById("generated-image");
const imageMetaArea = document.getElementById("image-meta-area");
const imageDimensions = document.getElementById("image-dimensions");
const imageProgress = document.getElementById("image-progress");
const imageProgressBar = document.getElementById("image-progress-bar");
const optimizedPromptArea = document.getElementById("optimized-prompt-area");
const optimizedPromptText = document.getElementById("optimized-prompt-text");
const optimizedPromptTip = document.getElementById("optimized-prompt-tip");
const settingsSaveTip = document.getElementById("settings-save-tip");
let imageProgressTimer = null;
let imageProgressAnimationTimer = null;
let imageProgressValue = 0;
let imageProgressTargetValue = 0;
let settingsSaveTipTimer = null;
let isGeneratingImage = false;
let imageGenerationAbortController = null;
let isSidebarCollapsed = false;
let sidebarToggleAnimationFrame = null;
let sidebarAnimationFrame = null;
let sidebarToggleCollapseTimer = null;
let sidebarWidthValue = 52;
let sidebarToggleState = {
    width: 4,
    radius: 2,
    iconOpacity: 0,
    iconScale: 0.75,
    shadow: 0,
    bgAlpha: 0.85
};
const customSizeRow = document.getElementById("custom-size-row");
const customWidthInput = document.getElementById("custom-width");
const customHeightInput = document.getElementById("custom-height");
