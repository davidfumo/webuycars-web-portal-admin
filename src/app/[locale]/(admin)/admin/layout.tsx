import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/modules/admin/components/admin-shell";
import { getPortalContext } from "@/lib/auth/portal";

export const dynamic = "force-dynamic";

export default async function AdminPortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getPortalContext();

  if (!ctx) {
    redirect(`/${locale}/login`);
  }

  if (ctx.surface !== "admin") {
    redirect(`/${locale}/dealer/dashboard`);
  }

  return <AdminShell>{children}</AdminShell>;
}
