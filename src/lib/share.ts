import { z } from "zod";
import {
  GuideDataSchema,
  PackingDataSchema,
  TravelRequestSchema,
  type GuideData,
  type PackingData,
  type TravelRequest,
} from "@/lib/travel";

export interface SharedTrip {
  request: TravelRequest;
  guide: GuideData;
  packing?: PackingData;
}

export const SharedTripSchema = z.object({
  request: TravelRequestSchema,
  guide: GuideDataSchema,
  packing: PackingDataSchema.optional(),
});

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeSharedTrip(data: SharedTrip): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(data)));
}

export function decodeSharedTrip(value: string): SharedTrip | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as unknown;
    const result = SharedTripSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
