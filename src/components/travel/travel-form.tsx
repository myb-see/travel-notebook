"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MapPin,
  Calendar,
  Sparkles,
  Compass,
  Mountain,
  Utensils,
  ShoppingBag,
  Gauge,
  User,
  Heart,
  Users,
  Baby,
  Briefcase,
  Shuffle,
  Cpu,
} from "lucide-react";
import {
  DEFAULT_TRIP_DAYS,
  TravelRequestSchema,
  aiProviderLabels,
  DEFAULT_AI_PROVIDER,
  type AiProvider,
  type TravelRequest,
} from "@/lib/travel";

interface TravelFormProps {
  onSubmit: (data: TravelRequest) => void;
  isLoading: boolean;
}

const activityOptions = [
  { id: "sightseeing", label: "观光游览", icon: Compass },
  { id: "hiking", label: "徒步登山", icon: Mountain },
  { id: "food", label: "美食探店", icon: Utensils },
  { id: "shopping", label: "购物扫货", icon: ShoppingBag },
  { id: "swimming", label: "海滨游泳", icon: MapPin },
  { id: "cultural", label: "文化体验", icon: Sparkles },
] as const;

const paceOptions: Array<{
  id: TravelRequest["pace"];
  label: string;
  description: string;
}> = [
  { id: "relaxed", label: "轻松慢游", description: "每天 1–2 个重点" },
  { id: "balanced", label: "均衡适中", description: "体验与休息兼顾" },
  { id: "intensive", label: "充实行程", description: "尽量覆盖更多内容" },
];

const companionOptions: Array<{
  id: TravelRequest["companions"];
  label: string;
  icon: typeof User;
}> = [
  { id: "solo", label: "独自", icon: User },
  { id: "couple", label: "情侣", icon: Heart },
  { id: "friends", label: "朋友", icon: Users },
  { id: "family", label: "亲子", icon: Baby },
  { id: "business", label: "商务", icon: Briefcase },
];

const randomDestinations = [
  "北京",
  "上海",
  "西安",
  "成都",
  "重庆",
  "杭州",
  "苏州",
  "南京",
  "厦门",
  "泉州",
  "青岛",
  "大连",
  "哈尔滨",
  "长沙",
  "桂林",
  "张家界",
  "大理",
  "丽江",
  "香格里拉",
  "三亚",
  "喀什",
  "伊犁",
  "拉萨",
  "香港",
  "澳门",
  "东京",
  "京都",
  "大阪",
  "札幌",
  "首尔",
  "曼谷",
  "清迈",
  "新加坡",
  "吉隆坡",
  "巴厘岛",
  "河内",
  "岘港",
  "伊斯坦布尔",
  "巴黎",
  "罗马",
  "佛罗伦萨",
  "巴塞罗那",
  "里斯本",
  "布拉格",
  "维也纳",
  "雷克雅未克",
  "伦敦",
  "纽约",
  "温哥华",
  "墨尔本",
  "皇后镇",
] as const;

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pickRandomDestination(currentDestination: string): string {
  const current = currentDestination.trim();
  const candidates = randomDestinations.filter((item) => item !== current);
  const pool = candidates.length > 0 ? candidates : randomDestinations;
  return pool[Math.floor(Math.random() * pool.length)];
}

const AI_PROVIDER_STORAGE_KEY = "travel-ai-provider";

function loadStoredAiProvider(): AiProvider {
  if (typeof window === "undefined") return DEFAULT_AI_PROVIDER;
  try {
    const stored = localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    if (stored === "gemini" || stored === "glm") return stored;
  } catch {
    // localStorage may be unavailable.
  }
  return DEFAULT_AI_PROVIDER;
}

