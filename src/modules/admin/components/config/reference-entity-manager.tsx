"use client";

import { useState, useTransition } from "react";
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
import type { ReferenceMutationResult } from "@/modules/admin/server/reference-data-actions";
import {
  deleteBodyType,
  deleteProvince,
  deleteVehicleBrand,
  deleteVehicleModel,
  saveBodyType,
  saveProvince,
  saveVehicleBrand,
  saveVehicleModel,
} from "@/modules/admin/server/reference-data-actions";

type ProvinceRow = Database["public"]["Tables"]["provinces"]["Row"];
type BodyTypeRow = Database["public"]["Tables"]["body_types"]["Row"];
type BrandRow = Database["public"]["Tables"]["vehicle_brands"]["Row"];
type ModelRow = Database["public"]["Tables"]["vehicle_models"]["Row"];

type Props =
  | { kind: "province"; locale: string; rows: ProvinceRow[] }
  | { kind: "body_type"; locale: string; rows: BodyTypeRow[] }
  | { kind: "brand"; locale: string; rows: BrandRow[] }
  | { kind: "model"; locale: string; rows: ModelRow[]; brands: { id: string; name: string }[] };

function slugify(raw: string) {
  return (
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

function toastMutation(
  t: (key: string) => string,
  r: ReferenceMutationResult,
  okMode: "save" | "delete" | "silent",
): void {
  if (r.ok) {
    if (okMode === "save") toast.success(t("saved"));
    if (okMode === "delete") toast.success(t("deleted"));
    return;
  }
  if (r.code === "unauthorized") toast.error(t("unauthorized"));
  else if (r.code === "in_use") toast.error(t("inUse"));
  else if (r.code === "duplicate") toast.error(t("duplicateSlug"));
  else toast.error(t("unknownError"));
}

export function ReferenceEntityManager(props: Props) {
  const { kind, locale } = props;
  const t = useTranslations("ConfigRef");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [logoUrl, setLogoUrl] = useState("");
  const [brandId, setBrandId] = useState("");

  const brands = kind === "model" ? props.brands : [];

  function openCreate() {
    setSelectedId(null);
    setName("");
    setSlug("");
    setIsActive(true);
    setLogoUrl("");
    setBrandId(brands[0]?.id ?? "");
    setEditorOpen(true);
  }

  function openEdit(row: ProvinceRow | BodyTypeRow | BrandRow | ModelRow) {
    setSelectedId(row.id);
    setName(row.name);
    setSlug(row.slug);
    setIsActive(row.is_active);
    setLogoUrl(kind === "brand" ? (row as BrandRow).logo_url ?? "" : "");
    setBrandId(kind === "model" ? (row as ModelRow).brand_id : "");
    setEditorOpen(true);
  }

  function openDelete(id: string) {
    setSelectedId(id);
    setDeleteOpen(true);
  }

  function runSave() {
    startTransition(async () => {
      let r: ReferenceMutationResult;
      const slugFinal = slug.trim().toLowerCase() || slugify(name.trim());
      if (kind === "province") {
        r = await saveProvince(locale, {
          id: selectedId ?? undefined,
          name,
          slug: slugFinal,
          is_active: isActive,
        });
      } else if (kind === "body_type") {
        r = await saveBodyType(locale, {
          id: selectedId ?? undefined,
          name,
          slug: slugFinal,
          is_active: isActive,
        });
      } else if (kind === "brand") {
        r = await saveVehicleBrand(locale, {
          id: selectedId ?? undefined,
          name,
          slug: slugFinal,
          is_active: isActive,
          logo_url: logoUrl.trim() || null,
        });
      } else {
        if (!brandId) {
          toast.error(t("pickBrand"));
          return;
        }
        r = await saveVehicleModel(locale, {
          id: selectedId ?? undefined,
          brand_id: brandId,
          name,
          slug: slugFinal,
          is_active: isActive,
        });
      }
      toastMutation(t, r, "save");
      if (r.ok) {
        setEditorOpen(false);
        router.refresh();
      }
    });
  }

  function runDelete() {
    if (!selectedId) return;
    startTransition(async () => {
      let r: ReferenceMutationResult;
      if (kind === "province") r = await deleteProvince(locale, selectedId);
      else if (kind === "body_type") r = await deleteBodyType(locale, selectedId);
      else if (kind === "brand") r = await deleteVehicleBrand(locale, selectedId);
      else r = await deleteVehicleModel(locale, selectedId);
      toastMutation(t, r, "delete");
      if (r.ok) {
        setDeleteOpen(false);
        setSelectedId(null);
        router.refresh();
      }
    });
  }

  function toggleQuick(row: ProvinceRow | BodyTypeRow | BrandRow | ModelRow) {
    startTransition(async () => {
      let r: ReferenceMutationResult;
      const next = !row.is_active;
      const s = row.slug;
      if (kind === "province") {
        r = await saveProvince(locale, { id: row.id, name: row.name, slug: s, is_active: next });
      } else if (kind === "body_type") {
        r = await saveBodyType(locale, { id: row.id, name: row.name, slug: s, is_active: next });
      } else if (kind === "brand") {
        const b = row as BrandRow;
        r = await saveVehicleBrand(locale, {
          id: b.id,
          name: b.name,
          slug: b.slug,
          is_active: next,
          logo_url: b.logo_url,
        });
      } else {
        const m = row as ModelRow;
        r = await saveVehicleModel(locale, {
          id: m.id,
          brand_id: m.brand_id,
          name: m.name,
          slug: m.slug,
          is_active: next,
        });
      }
      toastMutation(t, r, "silent");
      if (r.ok) router.refresh();
    });
  }

  const rows = props.rows;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <LoadingButton
          type="button"
          loading={pending}
          onClick={openCreate}
          size="sm"
          disabled={kind === "model" && brands.length === 0}
          title={kind === "model" && brands.length === 0 ? t("noBrands") : undefined}
        >
          <Plus className="h-4 w-4" />
          {t("add")}
        </LoadingButton>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("name")}</th>
                {kind === "model" ? <th className="px-4 py-3">{t("brand")}</th> : null}
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">{tCommon("status")}</th>
                <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  {kind === "model" ? (
                    <td className="px-4 py-3 text-muted-foreground">
                      {brands.find((b) => b.id === (row as ModelRow).brand_id)?.name ?? "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-muted-foreground">{row.slug}</td>
                  <td className="px-4 py-3">
                    <Badge variant={row.is_active ? "success" : "secondary"}>
                      {row.is_active ? tCommon("active") : tCommon("inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
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
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {tCommon("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleQuick(row)}>
                          <Power className="mr-2 h-4 w-4" />
                          {row.is_active ? t("deactivate") : t("activate")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => openDelete(row.id)}>
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
          {rows.length === 0 ? (
            <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {tCommon("noData")}
            </div>
          ) : null}
        </div>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedId ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{t("dialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {kind === "model" ? (
              <div className="space-y-2">
                <Label htmlFor="ref-brand">{t("brand")}</Label>
                <select
                  id="ref-brand"
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="ref-name">{tCommon("name")}</Label>
              <Input id="ref-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-slug">{t("slug")}</Label>
              <Input
                id="ref-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={slugify(name)}
              />
            </div>
            {kind === "brand" ? (
              <div className="space-y-2">
                <Label htmlFor="ref-logo">Logo URL ({tCommon("optional")})</Label>
                <Input id="ref-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              </div>
            ) : null}
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
