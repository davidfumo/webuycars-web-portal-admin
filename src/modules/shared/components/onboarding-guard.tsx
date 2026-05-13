"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

type Props = {
  needsOnboarding: boolean;
  children: React.ReactNode;
};

/**
 * Routes that must stay reachable while onboarding is incomplete — e.g. PaySuite
 * return runs `/dealer/payment/return` before DB reflects completion; blocking here
 * used to send paying users back to step 1 of onboarding.
 */
function isExemptFromOnboardingRedirect(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/dealer/onboarding") || pathname.includes("/dealer/payment/return")
  );
}

export function OnboardingGuard({ needsOnboarding, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const exempt = isExemptFromOnboardingRedirect(pathname ?? null);

  useEffect(() => {
    if (!needsOnboarding) return;
    if (exempt) return;
    router.replace("/dealer/onboarding");
  }, [needsOnboarding, exempt, router]);

  // Block rendering dealer content while a redirect to onboarding is pending.
  // This prevents a flash of the dashboard/other pages before the navigation fires.
  if (needsOnboarding && !exempt) {
    return null;
  }

  return <>{children}</>;
}
