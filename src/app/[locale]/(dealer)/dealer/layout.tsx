import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DealerShell } from "@/modules/dealer/components/dealer-shell";
import {
  dealerNeedsOnboarding,
  getPortalContext,
} from "@/lib/auth/portal";
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

  const needsOnboarding = dealerNeedsOnboarding(ctx.staff);

  return (
    <OnboardingGuard needsOnboarding={needsOnboarding}>
      <DealerShell>{children}</DealerShell>
    </OnboardingGuard>
  );
}
