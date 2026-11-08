# MathNote

手写数学笔记 + 圈选即问 AI。

**当前状态：可用原型。** 手写、PDF 作业批注、圈选/框选发图、流式 AI 对话、文档保存都已打通。

详细设计与技术决策见 [PLAN.md](./PLAN.md)。

## 功能

**手写**

- 压感笔 / 固定线宽圆珠笔 / 强压感钢笔，Catmull-Rom 重采样 + 变宽轮廓渲染
- 固定宽度、平口矩形荧光笔，单击显示竖直笔尖而非圆点
- `pointerrawupdate` + `getCoalescedEvents()`，不丢中间采样点
- 实时落笔增量渲染，抬笔整笔高质量重绘
- 笔刷 / 荧光笔 / 笔画橡皮 / 矩形框选 / 自由套索
- 每种笔型独立记忆颜色与粗细，点击工具弹出设置浮层；橡皮可调半径
- 数位笔橡皮端自动临时擦除，笔杆侧键可在橡皮浮层里开关
- 撤销、清空、适应宽度缩放
- `Ctrl/⌘ + 滚轮`以鼠标位置为锚点缩放
- 自绘标题栏 + Window Controls Overlay：窗口按钮交给桌面环境，圆角由客户端装饰负责
- 左右侧栏、AI 面板和弹窗带展开 / 收起动画，可在设置里一键关闭

**PDF 作业**

- 导入 PDF，保留原始宽高比和矢量清晰度（pdf.js 按显示倍率重渲染）
- 页面缩略图缓存，写笔迹时不重复渲染 PDF
- 空白页和 PDF 页可混在同一份笔记里

**选区 → AI**

- 矩形框选或自由套索，选中即自动附加到 AI 输入框
- 选区按 2~4× 倍率**矢量重绘**，不是屏幕截图；PDF 题干和手写笔迹一起合成
- 套索按多边形裁剪，不会把框外的印刷内容带进去

**AI 面板**

- Markdown + KaTeX 渲染，流式输出，可停止、复制原文
- 自动兼容模型混用的 `\(...\)` / `\[...\]` / `$...$` / `$$...$$` 定界符，并展开成正确的 display block
- 提示词预设、图片缩略图管理、面板最大化
- 供应商预设：DeepSeek（默认）、OpenCode Go、OpenAI、Anthropic、Kimi、智谱 GLM、通义千问、硅基流动、火山方舟、百度千帆、腾讯混元、MiniMax、阶跃星辰、零一万物、魔搭、OpenRouter、Gemini、xAI、Mistral、Groq、Together、Ollama、LM Studio、自定义
- OpenAI 兼容协议（DeepSeek / Kimi / 本地 vLLM / Ollama 等）+ Anthropic
- API 请求全部在主进程发出，密钥优先用系统密钥链加密保存

**笔记库**

- 启动进入笔记库，可新建或打开最近编辑的 `.mnote`
- 新建时选择竖版 / 横版 / 无边画布
- 最近列表记录名称、页数、方向、最近编辑时间，可单独移除
- 返回笔记库时若有未保存修改，会提示保存 / 不保存 / 取消

**页面与画布**

- 页面像 PDF 一样连续垂直滚动，滚动到哪一页就自动切换到哪一页书写
- 页面底部有「＋ 添加页面」按钮，点击直接在当前文档末尾追加一页
- 非活动页用静态预览渲染，只渲染视口附近的页面，避免整本笔记栅格化
- 无边模式使用视口相机：滚轮平移、Ctrl+滚轮以光标为中心缩放，笔迹坐标不设边界

**外观与笔刷**

- 主题色可自定义，应用到按钮、选中态、链接和 AI 面板强调色，并持久化
- 每支笔独立记忆颜色、粗细和三点压感曲线
- 压感曲线可在笔刷浮层里拖拽控制点，曲线随笔画保存，旧笔记仍按原 gamma 渲染

