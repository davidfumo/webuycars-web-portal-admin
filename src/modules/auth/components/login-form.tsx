"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInWithPasswordAction,
  type LoginActionState,
} from "@/modules/auth/server/login-action";

function errorMessage(state: LoginActionState, t: (key: string) => string): string | null {
  if (!state || !("ok" in state) || state.ok !== false) return null;
  if (state.error === "invalid") return t("invalidCredentials");
  if (state.error === "not_provisioned") return t("accountNotProvisioned");
  if (state.error === "no_portal") return t("noPortalAccess");
  if (state.error === "missing") return t("missingFields");
  return null;
}

export function LoginForm() {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState(signInWithPasswordAction, null);

  const message = errorMessage(state, t);

  return (
    <Card className="w-full max-w-md overflow-hidden border-border/80 shadow-card animate-fade-in">
      <div className="h-1 w-full bg-brand-orange" aria-hidden />
      <CardHeader className="space-y-1 border-b border-border/60 bg-card pb-5 pt-6">
        <CardTitle className="text-2xl font-semibold tracking-tight text-card-foreground">
          {tCommon("appName")}
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {t("welcome")}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-5" aria-busy={isPending}>
          <input type="hidden" name="locale" value={locale} />
          <div className="space-y-2">
            <Label htmlFor="email">{tCommon("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              required
              inputMode="email"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              required
              disabled={isPending}
            />
          </div>
          {message ? (
            <div
              id="login-error"
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            >
              {message}
            </div>
          ) : null}
          <LoadingButton
            type="submit"
            className="h-11 w-full text-base font-semibold"
            loading={isPending}
          >
            {t("signIn")}
          </LoadingButton>
        </form>
      </CardContent>
    </Card>
  );
}
