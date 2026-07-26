import { NextRequest, NextResponse } from "next/server";
import { SharedTripSchema } from "@/lib/share";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 15;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json(
      { error: "未配置持久化分享服务", persistentSharing: false },
      { status: 503 }
    );
  }

  const rateLimit = checkRateLimit(`share:${getClientIp(request.headers)}`, 20, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "分享创建过于频繁" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = SharedTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "攻略数据结构无效" }, { status: 400 });
  }

  const serialized = JSON.stringify(parsed.data);
  if (serialized.length > 120_000) {
    return NextResponse.json({ error: "攻略内容过大，无法创建分享" }, { status: 413 });
  }

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const response = await fetch(`${config.url}/rest/v1/travel_shares`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ id, payload: parsed.data, expires_at: expiresAt }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: `分享服务写入失败：${detail.slice(0, 160)}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ id, expiresAt }, { status: 201 });
}
