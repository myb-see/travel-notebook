import { NextResponse } from "next/server";
import { isProviderConfigured } from "@/lib/ai";
import { DEFAULT_AI_PROVIDER } from "@/lib/travel";

export const dynamic = "force-dynamic";

export function GET() {
  const geminiConfigured = isProviderConfigured("gemini");
  const glmConfigured = isProviderConfigured("glm");
  const legacyConfigured = Boolean(process.env.AI_API_KEY);

  return NextResponse.json(
    {
      ok: true,
      aiProviders: {
        gemini: geminiConfigured,
        glm: glmConfigured,
      },
      defaultAIProvider: DEFAULT_AI_PROVIDER,
      cozeRuntimeFallback: !geminiConfigured && !glmConfigured && !legacyConfigured,
      persistentSharing: Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
