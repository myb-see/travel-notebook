import { z } from "zod";

export const activityIds = [
  "sightseeing",
  "hiking",
  "food",
  "shopping",
  "swimming",
  "cultural",
] as const;

export const paceIds = ["relaxed", "balanced", "intensive"] as const;
export const companionIds = ["solo", "couple", "friends", "family", "business"] as const;

export const aiProviderIds = ["gemini", "glm"] as const;
export type AiProvider = (typeof aiProviderIds)[number];

export const aiProviderLabels: Record<AiProvider, string> = {
  gemini: "Google Gemini Flash",
  glm: "智谱 GLM Flash",
};

export const DEFAULT_AI_PROVIDER: AiProvider = "gemini";

export const activityLabels: Record<(typeof activityIds)[number], string> = {
  sightseeing: "观光游览",
  hiking: "徒步登山",
  food: "美食探店",
  shopping: "购物扫货",
  swimming: "海滨游泳",
  cultural: "文化体验",
};

export const paceLabels: Record<(typeof paceIds)[number], string> = {
  relaxed: "轻松慢游",
  balanced: "均衡适中",
  intensive: "充实行程",
};

export const companionLabels: Record<(typeof companionIds)[number], string> = {
  solo: "独自旅行",
  couple: "情侣同行",
  friends: "朋友结伴",
  family: "亲子家庭",
  business: "商务出行",
};

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD")
  .refine((value) => parseDate(value) !== null, "日期无效");

const optionalIsoDateSchema = z.preprocess(
  (value) => (value === undefined || value === null ? "" : value),
  z.union([z.literal(""), isoDateSchema])
);

export const DEFAULT_TRIP_DAYS = 3;

export const TravelRequestSchema = z
  .object({
    destination: z.string().trim().min(1, "请输入旅行目的地").max(80, "目的地过长"),
    startDate: optionalIsoDateSchema,
    endDate: optionalIsoDateSchema,
    activities: z.array(z.enum(activityIds)).max(activityIds.length).default([]),
    pace: z.enum(paceIds).default("balanced"),
    companions: z.enum(companionIds).default("solo"),
    aiProvider: z.enum(aiProviderIds).optional().default(DEFAULT_AI_PROVIDER),
  })
  .superRefine((value, ctx) => {
    const hasStart = Boolean(value.startDate);
    const hasEnd = Boolean(value.endDate);

    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: "custom",
        path: hasStart ? ["endDate"] : ["startDate"],
        message: "日期可以不选；如需指定日期，请同时填写出发日期和返回日期",
      });
      return;
    }

    if (!hasStart && !hasEnd) return;

    const start = parseDate(value.startDate);
    const end = parseDate(value.endDate);
    if (!start || !end) return;

    if (end.getTime() < start.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "返回日期不能早于出发日期",
      });
      return;
    }

    const days = getTripDays(value.startDate, value.endDate);
    if (days > 14) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "当前版本最多支持 14 天行程",
      });
    }
  });

export const GuideDataSchema = z.object({
  overview: z.string().min(1),
  attractions: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        tips: z.string().min(1),
        duration: z.string().min(1),
        imageUrl: z.string().optional(),
      })
    )
    .min(1),
  itinerary: z
    .array(
      z.object({
        day: z.number().int().positive(),
        title: z.string().min(1),
        activities: z.array(z.string().min(1)).min(1),
      })
    )
    .min(1),
  food: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        recommendation: z.string().min(1),
      })
    )
    .min(1),
  tips: z.array(z.string().min(1)).min(1),
  dataSource: z.enum(["ai", "fallback"]).optional(),
  dataNotice: z.string().optional(),
});

export const PackingDataSchema = z.object({
  climate: z.string().min(1),
  categories: z
    .array(
      z.object({
        name: z.string().min(1),
        icon: z.string().min(1),
        items: z
          .array(
            z.object({
              name: z.string().min(1),
              essential: z.boolean(),
              note: z.string().optional(),
            })
          )
          .min(1),
      })
    )
    .min(1),
  tips: z.array(z.string().min(1)).min(1),
  dataSource: z.enum(["ai", "fallback"]).optional(),
  dataNotice: z.string().optional(),
});

