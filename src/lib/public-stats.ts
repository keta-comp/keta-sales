import { supabase } from "@/integrations/supabase/client";

export type PlatformStats = { users: number; businesses: number; crms: number };

/**
 * Landing sahifadagi real statistika. Faqat umumiy sonlar qaytariladi
 * (platform_stats SQL funksiyasi), shaxsiy ma'lumotlar ochilmaydi.
 */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  // platform_stats — generatsiya qilingan turlar yangilanmaguncha yengil cast.
  const client = supabase as unknown as {
    rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("platform_stats");
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Partial<PlatformStats>;
  return {
    users: Number(raw.users ?? 0),
    businesses: Number(raw.businesses ?? 0),
    crms: Number(raw.crms ?? 0),
  };
}

/** 1000 dan oshganda "+" bilan ko‘rsatiladi, aks holda aniq son. */
export function formatCount(value: number): string {
  if (value >= 1000) return `${Math.floor(value / 1000) * 1000}`.replace(/\B(?=(\d{3})+$)/g, ",") + "+";
  return String(value);
}
