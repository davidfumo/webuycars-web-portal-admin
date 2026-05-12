"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Invite / recovery links often land on `/login` with tokens in the URL hash
 * or PKCE `code` in the query string. The server cannot read the hash, so we
 * establish the Supabase session on the client and refresh the RSC tree.
 *
 * Hash fragments (`#access_token=…&refresh_token=…`) are not always picked up
 * by `getSession()` alone (e.g. PKCE browser client timing), so we parse and
 * call `setSession` explicitly when both tokens are present.
 */
export function AuthSessionFromUrl() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (typeof window === "undefined") return;

    const pageUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(
      pageUrl.hash.startsWith("#") ? pageUrl.hash.slice(1) : "",
    );
    if (hashParams.has("error") || hashParams.has("error_code")) {
      return;
    }

    const hasCode = pageUrl.searchParams.has("code");
    const hasHashToken = pageUrl.hash.includes("access_token");

    if (!hasCode && !hasHashToken) return;

    ran.current = true;
    const supabase = createBrowserSupabaseClient();

    void (async () => {
      try {
        if (hasCode) {
          const code = pageUrl.searchParams.get("code");
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              ran.current = false;
              return;
            }
          }
          pageUrl.searchParams.delete("code");
          window.history.replaceState(null, "", `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
        } else if (hasHashToken) {
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) {
              ran.current = false;
              return;
            }
            window.history.replaceState(null, "", `${pageUrl.pathname}${pageUrl.search}`);
          } else {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
              ran.current = false;
              return;
            }
            window.history.replaceState(null, "", `${pageUrl.pathname}${pageUrl.search}`);
          }
        }

        router.refresh();
      } catch {
        ran.current = false;
      }
    })();
  }, [router]);

  return null;
}
