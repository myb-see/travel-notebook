import {
  GuideDataSchema,
  PackingDataSchema,
  TravelRequestSchema,
  type GuideData,
  type PackingData,
  type TravelRequest,
} from "@/lib/travel";

export interface FavoriteItem {
  id: string;
  request: TravelRequest;
  guide: GuideData;
  packing?: PackingData;
  createdAt: number;
}

const FAVORITES_KEY = "travel-favorites-v2";
const LEGACY_KEY = "travel-favorites";

export function loadFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      const value = JSON.parse(stored) as unknown;
      if (Array.isArray(value)) {
        return value.flatMap((item) => {
          const parsed = parseFavorite(item);
          return parsed ? [parsed] : [];
        });
      }
    }
  } catch {
    // Fall back to legacy migration.
  }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return [];
    const value = JSON.parse(legacy) as unknown;
    if (!Array.isArray(value)) return [];

    const migrated = value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      try {
        const request = TravelRequestSchema.parse({
          destination: candidate.destination,
          startDate: candidate.startDate,
          endDate: candidate.endDate,
          activities: [],
          pace: "balanced",
          companions: "solo",
        });
        const guide = GuideDataSchema.parse(
          typeof candidate.guide === "string" ? JSON.parse(candidate.guide) : candidate.guide
        );
        const packingRaw =
          typeof candidate.packing === "string" && candidate.packing
            ? JSON.parse(candidate.packing)
            : candidate.packing;
        const packing = packingRaw ? PackingDataSchema.safeParse(packingRaw) : null;
        return [
          {
            id: String(candidate.id || Date.now()),
            request,
            guide,
            packing: packing?.success ? packing.data : undefined,
            createdAt: Number(candidate.createdAt || Date.now()),
          } satisfies FavoriteItem,
        ];
      } catch {
        return [];
      }
    });

    saveFavorites(migrated);
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: FavoriteItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function parseFavorite(value: unknown): FavoriteItem | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const request = TravelRequestSchema.safeParse(candidate.request);
  const guide = GuideDataSchema.safeParse(candidate.guide);
  const packing = candidate.packing ? PackingDataSchema.safeParse(candidate.packing) : null;
  if (!request.success || !guide.success) return null;

  return {
    id: String(candidate.id || Date.now()),
    request: request.data,
    guide: guide.data,
    packing: packing?.success ? packing.data : undefined,
    createdAt: Number(candidate.createdAt || Date.now()),
  };
}
