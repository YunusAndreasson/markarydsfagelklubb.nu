/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types.d.ts" />

import type { SupabaseServerClient } from "@/lib/supabase-server"

declare global {
  namespace App {
    interface Locals {
      /** Set by the middleware for `/admin/*` only — a fresh client per request. */
      supabase?: SupabaseServerClient
      /**
       * The verified session's user on `/admin/*`, or null when signed out.
       * Authentication only: step 2 adds the `private.is_admin()` gate.
       */
      user?: { id: string; email: string | null } | null
    }
  }
}
