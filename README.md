# 设计排版AI助手

基于：https://github.com/MhcChampion/Gemini-PS-Plugin

一个基于 Adobe Photoshop UXP 的 AI 图片生成面板插件。插件通过 OpenAI 兼容接口连接本地代理或第三方图片模型，支持输入生成需求、选择输出尺寸、可选携带当前 Photoshop 画面作为参考，并将生成结果发送回 Photoshop。


## 预览

![配置项](https://github.com/user-attachments/assets/3da98699-f230-4d32-8931-14bcf0f4516a)

![选区替换1](https://github.com/user-attachments/assets/760059ad-4488-4187-b16b-601805812c91)

![选区替换2](https://github.com/user-attachments/assets/483a7bbc-6d97-443e-a14a-0fa2f613e11f)


## 关键词

Photoshop 插件、Photoshop UXP、Adobe UXP、UXP Plugin、OpenAI Photoshop Plugin、OpenAI PS Plugin、AI 图片生成、AI 绘图、AI 生图、文生图、图生图、图片编辑、OpenAI Images API、OpenAI 兼容接口、GPT Image、gpt-image-2、Photoshop AI 工具、设计辅助工具、设计排版、AIGC、Stable Diffusion 代理、本地 AI 代理、图片生成工作流。

## 功能特性

- **OpenAI 兼容接口**：支持配置代理接口地址、图片模型名称和 API Key。
- **图片生成**：在面板中输入图片生成需求，一键调用 `/v1/images/generations`。
- **携带 PS 画面**：可勾选“携带 PS 画面”，优先使用当前选区；没有选区时使用当前可见画面，并调用 `/v1/images/edits`。
- **尺寸选择**：内置 `1024×1024`、`1920×1080`、当前选取尺寸和自定义尺寸。
- **尺寸自动修正**：请求尺寸会等比例缩放到最长边不超过 3840，并调整为 16 的倍数，避免接口报错。
- **生成结果预览**：支持 URL、base64、二进制图片响应，并在插件面板中预览。
- **发送到 Photoshop**：可将生成图发送到当前文档，自动适配当前选区或画布；没有活动文档时作为新文档打开。
- **运行日志**：面板内显示请求状态、响应摘要和错误信息，支持复制和清空日志。
- **深色玻璃风格 UI**：面板使用深灰玻璃质感界面，内部 UI 图标使用 PNG 资源。

## 环境要求

- Adobe Photoshop `23.3.0` 或更高版本
- Adobe UXP Developer Tool（开发加载时需要）
- 一个 OpenAI 兼容图片接口，例如本地代理或第三方代理服务

## 项目结构

```text
.
├── manifest.json          # UXP 插件清单
├── index.html             # 面板 UI 和样式
├── js/                    # 插件运行逻辑，按职责拆分为多个普通脚本
├── assets/icons/          # 插件内部 UI 图标，使用 PNG
├── icon.png               # 插件图标
├── LICENSE
└── README.md
```

## 安装与加载

### 使用 UXP Developer Tool 加载

1. 打开 Adobe UXP Developer Tool。
2. 点击 `Add Plugin`。
3. 选择本项目中的 `manifest.json`。
4. 点击 `Load`。
5. 在 Photoshop 中打开插件面板：`增效工具 / Plugins` → `AI 设计助手`。

### 使用 CCX 安装包

如果你已有 `.ccx` 安装包，可以直接双击安装，或通过 Adobe Creative Cloud 安装。

## 使用方式

### 1. 配置接口

进入设置页，填写：

- **代理接口地址**：例如 `http://127.0.0.1:18317`
- **图片模型名称**：例如 `gpt-image-2`、`gpt-5.5` 或你的代理支持的模型名
- **API Key**：本地代理可留空；第三方接口按服务要求填写

地址会自动兼容裸 `host:port`，并移除末尾 `/v1`。

### 2. 选择尺寸

首页支持以下尺寸模式：

- `1024×1024`
- `1920×1080`
- 当前选取尺寸
- 自定义宽高

如果接口要求宽高必须能被 16 整除，且最长边不超过 3840，插件会先等比例缩放，再向下调整到最近的 16 倍数。例如：

```text
4096×2416 → 3840×2256
```

### 3. 输入生成需求

在“生成需求”中输入提示词，例如：

```text
清晨自然光下的嫩绿色草地特写，露珠，浅景深，治愈氛围
```

点击“发送 / 生成”后，插件会请求图片生成接口。

### 4. 可选携带 Photoshop 画面

勾选“携带 PS 画面”后：

- 如果当前文档有选区，插件会使用选区范围作为参考图。
- 如果没有选区，插件会使用当前可见画面作为参考图。

该模式会调用 OpenAI 兼容的图片编辑接口 `/v1/images/edits`。

### 5. 发送结果到 Photoshop

生成成功后，图片会显示在“生成结果”区域。点击“发送到 PS”后：

- 有活动文档：作为新图层放入当前文档，并尝试适配选区或画布。
- 无活动文档：作为新的 Photoshop 文档打开。

## 接口兼容说明

插件主要使用 OpenAI 兼容接口：

- 文生图：`POST /v1/images/generations`
- 图生图 / 编辑：`POST /v1/images/edits`

支持常见返回形式：

- 图片 URL
- `b64_json`
- base64 字段
- 直接返回图片二进制

## 开发注意事项

- 本项目没有构建步骤、测试脚本或外部依赖。
- 修改后需要在 Adobe UXP Developer Tool 中手动 `Reload` 插件。
- Photoshop UXP 中 `button` 内嵌 `img` 可能导致渲染异常或闪退，因此带图片图标的可点击控件使用 `div role="button"`。
- 插件内部 UI 图标统一使用 PNG，不使用 SVG。
- 资源路径使用 `assets/icons/*.png`，不要使用 `./assets/...`。
- 影响 Photoshop 活动文档的操作应放在 `core.executeAsModal` 中执行。

## 手动验证建议

修改后建议至少验证：

- 插件面板能正常加载，不闪退。
- 设置页能保存代理地址、模型名和 API Key。
- `host:port` 地址能自动补协议。
- 四种尺寸模式都能发起请求。
- 非 16 倍数尺寸会自动修正。
- 纯文本生成能返回并预览图片。
- 勾选“携带 PS 画面”能调用编辑接口。
- 日志复制、日志清空、表单清空可用。
- 生成结果能发送到 Photoshop。

## 许可证

本项目采用 [MIT License](LICENSE) 开源协议。
