import { NextRequest, NextResponse } from "next/server";
import { SharedTripSchema } from "@/lib/share";

export const runtime = "nodejs";
export const maxDuration = 15;

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!idPattern.test(id)) {
    return NextResponse.json({ error: "分享 ID 无效" }, { status: 400 });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "未配置持久化分享服务" }, { status: 503 });
  }

  const query = new URL(`${config.url}/rest/v1/travel_shares`);
  query.searchParams.set("id", `eq.${id}`);
  query.searchParams.set("select", "payload,expires_at");
  query.searchParams.set("limit", "1");

  const response = await fetch(query, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ error: "分享内容读取失败" }, { status: 502 });
  }

  const rows = (await response.json()) as Array<{ payload: unknown; expires_at: string }>;
  const row = rows[0];
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "分享不存在或已过期" }, { status: 404 });
  }

  const parsed = SharedTripSchema.safeParse(row.payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "分享内容已损坏" }, { status: 500 });
  }

  return NextResponse.json({ trip: parsed.data, expiresAt: row.expires_at });
}
