"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

function hashQueryParams(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

/**
 * Supabase redirects failed invite / magic links with errors in the URL hash,
 * e.g. `#error=access_denied&error_code=otp_expired&error_description=...`
 * (the server never sees this). Surfaces a clear message and clears the hash.
 */
export function AuthHashErrorFeedback() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = hashQueryParams(hash);
    if (!params.has("error") && !params.has("error_code")) return;

    ran.current = true;

    const errorCode = params.get("error_code") ?? "";
    const description = params.get("error_description");

    let detail: string;
    if (errorCode === "otp_expired") {
      detail = t("inviteLinkExpiredDetail");
    } else {
      const decoded =
        description != null && description.length > 0
          ? decodeURIComponent(description.replace(/\+/g, " "))
          : "";
      detail = decoded.length > 0 ? decoded : t("inviteLinkErrorGeneric");
    }

    toast.error(t("inviteLinkExpiredTitle"), { description: detail });

    const clean = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", clean);
    router.refresh();
  }, [router, t]);

  return null;
}
