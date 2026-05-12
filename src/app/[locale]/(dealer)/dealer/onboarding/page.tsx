import { redirect } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import {
  dealerNeedsOnboarding,
  getPortalContext,
} from "@/lib/auth/portal";
import { OnboardingWizard } from "@/modules/dealer/components/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function DealerOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getPortalContext();

  if (!ctx || ctx.surface !== "dealer" || !ctx.staff) {
    redirect(`/${locale}/login`);
  }

  if (!dealerNeedsOnboarding(ctx.staff)) {
    redirect(`/${locale}/dealer/dashboard`);
  }

  const service = createServiceSupabaseClient();

  const [{ data: dealer }, { data: sub }, { data: profile }, { data: pendingPay }] = await Promise.all([
    service.from("dealers").select("*").eq("id", ctx.dealerId).single(),
    service
      .from("dealer_subscriptions")
      .select("package_id")
      .eq("dealer_id", ctx.dealerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from("profiles").select("full_name").eq("user_id", ctx.userId).maybeSingle(),
    service
      .from("payments")
      .select("id")
      .eq("dealer_id", ctx.dealerId)
      .eq("payment_type", "subscription")
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!dealer || !sub?.package_id) {
    redirect(`/${locale}/dealer/dashboard`);
  }

  const { data: pkg } = await service
    .from("dealer_packages")
    .select("*")
    .eq("id", sub.package_id)
    .single();

  if (!pkg) {
    redirect(`/${locale}/dealer/dashboard`);
  }

  return (
    <OnboardingWizard
      dealer={dealer}
      pkg={pkg}
      initialFullName={profile?.full_name ?? null}
      initialPendingPaymentId={pendingPay?.id ?? null}
    />
  );
}
