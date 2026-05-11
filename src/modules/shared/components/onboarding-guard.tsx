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

  useEffect(() => {
    if (!needsOnboarding) return;
    if (pathname?.includes("/dealer/onboarding")) return;
    router.replace("/dealer/onboarding");
  }, [needsOnboarding, pathname, router]);

  return <>{children}</>;
}