**文档**

- `.mnote` = zip（`doc.json` + 原始 PDF），笔迹是矢量数据，不是位图
- 文档记录纸张方向和当前页
- 新建 / 打开 / 保存 / 另存为，未保存标记，关窗口前原生确认

## 运行

```bash
npm install
# Electron 二进制如果因为网络没装上：
node node_modules/electron/install.js

npm run dev        # Vite + Electron
npm run typecheck
npm run build
npm start          # 生产模式（需先 build）
npm run test:ai    # 本地 mock SSE，验证两种 AI 协议
npm run test:latex # 验证公式定界符归一化
npm run test:ink   # 验证笔刷压感与荧光笔形状
```

`test-assets/sample-homework.pdf` 是两页的测试作业，可直接拖进「导入 PDF」。

## 快捷键

| 键 | 动作 |
|---|---|
| `P` / `B` / `F` | 压感笔 / 圆珠笔 / 钢笔 |
| `H` / `E` | 荧光笔 / 橡皮 |
| `S` / `L` | 矩形框选 / 套索 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+滚轮` | 以鼠标位置为中心缩放 |
| `Ctrl+N` / `Ctrl+O` / `Ctrl+S` | 新建 / 打开 / 保存 |
| `Ctrl+Shift+S` | 另存为 |

## AI 配置

右上角齿轮 → 选供应商，Base URL / 模型会自动填好，再填 API Key。

- 预设覆盖 OpenAI、Anthropic、DeepSeek（默认）、OpenCode Go、Kimi、智谱 GLM、通义千问、硅基流动、火山方舟、百度千帆、腾讯混元、MiniMax、阶跃星辰、零一万物、魔搭、OpenRouter、Gemini、xAI、Mistral、Groq、Together、Ollama、LM Studio、自定义。
- **必须使用支持图片输入的多模态模型**，否则看不懂手写截图；设置里会标出每个预设的视觉能力。
- DeepSeek 官方 API 的图片支持随版本变化，发截图报错时改用 OpenCode Go / OpenRouter / 硅基流动里的 VL 模型。
- OpenCode Go 使用 `https://opencode.ai/inference/go/openai/v1`，应用会自动附带 `x-opencode-session` 会话头与 MathNote 的 User-Agent。
- Ollama 等本地服务可以留空 API Key。

## 打包 pacman

```bash
npm run package:pacman
# 产物：packaging/mathnote-0.1.0-1-x86_64.pkg.tar.zst
sudo pacman -U packaging/mathnote-0.1.0-1-x86_64.pkg.tar.zst
```

包依赖系统的 `electron44`（Arch extra 仓库），因此安装包只有约 1.5 MB，不重复打包 Chromium。
需要 `makepkg`、`fakeroot` 和 `rsvg-convert` 或 ImageMagick 来构建图标。

## 目录

```
android/         原生 Android：Material 3、MotionEvent 压感、C++ 共享笔迹内核
electron/        主进程：窗口、文件、设置、AI 流式请求
packaging/       PKGBUILD、桌面入口、图标、pacman 打包
scripts/         dev 启动器、AI 协议测试、pacman 打包脚本
src/
  ink/           手写引擎：指针事件、压感、轮廓渲染、选区
  ui/            React 界面：标题栏、工具条、页面栏、AI 面板
  providers.ts   供应商预设
  pdf.ts         pdf.js 加载与区域渲染
  pageRender.ts  PDF 背景 + 笔迹的统一合成
  document.ts    .mnote 打包/解包
  App.tsx        文档、页面、选区、快捷键接线
```

## 已知限制 / 下一步

- 对话内容暂未随 `.mnote` 保存
- 还没有文字工具、图层、PDF 导出
- 标题栏内容自绘，最小化/最大化/关闭由桌面环境通过 Window Controls Overlay 绘制
- 自研 ink 的手感仍在调，M0 的延迟 HUD 可在标题栏用虫子图标打开
