"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Trash2, Power } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  deleteDealerPackage,
  saveDealerPackage,
  type DealerPackageFormInput,
  type PackageMutationResult,
} from "@/modules/admin/server/dealer-package-actions";

type PackageRow = Database["public"]["Tables"]["dealer_packages"]["Row"];
type ScopeFilter = "all" | "dealer" | "private";

function rowScope(r: PackageRow): PackageRow["seller_scope"] {
  const s = (r as { seller_scope?: PackageRow["seller_scope"] }).seller_scope;
  if (s === "private" || s === "all" || s === "dealer") return s;
  return "dealer";
}

function slugify(raw: string) {
  return (
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "plan"
  );
}

function toastPackage(
  t: (key: string) => string,
  r: PackageMutationResult,
  ok: "save" | "delete" | "silent",
) {
  if (r.ok) {
    if (ok === "save") toast.success(t("saved"));
    if (ok === "delete") toast.success(t("deleted"));
    return;
  }
  if (r.code === "unauthorized") toast.error(t("unauthorized"));
  else if (r.code === "in_use") toast.error(t("inUse"));
  else if (r.code === "duplicate") toast.error(t("duplicateSlug"));
  else if (r.code === "validation" && r.messageKey) toast.error(t(r.messageKey));
  else toast.error(t("unknownError"));
}

type Props = {
  locale: string;
  rows: PackageRow[];
  usageByPackageId: Record<string, number>;
};

