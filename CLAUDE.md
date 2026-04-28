# CLAUDE.md

本文件为 Claude Code 在此仓库中工作时提供项目级指导。所有后续修改都应优先遵守这里的约定。

## 基本编码规则

- 所有回复和写入内容必须使用兼容 UTF-8 的文本。
- 本仓库中所有写入或重写的文件必须使用 UTF-8 无 BOM 编码。
- 优先使用 Claude Code 文件工具修改文件，避免用可能产生 BOM 或编码不确定的 PowerShell 写入方式。
- 不要引入构建步骤、打包器、依赖管理或模块系统，除非用户明确要求。
- 本项目没有自动化测试、lint 或 package.json；修改后至少执行相关 JS 文件的 `node --check`，并提示用户在 Photoshop / UXP Developer Tool 中手动验证。

## 项目概览

这是一个无外部依赖的 Adobe Photoshop UXP 面板插件，名称为 `设计排版AI助手`。当前核心功能是通过 OpenAI 兼容图片接口生成图片，可选择携带当前 Photoshop 选区或可见画面作为参考，并支持将生成结果发送到 Photoshop。

插件通过 Adobe UXP Developer Tool 直接从 `manifest.json` 加载，不经过前端构建流程。

## 运行与验证工作流

- 开发加载：打开 Adobe UXP Developer Tool，选择 `Add Plugin`，选中 `manifest.json`，然后点击 `Load`。
- 修改后重载：在 UXP Developer Tool 中对该插件执行 `Reload`。
- 自动检查：对变更过的 `js/*.js` 执行 `node --check`。
- 手动验证：必须在 Photoshop UXP 面板中验证真实 UI 和 Photoshop API 行为。
- 安装包产物：仓库中可能存在 `.ccx` 安装包产物，不要在没有明确要求时重新生成或删除。

## 当前文件结构与职责

- `manifest.json`
  - 定义 UXP manifest v5 插件元数据、Photoshop 宿主要求、面板入口、权限和图标资源。
- `index.html`
  - 包含完整面板 DOM 和内联 CSS。
  - 底部按顺序加载多个普通 `<script>`，不要改成 `type="module"`。
- `js/bootstrap.js`
  - 初始化 `require("photoshop")`、`require("uxp")`。
  - 定义 Photoshop / UXP 运行时对象、默认接口配置、全局状态和核心常量。
- `js/dom.js`
  - 缓存 DOM 元素引用。
  - 保存 UI 计时器、动画状态、生成状态等跨函数共享状态。
- `js/logger.js`
  - 日志脱敏、输出区域更新、运行日志追加、错误展示、响应文本读取和 JSON 解析。
- `js/utils.js`
  - URL 规范化、base64 / ArrayBuffer 转换、图片类型识别、尺寸规范化、默认图片生成 prompt 构建。
- `js/photoshop.js`
  - Photoshop 文档、选区、画布导出、图片临时文件写入、图片放入 Photoshop 等逻辑。
- `js/api.js`
  - OpenAI 兼容 `/v1/images/generations` 和 `/v1/images/edits` 请求、响应解析、图片数据标准化。
- `js/ui.js`
  - 页面交互、尺寸选择、进度条、侧边栏收起/展开、设置保存、生成按钮、复制、清空和初始化绑定。
- `js/main.js`
  - 最终入口，只调用 `initializeApp()`。

脚本加载顺序必须保持：

```html
<script src="js/bootstrap.js"></script>
<script src="js/dom.js"></script>
<script src="js/logger.js"></script>
<script src="js/utils.js"></script>
<script src="js/photoshop.js"></script>
<script src="js/api.js"></script>
<script src="js/ui.js"></script>
<script src="js/main.js"></script>
```

## 架构与实现约定

- 使用普通 script 共享全局作用域，不使用 ES module、import/export 或打包器。
- 修改 Photoshop 活动文档、写入临时文件、放置图片等操作应放在 `core.executeAsModal()` 中执行。
- 配置通过 `localStorage` 持久化，当前键名包括：
  - `gemini_tp_url`
  - `gemini_tp_model`
  - `gemini_tp_key`
- OpenAI 兼容接口地址允许裸 `host:port`，代码会自动补 `http://` 并移除末尾 `/v1`。
- 图片生成走 `/v1/images/generations`；勾选“携带 PS 画面”时走 `/v1/images/edits`。
- 图片尺寸必须符合接口限制：最长边不超过 `MAX_IMAGE_EDGE`，并按比例缩放；最终宽高应规范为 16 的倍数。
- 请求过程中生成按钮变为红色“终止”，点击后通过 `AbortController` 中断当前请求。
- 生成成功后，生成结果区域展示图片、基础信息和“参考优化输入词”；参考优化输入词点击可复制。
- 日志输出必须脱敏：API key、token、authorization、base64、data URL、长文本等不要完整输出。

## UI 修改约定

