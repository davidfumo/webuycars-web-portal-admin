"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
export function SignOutButton() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
    setPending(false);
  }

  return (
    <Button variant="ghost" size="sm" onClick={onSignOut} disabled={pending} aria-busy={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="mr-2 h-4 w-4" aria-hidden />
      )}
      {t("signOut")}
    </Button>
  );
}
