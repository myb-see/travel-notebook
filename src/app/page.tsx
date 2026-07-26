"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TravelForm } from "@/components/travel/travel-form";
import { GuideDisplay } from "@/components/travel/guide-display";
import { PackingDisplay } from "@/components/travel/packing-display";
import { FavoritesPanel } from "@/components/travel/favorites-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Compass,
  Luggage,
  Bookmark,
  Share2,
  ArrowLeft,
  MapPin,
  Sparkles,
  RefreshCw,
  Users,
  Gauge,
  Cpu,
} from "lucide-react";
import {
  GuideDataSchema,
  PackingDataSchema,
  activityLabels,
  aiProviderLabels,
  companionLabels,
  formatTravelDateRange,
  getTripKey,
  paceLabels,
  type AiProvider,
  type GuideData,
  type PackingData,
  type TravelRequest,
} from "@/lib/travel";
import { loadFavorites, saveFavorites, type FavoriteItem } from "@/lib/favorites";
import {
  SharedTripSchema,
  decodeSharedTrip,
  encodeSharedTrip,
  type SharedTrip,
} from "@/lib/share";

interface StreamResponse {
  result: unknown;
  warning?: string;
}

type AppView = "form" | "result";

async function streamFetch(
  url: string,
  body: TravelRequest,
  onChunk?: (fullText: string) => void
): Promise<StreamResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 70_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorBody?.error || `请求失败（${response.status}）`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("服务未返回可读取的响应流");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let result: unknown;
    let warning: string | undefined;

    const consumeLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) return;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") return;

      try {
        const payload = JSON.parse(data) as {
          content?: unknown;
          result?: unknown;
          warning?: unknown;
          error?: unknown;
        };
        if (typeof payload.error === "string") throw new Error(payload.error);
        if (typeof payload.content === "string") {
          fullText += payload.content;
          onChunk?.(fullText);
        }
        if (payload.result !== undefined) result = payload.result;
        if (typeof payload.warning === "string") warning = payload.warning;
      } catch (error) {
        if (error instanceof SyntaxError) return;
        throw error;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) consumeLine(line);
    }
    if (buffer.trim()) consumeLine(buffer);

    if (result === undefined) throw new Error("服务未返回有效的结构化结果");
    return { result, warning };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("生成超时，请稍后重试");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildShareText(request: TravelRequest, guide: GuideData): string {
  return `【${request.destination}旅行攻略】\n日期：${formatTravelDateRange(request)}\n节奏：${paceLabels[request.pace]}｜同行：${companionLabels[request.companions]}｜模型：${aiProviderLabels[request.aiProvider]}\n\n${guide.overview}\n\n景点推荐：\n${guide.attractions
    .slice(0, 6)
    .map((attraction) => `• ${attraction.name}：${attraction.description}`)
    .join("\n")}\n\n行程规划：\n${guide.itinerary
    .map((day) => `Day ${day.day}｜${day.title}\n${day.activities.join("；")}`)
    .join("\n\n")}`;
}

