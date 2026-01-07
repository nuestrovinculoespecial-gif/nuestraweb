"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleVideoActualizado(cardId: string, clientId: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cards")
    .select("video_actualizado")
    .eq("card_id", cardId)
    .single();
  if (error) throw new Error(error.message);

  const { error: updErr } = await supabase
    .from("cards")
    .update({ video_actualizado: !data.video_actualizado })
    .eq("card_id", cardId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath(`/admin/clients/${clientId}`);
}
