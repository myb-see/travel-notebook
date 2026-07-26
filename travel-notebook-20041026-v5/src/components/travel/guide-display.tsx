"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Clock,
  Lightbulb,
  Utensils,
  Route,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from "lucide-react";

import type { GuideData } from "@/lib/travel";

interface GuideDisplayProps {
  guide: GuideData;
}

export function GuideDisplay({ guide }: GuideDisplayProps) {
  const [expandedDay, setExpandedDay] = useState<number | null>(1);

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {guide.dataNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-travel-orange/20 bg-travel-orange/5 px-3 py-2 text-xs text-muted-foreground">
          <ShieldAlert className="w-4 h-4 text-travel-orange shrink-0 mt-0.5" />
          <span>{guide.dataNotice}</span>
        </div>
      )}

      {/* 概览卡片 */}
      <Card className="border-travel-sand/20 bg-gradient-to-br from-travel-sand/5 to-travel-blue/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-travel-sand mt-0.5 shrink-0" />
            <p className="text-foreground/90 leading-relaxed">{guide.overview}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="attractions" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1 bg-muted/50">
          <TabsTrigger
            value="attractions"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm py-2.5 text-sm gap-1.5"
          >
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">景点</span>
          </TabsTrigger>
          <TabsTrigger
            value="itinerary"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm py-2.5 text-sm gap-1.5"
          >
            <Route className="w-4 h-4" />
            <span className="hidden sm:inline">行程</span>
          </TabsTrigger>
          <TabsTrigger
            value="food"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm py-2.5 text-sm gap-1.5"
          >
            <Utensils className="w-4 h-4" />
            <span className="hidden sm:inline">美食</span>
          </TabsTrigger>
          <TabsTrigger
            value="tips"
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm py-2.5 text-sm gap-1.5"
          >
            <Lightbulb className="w-4 h-4" />
            <span className="hidden sm:inline">贴士</span>
          </TabsTrigger>
        </TabsList>

        {/* 景点推荐 */}
        <TabsContent value="attractions" className="mt-4 space-y-3">
          {guide.attractions.map((attraction, index) => (
            <Card
              key={index}
              className="group hover:shadow-md transition-all duration-200 border-border/60"
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-travel-sand/15 text-travel-sand text-xs font-bold">
                      {index + 1}
                    </span>
                    {attraction.name}
                  </CardTitle>
                  {attraction.duration && (
                    <Badge
                      variant="secondary"
                      className="text-xs shrink-0 bg-travel-blue/10 text-travel-blue border-0"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {attraction.duration}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4 px-4 space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {attraction.description}
                </p>
                {attraction.tips && (
                  <p className="text-xs text-travel-sand/80 bg-travel-sand/5 px-3 py-1.5 rounded-md inline-flex items-center gap-1.5">
                    <Lightbulb className="w-3 h-3" />
                    {attraction.tips}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* 行程规划 */}
        <TabsContent value="itinerary" className="mt-4 space-y-3">
          {guide.itinerary.map((day) => (
            <Card
              key={day.day}
              className="border-border/60 overflow-hidden"
            >
              <button
                type="button"
                aria-expanded={expandedDay === day.day}
                aria-label={`${day.title}，第 ${day.day} 天`}
                onClick={() =>
                  setExpandedDay(expandedDay === day.day ? null : day.day)
                }
                className="w-full text-left"
              >
                <CardHeader className="pb-2 pt-4 px-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-travel-orange/10 text-travel-orange text-sm font-bold">
                        D{day.day}
                      </span>
                      {day.title}
                    </CardTitle>
                    {expandedDay === day.day ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </button>
              {expandedDay === day.day && (
                <CardContent className="pt-0 pb-4 px-4">
                  <Separator className="mb-3 bg-border/50" />
                  <ul className="space-y-2">
                    {day.activities.map((activity, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm text-foreground/85"
                      >
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-travel-blue shrink-0" />
                        {activity}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        {/* 当地美食 */}
        <TabsContent value="food" className="mt-4 space-y-3">
          {guide.food.map((food, index) => (
            <Card
              key={index}
              className="group hover:shadow-md transition-all duration-200 border-border/60"
            >
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className="text-lg">🍜</span>
                  {food.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 px-4 space-y-1.5">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {food.description}
                </p>
                {food.recommendation && (
                  <p className="text-xs text-travel-blue/80 bg-travel-blue/5 px-3 py-1.5 rounded-md inline-flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {food.recommendation}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* 实用贴士 */}
        <TabsContent value="tips" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="pt-5 pb-5 px-4">
              <ul className="space-y-3">
                {guide.tips.map((tip, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-sm text-foreground/85 leading-relaxed"
                  >
                    <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-travel-sand/10 text-travel-sand text-xs font-bold">
                      {index + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