export type TravelRequest = z.infer<typeof TravelRequestSchema>;
export type GuideData = z.infer<typeof GuideDataSchema>;
export type PackingData = z.infer<typeof PackingDataSchema>;

export interface WeatherContext {
  summary: string;
  source: "forecast" | "unavailable";
  locationName?: string;
}

export function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function hasTravelDates(
  request: Pick<TravelRequest, "startDate" | "endDate">
): boolean {
  return Boolean(request.startDate && request.endDate);
}

export function getTripDays(
  startDate: string,
  endDate: string,
  fallbackDays = DEFAULT_TRIP_DAYS
): number {
  if (!startDate && !endDate) return fallbackDays;
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function formatTravelDateRange(
  request: Pick<TravelRequest, "startDate" | "endDate">
): string {
  return hasTravelDates(request)
    ? `${request.startDate} ~ ${request.endDate}`
    : `日期未定 · 默认 ${DEFAULT_TRIP_DAYS} 天`;
}

export function getTripKey(request: TravelRequest): string {
  return [
    request.destination.trim().toLowerCase(),
    request.startDate,
    request.endDate,
    request.pace,
    request.companions,
    [...request.activities].sort().join(","),
    request.aiProvider,
  ].join("|");
}

export function formatActivities(activities: TravelRequest["activities"]): string {
  if (activities.length === 0) return "综合体验";
  return activities.map((activity) => activityLabels[activity]).join("、");
}

const PRESET_ATTRACTION_IMAGES: Record<string, string> = {
  栈桥: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/%E9%9D%92%E5%B2%9B%E6%A0%88%E6%A1%A5_Ehemalige_Landungsbr%C3%BCcke_Qingdao.jpg/960px-%E9%9D%92%E5%B2%9B%E6%A0%88%E6%A1%A5_Ehemalige_Landungsbr%C3%BCcke_Qingdao.jpg",
  八大关: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/%E9%9D%92%E5%B2%9B%E5%85%AB%E5%A4%A7%E5%85%B3%E8%8A%B1%E7%9F%B3%E6%A5%BC.jpg/960px-%E9%9D%92%E5%B2%9B%E5%85%AB%E5%A4%A7%E5%85%B3%E8%8A%B1%E7%9F%B3%E6%A5%BC.jpg",
  信号山: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/XinHaoShan_Park_of_Qingdao.JPG/960px-XinHaoShan_Park_of_Qingdao.JPG",
  啤酒博物馆: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Tsingdao_Brewery.jpg/960px-Tsingdao_Brewery.jpg",
  五四广场: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/51367-Qingdao_%28xiquinhosilva%29_-_Flickr.jpg/960px-51367-Qingdao_%28xiquinhosilva%29_-_Flickr.jpg",
  宽窄巷子: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Chengdu_travel_045_%2836150300546%29.jpg/960px-Chengdu_travel_045_%2836150300546%29.jpg",
  锦里: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Jinli_Street_35201-Chengdu_%2849068150581%29.jpg/960px-Jinli_Street_35201-Chengdu_%2849068150581%29.jpg",
  武侯祠: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Wuhou_Shrine_Chengdu.jpg/960px-Wuhou_Shrine_Chengdu.jpg",
  熊猫: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Grosser_Panda.JPG/960px-Grosser_Panda.JPG",
  故宫: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/%E6%99%AF%E5%B1%B1%E5%85%AC%E5%9B%AD_%2819687188164%29.jpg/960px-%E6%99%AF%E5%B1%B1%E5%85%AC%E5%9B%AD_%2819687188164%29.jpg",
  天坛: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Temple_of_Heaven_Beijing.jpg/960px-Temple_of_Heaven_Beijing.jpg",
  颐和园: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Summer_Palace_Beijing.jpg/960px-Summer_Palace_Beijing.jpg",
  埃菲尔铁塔: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Tour_Eiffel_14.jpg/960px-Tour_Eiffel_14.jpg",
  开元寺: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Quanzhou_Kaiyuan_Temple-the_Hall_of_Mahavira.jpg/960px-Quanzhou_Kaiyuan_Temple-the_Hall_of_Mahavira.jpg",
  西湖: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/West_Lake_Hangzhou.jpg/960px-West_Lake_Hangzhou.jpg",
  外滩: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/The_Bund_Shanghai.jpg/960px-The_Bund_Shanghai.jpg",
};

export async function fetchWikiAttractionPhoto(
  title: string,
  destination: string
): Promise<string | null> {
  // Check instant 0ms preset CDN map first
  for (const [key, url] of Object.entries(PRESET_ATTRACTION_IMAGES)) {
    if (title.includes(key)) return url;
  }

  const getJson = async (url: string) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        headers: { "User-Agent": "TravelNotebookApp/2.0 (https://travel.521026.xyz; mybsee@gmail.com)" },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const rawClean = title.replace(/（[^）]*）|\([^)]*\)/g, "").trim();
  const mainPart = rawClean.split(/[与和及/、]/)[0].trim();
  const pureName = mainPart.replace(/历史城区|景区|公园|风景区|遗址|纪念馆|博物院|博物馆/g, "").trim();

  const searchTerms = [
    `${destination} ${pureName}`,
    `${destination}${pureName}`,
    mainPart,
    pureName,
  ];

  // 1. Chinese Wikipedia title & pageimages query
  for (const term of searchTerms) {
    if (!term || term.length < 2) continue;
    const wikiUrl = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      term
    )}&prop=pageimages&pithumbsize=800&redirects=1&format=json`;

    const data = (await getJson(wikiUrl)) as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
    } | null;

    if (data?.query?.pages) {
      const pageId = Object.keys(data.query.pages)[0];
      if (pageId && pageId !== "-1") {
        const src = data.query.pages[pageId]?.thumbnail?.source;
        if (src) return src;
      }
    }
  }

  // 2. Wikimedia Commons fallback search
  const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    `${destination} ${pureName}`
  )}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json`;
  const commonsData = (await getJson(commonsUrl)) as {
    query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
  } | null;
  if (commonsData?.query?.pages) {
    const pageId = Object.keys(commonsData.query.pages)[0];
    if (pageId && pageId !== "-1") {
      const src = commonsData.query.pages[pageId]?.thumbnail?.source;
      if (src) return src;
    }
  }

  // 3. Wikipedia Opensearch fallback
  for (const term of [pureName, `${destination} ${pureName}`]) {
    if (!term || term.length < 2) continue;
    const searchUrl = `https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      term
    )}&limit=1&namespace=0&format=json`;
    const searchData = (await getJson(searchUrl)) as [string, string[]] | null;
    if (searchData && searchData[1] && searchData[1][0]) {
      const candidateTitle = searchData[1][0];
      const pageUrl = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        candidateTitle
      )}&prop=pageimages&pithumbsize=800&redirects=1&format=json`;
      const pData = (await getJson(pageUrl)) as {
        query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
      } | null;
      if (pData?.query?.pages) {
        const pId = Object.keys(pData.query.pages)[0];
        if (pId && pId !== "-1") {
          const src = pData.query.pages[pId]?.thumbnail?.source;
          if (src) return src;
        }
      }
    }
  }

  return null;
}

export async function enrichGuideWithPhotos(
  guide: GuideData,
  destination: string
): Promise<GuideData> {
  if (!guide.attractions || guide.attractions.length === 0) return guide;

  const enrichedAttractions = await Promise.all(
    guide.attractions.map(async (attraction) => {
      if (attraction.imageUrl) return attraction;
      const photo = await fetchWikiAttractionPhoto(attraction.name, destination);
      return photo ? { ...attraction, imageUrl: photo } : attraction;
    })
  );

  return {
    ...guide,
    attractions: enrichedAttractions,
  };
}

export function extractJSONObject(text: string): unknown | null {
  const candidates: string[] = [];
  const jsonBlock = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const genericBlock = text.match(/```\s*([\s\S]*?)```/)?.[1];
  if (jsonBlock) candidates.push(jsonBlock);
  if (genericBlock) candidates.push(genericBlock);

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }
  candidates.push(text);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      // Continue trying other candidates.
    }
  }
  return null;
}

export function validateGuideText(text: string, expectedDays?: number): GuideData | null {
  const parsed = extractJSONObject(text);
  if (!parsed) return null;

  if (expectedDays && expectedDays > 0) {
    const strictSchema = GuideDataSchema.superRefine((guide, ctx) => {
      if (guide.itinerary.length !== expectedDays) {
        ctx.addIssue({
          code: "custom",
          path: ["itinerary"],
          message: `行程天数必须等于 ${expectedDays} 天`,
        });
      }
      guide.itinerary.forEach((item, index) => {
        if (item.day !== index + 1) {
          ctx.addIssue({
            code: "custom",
            path: ["itinerary", index, "day"],
            message: "Day 序号必须从 1 连续递增",
          });
        }
      });
    });
    const result = strictSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }

  const result = GuideDataSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export function validatePackingText(text: string): PackingData | null {
  const parsed = extractJSONObject(text);
  const result = PackingDataSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

const cityLandmarksMap: Record<string, Array<[string, string, string, string]>> = {
  青岛: [
    ["栈桥", "青岛标志性建筑与海滨景观，延伸至海中的百年长廊。", "建议潮汐低谷时前往，可观赏退潮后的礁石风光。", "1.5–2 小时"],
    ["八大关风景区", "由十条以中国长城关隘命名的街道构成，汇聚多国风格别墅建筑。", "适合漫步拍照，重点推荐花石楼与公主楼。", "2–3 小时"],
    ["信号山公园", "老城区制高点，顶层旋转观景台可俯瞰青岛“红瓦绿树、碧海蓝天”。", "日落前 1 小时登顶，体验绝佳全景。", "1–1.5 小时"],
    ["青岛啤酒博物馆", "在百年老厂房中展示青岛啤酒的发展历史与工业生产线。", "门票包含免费新鲜原浆啤酒与花生小食。", "2 小时"],
    ["五四广场", "青岛市中心海滨广场，以大型红色雕塑“五月的风”为标志。", "夜间亮灯后景色优雅，可沿海滨步道散步。", "1 小时"],
  ],
  成都: [
    ["宽窄巷子", "由宽巷子、窄巷子和井巷子平行排列组成，保留了清末民初的古街格局。", "早晨游览客流较少，可品尝盖碗茶与成都小吃。", "2–3 小时"],
    ["锦里", "紧邻武侯祠的著名三国文化主题街区，浓缩了成都民俗与老街风貌。", "傍晚提灯亮起时氛围绝佳。", "2 小时"],
    ["武侯祠", "中国唯一的君臣合祀祠堂，红墙竹影是极具特色的打卡点。", "建议选择官方讲解或语音导览。", "2 小时"],
    ["成都大熊猫繁育研究基地", "近距离观赏大熊猫和小熊猫生活状态的世界级保护基地。", "务必清晨开园前往，此时熊猫最活跃且喂食观赏最佳。", "3–4 小时"],
  ],
  北京: [
    ["故宫博物院", "世界上现存规模最大、保存最为完整的木质结构古建筑群。", "需提前在官方微信公众号实名预约购票。", "3–4 小时"],
    ["天坛公园", "明清两代帝王祭天、祈谷的场所，建筑艺术杰作。", "建议从南门进北门出，顺应古代祭祀路线。", "2–3 小时"],
    ["颐和园", "中国现存规模最大、保存最完整的皇家行宫御花园。", "推荐乘坐西堤船只划行，漫步长廊。", "3 小时"],
  ],
};

const genericAttractions: Array<[string, string, string, string]> = [
  ["历史核心区", "从城市最具代表性的街区开始，了解当地历史脉络与建筑风格。", "优先步行游览，并在出发前核实开放区域。", "2–3 小时"],
  ["代表性博物馆", "通过常设展览快速建立对目的地文化、艺术与社会背景的认识。", "提前预约热门时段，注意闭馆日。", "2–3 小时"],
  ["城市地标与观景点", "从高处或标志性公共空间观察城市布局与天际线。", "日落前 1 小时到达，兼顾白天与夜景。", "1.5–2 小时"],
  ["本地市场", "体验当地食材、日常消费与市井文化，适合安排简餐。", "携带少量现金并注意个人物品。", "1–2 小时"],
  ["特色社区", "避开单一打卡点，在咖啡馆、小店与公共空间中感受本地生活。", "按兴趣挑选 2–3 个相邻街区，避免跨城折返。", "半天"],
  ["公园或滨水区域", "作为高强度游览后的缓冲，适合散步、休息和拍摄。", "根据天气准备防晒、防雨或保暖层。", "1.5–3 小时"],
];

export function buildFallbackGuide(request: TravelRequest): GuideData {
  const days = Math.max(1, getTripDays(request.startDate, request.endDate));
  const dateContext = hasTravelDates(request)
    ? `${request.startDate} 至 ${request.endDate}`
    : `日期未定，按 ${days} 天灵活行程`;
  const activityText = formatActivities(request.activities);
  const paceText = paceLabels[request.pace];
  const companionText = companionLabels[request.companions];
  const themes = [
    "城市初识与历史脉络",
    "经典地标与文化场馆",
    "在地生活与特色街区",
    "自然景观与轻松漫步",
    "主题体验与自由探索",
    "周边区域或深度文化体验",
  ];

  const matchedCity = Object.keys(cityLandmarksMap).find((city) =>
    request.destination.includes(city)
  );
  const selectedLandmarks = matchedCity ? cityLandmarksMap[matchedCity] : genericAttractions;

  return {
    overview: `${request.destination}经典规划方案：${dateContext}，旅行节奏为${paceText}，同行方式为${companionText}，重点偏向${activityText}。以下为您精选当地核心景点与行程搭配。`,
    attractions: selectedLandmarks.map(([name, description, tips, duration]) => {
      const actualName = matchedCity ? name : `${request.destination}${name}`;
      let imageUrl: string | undefined;
      for (const [key, url] of Object.entries(PRESET_ATTRACTION_IMAGES)) {
        if (actualName.includes(key)) {
          imageUrl = url;
          break;
        }
      }
      return {
        name: actualName,
        description,
        tips,
        duration,
        imageUrl,
      };
    }),
    itinerary: Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const theme = themes[index % themes.length];
      const baseActivities = [
        `09:00–11:30｜围绕“${theme}”选择 1–2 个相邻景点`,
        "12:00–13:30｜在附近品尝当地代表性午餐",
        request.pace === "relaxed"
          ? "14:30–17:00｜安排一个主景点，并预留咖啡或休息时间"
          : "14:00–17:30｜继续游览同一区域的文化场馆或特色街区",
        request.pace === "intensive"
          ? "19:00–21:00｜夜景、夜市或演出活动"
          : "18:30 以后｜轻松晚餐并根据体力自由活动",
      ];
      return { day, title: theme, activities: baseActivities };
    }),
    food: [
      { name: "当地早餐", description: "优先选择居民常去的早餐店或市场摊位。", recommendation: "住宿地步行 15 分钟内、评价稳定的本地店" },
      { name: "代表性主食", description: "选择最能体现当地谷物、面食或米食传统的主食。", recommendation: "传统街区或老字号集中区域" },
      { name: "季节料理", description: "根据旅行月份寻找时令食材和短季菜单。", recommendation: "询问店员当季推荐，避免只点游客套餐" },
      { name: "街头小吃", description: "以少量多样的方式体验不同口味。", recommendation: "卫生条件清晰、客流稳定的市场或夜市" },
      { name: "本地甜品与饮品", description: "作为下午休息点，兼顾体验和恢复体力。", recommendation: "特色社区中的独立店或传统茶馆" },
    ],
    tips: [
      "将每天景点控制在同一片区，优先减少跨城折返。",
      "热门场馆和交通票务应提前预约，并保留电子与离线凭证。",
      "餐厅、营业时间和临时闭馆信息请以官方渠道为准。",
      "每天预留至少 1 小时机动时间，应对天气、排队和交通变化。",
      `${companionText}场景下应提前约定集合方式、预算和紧急联系人。`,
    ],
    dataSource: "fallback",
    dataNotice: "当前展示的是离线降级方案，不包含实时天气、票务或营业状态。",
  };
}

export function buildFallbackPacking(request: TravelRequest): PackingData {
  const days = Math.max(1, getTripDays(request.startDate, request.endDate));
  const dateNotice = hasTravelDates(request)
    ? `按 ${request.startDate} 至 ${request.endDate} 的 ${days} 天行程`
    : `日期未定，先按 ${days} 天通用行程`;
  const underwearCount = Math.min(days, 7);
  const topsCount = Math.max(2, Math.ceil(days / 2));
  const activitySet = new Set(request.activities);

  const categories: PackingData["categories"] = [
    {
      name: "衣物",
      icon: "clothing",
      items: [
        { name: `${underwearCount} 套换洗内衣袜`, essential: true, note: "长途旅行可按 5–7 天量携带并途中清洗" },
        { name: `${topsCount} 件易搭配上衣`, essential: true },
        { name: `${Math.max(1, Math.ceil(days / 4))} 条下装`, essential: true },
        { name: "轻薄保暖或防风外层", essential: true, note: "应对早晚温差和交通工具空调" },
        { name: "睡衣或舒适家居服", essential: false },
      ],
    },
    {
      name: "鞋履",
      icon: "footwear",
      items: [
        { name: "1 双已磨合的步行鞋", essential: true },
        { name: "备用轻便鞋或拖鞋", essential: false },
      ],
    },
    {
      name: "洗漱用品",
      icon: "toiletry",
      items: [
        { name: "旅行装牙具与个人洗护", essential: true },
        { name: "防晒用品", essential: true },
        { name: "纸巾、湿巾与免洗清洁用品", essential: false },
      ],
    },
    {
      name: "电子设备",
      icon: "electronics",
      items: [
        { name: "手机、充电器与充电线", essential: true },
        { name: "合规容量移动电源", essential: true },
        { name: "目的地适用的转换插头", essential: false },
        { name: "耳机与备用数据线", essential: false },
      ],
    },
    {
      name: "证件文件",
      icon: "documents",
      items: [
        { name: "身份证件／护照及签证材料", essential: true },
        { name: "交通、住宿和保险凭证", essential: true, note: "同时保存离线副本" },
        { name: "银行卡、少量现金与紧急联系方式", essential: true },
      ],
    },
    {
      name: "常备药品",
      icon: "medicine",
      items: [
        { name: "个人处方药及处方证明", essential: true },
        { name: "创可贴、止痛药和肠胃药", essential: false },
        { name: "防蚊或过敏应急用品", essential: false },
      ],
    },
    {
      name: "其他",
      icon: "other",
      items: [
        { name: "折叠雨具或轻便雨衣", essential: true },
        { name: "可重复使用水杯", essential: false },
        { name: "小型分装袋与脏衣袋", essential: false },
      ],
    },
  ];

  if (activitySet.has("hiking")) {
    categories[1].items.push(
      { name: "防滑徒步鞋或越野鞋", essential: true },
      { name: "轻量背包、补水用品和基础急救包", essential: true }
    );
  }
  if (activitySet.has("swimming")) {
    categories[0].items.push({ name: "泳衣、速干毛巾和防晒衣", essential: true });
    categories[6].items.push({ name: "防水袋或手机防水套", essential: false });
  }
  if (activitySet.has("shopping")) {
    categories[6].items.push({ name: "可折叠购物袋及预留行李空间", essential: false });
  }
  if (request.companions === "family") {
    categories[5].items.push({ name: "儿童常用药、体温计和身份信息卡", essential: true });
  }

  return {
    climate: `当前无法获取可靠实时天气。此清单${dateNotice}生成，出发前 3–7 天请根据目的地官方预报补充防雨、防晒或保暖装备。`,
    categories,
    tips: [
      "先摆出全部必带物品，再按使用场景分装，避免重复携带。",
      "贵重物品、证件、药品和一套换洗衣物放入随身行李。",
      "液体、移动电源和托运行李限制以承运方最新规定为准。",
      "为返程纪念品预留约 15%–20% 的箱内容量。",
    ],
    dataSource: "fallback",
    dataNotice: "当前展示的是离线降级清单，未使用实时气象数据。",
  };
}