export default function Home() {
  const [view, setView] = useState<AppView>("form");
  const [isLoading, setIsLoading] = useState(false);
  const [isPackingLoading, setIsPackingLoading] = useState(false);
  const [guideData, setGuideData] = useState<GuideData | null>(null);
  const [packingData, setPackingData] = useState<PackingData | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [guideError, setGuideError] = useState<string | null>(null);
  const [packingError, setPackingError] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<TravelRequest | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  const currentTripKey = useMemo(
    () => (currentRequest ? getTripKey(currentRequest) : "no-trip"),
    [currentRequest]
  );

  const loadTrip = useCallback((trip: SharedTrip) => {
    setCurrentRequest(trip.request);
    setGuideData(trip.guide);
    setPackingData(trip.packing || null);
    setGuideError(null);
    setPackingError(null);
    setStreamingText("");
    setIsLoading(false);
    setIsPackingLoading(false);
    setView("result");
  }, []);

  useEffect(() => {
    setFavorites(loadFavorites());
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const persistentId = params.get("trip");
    const inlineValue = params.get("share");

    void (async () => {
      if (persistentId) {
        try {
          const response = await fetch(`/api/shares/${encodeURIComponent(persistentId)}`, {
            cache: "no-store",
          });
          if (!response.ok) throw new Error("分享不存在或已过期");
          const body = (await response.json()) as { trip?: unknown };
          const parsed = SharedTripSchema.safeParse(body.trip);
          if (!parsed.success) throw new Error("分享内容已损坏");
          if (!cancelled) {
            loadTrip(parsed.data);
            toast.info("已打开一份分享的旅行攻略");
          }
          return;
        } catch (error) {
          if (!cancelled) {
            toast.error(error instanceof Error ? error.message : "分享链接读取失败");
          }
          return;
        }
      }

      if (inlineValue) {
        const sharedTrip = decodeSharedTrip(inlineValue);
        if (sharedTrip && !cancelled) {
          loadTrip(sharedTrip);
          toast.info("已打开一份分享的旅行攻略");
        } else if (!cancelled) {
          toast.error("分享链接无效或内容已损坏");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadTrip]);

  const runPacking = useCallback(async (request: TravelRequest) => {
    setIsPackingLoading(true);
    setPackingError(null);
    try {
      const response = await streamFetch("/api/generate-packing", request);
      const parsed = PackingDataSchema.safeParse(response.result);
      if (!parsed.success) throw new Error("行李结果结构校验失败");
      setPackingData(parsed.data);
      if (response.warning) toast.warning(response.warning);
    } catch (error) {
      setPackingError(error instanceof Error ? error.message : "行李建议生成失败");
    } finally {
      setIsPackingLoading(false);
    }
  }, []);

  const runGuide = useCallback(async (request: TravelRequest) => {
    setIsLoading(true);
    setGuideError(null);
    setStreamingText("");
    try {
      const response = await streamFetch("/api/generate-guide", request, setStreamingText);
      const parsed = GuideDataSchema.safeParse(response.result);
      if (!parsed.success) throw new Error("攻略结果结构校验失败");
      setGuideData(parsed.data);
      setView("result");
      if (response.warning) toast.warning(response.warning);
    } catch (error) {
      setGuideError(error instanceof Error ? error.message : "旅行攻略生成失败");
    } finally {
      setStreamingText("");
      setIsLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (request: TravelRequest) => {
      setCurrentRequest(request);
      setGuideData(null);
      setPackingData(null);
      setGuideError(null);
      setPackingError(null);
      setView("form");

      if (request.aiProvider === "glm") {
        // GLM: 串行执行，消除免费账号并发风控 (Error 1302)
        await runGuide(request);
        await runPacking(request);
      } else {
        // Gemini: 并行/并发极速执行，充分利用高吞吐带宽
        void runPacking(request);
        await runGuide(request);
      }
    },
    [runGuide, runPacking]
  );

  const persistFavorites = (next: FavoriteItem[]) => {
    setFavorites(next);
    try {
      saveFavorites(next);
    } catch {
      toast.error("浏览器存储空间不足，无法保存收藏");
    }
  };

  const handleSave = () => {
    if (!currentRequest || !guideData) return;
    const tripKey = getTripKey(currentRequest);
    const existing = favorites.find((item) => getTripKey(item.request) === tripKey);
    const item: FavoriteItem = {
      id: existing?.id || globalThis.crypto?.randomUUID?.() || Date.now().toString(),
      request: currentRequest,
      guide: guideData,
      packing: packingData || undefined,
      createdAt: Date.now(),
    };
    const next = [item, ...favorites.filter((favorite) => favorite.id !== item.id)];
    persistFavorites(next);
    toast.success(existing ? "收藏已更新" : "攻略已收藏");
  };

  const removeFavorite = (id: string) => {
    persistFavorites(favorites.filter((favorite) => favorite.id !== id));
    toast.success("已从收藏夹删除");
  };

  const shareTrip = async (trip: SharedTrip) => {
    const text = buildShareText(trip.request, trip.guide);
    let shareUrl: string | undefined;

    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trip),
      });
      if (response.ok) {
        const body = (await response.json()) as { id?: string };
        if (body.id) {
          const url = new URL(window.location.origin + window.location.pathname);
          url.searchParams.set("trip", body.id);
          shareUrl = url.toString();
        }
      }
    } catch {
      // The inline fallback below remains available.
    }

    if (!shareUrl) {
      try {
        const encoded = encodeSharedTrip(trip);
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set("share", encoded);
        if (url.toString().length <= 7_500) shareUrl = url.toString();
      } catch {
        // Text sharing remains available.
      }
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${trip.request.destination}旅行攻略`,
          text,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl ? `${text}\n\n查看完整攻略：${shareUrl}` : text);
      toast.success(shareUrl ? "分享链接已复制" : "攻略文本已复制");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("分享失败，请检查浏览器剪贴板权限");
    }
  };

  const handleShare = () => {
    if (!currentRequest || !guideData) return;
    void shareTrip({ request: currentRequest, guide: guideData, packing: packingData || undefined });
  };

  const handleLoadFavorite = (item: FavoriteItem) => {
    loadTrip({ request: item.request, guide: item.guide, packing: item.packing });
  };

  const retryGuide = () => {
    if (!currentRequest) return;
    setGuideData(null);
    void runGuide(currentRequest);
  };

  const retryPacking = () => {
    if (!currentRequest) return;
    setPackingData(null);
    void runPacking(currentRequest);
  };

  const switchProvider = async (provider: AiProvider) => {
    if (!currentRequest || currentRequest.aiProvider === provider) return;
    const nextRequest = { ...currentRequest, aiProvider: provider };
    setCurrentRequest(nextRequest);
    setGuideData(null);
    setPackingData(null);
    setGuideError(null);
    setPackingError(null);

    if (provider === "glm") {
      // GLM: 串行执行，消除并发风控
      await runGuide(nextRequest);
      await runPacking(nextRequest);
    } else {
      // Gemini: 并行执行，双管齐下极速输出
      void runPacking(nextRequest);
      await runGuide(nextRequest);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {view === "result" && (
              <button
                type="button"
                onClick={() => setView("form")}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="返回旅行信息表单"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2 truncate">
              <Compass className="w-5 h-5 text-travel-sand shrink-0" />
              <span className="truncate">旅途手帐</span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {view === "result" && guideData && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  className="gap-1.5 border-border text-muted-foreground hover:text-foreground hover:border-travel-sand/40 px-2.5 sm:px-3"
                  aria-label="收藏当前攻略"
                >
                  <Bookmark className="w-4 h-4" />
                  <span className="hidden sm:inline">收藏</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="gap-1.5 border-border text-muted-foreground hover:text-foreground hover:border-travel-blue/40 px-2.5 sm:px-3"
                  aria-label="分享当前攻略"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">分享</span>
                </Button>
              </>
            )}
            <FavoritesPanel
              favorites={favorites}
              onLoad={handleLoadFavorite}
              onRemove={removeFavorite}
              onShare={(item) =>
                void shareTrip({ request: item.request, guide: item.guide, packing: item.packing })
              }
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {view === "form" ? (
          <div className="space-y-8">
            <div className="text-center space-y-3 pt-8 pb-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-travel-sand/10 text-travel-sand text-sm font-medium mb-2">
                <Sparkles className="w-4 h-4" />
                AI 智能旅行规划
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                你的下一段旅途
                <br />
                <span className="text-travel-sand">从这里开始</span>
              </h2>
              <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
                输入目的地和旅行偏好，或随机抽取一个地点；日期可选
              </p>
            </div>

            <TravelForm onSubmit={handleSubmit} isLoading={isLoading} />

            {(isLoading || streamingText) && (
              <div className="w-full max-w-2xl mx-auto space-y-3 animate-in fade-in duration-300" aria-live="polite">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block w-4 h-4 border-2 border-travel-sand/30 border-t-travel-sand rounded-full animate-spin" />
                  正在规划你的旅途……
                </div>
                {streamingText && (
                  <div className="p-4 rounded-xl border border-border/60 bg-card/50 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed break-all">
                    {streamingText}
                  </div>
                )}
              </div>
            )}

            {guideError && (
              <div className="w-full max-w-2xl mx-auto rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <p>{guideError}</p>
                {currentRequest && (
                  <Button variant="outline" size="sm" onClick={retryGuide} className="mt-3 gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新生成
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {currentRequest && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2.5">
                    <MapPin className="w-6 h-6 text-travel-sand shrink-0" />
                    {currentRequest.destination}
                  </h2>
                  <p className="text-muted-foreground text-sm ml-8 mt-1">
                    {formatTravelDateRange(currentRequest)}
                  </p>
                </div>
                <div className="ml-0 sm:ml-8 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <Gauge className="w-3 h-3" />
                    {paceLabels[currentRequest.pace]}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <Users className="w-3 h-3" />
                    {companionLabels[currentRequest.companions]}
                  </span>
                  {currentRequest.activities.map((activity) => (
                    <span key={activity} className="rounded-full bg-travel-sand/10 text-travel-sand px-2.5 py-1">
                      {activityLabels[activity]}
                    </span>
                  ))}
                </div>

                <div className="ml-0 sm:ml-8 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-travel-blue/10 text-travel-blue px-2.5 py-1 text-xs">
                    <Cpu className="w-3 h-3" />
                    {aiProviderLabels[currentRequest.aiProvider]}
                  </span>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">切换模型对比：</span>
                    {(["gemini", "glm"] as const)
                      .filter((p) => p !== currentRequest.aiProvider)
                      .map((provider) => (
                        <button
                          key={provider}
                          type="button"
                          disabled={isLoading || isPackingLoading}
                          onClick={() => switchProvider(provider)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-travel-blue/40 hover:text-travel-blue disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className="w-3 h-3" />
                          用 {aiProviderLabels[provider]} 重新生成
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}

            <Tabs defaultValue="guide" className="w-full">
              <TabsList className="w-full max-w-xs grid grid-cols-2 h-auto p-1 bg-muted/50">
                <TabsTrigger value="guide" className="data-[state=active]:bg-card data-[state=active]:shadow-sm py-2.5 gap-1.5">
                  <Compass className="w-4 h-4" />
                  旅行攻略
                </TabsTrigger>
                <TabsTrigger value="packing" className="data-[state=active]:bg-card data-[state=active]:shadow-sm py-2.5 gap-1.5">
                  <Luggage className="w-4 h-4" />
                  行李建议
                </TabsTrigger>
              </TabsList>

              <TabsContent value="guide" className="mt-5">
                {guideData ? (
                  <GuideDisplay guide={guideData} />
                ) : isLoading ? (
                  <div className="py-12 text-center space-y-3" aria-live="polite">
                    <span className="inline-block w-6 h-6 border-2 border-travel-sand/30 border-t-travel-sand rounded-full animate-spin" />
                    <p className="text-muted-foreground text-sm">正在重新生成攻略……</p>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-destructive text-sm">{guideError || "攻略生成失败"}</p>
                    <Button variant="outline" size="sm" onClick={retryGuide} className="gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" />
                      重试攻略
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="packing" className="mt-5">
                {packingData ? (
                  <PackingDisplay packing={packingData} storageKey={currentTripKey} />
                ) : isPackingLoading ? (
                  <div className="py-12 text-center space-y-3" aria-live="polite">
                    <span className="inline-block w-6 h-6 border-2 border-travel-sand/30 border-t-travel-sand rounded-full animate-spin" />
                    <p className="text-muted-foreground text-sm">正在分析天气、天数和活动，生成行李建议……</p>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-destructive text-sm">{packingError || "行李建议生成失败"}</p>
                    <Button variant="outline" size="sm" onClick={retryPacking} className="gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" />
                      重试行李建议
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <footer className="border-t border-border/40 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-muted-foreground/60">
          旅途手帐 — AI 生成内容仅作规划参考，预订与出行信息请以官方渠道为准
        </div>
      </footer>
    </div>
  );
}
