# NextStep

NextStep 是位于 Agent 工具旁边的本地执行画布，让长任务的过程可见、可追踪、可沉淀。

它不替换 Agent，也不把执行过程简化成一条对话流。任务、文件、决定、批注和 Agent 写入都可以回到对应节点，最终收归为可复用的工作结构。

## 在线体验

- [项目展示](https://qinw608-max.github.io/nextstep-demo/)
- [8 项交互演示](https://qinw608-max.github.io/nextstep-demo/interactive.html?from=github-pages#scenarios)
- [SUOLUO 个人网站中的项目页](https://suoluo-portfolio-d6e969w8ce60141-1415753242.tcloudbaseapp.com/nextstep.html?from=world&transition=logo-lockup#overview)

## 当前状态

- 已完成：嵌套画布、文件节点、搜索定位、批注、流式写入与本地保存的可操作原型。
- 可体验：8 项核心交互场景。
- 开发中：正式 Agent 适配、diff / 历史 / 恢复、安装与公开发行。

本仓库用于公开项目展示与交互原型，不代表最终产品版本。

## 本仓库的运行范围

上方保留项目介绍与进度摘要；这个仓库直接提供的是静态展示和八项浏览器交互原型。`demo-agent.html` 使用预设规则模拟回答；批注演示使用浏览器本地存储。桌面应用、MCP 和真实 Agent 能力应在对应实现中另行验证。

## 本地预览

需要 Python 3，无须安装 npm 依赖或构建。进入仓库目录后运行：

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8000/`，或直接打开 `http://127.0.0.1:8000/interactive.html`。Windows 可将 `python3` 换为 `py -3`。当前首页仍有 4182 本地服务探测；其入口影响见维护说明。

## 维护导航

- [仓库地图、八项演示入口与资源登记](docs/REPOSITORY_MAP.md)
- [维护约定](AGENTS.md)
- [历史产品规格（2026-06-24）](docs/PRODUCT_SPEC.md)

静态检查需要 Python 3 和 PATH 中的 Node.js，检查过程不联网、不执行页面代码：

```bash
python3 scripts/check_site.py
```

检查本地资源、静态锚点、八个演示入口、根目录 / 子目录路径以及 JavaScript 语法；运行方式和未覆盖范围见[仓库地图](docs/REPOSITORY_MAP.md#运行与检查)。
