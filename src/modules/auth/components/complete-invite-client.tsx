"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthHashErrorFeedback } from "@/modules/auth/components/auth-hash-error-feedback";
import { AuthSessionFromUrl } from "@/modules/auth/components/auth-session-from-url";
import { SignOutButton } from "@/modules/shared/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";

type Phase =
  | "loading"
  | "form"
  | "no_link"
  | "token_stuck"
  | "submitting"
  | "no_portal_help";

function urlHadAuthTokens(): boolean {
  if (typeof window === "undefined") return false;
  const u = new URL(window.location.href);
  return u.searchParams.has("code") || u.hash.includes("access_token");
}

type Props = {
  /** From `?reason=no-portal` when redirected from home (session but no dealer/admin access). */
  initialReason?: string;
};

export function CompleteInviteClient({ initialReason }: Props) {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const hadTokensRef = useRef(false);
  const isNoPortalReturn = initialReason === "no-portal";

  useEffect(() => {
    hadTokensRef.current = urlHadAuthTokens();
    void createBrowserSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    function resolveWithSession(session: Session | null) {
      if (cancelled) return;
      if (session) {
        if (isNoPortalReturn && !hadTokensRef.current) {
          setPhase("no_portal_help");
          return;
        }
        setPhase("form");
        return;
      }
    }

    void supabase.auth.getSession().then(({ data }) => resolveWithSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveWithSession(session);
    });

    const tSlow = window.setTimeout(() => {
      if (cancelled) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        if (data.session) {
          resolveWithSession(data.session);
          return;
        }
        if (!hadTokensRef.current) {
          setPhase("no_link");
        } else {
          setPhase("token_stuck");
        }
      });
    }, 15000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(tSlow);
    };
  }, [isNoPortalReturn]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("completeInvitePasswordTooShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("completeInvitePasswordMismatch"));
      return;
    }
    setPhase("submitting");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message || tCommon("error"));
      setPhase("form");
      return;
    }
    toast.success(t("completeInviteSuccess"));
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
      <AuthHashErrorFeedback />
      <AuthSessionFromUrl />

      {phase === "loading" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("completeInviteLoadingTitle")}</CardTitle>
            <CardDescription>{t("completeInviteLoadingBody")}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {phase === "no_portal_help" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("completeInviteNoPortalHelpTitle")}</CardTitle>
            <CardDescription className="space-y-3">
              <span className="block">{t("completeInviteNoPortalHelpBody")}</span>
              {sessionEmail ? (
                <span className="block font-mono text-xs text-muted-foreground">
                  {t("completeInviteNoPortalSignedInAs", { email: sessionEmail })}
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{t("completeInviteNoPortalHelpHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  window.history.replaceState(null, "", window.location.pathname);
                  router.replace("/");
                  router.refresh();
                }}
              >
                {t("completeInviteNoPortalRetry")}
              </Button>
              <SignOutButton />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "no_link" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("completeInviteNoLinkTitle")}</CardTitle>
            <CardDescription>{t("completeInviteNoLinkBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/login">{t("completeInviteGoLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "token_stuck" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("completeInviteStuckTitle")}</CardTitle>
            <CardDescription>{t("completeInviteStuckBody")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              {tCommon("retry")}
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">{t("completeInviteGoLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "form" || phase === "submitting" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("completeInviteTitle")}</CardTitle>
            <CardDescription>{t("completeInviteDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-password">{t("completeInviteNewPassword")}</Label>
                <Input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={phase === "submitting"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-confirm">{t("completeInviteConfirmPassword")}</Label>
                <Input
                  id="invite-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  disabled={phase === "submitting"}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("completeInvitePasswordHint")}</p>
              <LoadingButton type="submit" className="w-full" loading={phase === "submitting"}>
                {t("completeInviteSubmit")}
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