export function TravelForm({ onSubmit, isLoading }: TravelFormProps) {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<TravelRequest["activities"]>([]);
  const [pace, setPace] = useState<TravelRequest["pace"]>("balanced");
  const [companions, setCompanions] = useState<TravelRequest["companions"]>("solo");
  const [aiProvider, setAiProvider] = useState<AiProvider>(DEFAULT_AI_PROVIDER);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setAiProvider(loadStoredAiProvider());
  }, []);

  const today = useMemo(localToday, []);

  const handleAiProviderChange = (provider: AiProvider) => {
    setAiProvider(provider);
    try {
      localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
    } catch {
      // localStorage may be unavailable.
    }
  };

  const toggleActivity = (id: TravelRequest["activities"][number]) => {
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((activity) => activity !== id) : [...prev, id]
    );
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (!value) {
      setEndDate("");
    } else if (endDate && endDate < value) {
      setEndDate(value);
    }
    setFormError(null);
  };

  const submitRequest = (nextDestination: string) => {
    const result = TravelRequestSchema.safeParse({
      destination: nextDestination,
      startDate,
      endDate,
      activities: selectedActivities,
      pace,
      companions,
      aiProvider,
    });

    if (!result.success) {
      setFormError(result.error.issues[0]?.message || "请检查旅行信息");
      return;
    }

    setFormError(null);
    onSubmit(result.data);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitRequest(destination);
  };

  const handleRandomGuide = () => {
    const randomDestination = pickRandomDestination(destination);
    setDestination(randomDestination);
    submitRequest(randomDestination);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="destination" className="text-sm font-medium text-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-travel-sand" />
          旅行目的地
        </Label>
        <Input
          id="destination"
          placeholder="例如：京都、巴黎、三亚……"
          value={destination}
          onChange={(event) => {
            setDestination(event.target.value);
            setFormError(null);
          }}
          maxLength={80}
          autoComplete="off"
          className="h-12 text-base border-border bg-card focus-visible:ring-travel-sand/30 focus-visible:border-travel-sand placeholder:text-muted-foreground/60"
        />
        <p className="text-xs text-muted-foreground">
          没有想好去哪里？可使用下方“随机生成目的地攻略”。
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-travel-blue" />
            出发日期（可选）
          </Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(event) => handleStartDateChange(event.target.value)}
            min={today}
            className="h-12 border-border bg-card focus-visible:ring-travel-blue/30 focus-visible:border-travel-blue"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-travel-blue" />
            返回日期（可选）
          </Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setFormError(null);
            }}
            min={startDate || today}
            disabled={!startDate}
            className="h-12 border-border bg-card focus-visible:ring-travel-blue/30 focus-visible:border-travel-blue disabled:opacity-60"
          />
        </div>
      </div>
      <p className="-mt-4 text-xs text-muted-foreground">
        日期可全部留空，系统会按 {DEFAULT_TRIP_DAYS} 天灵活行程生成；指定日期时最多支持 14 天。
      </p>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Gauge className="w-4 h-4 text-travel-blue" />
          旅行节奏
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {paceOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={pace === option.id}
              onClick={() => setPace(option.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                pace === option.id
                  ? "border-travel-blue/50 bg-travel-blue/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-travel-blue/30"
              }`}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs mt-0.5 opacity-75">{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-travel-sand" />
          同行方式
        </Label>
        <div className="flex flex-wrap gap-2">
          {companionOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={companions === option.id}
                onClick={() => setCompanions(option.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm border transition-colors ${
                  companions === option.id
                    ? "bg-travel-sand/15 border-travel-sand/40 text-travel-sand"
                    : "bg-card border-border text-muted-foreground hover:border-travel-sand/30 hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-travel-orange" />
          计划活动（可多选）
        </Label>
        <div className="flex flex-wrap gap-2">
          {activityOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedActivities.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleActivity(option.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm transition-all duration-200 border ${
                  isSelected
                    ? "bg-travel-sand/15 border-travel-sand/40 text-travel-sand shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:border-travel-sand/30 hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Cpu className="w-4 h-4 text-travel-blue" />
          AI 模型
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {(["gemini", "glm"] as const).map((provider) => (
            <button
              key={provider}
              type="button"
              aria-pressed={aiProvider === provider}
              onClick={() => handleAiProviderChange(provider)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                aiProvider === provider
                  ? "border-travel-blue/50 bg-travel-blue/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-travel-blue/30"
              }`}
            >
              <span className="block text-sm font-medium">{aiProviderLabels[provider]}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          选择不同的 AI 模型可以对比生成效果，旅行参数会保持不变。
        </p>
      </div>

      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          type="submit"
          disabled={isLoading || !destination.trim()}
          className="h-12 bg-travel-orange hover:bg-travel-orange/90 text-white text-base font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              正在规划……
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Compass className="w-5 h-5" />
              生成旅行攻略
            </span>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={handleRandomGuide}
          className="h-12 border-travel-sand/40 bg-travel-sand/5 text-travel-sand hover:bg-travel-sand/10 hover:text-travel-orange text-base font-medium rounded-lg"
        >
          <Shuffle className="w-5 h-5" />
          随机生成目的地攻略
        </Button>
      </div>
    </form>
  );
}
