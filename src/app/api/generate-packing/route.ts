import { NextRequest, NextResponse } from "next/server";
import { streamAI } from "@/lib/ai";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  TravelRequestSchema,
  buildFallbackPacking,
  companionLabels,
  formatActivities,
  getTripDays,
  hasTravelDates,
  paceLabels,
  validatePackingText,
  type PackingData,
} from "@/lib/travel";
import { getWeatherContext } from "@/lib/weather";

export const runtime = "nodejs";
export const maxDuration = 60;

function validationError(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message || "请求参数无效";
}

export async function POST(request: NextRequest) {
  const accessCode = request.headers.get("x-access-code");
  const expectedCode = process.env.APP_ACCESS_CODE || "521026";
  if (accessCode !== expectedCode) {
    return NextResponse.json(
      { error: "访问密钥无效，请输入正确的开屏密码 (521026) 以解锁使用 API" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsedRequest = TravelRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: validationError(parsedRequest.error) },
      { status: 400 }
    );
  }

  const trip = parsedRequest.data;
  const rateLimit = checkRateLimit(`packing:${getClientIp(request.headers)}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const weather = await getWeatherContext(trip);
  const days = getTripDays(trip.startDate, trip.endDate);
  const dateText = hasTravelDates(trip)
    ? `${trip.startDate} 至 ${trip.endDate}`
    : `未指定（按 ${days} 天灵活行程规划）`;

  const systemPrompt = `你是一位谨慎的旅行装备顾问。请依据旅行天数、活动类型、同行方式和已提供的天气数据生成清单。

必须直接返回纯 JSON，不得输出 Markdown、代码围栏或任何 JSON 之外的文字。JSON 结构必须严格如下：
{
  "climate": "气候与穿衣逻辑说明",
  "categories": [
    {
      "name": "分类名称",
      "icon": "clothing/footwear/toiletry/electronics/documents/medicine/other",
      "items": [
        { "name": "带数量的物品名称", "essential": true, "note": "可选补充说明" }
      ]
    }
  ],
  "tips": ["打包贴士"]
}

硬性要求：
- 分类至少包含衣物、鞋履、洗漱用品、电子设备、证件文件、常备药品、其他。
- 根据 ${days} 天给出合理数量，避免让用户每天都携带一整套全新外衣。
- 徒步、游泳、亲子或商务场景必须补充相应装备。
- 处方药、航空液体、移动电源等只给风险提醒，不替代承运方或医生规定。
- 如果天气数据不可靠，明确提醒出发前复核，不得编造精确降水概率。`;

  const userPrompt = `请生成行李清单：
- 目的地：${trip.destination}
- 日期：${dateText}
- 行程天数：${days} 天
- 旅行节奏：${paceLabels[trip.pace]}
- 同行方式：${companionLabels[trip.companions]}
- 活动偏好：${formatActivities(trip.activities)}
- 气象数据：${weather.summary}`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      let fullText = "";
      try {
        if (trip.aiProvider === "offline") {
          const result = buildFallbackPacking(trip);
          send({
            result: {
              ...result,
              dataSource: "fallback",
              dataNotice: "已使用 0 延迟离线精选行李模板为您生成清单。",
            },
            source: "fallback",
            warning: undefined,
          });
          return;
        }

        for await (const chunk of streamAI(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          request.headers,
          trip.aiProvider
        )) {
          fullText += chunk;
          send({ content: chunk });
        }

        const validated = validatePackingText(fullText);
        const result: PackingData = validated
          ? {
              ...validated,
              dataSource: "ai",
              dataNotice:
                weather.source === "forecast"
                  ? "已使用短期天气预报辅助生成；出发前仍应复核天气和承运方限制。"
                  : hasTravelDates(trip)
                    ? "未取得可靠短期天气；出发前应复核天气和承运方限制。"
                    : `未指定旅行日期，清单按 ${days} 天通用行程生成；确定日期后请根据天气调整装备。`,
            }
          : buildFallbackPacking(trip);

        send({
          result,
          source: result.dataSource,
          warning: validated ? undefined : "模型返回结构异常，已切换到稳定的离线行李模板。",
        });
      } catch (error) {
        console.error("API Route generate-packing error:", error);
        const result = buildFallbackPacking(trip);
        send({
          result,
          source: "fallback",
          warning: "AI 服务暂不可用，已为您自动提供实用离线行李模板。",
        });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    },
  });
}