export function DealerPackagesManager({ locale, rows, usageByPackageId }: Props) {
  const t = useTranslations("PackagesAdmin");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sellerScope, setSellerScope] = useState<PackageRow["seller_scope"]>("dealer");
  const [listingLimit, setListingLimit] = useState("10");
  const [price, setPrice] = useState("0");
  const [priceExtra, setPriceExtra] = useState("0");
  const [durationDays, setDurationDays] = useState("30");
  const [featured, setFeatured] = useState("0");
  const [sponsored, setSponsored] = useState("0");
  const [prioritySupport, setPrioritySupport] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const filteredRows = useMemo(() => {
    if (scopeFilter === "all") return rows;
    if (scopeFilter === "dealer") {
      return rows.filter((r) => {
        const s = rowScope(r);
        return s === "dealer" || s === "all";
      });
    }
    return rows.filter((r) => {
      const s = rowScope(r);
      return s === "private" || s === "all";
    });
  }, [rows, scopeFilter]);

  function openCreate() {
    setSelectedId(null);
    setName("");
    setSlug("");
    setSellerScope("dealer");
    setListingLimit("10");
    setPrice("0");
    setPriceExtra("0");
    setDurationDays("30");
    setFeatured("0");
    setSponsored("0");
    setPrioritySupport(false);
    setIsActive(true);
    setEditorOpen(true);
  }

  function openEdit(p: PackageRow) {
    setSelectedId(p.id);
    setName(p.name);
    setSlug(p.slug);
    setSellerScope(rowScope(p));
    setListingLimit(String(p.listing_limit));
    setPrice(String(p.price));
    setPriceExtra(String(p.price_per_extra_listing));
    setDurationDays(String(p.duration_days));
    setFeatured(String(p.featured_listing_allowance));
    setSponsored(String(p.sponsored_listing_allowance));
    setPrioritySupport(p.priority_support);
    setIsActive(p.is_active);
    setEditorOpen(true);
  }

  function openDelete(id: string) {
    setSelectedId(id);
    setDeleteOpen(true);
  }

  function buildPayload(): DealerPackageFormInput {
    return {
      id: selectedId ?? undefined,
      name,
      slug,
      listing_limit: listingLimit,
      price,
      price_per_extra_listing: priceExtra,
      duration_days: durationDays,
      featured_listing_allowance: featured,
      sponsored_listing_allowance: sponsored,
      priority_support: prioritySupport,
      is_active: isActive,
      seller_scope: sellerScope,
    };
  }

  function runSave() {
    startTransition(async () => {
      const r = await saveDealerPackage(locale, buildPayload());
      toastPackage(t, r, "save");
      if (r.ok) {
        setEditorOpen(false);
        router.refresh();
      }
    });
  }

  function runDelete() {
    if (!selectedId) return;
    startTransition(async () => {
      const r = await deleteDealerPackage(locale, selectedId);
      toastPackage(t, r, "delete");
      if (r.ok) {
        setDeleteOpen(false);
        setSelectedId(null);
        router.refresh();
      }
    });
  }

  function toggleActive(p: PackageRow) {
    startTransition(async () => {
      const r = await saveDealerPackage(locale, {
        id: p.id,
        name: p.name,
        slug: p.slug,
        listing_limit: String(p.listing_limit),
        price: String(p.price),
        price_per_extra_listing: String(p.price_per_extra_listing),
        duration_days: String(p.duration_days),
        featured_listing_allowance: String(p.featured_listing_allowance),
        sponsored_listing_allowance: String(p.sponsored_listing_allowance),
        priority_support: p.priority_support,
        is_active: !p.is_active,
        seller_scope: rowScope(p),
      });
      toastPackage(t, r, "silent");
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "dealer", "private"] as const).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={scopeFilter === key ? "default" : "outline"}
              onClick={() => setScopeFilter(key)}
            >
              {t(`filter_${key}`)}
            </Button>
          ))}
        </div>
        <LoadingButton type="button" size="sm" loading={pending} onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("add")}
        </LoadingButton>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">{tCommon("name")}</th>
                <th className="px-3 py-3">{t("columnScope")}</th>
                <th className="px-3 py-3">Slug</th>
                <th className="px-3 py-3">{t("columnListings")}</th>
                <th className="px-3 py-3">{t("columnPlanPrice")}</th>
                <th className="px-3 py-3">{t("columnPerListing")}</th>
                <th className="px-3 py-3">{t("columnDays")}</th>
                <th className="px-3 py-3">{t("columnUsage")}</th>
                <th className="px-3 py-3">{tCommon("status")}</th>
                <th className="px-3 py-3 text-right">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-3 font-medium">{p.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{t(`scope_${rowScope(p)}`)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{p.slug}</td>
                  <td className="px-3 py-3">{p.listing_limit}</td>
                  <td className="px-3 py-3">{Number(p.price).toLocaleString()}</td>
                  <td className="px-3 py-3">{Number(p.price_per_extra_listing).toLocaleString()}</td>
                  <td className="px-3 py-3">{p.duration_days}</td>
                  <td className="px-3 py-3">{usageByPackageId[p.id] ?? 0}</td>
                  <td className="px-3 py-3">
                    <Badge variant={p.is_active ? "success" : "secondary"}>
                      {p.is_active ? tCommon("active") : tCommon("inactive")}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={tCommon("actions")}
                          disabled={pending}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(p)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {tCommon("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(p)}>
                          <Power className="mr-2 h-4 w-4" />
                          {p.is_active ? t("deactivate") : t("activate")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => openDelete(p.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tCommon("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 ? (
            <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {tCommon("noData")}
            </div>
          ) : null}
        </div>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedId ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{t("editorHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="pkg-name">{tCommon("name")}</Label>
              <Input id="pkg-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-slug">{t("slug")}</Label>
              <Input
                id="pkg-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={slugify(name)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-scope">{t("columnScope")}</Label>
              <select
                id="pkg-scope"
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={sellerScope}
                onChange={(e) => setSellerScope(e.target.value as PackageRow["seller_scope"])}
              >
                <option value="dealer">{t("scope_dealer")}</option>
                <option value="private">{t("scope_private")}</option>
                <option value="all">{t("scope_all")}</option>
              </select>
              <p className="text-xs text-muted-foreground">{t("scopeHelp")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pkg-limit">{t("columnListings")}</Label>
                <Input id="pkg-limit" inputMode="numeric" value={listingLimit} onChange={(e) => setListingLimit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-days">{t("columnDays")}</Label>
                <Input id="pkg-days" inputMode="numeric" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pkg-price">{t("planPrice")}</Label>
                <Input id="pkg-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-extra">{t("perListingFee")}</Label>
                <Input id="pkg-extra" inputMode="decimal" value={priceExtra} onChange={(e) => setPriceExtra(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pkg-feat">{t("featuredAllowance")}</Label>
                <Input id="pkg-feat" inputMode="numeric" value={featured} onChange={(e) => setFeatured(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-spon">{t("sponsoredAllowance")}</Label>
                <Input id="pkg-spon" inputMode="numeric" value={sponsored} onChange={(e) => setSponsored(e.target.value)} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={prioritySupport}
                onChange={(e) => setPrioritySupport(e.target.checked)}
              />
              {t("prioritySupport")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {t("activeLabel")}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <LoadingButton type="button" loading={pending} onClick={runSave}>
              {tCommon("save")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <LoadingButton type="button" variant="destructive" loading={pending} onClick={runDelete}>
              {tCommon("delete")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
