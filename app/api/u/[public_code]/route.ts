import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin"; // el que ya usas
import { uploadOrReplaceVideoToDrive } from "@/lib/drive"; // ajusta la ruta real

export async function POST(req: Request, ctx: { params: Promise<{ card_code: string }> }) {
  const { card_code } = await ctx.params;

  const form = await req.formData();
  const token = String(form.get("t") ?? "");
  const file = form.get("video") as File | null;

  if (!file) return NextResponse.json({ error: "Falta vídeo" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Token inválido" }, { status: 403 });

  const supabase = getSupabaseAdmin();

  const { data: card, error } = await supabase
    .from("cards")
    .select("card_id, card_code, upload_token, drive_file_id, event_fk, card_index")
    .eq("card_code", card_code)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: "Card no encontrada" }, { status: 404 });
  }
  if (!card.upload_token || card.upload_token !== token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Necesitamos datos del evento para decidir folder + TAG-X.mp4 (igual que tu action)
  const { data: ev, error: evErr } = await supabase
    .from("Eventos")
    .select("drive_folder_id, num_tags_tipo")
    .eq("events_id", card.event_fk)
    .single();

  if (evErr || !ev?.drive_folder_id || !ev?.num_tags_tipo) {
    return NextResponse.json({ error: "Evento mal configurado" }, { status: 400 });
  }
  if (!card.card_index) {
    return NextResponse.json({ error: "Card sin card_index" }, { status: 400 });
  }

  const groupIndex = Math.ceil(card.card_index / ev.num_tags_tipo);
  const folderId = ev.drive_folder_id;
  const fileName = `TAG-${groupIndex}.mp4`;

  const result = await uploadOrReplaceVideoToDrive({ folderId, fileName, file });

  const viewUrl = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;

  // Actualiza el grupo de cards igual que haces ya
  const startIndex = (groupIndex - 1) * ev.num_tags_tipo + 1;
  const endIndex = groupIndex * ev.num_tags_tipo;

  const { error: updErr } = await supabase
    .from("cards")
    .update({
      drive_file_id: result.fileId,
      video_actualizado: true,
      initial_video_url: viewUrl,
      recording_status: "GRABADA",
      recorded_at: new Date().toISOString(),
      // notes: null,
    })
    .eq("event_fk", card.event_fk)
    .gte("card_index", startIndex)
    .lte("card_index", endIndex);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Redirige de vuelta a la página de la tarjeta (sin perder el token)
  return NextResponse.redirect(new URL(`/c/${encodeURIComponent(card_code)}?t=${encodeURIComponent(token)}`, req.url));
}
