"use client";

import { useLayoutEffect } from "react";
import { useLocale } from "next-intl";

/**
 * Invite / recovery / magic links sometimes still target `/[locale]/login` (old emails or
 * Supabase Site URL). Tokens live in the hash or as `?code=` — the server never sees the
 * hash, so we must bounce to `/auth/complete-invite` on the client before the login UI misleads users.
 */
export function LoginInviteTokenRedirect() {
  const locale = useLocale();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const hasTokens = u.hash.includes("access_token") || u.searchParams.has("code");
    if (!hasTokens) return;
    if (!/\/login\/?$/i.test(u.pathname)) return;

    const sp = new URLSearchParams(u.search);
    sp.delete("reason");
    const query = sp.toString() ? `?${sp.toString()}` : "";

    window.location.replace(`${u.origin}/${locale}/auth/complete-invite${query}${u.hash}`);
  }, [locale]);

  return null;
}
