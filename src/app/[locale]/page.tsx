import { redirect } from "next/navigation";
import {
  dealerNeedsOnboarding,
  getPortalContext,
} from "@/lib/auth/portal";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getPortalContext();

  if (!ctx) {
    redirect(`/${locale}/login`);
  }

  if (ctx.surface === "admin") {
    redirect(`/${locale}/admin/dashboard`);
  }

  if (ctx.surface === "dealer") {
    if (dealerNeedsOnboarding(ctx.staff)) {
      redirect(`/${locale}/dealer/onboarding`);
    }
    redirect(`/${locale}/dealer/dashboard`);
  }

  redirect(`/${locale}/login?reason=noPortalAccess`);
}
