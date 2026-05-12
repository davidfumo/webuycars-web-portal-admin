import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { dealerNeedsOnboarding, getPortalContext } from "@/lib/auth/portal";
import { SignOutButton } from "@/modules/shared/components/sign-out-button";
import { LoginForm } from "@/modules/auth/components/login-form";
import { AuthHashErrorFeedback } from "@/modules/auth/components/auth-hash-error-feedback";
import { AuthSessionFromUrl } from "@/modules/auth/components/auth-session-from-url";
import { LoginInviteTokenRedirect } from "@/modules/auth/components/login-invite-token-redirect";
import { LanguageSwitcher } from "@/modules/shared/components/language-switcher";
import { ThemeToggle } from "@/modules/shared/components/theme-toggle";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("title") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ reason?: string }>;
}) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const ctx = await getPortalContext();
  if (ctx?.surface === "admin") {
    redirect(`/${locale}/admin/dashboard`);
  }
  if (ctx?.surface === "dealer") {
    if (dealerNeedsOnboarding(ctx.staff)) {
      redirect(`/${locale}/dealer/onboarding`);
    }
    redirect(`/${locale}/dealer/dashboard`);
  }

  const tAuth = await getTranslations("Auth");
  const tCommon = await getTranslations("Common");

  const showNoPortalBanner =
    sp.reason === "noPortalAccess" || ctx?.surface === "none";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy px-10 py-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, hsl(20 89% 54%) 0%, transparent 55%), radial-gradient(circle at 80% 90%, hsl(200 40% 40%) 0%, transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative z-10">
          <Image
            src="/brand/logo.png"
            alt={tCommon("appName")}
            width={280}
            height={280}
            className="h-28 w-auto drop-shadow-md"
            priority
          />
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white">
            {tCommon("appName")}
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
            {tAuth("loginTagline")}
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/45">{tAuth("loginSecureHint")}</p>
      </aside>

      <section
        className="relative flex flex-col bg-auth-canvas dark:bg-auth-canvas-dark"
        suppressHydrationWarning
      >
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full border border-border/60 bg-card/80 px-1 py-1 shadow-sm backdrop-blur-sm dark:bg-card/60">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-14 sm:px-8">
          <LoginInviteTokenRedirect />
          <AuthHashErrorFeedback />
          <AuthSessionFromUrl />
          {showNoPortalBanner ? (
            <div
              role="alert"
              className="mb-6 flex w-full max-w-md flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-100"
            >
              <p className="leading-relaxed">{tAuth("noPortalAccess")}</p>
              {ctx?.surface === "none" ? (
                <div className="flex justify-end">
                  <SignOutButton />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mb-8 flex flex-col items-center gap-4 lg:hidden">
            <Image
              src="/brand/logo.png"
              alt={tCommon("appName")}
              width={200}
              height={200}
              className="h-20 w-auto drop-shadow"
              priority
            />
            <p className="max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              {tAuth("loginTagline")}
            </p>
          </div>
          <LoginForm />
          <p className="mt-6 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
            {tAuth("inviteCompletionHint")}
          </p>
        </div>
      </section>
    </div>
  );
}
