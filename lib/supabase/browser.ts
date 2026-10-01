"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  const { url, key } = getPublicSupabaseEnv();
  return createBrowserClient(url, key);
}
