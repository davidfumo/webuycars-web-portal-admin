"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

type Props = {
  needsOnboarding: boolean;
  children: React.ReactNode;
};

export function OnboardingGuard({ needsOnboarding, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = pathname?.includes("/dealer/onboarding") ?? false;

  useEffect(() => {
    if (!needsOnboarding) return;
    if (isOnboarding) return;
    router.replace("/dealer/onboarding");
  }, [needsOnboarding, isOnboarding, router]);

  // Block rendering dealer content while a redirect to onboarding is pending.
  // This prevents a flash of the dashboard/other pages before the navigation fires.
  if (needsOnboarding && !isOnboarding) {
    return null;
  }

  return <>{children}</>;
}
