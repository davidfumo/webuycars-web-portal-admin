"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDraftDealerListing } from "@/modules/dealer/server/listing-actions";

export function NewDealerListingForm({ dealerId }: { dealerId: string }) {
  const t = useTranslations("Dealer");
  const tList = useTranslations("Listing");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await createDraftDealerListing({ dealerId, title });
      toast.success(tCommon("success"));
      router.replace("/dealer/listings");
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{t("listingNew")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="title">{tCommon("name")}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {tList("saveDraft")}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
