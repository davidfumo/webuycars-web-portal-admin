"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";

type Props = {
  canInvite: boolean;
};

export function DealerInviteStaffForm({ canInvite }: Props) {
  const t = useTranslations("UsersAdmin");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [setupLink, setSetupLink] = useState<string | null>(null);

  if (!canInvite) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/dealer/staff/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          portalLocale: locale === "en" ? "en" : "pt",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.error === "email_exists") toast.error(t("inviteEmailExists"));
        else if (body?.error === "dealer_inactive") toast.error(t("inviteDealerInactive"));
        else toast.error(t("inviteFailed"));
        return;
      }
      const link = typeof body.setupLink === "string" ? body.setupLink : null;
      if (link) {
        setSetupLink(link);
        setLinkOpen(true);
        toast.success(t("inviteStaffSuccessManual"));
      } else {
        toast.success(t("inviteStaffSuccessEmail"));
        setEmail("");
        router.refresh();
      }
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!setupLink) return;
    try {
      await navigator.clipboard.writeText(setupLink);
      toast.success(t("inviteLinkCopied"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  function closeLinkDialog() {
    setLinkOpen(false);
    setSetupLink(null);
    setEmail("");
    router.refresh();
  }

  return (
    <>
      <form
        className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-end"
        onSubmit={onSubmit}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="invite-staff-email">{t("inviteStaffEmailLabel")}</Label>
          <Input
            id="invite-staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@email.com"
            required
          />
          <p className="text-xs text-muted-foreground">{t("inviteStaffHint")}</p>
        </div>
        <LoadingButton type="submit" loading={pending} disabled={!email.trim()}>
          {t("inviteStaffSubmit")}
        </LoadingButton>
      </form>

      <Dialog open={linkOpen} onOpenChange={(o) => !o && closeLinkDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("inviteLinkDialogTitle")}</DialogTitle>
            <DialogDescription>{t("inviteLinkDialogBody")}</DialogDescription>
          </DialogHeader>
          {setupLink ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("inviteLinkField")}</Label>
              <Input readOnly value={setupLink} className="font-mono text-xs" />
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={() => void copyLink()}>
              {t("inviteLinkCopy")}
            </Button>
            <Button type="button" onClick={closeLinkDialog}>
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
