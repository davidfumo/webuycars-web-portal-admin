import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/auth/portal";
import { LoginForm } from "@/modules/auth/components/login-form";

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getPortalContext();
  if (ctx?.surface === "admin") {
    redirect(`/${locale}/admin/dashboard`);
  }
  if (ctx?.surface === "dealer") {
    redirect(`/${locale}/dealer/dashboard`);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-canvas px-4 py-10 dark:bg-background">
      <LoginForm />
    </div>
  );
}
