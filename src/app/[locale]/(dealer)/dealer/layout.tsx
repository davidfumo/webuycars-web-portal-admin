import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DealerShell } from "@/modules/dealer/components/dealer-shell";
import {
  dealerNeedsOnboarding,
  getPortalContext,
} from "@/lib/auth/portal";
import { syncPendingPaysuiteSubscriptionPaymentsForDealer } from "@/lib/payments/sync-paysuite-pending-subscription-for-dealer.server";
import { OnboardingGuard } from "@/modules/shared/components/onboarding-guard";

export const dynamic = "force-dynamic";

export default async function DealerPortalLayout({
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

  if (ctx.surface !== "dealer") {
    redirect(`/${locale}/admin/dashboard`);
  }

  /**
   * PaySuite checkout runs on their site — our DB only updates when webhooks / return
   * handlers / sync run. Re-fetch PaySuite for any pending subscription session **before**
   * deciding onboarding, so a reload or deep link does not strand a paid customer.
   */
  let needsOnboarding = dealerNeedsOnboarding(ctx.staff);
  if (ctx.portalRole === "dealer_manager") {
    await syncPendingPaysuiteSubscriptionPaymentsForDealer(ctx.dealerId);
    const refreshed = await getPortalContext();
    if (refreshed?.surface === "dealer" && refreshed.staff) {
      needsOnboarding = dealerNeedsOnboarding(refreshed.staff);
    }
  }

  return (
    <OnboardingGuard needsOnboarding={needsOnboarding}>
      <DealerShell>{children}</DealerShell>
    </OnboardingGuard>
  );
}
