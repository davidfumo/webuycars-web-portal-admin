import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LanguageSwitcher } from "@/modules/shared/components/language-switcher";
import { ThemeToggle } from "@/modules/shared/components/theme-toggle";
import { NoPortalAccessCard } from "@/modules/auth/components/no-portal-access-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("noPortalAccessMetaTitle") };
}

export default async function NoPortalAccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="relative min-h-dvh bg-auth-canvas dark:bg-auth-canvas-dark">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full border border-border/60 bg-card/80 px-1 py-1 shadow-sm backdrop-blur-sm dark:bg-card/60">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <NoPortalAccessCard email={user.email ?? null} />
    </div>
  );
}
