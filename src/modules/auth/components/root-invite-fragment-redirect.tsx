"use client";

import { useLayoutEffect } from "react";

/**
 * Supabase sometimes redirects to the project Site URL root, e.g. `/en#access_token=…`.
 * Server navigations drop the hash, so we bounce to `auth/complete-invite` on the client
 * before any RSC `redirect()` can strip it.
 */
export function RootInviteFragmentRedirect({ locale }: { locale: string }) {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const hasTokens = u.hash.includes("access_token") || u.searchParams.has("code");
    if (!hasTokens) return;

    const normalized = u.pathname.replace(/\/$/, "") || "/";
    if (normalized !== `/${locale}`) return;

    window.location.replace(`${u.origin}/${locale}/auth/complete-invite${u.search}${u.hash}`);
  }, [locale]);

  return null;
}
