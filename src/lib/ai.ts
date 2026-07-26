import type { AiProvider } from "@/lib/travel";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiConfig {
  apiKey: string | undefined;
  baseURL: string;
  model: string;
  source: "gemini" | "glm" | "legacy" | "coze";
}

const PROVIDER_ENV_MAP: Record<
  AiProvider,
  { apiKey: string; baseURL: string; model: string; defaultURL: string; defaultModel: string }
> = {
  gemini: {
    apiKey: "GEMINI_API_KEY",
    baseURL: "GEMINI_BASE_URL",
    model: "GEMINI_MODEL",
    defaultURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-3.5-flash",
  },
  glm: {
    apiKey: "GLM_API_KEY",
    baseURL: "GLM_BASE_URL",
    model: "GLM_MODEL",
    defaultURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
  },
};

export function getAiConfig(provider: AiProvider): AiConfig {
  const env = PROVIDER_ENV_MAP[provider];
  const apiKey = process.env[env.apiKey];

  // 1. 显式供应商配置（GEMINI_API_KEY 或 GLM_API_KEY）
  if (apiKey) {
    const model = process.env[env.model] || env.defaultModel;
    return {
      apiKey,
      baseURL: (process.env[env.baseURL] || env.defaultURL).replace(/\/$/, ""),
      model,
      source: provider,
    };
  }

  // 2. 通用兼容配置（仅在同时显式提供 AI_API_KEY、AI_BASE_URL、AI_MODEL 时触发）
  if (process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL) {
    return {
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL.replace(/\/$/, ""),
      model: process.env.AI_MODEL,
      source: "legacy",
    };
  }

  return { apiKey: undefined, baseURL: "", model: "", source: "coze" };
}

export function isProviderConfigured(provider: AiProvider): boolean {
  const env = PROVIDER_ENV_MAP[provider];
  return Boolean(process.env[env.apiKey]) || Boolean(process.env.AI_API_KEY);
}

async function* streamOpenAICompatible(
  messages: AIMessage[],
  config: AiConfig
): AsyncGenerator<string> {
  if (!config.apiKey) throw new Error("未配置 AI API Key");

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI 接口返回 ${response.status}: ${body.slice(0, 240)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("AI 接口未返回响应流");

    const decoder = new TextDecoder();
    let buffer = "";

    const parseLine = (
      rawLine: string
    ): { content: string | null; finishReason: string | null } | null => {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) return null;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") return null;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string };
            message?: { content?: string };
            finish_reason?: string | null;
          }>;
        };
        const choice = parsed.choices?.[0];
        const content = choice?.delta?.content ?? choice?.message?.content ?? null;
        const finishReason = choice?.finish_reason ?? null;
        return { content, finishReason };
      } catch {
        return null;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const res = parseLine(rawLine);
        if (res) {
          if (res.finishReason) {
            console.info("AI stream finished", {
              provider: config.source,
              model: config.model,
              finishReason: res.finishReason,
              elapsedMs: Date.now() - startedAt,
            });
          }
          if (res.content) yield res.content;
        }
      }
    }

    if (buffer.trim()) {
      const res = parseLine(buffer);
      if (res) {
        if (res.finishReason) {
          console.info("AI stream finished", {
            provider: config.source,
            model: config.model,
            finishReason: res.finishReason,
            elapsedMs: Date.now() - startedAt,
          });
        }
        if (res.content) yield res.content;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function* streamCoze(messages: AIMessage[], headers: Headers): AsyncGenerator<string> {
  const { LLMClient, Config, HeaderUtils } = await import("coze-coding-dev-sdk");
  const customHeaders = HeaderUtils.extractForwardHeaders(headers);
  const client = new LLMClient(new Config(), customHeaders);
  const stream = client.stream(messages, {
    model: process.env.COZE_AI_MODEL || "doubao-seed-2-0-pro-260215",
    temperature: 0.3,
  });

  for await (const chunk of stream) {
    if (chunk.content) yield chunk.content.toString();
  }
}

export async function* streamAI(
  messages: AIMessage[],
  headers: Headers,
  provider: AiProvider = "gemini"
): AsyncGenerator<string> {
  const config = getAiConfig(provider);

  if (config.apiKey) {
    let emitted = false;
    try {
      for await (const chunk of streamOpenAICompatible(messages, config)) {
        emitted = true;
        yield chunk;
      }
      return;
    } catch (primaryError) {
      // 关键防线：若主 AI 已经开始向客户端吐字（emitted === true），禁止中途追加备用 AI 避免 JSON 拼接损坏！
      if (emitted) {
        console.warn("主 AI 在输出部分内容后中断，终止倒换以防 JSON 拼接破坏", {
          provider,
          primaryError,
        });
        throw primaryError;
      }

      const fallbackProvider: AiProvider = provider === "gemini" ? "glm" : "gemini";
      const fallbackConfig = getAiConfig(fallbackProvider);
      if (
        fallbackConfig.apiKey &&
        (fallbackConfig.baseURL !== config.baseURL || fallbackConfig.model !== config.model)
      ) {
        try {
          for await (const chunk of streamOpenAICompatible(messages, fallbackConfig)) {
            yield chunk;
          }
          return;
        } catch (fallbackError) {
          console.error("主备 AI 均响应失败", {
            primaryProvider: provider,
            fallbackProvider,
            primaryError,
            fallbackError,
          });

          const getMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
          throw new Error(
            `主 AI (${provider}) 失败: ${getMsg(primaryError)} ； 备用 AI (${fallbackProvider}) 失败: ${getMsg(fallbackError)}`
          );
        }
      }
      throw primaryError;
    }
  }

  yield* streamCoze(messages, headers);
}
