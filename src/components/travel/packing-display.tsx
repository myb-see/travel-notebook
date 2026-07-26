"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Shirt,
  Footprints,
  Droplets,
  Zap,
  FileText,
  Pill,
  Package,
  CloudSun,
  Lightbulb,
  Info,
} from "lucide-react";
import type { PackingData } from "@/lib/travel";

interface PackingDisplayProps {
  packing: PackingData;
  storageKey: string;
}

const iconMap: Record<string, ElementType> = {
  clothing: Shirt,
  footwear: Footprints,
  toiletry: Droplets,
  electronics: Zap,
  documents: FileText,
  medicine: Pill,
  other: Package,
};

const getItemKey = (categoryName: string, itemName: string) => {
  return `${categoryName.trim().toLowerCase()}:${itemName.trim().toLowerCase()}`;
};

export function PackingDisplay({ packing, storageKey }: PackingDisplayProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const localStorageKey = useMemo(
    () => `travel-packing-v3:${encodeURIComponent(storageKey)}`,
    [storageKey]
  );

  useEffect(() => {
    setHydratedKey(null);
    try {
      const stored = localStorage.getItem(localStorageKey);
      const parsed = stored ? (JSON.parse(stored) as unknown) : [];
      setCheckedItems(
        new Set(
          Array.isArray(parsed)
            ? parsed.filter((item): item is string => typeof item === "string")
            : []
        )
      );
    } catch {
      setCheckedItems(new Set());
    } finally {
      setHydratedKey(localStorageKey);
    }
  }, [localStorageKey, packing]);

  useEffect(() => {
    if (hydratedKey !== localStorageKey) return;
    try {
      localStorage.setItem(localStorageKey, JSON.stringify([...checkedItems]));
    } catch {
      // Storage can be unavailable in private browsing or when quota is exhausted.
    }
  }, [checkedItems, hydratedKey, localStorageKey]);

  const toggleItem = (key: string) => {
    setCheckedItems((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalItems = packing.categories.reduce((sum, category) => sum + category.items.length, 0);
  const checkedCount = packing.categories.reduce((sum, category) => {
    return (
      sum +
      category.items.filter((item) => checkedItems.has(getItemKey(category.name, item.name))).length
    );
  }, 0);
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  return (
    <div className="w-full space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {packing.dataNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-travel-blue/20 bg-travel-blue/5 px-3 py-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-travel-blue shrink-0 mt-0.5" />
          <span>{packing.dataNotice}</span>
        </div>
      )}

      <Card className="border-travel-blue/20 bg-gradient-to-br from-travel-blue/5 to-travel-sand/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <CloudSun className="w-5 h-5 text-travel-blue mt-0.5 shrink-0" />
            <p className="text-foreground/90 leading-relaxed">{packing.climate}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">打包进度</span>
          <span className="text-foreground font-medium">
            {checkedCount} / {totalItems}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-travel-sand h-full transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {packing.categories.map((category, catIndex) => {
          const IconComponent = iconMap[category.icon] || Package;
          const completed = category.items.reduce(
            (sum, item) => sum + (checkedItems.has(getItemKey(category.name, item.name)) ? 1 : 0),
            0
          );

          return (
            <Card key={`${category.name}-${catIndex}`} className="border-border/60">
              <CardHeader className="pb-2 pt-3.5 px-4">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <IconComponent className="w-4 h-4 text-travel-sand" />
                  {category.name}
                  <Badge variant="secondary" className="text-xs bg-muted border-0 ml-auto">
                    {completed}/{category.items.length} 项
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3.5 px-4">
                <ul className="space-y-2">
                  {category.items.map((item, itemIndex) => {
                    const key = getItemKey(category.name, item.name);
                    const inputId = `packing-${catIndex}-${itemIndex}`;
                    const isChecked = checkedItems.has(key);
                    return (
                      <li key={`${item.name}-${itemIndex}`} className="flex items-start gap-2.5">
                        <Checkbox
                          id={inputId}
                          checked={isChecked}
                          onCheckedChange={() => toggleItem(key)}
                          className="mt-0.5 data-[state=checked]:bg-travel-sand data-[state=checked]:border-travel-sand"
                        />
                        <label
                          htmlFor={inputId}
                          className={`text-sm leading-relaxed cursor-pointer transition-colors ${
                            isChecked ? "text-muted-foreground line-through" : "text-foreground/90"
                          }`}
                        >
                          <span className="flex flex-wrap items-center gap-1.5">
                            {item.name}
                            {item.essential && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-travel-orange/10 text-travel-orange border-0 h-4">
                                必带
                              </Badge>
                            )}
                          </span>
                          {item.note && (
                            <span className="block text-xs text-muted-foreground/70 mt-0.5">
                              {item.note}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {packing.tips.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-3.5 px-4">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-travel-orange" />
              打包小贴士
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3.5 px-4">
            <ul className="space-y-2">
              {packing.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-foreground/80 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-travel-orange/60 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
