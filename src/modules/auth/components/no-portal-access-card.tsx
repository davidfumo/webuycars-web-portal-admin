"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/modules/shared/components/sign-out-button";

type Props = {
  email: string | null;
};

/**
 * Terminal screen for authenticated users with no portal access.
 * No auto-sync (server already self-heals from app_metadata in `getPortalContext`).
 * "Try again" simply re-renders the home redirect path.
 */
export function NoPortalAccessCard({ email }: Props) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  function onRetry() {
    setRetrying(true);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("noPortalAccessTitle")}
          </CardTitle>
          <CardDescription className="space-y-3">
            <span className="block">{t("noPortalAccessBody")}</span>
            {email ? (
              <span className="block font-mono text-xs text-muted-foreground">
                {t("noPortalAccessSignedInAs", { email })}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t("noPortalAccessHint")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onRetry}
              disabled={retrying}
              aria-busy={retrying}
            >
              {retrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RotateCw className="mr-2 h-4 w-4" aria-hidden />
              )}
              {t("noPortalAccessRetry")}
            </Button>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
