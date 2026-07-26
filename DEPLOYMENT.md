# 部署到 travel.20041026.xyz

推荐方案：GitHub + Vercel。Next.js API Route、流式响应和自定义域名均可直接使用。

## 1. 推送到 GitHub

```bash
git init
git add .
git commit -m "feat: production-ready travel notebook"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

## 2. 导入 Vercel

1. 登录 Vercel，选择 **Add New → Project**。
2. 导入 GitHub 仓库。
3. Framework Preset 保持 **Next.js**。
4. Root Directory 保持仓库根目录。
5. Build Command 使用 `pnpm build`；通常自动识别，无需手工修改。
6. 点击部署。

## 3. 配置生产环境变量

进入 **Project → Settings → Environment Variables**，配置双 AI 接口：

| 名称 | 示例 | 作用 |
|---|---|---|
| `GEMINI_API_KEY` | `***` | Google Gemini API 密钥 |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | Gemini OpenAI 兼容接口 |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini 模型 ID |
| `GLM_API_KEY` | `***` | 智谱 GLM API 密钥 |
| `GLM_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4` | 智谱 OpenAI 兼容接口 |
| `GLM_MODEL` | `glm-4-flash` | GLM 模型 ID |
| `NEXT_PUBLIC_SITE_URL` | `https://travel.20041026.xyz` | 元数据与正式站点地址 |

> **安全提示**：不要使用 `NEXT_PUBLIC_` 前缀的 API Key 变量，否则密钥会暴露给浏览器。

旧版单接口兼容（可选，未配置 Gemini/GLM 时回退使用）：

| 名称 | 示例 | 作用 |
|---|---|---|
| `AI_API_KEY` | `***` | OpenAI 兼容接口密钥 |
| `AI_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3` | 接口根地址 |
| `AI_MODEL` | 推理接入点或模型 ID | 使用的模型 |

可选添加：

| 名称 | 作用 |
|---|---|
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端读写分享表；严禁暴露给浏览器 |

变量添加后重新部署一次，使生产部署读取新配置。

## 4. 添加子域名

在 Vercel 项目中进入 **Settings → Domains**，输入：

```text
travel.20041026.xyz
```

Vercel 会显示该项目需要的 DNS 记录。子域名通常是：

- 类型：`CNAME`
- 主机记录：`travel`
- 记录值：**以 Vercel 当前页面显示的项目专属 CNAME 为准**

不要凭旧教程固定填写某个通用值，因为 Vercel 项目可能提供唯一 CNAME。

## 5. 在域名 DNS 服务商添加记录

登录 `20041026.xyz` 当前使用的 DNS 服务商，在 DNS 解析中新增：

```text
Type:  CNAME
Name:  travel
Value: <Vercel Domains 页面给出的值>
TTL:   Auto 或默认
```

如果已有同名 `travel` 的 A、AAAA 或 CNAME 记录，先删除冲突记录。

保存后回到 Vercel Domains 页面点击刷新或验证。DNS 生效后，Vercel 会自动签发 HTTPS 证书。

## 6. 验收

依次检查：

```text
https://travel.20041026.xyz
https://travel.20041026.xyz/api/health
```

健康接口应返回类似：

```json
{
  "ok": true,
  "aiProviders": {
    "gemini": true,
    "glm": true
  },
  "defaultAIProvider": "gemini",
  "cozeRuntimeFallback": false,
  "persistentSharing": false
}
```

随后测试：

1. 同日、反向日期和超过 14 天是否被拦截。
2. 不同活动、节奏、同行方式是否改变攻略。
3. 切换 Gemini / GLM 模型后，攻略是否使用对应接口重新生成。
4. AI 接口失败时是否显示离线降级结果。
5. 收藏后收藏夹是否立即更新。
6. 勾选行李后刷新页面，进度是否保留。
7. 分享链接能否在无痕窗口打开。

## CLI 等价操作

安装并登录 Vercel CLI 后：

```bash
pnpm dlx vercel login
pnpm dlx vercel link
pnpm dlx vercel --prod
pnpm dlx vercel domains add travel.20041026.xyz
pnpm dlx vercel domains inspect travel.20041026.xyz
```

`domains inspect` 会给出准确的 DNS 配置要求。

## 常见问题

### 域名一直显示 Invalid Configuration

- 检查主机记录是否只填 `travel`，而不是重复填写完整域名。
- 检查是否存在同名 A/AAAA/CNAME 冲突。
- 以 Vercel 项目 Domains 页面显示的 CNAME 值为准。
- DNS 传播可能不是即时完成，稍后再次验证。

### 页面能打开，但生成失败

- 检查 `GEMINI_API_KEY`、`GLM_API_KEY`（或旧版 `AI_API_KEY`）是否配置在 Production 环境。
- 在 Vercel Logs 中查看 `/api/generate-guide` 和 `/api/generate-packing`。
- 访问 `/api/health` 确认 `aiProviders` 中哪些接口已配置。
- 即使 AI 失败，页面应返回离线模板；若没有，检查是否部署了最新提交。

### 短分享链接不可用

- 未配置 Supabase 时这是预期行为，应用会自动退化为内嵌链接。
- 若已配置，确认 SQL migration 已执行，并确认 service role key 只放在服务端环境变量中。
