import { NextRequest, NextResponse } from "next/server";
import { streamAI } from "@/lib/ai";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  TravelRequestSchema,
  activityLabels,
  buildFallbackGuide,
  companionLabels,
  enrichGuideWithPhotos,
  getTripDays,
  hasTravelDates,
  paceLabels,
  validateGuideText,
  type GuideData,
} from "@/lib/travel";
import { getWeatherContext } from "@/lib/weather";

export const runtime = "nodejs";
export const maxDuration = 60;

function validationError(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message || "请求参数无效";
}

export async function POST(request: NextRequest) {
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
  const rateLimit = checkRateLimit(`guide:${getClientIp(request.headers)}`);
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

  const systemPrompt = `你是一位严谨的资深旅行顾问。你的任务是基于用户偏好和已提供的气象事实，生成可执行但不过度承诺的旅行攻略。

必须直接返回纯 JSON，不得输出 Markdown、代码围栏或任何 JSON 之外的文字。JSON 结构必须严格如下：
{
  "overview": "目的地概览，2-3句话",
  "attractions": [
    { "name": "景点名称", "description": "简要描述", "tips": "游玩贴士", "duration": "建议游玩时长" }
  ],
  "itinerary": [
    { "day": 1, "title": "当日主题", "activities": ["09:00–11:00｜活动", "12:00–13:30｜活动"] }
  ],
  "food": [
    { "name": "美食名称", "description": "特点描述", "recommendation": "推荐区域或选择方法" }
  ],
  "tips": ["实用贴士"]
}

硬性要求：
- attractions 提供 5-8 个，优先按地理邻近性组织。
- itinerary 必须恰好提供 ${days} 天，每天 3-4 个带时段的活动。
- food 提供 5-8 个当地特色美食；不确定具体餐厅时推荐区域，不得编造店名。
- tips 提供 4-6 条，涵盖交通、预约、安全、支付或通信。
- 必须体现旅行节奏、同行方式和活动偏好。
- 不得把天气、营业时间、门票价格写成绝对事实；无法确认时明确建议核实官方渠道。
- 不要声称已经完成预订或实时查询。`;

  const activityDetails = trip.activities.length
    ? trip.activities.map((id) => activityLabels[id]).join("、")
    : "综合体验";
  const userPrompt = `请生成旅行攻略：
- 目的地：${trip.destination}
- 日期：${dateText}
- 规划天数：${days} 天
- 旅行节奏：${paceLabels[trip.pace]}
- 同行方式：${companionLabels[trip.companions]}
- 活动偏好：${activityDetails}
- 气象数据：${weather.summary}

请确保路线不反复跨区，首尾两天结合交通时间适度减量。`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      let fullText = "";
      try {
        if (trip.aiProvider === "offline") {
          const baseFallback = buildFallbackGuide(trip);
          const result = await enrichGuideWithPhotos(baseFallback, trip.destination);
          send({
            result: {
              ...result,
              dataSource: "fallback",
              dataNotice: "已使用 0 延迟离线精选模板为您规划攻略。",
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

        const validated = validateGuideText(fullText, days);
        const baseResult: GuideData = validated
          ? {
              ...validated,
              dataSource: "ai",
              dataNotice:
                weather.source === "forecast"
                  ? "已使用短期天气预报辅助规划；景点开放、票务和交通仍需出发前核实。"
                  : hasTravelDates(trip)
                    ? "未取得可靠短期天气；景点开放、天气、票务和交通需出发前核实。"
                    : `未指定旅行日期，本攻略按 ${days} 天灵活行程生成；确定日期后请复核天气、营业和交通信息。`,
            }
          : buildFallbackGuide(trip);

        const result = await enrichGuideWithPhotos(baseResult, trip.destination);

        send({
          result,
          source: result.dataSource,
          warning: validated ? undefined : "模型返回结构异常，已切换到稳定的离线规划模板。",
        });
      } catch (error) {
        console.error("API Route generate-guide error:", error);
        const baseFallback = buildFallbackGuide(trip);
        const result = await enrichGuideWithPhotos(baseFallback, trip.destination);
        send({
          result,
          source: "fallback",
          warning: "AI 服务暂不可用，已为您自动提供精选离线规划模板。",
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