- 只改用户要求的区域，不顺手重构其它 UI、布局、配色或交互。
- 插件内部 UI 图标使用 PNG，不使用 SVG；路径使用 `assets/icons/*.png`，不要使用 `./assets/...`。
- 避免在 `button` 内嵌复杂资源；已有 PNG 小图标可保留，但新增控制按钮优先用文本字符或简单 DOM。
- UXP 中 CSS transition / animation 表现不可靠，不要依赖 CSS 动画。
- 需要动画时使用 JavaScript：`requestAnimationFrame` + 手动插值；不要用 CSS transition 作为关键交互依赖。
- 侧边栏展开/收起：
  - 控制按钮位于 sidebar 右侧边框线上。
  - 默认是窄竖线，hover 时同一个按钮通过 JS 变形成方形按钮。
  - hover 只改变按钮形态，点击才切换 sidebar 展开/收起。
  - 窄竖线状态下圆角不得超过当前按钮宽度的 1/2；例如宽度 4px 时，`border-radius` 最大 2px。
  - 收起后隐藏导航按钮，只保留窄边；再次展开恢复原内容。
- 输出日志区域：
  - 外层容器负责滚动，textarea 负责文本展示和拖选。
  - 不要依赖 `textarea.scrollTop` 作为唯一滚动方案。
  - textarea 背景应与日志容器颜色一致。

## Photoshop UXP 已知限制与规避

- Photoshop 工具栏面板图标必须使用 23x23 / 46x46 的 PNG；工具栏不支持 SVG 图标。
- 插件列表图标应使用 24x24 / 48x48，并在 manifest 中显式指定宽高。
- UXP 的 SVG 渲染只适合简单图标，复杂 SVG 可能渲染异常；本项目内部 UI 默认不用 SVG。
- `<img>` 在面板或对话框中应显式设置 `width` 和 `height`，否则初始 0x0 可能导致布局或对话框尺寸异常。
- `<img>` 不会处理嵌入的旋转信息。
- 文本输入控件会渲染在同一面板/对话框大多数内容之上，`z-index` 不能可靠覆盖它们；需要遮挡时应临时隐藏相关输入控件。
- `<textarea>` 尺寸不要依赖 `rows` / `cols`，应使用 CSS `height` / `width` 控制。
- 不支持 HTML5 输入验证；表单边界校验必须在 JavaScript 中手动实现。
- 不要依赖 `defaultValue`、`<input type="file">`、`<input type="color">`、`<option disabled>`。
- `<option>` 必须提供 `value`。
- 当前不支持 DOM 拖拽能力，不要设计依赖 drag/drop 的交互。
- CSS 简写 `font` 不支持；`text-transform` 不支持；`outline` 必须显式提供颜色；`calc()` 只用于长度和数值属性。
- `window.devicePixelRatio` 可能总是返回 `1`，不要用它判断真实屏幕像素比。
- Blob 支持有限；文件与网络二进制处理优先使用 `ArrayBuffer`。XHR 发送二进制也只能用 `ArrayBuffer`。
- macOS 上密码字段值可能无法读取；如遇到该问题，可在 focus 时临时切到 `type="text"`，blur 时切回 `type="password"`。
- 从 Spectrum UXP 控件触发文件选择器可能造成无限 click 事件；必要时加防重入逻辑或使用原生 HTML 控件。
- `keypress` 当前不支持；键盘逻辑应使用 `keydown` / `keyup`。
- `uxpshowpanel` / `uxphidepanel` 存在已知问题：show 可能只触发一次，hide 可能不触发。
- `require("uxp").entrypoints.setup()` 应在插件启动时尽早调用；延迟调用可能触发无法捕获的错误。
- Windows 上从插件数据目录外复制文件到数据目录可能失败；优先使用当前项目已有的临时文件写入方式，并在 Photoshop 中实测。
- 调试器中暴露的私有字段或方法不得使用，依赖私有 API 的插件可能被拒审且容易在后续版本损坏。

## 手动冒烟测试清单

修改 UI 或生成流程后，至少按影响范围验证以下项目：

- UXP Developer Tool Reload 后面板能打开，无脚本报错。
- 首页和设置页能正常切换。
- 保存代理地址、模型名、API Key 后提示正常，Reload 后配置仍在。
- 尺寸选择正常：选区、自定义、1024×1024、1920×1080。
- 自定义尺寸会按比例缩放到最长边不超过限制，并规范为 16 的倍数。
- 不携带 PS 画面时能调用图片生成接口。
- 勾选“携带 PS 画面”时能调用图片编辑接口。
- 生成中按钮变为“终止”，点击能中断请求。
- 生成成功后图片预览、发送到 PS、参考优化输入词展示和点击复制正常。
- 日志自动滚动、复制日志、清空日志正常。
- 侧边栏 hover 控制按钮、点击收起/展开和动画正常。

## Git 与文件安全

- 不要主动提交、推送、重置、清理或删除用户未要求处理的文件。
- 看到用户或工具修改过的文件时，不要回退，除非用户明确要求。
- 修改前后注意当前仓库可能已有未提交改动，避免覆盖用户工作。
