"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";

type DealerRow = Database["public"]["Tables"]["dealers"]["Row"];

type ProvinceOpt = { id: string; name: string };
type PackageOpt = { id: string; name: string; price: number };

type LatestSub = {
  id: string;
  status: string;
  package_id: string;
};

type Props = {
  dealer: DealerRow;
  provinces: ProvinceOpt[];
  packages: PackageOpt[];
  latestSub: LatestSub | null;
};

function mapPatchError(code: string | undefined, t: (k: string) => string) {
  switch (code) {
    case "unauthorized":
      return t("dealerAdminErrUnauthorized");
    case "forbidden":
      return t("dealerAdminErrForbidden");
    case "service_role_missing":
      return t("dealerAdminErrService");
    case "invalid_body":
    case "empty_body":
      return t("dealerAdminErrInvalid");
    case "update_failed":
      return t("dealerAdminErrUpdate");
    case "confirm_mismatch":
      return t("dealerAdminErrConfirmMismatch");
    case "dealer_has_listings":
      return t("dealerAdminErrHasListings");
    case "delete_failed":
      return t("dealerAdminErrDelete");
    case "subscription_not_pending_payment":
      return t("dealerAdminErrSubNotPending");
    case "subscription_not_found":
      return t("dealerAdminErrSubNotFound");
    case "package_not_found":
      return t("dealerAdminErrPackage");
    case "subscription_update_failed":
      return t("dealerAdminErrSubUpdate");
    case "manager_not_found":
      return t("dealerAdminErrManager");
    default:
      return t("dealerAdminErrGeneric");
  }
}

export function DealerAdminPanel({ dealer, provinces, packages, latestSub }: Props) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const [businessName, setBusinessName] = useState(dealer.business_name);
  const [provinceId, setProvinceId] = useState(dealer.province_id ?? provinces[0]?.id ?? "");
  const [contactEmail, setContactEmail] = useState(dealer.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(dealer.contact_phone ?? "");
  const [address, setAddress] = useState(dealer.address ?? "");
  const [isActive, setIsActive] = useState(dealer.is_active);

  const [packageId, setPackageId] = useState(
    latestSub?.status === "pending_payment"
      ? latestSub.package_id
      : packages[0]?.id ?? "",
  );

  const [savePending, setSavePending] = useState(false);
  const [subPending, setSubPending] = useState(false);
  const [statusPending, setStatusPending] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePending, setDeletePending] = useState(false);

  const canChangePackage = latestSub?.status === "pending_payment";

  async function saveProfile() {
    setSavePending(true);
    try {
      const res = await fetch(`/api/admin/dealers/${dealer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          provinceId: provinceId || undefined,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          address: address.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(mapPatchError(typeof body?.error === "string" ? body.error : undefined, t));
        return;
      }
      toast.success(t("dealerAdminSaved"));
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSavePending(false);
    }
  }

  async function saveBlockedState(next: boolean) {
    setStatusPending(true);
    try {
      const res = await fetch(`/api/admin/dealers/${dealer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(mapPatchError(typeof body?.error === "string" ? body.error : undefined, t));
        return;
      }
      setIsActive(next);
      toast.success(next ? t("dealerAdminActivated") : t("dealerAdminBlocked"));
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setStatusPending(false);
    }
  }

  async function saveSubscriptionPackage() {
    if (!canChangePackage) return;
    setSubPending(true);
    try {
      const res = await fetch(`/api/admin/dealers/${dealer.id}/subscription`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(mapPatchError(typeof body?.error === "string" ? body.error : undefined, t));
        return;
      }
      toast.success(t("dealerAdminSubPackageUpdated"));
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSubPending(false);
    }
  }

  async function confirmDelete() {
    setDeletePending(true);
    try {
      const res = await fetch(`/api/admin/dealers/${dealer.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmDealerId: deleteConfirm.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.error === "dealer_has_listings") {
          toast.error(t("dealerAdminErrHasListingsDetail", { count: body.count ?? 0 }));
        } else {
          toast.error(mapPatchError(typeof body?.error === "string" ? body.error : undefined, t));
        }
        return;
      }
      toast.success(t("dealerAdminDeleted"));
      router.replace("/admin/dealers");
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setDeletePending(false);
      setDeleteOpen(false);
      setDeleteConfirm("");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dealerAdminEditTitle")}</CardTitle>
          <CardDescription>{t("dealerAdminEditHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{tCommon("name")}</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tCommon("province")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={provinceId}
                onChange={(e) => setProvinceId(e.target.value)}
              >
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{tCommon("email")}</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{tCommon("phone")}</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{tCommon("address")}</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <LoadingButton type="button" onClick={() => void saveProfile()} loading={savePending}>
            {tCommon("save")}
          </LoadingButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dealerAdminAccessTitle")}</CardTitle>
          <CardDescription>{t("dealerAdminAccessHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {isActive ? t("dealerAdminStatusActive") : t("dealerAdminStatusBlocked")}
          </span>
          <div className="flex gap-2">
            <LoadingButton
              type="button"
              variant={isActive ? "outline" : "default"}
              size="sm"
              loading={statusPending}
              disabled={isActive}
              onClick={() => void saveBlockedState(true)}
            >
              {t("dealerActivate")}
            </LoadingButton>
            <LoadingButton
              type="button"
              variant={!isActive ? "outline" : "destructive"}
              size="sm"
              loading={statusPending}
              disabled={!isActive}
              onClick={() => void saveBlockedState(false)}
            >
              {t("dealerSuspend")}
            </LoadingButton>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dealerAdminSubscriptionTitle")}</CardTitle>
          <CardDescription>
            {canChangePackage
              ? t("dealerAdminSubscriptionPendingHint")
              : t("dealerAdminSubscriptionLockedHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestSub ? (
            <p className="text-sm text-muted-foreground">
              {t("dealerAdminCurrentSubStatus", { status: latestSub.status })}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label>{t("packagesTitle")}</Label>
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-border bg-card px-3 text-sm"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              disabled={!canChangePackage}
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {Number(p.price).toLocaleString()} {tCommon("currency")}
                </option>
              ))}
            </select>
          </div>
          <LoadingButton
            type="button"
            onClick={() => void saveSubscriptionPackage()}
            loading={subPending}
            disabled={!canChangePackage}
          >
            {t("dealerAdminApplyPackage")}
          </LoadingButton>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{t("dealerAdminDangerTitle")}</CardTitle>
          <CardDescription>{t("dealerAdminDangerHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            {t("dealerAdminDeleteOpen")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dealerAdminDeleteTitle")}</DialogTitle>
            <DialogDescription>{t("dealerAdminDeleteBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground">{dealer.id}</Label>
            <Input
              placeholder={t("dealerAdminDeletePlaceholder")}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <LoadingButton
              type="button"
              variant="destructive"
              loading={deletePending}
              disabled={deleteConfirm.trim() !== dealer.id}
              onClick={() => void confirmDelete()}
            >
              {tCommon("delete")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
