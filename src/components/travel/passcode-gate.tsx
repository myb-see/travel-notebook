"use client";

import { useState, useEffect } from "react";
import { Lock, KeyRound, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const PASSCODE_STORAGE_KEY = "travel_app_access_code";
export const CORRECT_PASSCODE = "521026";

interface PasscodeGateProps {
  children: React.ReactNode;
}

export function PasscodeGate({ children }: PasscodeGateProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PASSCODE_STORAGE_KEY);
      if (stored === CORRECT_PASSCODE) {
        setIsUnlocked(true);
      } else {
        setIsUnlocked(false);
      }
    } catch {
      setIsUnlocked(false);
    }
  }, []);

  const handleUnlock = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputCode.trim() === CORRECT_PASSCODE) {
      try {
        localStorage.setItem(PASSCODE_STORAGE_KEY, CORRECT_PASSCODE);
      } catch {
        // ignore
      }
      setIsUnlocked(true);
      setErrorMsg(null);
    } else {
      setErrorMsg("密码错误，请重新输入");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  // SSR or before client hydration finishes
  if (isUnlocked === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-travel-blue/30 border-t-travel-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
        <div
          className={`w-full max-w-md rounded-2xl border border-travel-blue/20 bg-card p-6 shadow-2xl transition-all ${
            isShaking ? "animate-shake border-destructive/50" : ""
          }`}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-travel-blue/10 flex items-center justify-center text-travel-blue shadow-inner">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">
                旅行随记
              </h2>
            </div>

            <form onSubmit={handleUnlock} className="w-full space-y-3 pt-2">
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="请输入访问密码"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    setErrorMsg(null);
                  }}
                  autoFocus
                  className="pl-10 h-11 text-center font-mono tracking-widest text-lg border-border/80 focus-visible:ring-travel-blue"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg py-1.5 px-3">
                  {errorMsg}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-travel-blue hover:bg-travel-blue/90 text-white font-medium rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                解锁进入
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
