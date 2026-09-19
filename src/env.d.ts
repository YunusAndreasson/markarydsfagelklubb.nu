/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types.d.ts" />

import type { SupabaseServerClient } from "@/lib/supabase-server"

declare global {
  namespace App {
    interface Locals {
      /** Set by the middleware for `/admin/*` only — a fresh client per request. */
      supabase?: SupabaseServerClient
      /** The verified session's user on `/admin/*`, or null when signed out. */
      user?: { id: string; email: string | null } | null
      /**
       * True only for the administrator (`profiles.is_admin`). The middleware
       * never renders an admin page without it; the login and logout routes
       * are the only ones a non-admin reaches.
       */
      isAdmin?: boolean
    }
  }
}
