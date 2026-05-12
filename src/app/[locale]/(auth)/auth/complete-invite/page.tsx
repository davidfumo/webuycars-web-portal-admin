import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CompleteInviteClient } from "@/modules/auth/components/complete-invite-client";
import { LanguageSwitcher } from "@/modules/shared/components/language-switcher";
import { ThemeToggle } from "@/modules/shared/components/theme-toggle";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("completeInviteMetaTitle") };
}

export default async function CompleteInvitePage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};

  return (
    <div className="relative min-h-dvh bg-auth-canvas dark:bg-auth-canvas-dark">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full border border-border/60 bg-card/80 px-1 py-1 shadow-sm backdrop-blur-sm dark:bg-card/60">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <CompleteInviteClient initialReason={sp.reason} />
    </div>
  );
}
