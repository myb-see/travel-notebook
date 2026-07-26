# AGENTS.md

## 项目概览

旅途手帐 — AI 驱动的智能旅行攻略与行李建议网页应用。用户输入目的地和旅行时间，AI 自动生成景点推荐、行程规划、美食建议及个性化行李清单。

### 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS 4
- **AI**: coze-coding-dev-sdk (doubao-seed-2-0-pro-260215)

## 目录结构

```
src/
├── app/
│   ├── api/
│   │   ├── generate-guide/route.ts   # 旅行攻略生成 (SSE 流式)
│   │   └── generate-packing/route.ts # 行李建议生成 (SSE 流式)
│   ├── globals.css                   # 全局样式 + 旅行主题配色
│   ├── layout.tsx                    # 根布局
│   └── page.tsx                      # 主页面（表单 + 结果展示）
├── components/
│   ├── travel/
│   │   ├── travel-form.tsx           # 旅行输入表单
│   │   ├── guide-display.tsx         # 攻略展示（景点/行程/美食/贴士）
│   │   ├── packing-display.tsx       # 行李清单展示（可勾选打包进度）
│   │   └── favorites-panel.tsx       # 收藏夹侧边栏
│   └── ui/                           # shadcn/ui 组件库
└── lib/utils.ts                      # 工具函数
```

## 构建与测试命令

- 开发: `pnpm dev`
- 构建: `pnpm build`
- 类型检查: `pnpm ts-check`
- Lint: `pnpm lint --quiet`
- 生产启动: `pnpm start`

## API 接口

### POST /api/generate-guide
- 请求体: `{ destination, startDate, endDate }`
- 响应: SSE 流式返回 JSON 格式旅行攻略

### POST /api/generate-packing
- 请求体: `{ destination, startDate, endDate, activities }`
- 响应: SSE 流式返回 JSON 格式行李建议

## 编码规范

- TypeScript strict 模式，禁止隐式 any
- 前端流式消费使用 `fetch` + `ReadableStream` + `getReader()`
- 收藏数据存储在 localStorage
- 分享功能优先使用 Web Share API，降级为剪贴板复制
- 颜色使用 CSS 变量 (travel-sand/travel-blue/travel-orange) 保持设计一致性
