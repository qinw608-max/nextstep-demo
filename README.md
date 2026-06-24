# 下一步 — 对话与画布双向同步

## 产品定位
外挂插件 — 不替换 Agent，不改变对话习惯，嵌在对话窗口旁边。
解决长对话执行中的上下文丢失：任务、资料、提问、Agent 回复和完成结果都能回到对应节点。

## 项目结构
```
next-step-eliminator/
├── docs/                    # 产品文档
│   ├── PRODUCT_SPEC.md      # 产品规格
│   ├── DESIGN_DOC.md        # 设计文档
│   └── DESIGN_PHILOSOPHY.md # 设计哲学
├── demo/                    # 比赛展示页（HTML demo）
│   ├── index.html           # 产品页
│   ├── logo.html            # Logo 动画
│   ├── demo-scan.html       # 01 资产扫描
│   ├── demo-sync.html       # 02 双向同步
│   ├── demo-edit.html       # 03 节点即画布
│   ├── demo-live-edit.html  # 04 Agent 实时编辑
│   ├── demo-annotate.html   # 05 批注工具
│   ├── demo-agent.html      # 06 Agent 协作
│   ├── demo-collapse.html   # 07 抽屉收归
│   ├── demo-template.html   # 08 模板沉淀
│   └── assets/              # 图片素材
│       ├── character-lin.jpg
│       ├── character-zhao.jpg
│       └── world-map.jpg
└── README.md                # 本文件
```

## 在线体验
https://qinw608-max.github.io/nextstep-demo/

## 状态
- [x] 创意提案
- [x] 8 个可交互 Demo
- [x] 产品展示页
- [x] GitHub Pages 部署
- [ ] 完整产品开发
