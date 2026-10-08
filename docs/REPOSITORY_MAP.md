# 仓库地图与维护说明

适用仓库：`qinw608-max/nextstep-demo`。结构核对基线：
[`ee4f357`](https://github.com/qinw608-max/nextstep-demo/tree/ee4f357e34bf0acd0df40776c3e698f181c57275)，2026-10-08。

## 从哪里开始

| 需要处理的内容 | 文件或目录 | 职责 |
| --- | --- | --- |
| 项目定位、体验入口、运行方法 | [README](../README.md) | 维护入口与当前仓库范围 |
| 展示首页 | [index.html](../index.html) | 品牌展示、八张场景预览、进入交互演示 |
| 八场景切换 | [interactive.html](../interactive.html) | `data-proof-file` 按钮切换同源 `proof-frame` |
| 首页视觉与响应式 | [nextstep.css](../nextstep.css) | 布局、背景、移动端与省流资源 |
| 首页动效与导航 | [nextstep.js](../nextstep.js) | WebGL、GSAP、来源参数、返回转场 |
| 字体加载 | [font-loader.js](../font-loader.js) | 首页 Google Fonts 加载与降级 |
| 图标与 Logo 试作 | [favicon.svg](../favicon.svg)、[logo.html](../logo.html) | 站点图标；交互页页脚仍引用 Logo 试作 |
| 展示图片 | [assets/projects/nextstep](../assets/projects/nextstep/) | 场景截图和背景变体 |
| 第三方动效代码 | [assets/vendor/gsap](../assets/vendor/gsap/) | 本地 GSAP / ScrollTrigger，保留版本与版权头 |
| 历史产品设想 | [PRODUCT_SPEC](PRODUCT_SPEC.md) | 2026-06-24 的设计与进度记录 |
| 静态检查 | [check_site.py](../scripts/check_site.py) | 页面、资源、锚点、双基址和 JavaScript 语法检查 |
| 接手约定 | [AGENTS](../AGENTS.md) | 修改范围、检查命令与提交约定 |

这是一套直接运行的 HTML / CSS / JavaScript 展示文件。各演示保留内联样式与脚本；现有文件组织本身不要求构建工具或框架迁移。

## 八项演示与稳定入口

以下地址保留在仓库根目录。修改文件名或移动页面会影响现有分享地址、场景切换与嵌入。

| 顺序 | 场景 | 页面 |
| --- | --- | --- |
| 01 | 全局资产扫描 | [demo-scan.html](../demo-scan.html) |
| 02 | 双向同步 | [demo-sync.html](../demo-sync.html) |
| 03 | 节点资料容器 / 嵌套画布 | [demo-edit.html](../demo-edit.html) |
| 04 | Agent 实时编辑 | [demo-live-edit.html](../demo-live-edit.html) |
| 05 | 上下文批注 | [demo-annotate.html](../demo-annotate.html) |
| 06 | Agent 协作 | [demo-agent.html](../demo-agent.html) |
| 07 | 抽屉收归 | [demo-collapse.html](../demo-collapse.html) |
| 08 | 模板沉淀 | [demo-template.html](../demo-template.html) |

`interactive.html` 的当前入口是页面内的八个场景按钮。文件还保留隐藏 modal 和 `[data-demo]` 绑定，但当前标记中没有对应按钮；不要把这条保留逻辑当作已经接线、验收的功能，也不要在文档整理中顺手删除。

### 演示能力的边界

- 场景中的文件、Agent、同步和写入用于演示交互，不能据此认定浏览器已经获得本机文件访问或桌面应用能力。
- `demo-agent.html` 的 `answerFor()` 根据关键词返回预设内容，`askAgent()` 使用延时模拟回答；这条路径没有真实模型请求。
- `demo-annotate.html` 使用 `localStorage` 的 `nextstep.demo.annotations.v2` 保存批注。其余七个演示没有相同的持久化实现，不能把这一能力推广到全部演示。
- 首页和旧规格中的完整产品进度是项目介绍；桌面应用、MCP 与真实 Agent 集成需要在对应实现中独立验证。

## 资源登记

| 资源 | 当前引用 | 维护方式 |
| --- | --- | --- |
| `assets/projects/nextstep/corridor/01-…08-*.png` | `index.html` 的八个预览卡片 | 保持八张图及现有路径 |
| `signal-field.webp`、`grain-texture.webp` | `nextstep.css` 桌面背景 | 保留 |
| `signal-field-mobile.webp`、`signal-field-mobile-hq.webp`、`signal-field-mobile-portrait.webp`、`grain-texture-mobile.webp` | `nextstep.css` 的移动端 / 省流条件 | 各有明确引用，不按名称去重 |
| `assets/vendor/gsap/gsap.min.js`、`ScrollTrigger.min.js` | 首页、交互页 | 当前文件头标注 3.15.0；不在整理中升级或改写 |
| `assets/character-lin.jpg` | 基线全部文本源码未发现文件名或完整路径引用 | 保留待查 |
| `assets/character-zhao.jpg` | 同上 | 保留待查 |
| `assets/world-map.jpg` | 同上 | 保留待查 |

三张 JPG 合计 933,224 字节。“未发现仓库内静态引用”不能排除外部直链、历史分享或素材用途，不能直接作为删除依据。静态检查器负责引用存在性，不负责判断素材是否可以删除。

页面还使用 Google Fonts。外部字体是否可达取决于网络环境；静态检查不访问网络、不证明外部服务可用。站点公开可见也不等于素材或第三方代码已经获得重新授权。

## 运行与检查

预览需要 Python 3。在仓库根目录运行：

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8000/`。在 Windows 上可将 `python3` 换为 `py -3`。

检查需要 Python 3 和 PATH 中的 Node.js，不需要 `npm install`：

```bash
python3 scripts/check_site.py
git diff --check
```

检查器以 `/` 和 `/nextstep-demo/` 两种部署基址解析本地页面与资源，忽略 URL 查询参数对文件定位的影响，并核对可解析的 HTML 锚点。它也检查八个场景入口与 JavaScript 语法；语法检查只解析脚本，不执行页面。以脚本实际输出为检查结果，退出码非零时先处理报错。

这不是完整 JavaScript 路径分析或浏览器验收。计算出来的 URL、外部链接、字体下载、WebGL、动效与操作行为仍需运行检查。

需要验证子目录服务时，在仓库的父目录运行：

```bash
python3 -m http.server 8001 --bind 127.0.0.1
```

仓库文件夹名称为 `nextstep-demo` 时，打开 `http://127.0.0.1:8001/nextstep-demo/`。这里只供本机预览，服务结束后按 Ctrl+C 关闭。

### 已有导航行为

`nextstep.js` 在 `localhost` 或 `127.0.0.1` 下会请求 `127.0.0.1:4182`；端口有响应时，演示入口可能改为 `http://localhost:4182/`。使用 8000 预览不会关闭这段探测。排查本地入口时检查实际链接，必要时直接打开同目录的 `interactive.html`，不要把已有跳转误判为文档整理引入的问题。

首页和交互页还保留作品站来源参数、返回地址及右键 / 键盘返回监听。它们与个人站转场相关；变更应单独评估并覆盖编辑框、iframe、返回按钮和浏览器历史。

## 下一批维护事项

| 优先级 | 具体事项 | 完成依据 |
| --- | --- | --- |
| P1 | 梳理本地 4182 探测及作品站导航 | 独立打开与作品站进入两种方式都可用，编辑和返回操作无误跳转 |
| P1 | 明确隐藏 modal 的保留用途 | 确认当前入口与历史兼容需求后，再决定接回或退役 |
| P2 | 核对三张历史 JPG 的外部用途 | 有逐文件证据且在用户明确授权范围内再决定去留 |
| P2 | 补充素材来源和许可记录 | 使用实际来源记录，不擅自添加开源许可 |

未来变更页面行为时，至少覆盖桌面与窄屏的首页、交互总览、八个场景按钮及对应操作；记录根路径和子目录下的资源错误、控制台异常与已知基线问题。静态检查通过不能替代这些记录。
