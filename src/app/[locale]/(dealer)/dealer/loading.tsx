"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function DealerSegmentLoading() {
  const t = useTranslations("Common");
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm font-medium">{t("loading")}</p>
    </div>
  );
}
