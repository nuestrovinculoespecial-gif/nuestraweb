"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { uploadOrReplaceVideoToDrive } from "@/lib/drive";
import { createEventFolder } from "@/lib/drive";
import { getSupabaseAdmin } from "@/lib/supabase/admin";



export async function generateCardsForEvent(formData: FormData) {
  const events_id = Number(formData.get("events_id"));
  const id_cliente = String(formData.get("id_cliente") ?? "");

  if (!events_id || !id_cliente) throw new Error("Faltan params");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("generate_missing_cards", {
    p_event_id: events_id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/clients/${id_cliente}`);
}

export async function createEventAction(formData: FormData) {

  const id_cliente = Number(formData.get("id_cliente"));
  const tipo_evento = String(formData.get("tipo_evento") ?? "").trim();
  const fecha_evento = String(formData.get("fecha_evento") ?? "");
  const numero_tags_diferentes = Number(formData.get("numero_tags_diferentes"));
  const numero_tags_tipo = Number(formData.get("numero_tags_tipo")); // input
  const pagado = formData.get("pagado") === "on";
  const generate_cards = formData.get("generate_cards") === "on";
  const modalidad_video = String(formData.get("modalidad_video") ?? "").trim();

  if (!Number.isFinite(id_cliente)) throw new Error("id_cliente inválido");
  if (!tipo_evento) throw new Error("Falta tipo_evento");
  if (!fecha_evento) throw new Error("Falta fecha_evento");

  const supabase = getSupabaseAdmin();

  // 1) Crear evento con event_code autogenerado
  const { data, error } = await supabase.rpc("create_event_with_code", {
    p_id_cliente: id_cliente,
    p_tipo_evento: tipo_evento,
    p_fecha_evento: fecha_evento,
    p_numero_tags_diferentes: numero_tags_diferentes,
    p_numero_tags_tipo: numero_tags_tipo,
    p_pagado: pagado,
    p_modalidad_video: modalidad_video,
  });

  if (error) throw new Error(error.message);
  console.log("RPC create_event_with_code devuelve:", data);

  const created = Array.isArray(data) ? data[0] : data;
  if (!created?.event_code) {
    throw new Error("NO VIENE event_code en la respuesta de la RPC");
  }
  const events_id = created?.events_id;
  const event_code = created?.event_code;
  if (!events_id) throw new Error("No se pudo obtener events_id");
  if (!event_code) throw new Error("No se pudo obtener event_code");

  const { id: drive_folder_id } = await createEventFolder(event_code);

  const { error: updEventErr } = await supabase
    .from('Eventos')
    .update({ drive_folder_id })
    .eq("events_id", events_id);

  if (updEventErr) throw new Error(updEventErr.message);


  // 2) (Opcional) generar cards inmediatamente
  if (generate_cards && events_id) {
    const { error: rpcErr } = await supabase.rpc("generate_missing_cards", {
      p_event_id: events_id,
    });
    if (rpcErr) throw new Error(rpcErr.message);
  }

  revalidatePath(`/admin/clients/${id_cliente}`);
}

export async function uploadCardVideoAction(formData: FormData) {
  try {

    console.log("card_id raw =", formData.get("card_id"));

    const client_id = String(formData.get("client_id") ?? "");
    const file = formData.get("video") as File | null;
    const card_id = String(formData.get("card_id") ?? "").trim();
    if (!card_id) throw new Error("card_id inválido");


    if (!file) throw new Error("Falta archivo de vídeo");

    const supabase = getSupabaseAdmin();

    const { data: card, error: cardErr } = await supabase
      .from("cards")
      .select("card_id, drive_file_id, card_code, event_fk, card_index")
      .eq("card_id", card_id)
      .single();

    if (cardErr) throw new Error("cardErr: " + cardErr.message);
    if (!card?.event_fk) throw new Error("La card no tiene event_fk");

   
    const { data: ev, error: evErr } = await supabase
      .from("Eventos")
      .select("drive_folder_id,num_tags_tipo")
      .eq("events_id", card.event_fk)
      .single();

    if (evErr) throw new Error("evErr: " + evErr.message);
    if (!ev?.drive_folder_id) throw new Error("Evento sin drive_folder_id");
    if (!ev?.num_tags_tipo) throw new Error("Evento sin num_tags_tipo");

    if (!card.card_index) throw new Error("Card sin card_index");

    const groupIndex = Math.ceil(card.card_index / ev.num_tags_tipo); // 1..numero_tags_diferentes
    const folderId = ev.drive_folder_id;
    const fileName = `TAG-${groupIndex}.mp4`;

    // 👇 OJO: aquí aún no hemos alineado la firma con tu drive.ts
    const result = await uploadOrReplaceVideoToDrive({
      folderId,
      fileName,
      file,
    });
  console.log("Drive result:", result);

const stableViewUrl = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
    const startIndex = (groupIndex - 1) * ev.num_tags_tipo + 1;
    const endIndex = groupIndex * ev.num_tags_tipo;

    const { error: updCardsErr } = await supabase
      .from("cards")
      .update({
        drive_file_id: result.fileId,
        video_actualizado: true,
        initial_video_url: stableViewUrl,
      })
      .eq("event_fk", card.event_fk)
      .gte("card_index", startIndex)
      .lte("card_index", endIndex);

    if (updCardsErr) throw new Error("updCardsErr: " + updCardsErr.message);


    if (client_id) revalidatePath(`/admin/clients/${client_id}`, "page");
  } catch (e: any) {
    console.error("uploadCardVideoAction FALLÓ:", e?.message ?? e);
    throw e;
  }
}
