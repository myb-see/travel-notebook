"use client";

import { Button } from "@/components/ui/button";
import { Bookmark, Share2, Trash2, MapPin, Calendar, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { FavoriteItem } from "@/lib/favorites";
import { formatTravelDateRange } from "@/lib/travel";

interface FavoritesPanelProps {
  favorites: FavoriteItem[];
  onLoad: (item: FavoriteItem) => void;
  onRemove: (id: string) => void;
  onShare: (item: FavoriteItem) => void;
}

export function FavoritesPanel({ favorites, onLoad, onRemove, onShare }: FavoritesPanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border text-muted-foreground hover:text-foreground hover:border-travel-sand/40"
          aria-label={`打开收藏夹，共 ${favorites.length} 条攻略`}
        >
          <Bookmark className="w-4 h-4" />
          <span className="hidden sm:inline">收藏夹</span>
          {favorites.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-travel-sand text-white text-[10px] font-bold">
              {favorites.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[min(440px,100vw)] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-serif">
            <Bookmark className="w-5 h-5 text-travel-sand" />
            我的收藏
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bookmark className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">还没有收藏攻略</p>
              <p className="text-xs mt-1 opacity-70">生成攻略后点击收藏保存</p>
            </div>
          ) : (
            favorites.map((item) => (
              <article
                key={item.id}
                className="p-3 rounded-lg border border-border/60 bg-card hover:border-travel-sand/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onLoad(item)} className="text-left flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-travel-sand shrink-0" />
                      <span className="truncate">{item.request.destination}</span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatTravelDateRange(item.request)}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onShare(item)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-travel-blue hover:bg-travel-blue/10 transition-colors"
                      aria-label={`分享 ${item.request.destination} 攻略`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label={`删除 ${item.request.destination} 攻略`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => onLoad(item)}
                  className="mt-2 flex items-center gap-1 text-xs text-travel-sand hover:text-travel-orange transition-colors"
                >
                  查看攻略
                  <ChevronRight className="w-3 h-3" />
                </button>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
