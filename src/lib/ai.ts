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

  // Provider-specific env vars take priority; fall back to legacy AI_API_KEY.
  if (apiKey) {
    let model = process.env[env.model] || env.defaultModel;
    if (provider === "gemini" && (model.includes("2.0") || !model)) {
      model = "gemini-3.5-flash";
    }
    if (provider === "glm" && (!process.env.GLM_MODEL || model === "glm-4.7-flash")) {
      model = "glm-4-flash";
    }

    return {
      apiKey,
      baseURL: (process.env[env.baseURL] || env.defaultURL).replace(/\/$/, ""),
      model,
      source: provider,
    };
  }

  // Legacy single-provider configuration.
  if (process.env.AI_API_KEY) {
    return {
      apiKey: process.env.AI_API_KEY,
      baseURL: (process.env.AI_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/, ""),
      model: process.env.AI_MODEL || "doubao-seed-2-0-lite-260215",
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 48_000);

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
        temperature: 0.55,
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

    const parseLine = (rawLine: string): string | null => {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) return null;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") return null;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        return parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? null;
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
        const content = parseLine(rawLine);
        if (content) yield content;
      }
    }

    if (buffer.trim()) {
      const content = parseLine(buffer);
      if (content) yield content;
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
    temperature: 0.55,
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
    yield* streamOpenAICompatible(messages, config);
    return;
  }

  yield* streamCoze(messages, headers);
}
