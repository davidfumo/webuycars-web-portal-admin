import { redirect } from "next/navigation";
import {
  dealerNeedsOnboarding,
  getPortalContext,
} from "@/lib/auth/portal";
import { syncPendingPaysuiteSubscriptionPaymentsForDealer } from "@/lib/payments/sync-paysuite-pending-subscription-for-dealer.server";

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
    let effective = ctx;
    if (ctx.portalRole === "dealer_manager") {
      await syncPendingPaysuiteSubscriptionPaymentsForDealer(ctx.dealerId);
      const refreshed = await getPortalContext();
      if (refreshed?.surface === "dealer") {
        effective = refreshed;
      }
    }
    if (dealerNeedsOnboarding(effective.staff)) {
      redirect(`/${locale}/dealer/onboarding`);
    }
    redirect(`/${locale}/dealer/dashboard`);
  }

  redirect(`/${locale}/auth/no-portal-access`);
}
