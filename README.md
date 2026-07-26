# 旅途手帐

基于 Next.js 16 的 AI 旅行攻略与个性化行李建议应用。输入目的地和旅行偏好，或让系统随机抽取目的地，即可生成分日攻略与可勾选行李清单；旅行日期为可选项。

## 已实现

- 日期可选；未选择时按 3 天灵活行程生成，选择时支持 1–14 天并拦截非法或反向日期
- 随机目的地攻略入口，覆盖国内外城市、自然与海岛目的地
- 旅行节奏、同行方式、活动偏好进入攻略与行李生成逻辑
- OpenAI 兼容接口与扣子运行环境双模式
- SSE 流式生成、Zod 结构校验、超时控制和离线降级模板
- Open-Meteo 短期天气上下文；未选日期或超出预报窗口时明确降级
- 收藏即时同步与旧版收藏迁移
- 行李勾选进度按行程持久化
- 系统分享、内嵌分享链接，以及可选 Supabase 短链接
- 基础请求限流、移动端适配和无障碍标签

## 本地运行

要求：Node.js 20.9+、pnpm 9+。

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

浏览器访问 `http://localhost:3000`。

至少需要配置：

```env
AI_API_KEY=你的接口密钥
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_MODEL=你的模型或推理接入点 ID
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

未配置或 AI 调用失败时，应用仍会返回通用降级攻略与行李模板。

## 校验与构建

```bash
pnpm validate
pnpm build
pnpm start
```

## 部署

目标域名建议使用：`travel.20041026.xyz`。

完整步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 可选：Supabase 短分享链接

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/migrations/001_travel_shares.sql`。
3. 在服务端环境变量配置：

```env
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=仅服务端使用的密钥
```

不要给密钥增加 `NEXT_PUBLIC_` 前缀，也不要提交到 Git。

不配置 Supabase 时，分享功能会自动使用 URL 内嵌数据；内容过长时退化为文本复制。

## 数据边界

- 短期天气来自 Open-Meteo；未选日期或远期日期仅提供季节性规划提醒。
- 景点开放、票务、交通和餐厅信息仍可能变化，界面会要求用户通过官方渠道复核。
- 当前限流是单实例内存实现，适合 MVP。公开流量较大时应换成 Vercel Firewall、Upstash Redis 或其他分布式限流。
- 收藏与打包进度保存在当前浏览器；账户同步尚未实现。
