import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadOrReplaceVideoToDrive } from "@/lib/drive";

type Params = { public_code: string };

export async function POST(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { public_code } = await context.params;

  const form = await req.formData();
  const token = String(form.get("t") ?? "");
  const file = form.get("video") as File | null;

  if (!file) return NextResponse.json({ error: "Falta vídeo" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Token inválido" }, { status: 403 });

  const supabase = getSupabaseAdmin();

  // OJO: aquí estabas usando card_code (variable inexistente)
  // Si tu ruta es /api/u/[public_code], normalmente "public_code" es el código de la card.
  const { data: card, error } = await supabase
    .from("cards")
    .select("card_id, card_code, upload_token, drive_file_id, event_fk, card_index")
    .eq("card_code", public_code)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: "Card no encontrada" }, { status: 404 });
  }
  if (!card.upload_token || card.upload_token !== token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Datos del evento
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

  // Actualiza grupo
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
    })
    .eq("event_fk", card.event_fk)
    .gte("card_index", startIndex)
    .lte("card_index", endIndex);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, public_code });
}
