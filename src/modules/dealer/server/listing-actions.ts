"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createDraftDealerListing(input: {
  dealerId: string;
  title: string;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data, error } = await supabase
    .from("vehicle_listings")
    .insert({
      title: input.title,
      seller_type: "dealer",
      dealer_id: input.dealerId,
      status: "draft",
      currency: "MZN",
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("insert_failed");

  revalidatePath("/dealer/listings");
  return { listingId: data.id };
}
