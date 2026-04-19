import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadOrReplaceVideoToDrive } from "@/lib/drive";

export async function POST(
  req: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await context.params;
    const body = await req.json();

    const clientId = String(body?.clientId ?? "").trim();
    const tempPath = String(body?.tempPath ?? "").trim();
    const mimeType = String(body?.mimeType ?? "video/mp4").trim();

    if (!cardId) {
      return NextResponse.json({ error: "cardId inválido" }, { status: 400 });
    }

    if (!tempPath) {
      return NextResponse.json({ error: "tempPath obligatorio" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: card, error: cardErr } = await supabase
      .from("cards")
      .select("card_id, drive_file_id, card_code, event_fk, card_index")
      .eq("card_id", cardId)
      .single();

    if (cardErr) {
      return NextResponse.json({ error: "cardErr: " + cardErr.message }, { status: 400 });
    }

    if (!card?.event_fk) {
      return NextResponse.json({ error: "La card no tiene event_fk" }, { status: 400 });
    }

    const { data: ev, error: evErr } = await supabase
      .from("Eventos")
      .select("drive_folder_id, num_tags_tipo")
      .eq("events_id", card.event_fk)
      .single();

    if (evErr) {
      return NextResponse.json({ error: "evErr: " + evErr.message }, { status: 400 });
    }

    if (!ev?.drive_folder_id) {
      return NextResponse.json({ error: "Evento sin drive_folder_id" }, { status: 400 });
    }

    if (!ev?.num_tags_tipo) {
      return NextResponse.json({ error: "Evento sin num_tags_tipo" }, { status: 400 });
    }

    if (!card.card_index) {
      return NextResponse.json({ error: "Card sin card_index" }, { status: 400 });
    }

    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("videos")
      .download(tempPath);

    if (downloadErr || !fileData) {
      return NextResponse.json(
        { error: downloadErr?.message || "No se pudo descargar el vídeo temporal" },
        { status: 400 }
      );
    }

    const fileNameFromPath = tempPath.split("/").pop() || "upload.mp4";
    const file = new File([fileData], fileNameFromPath, {
      type: mimeType || fileData.type || "video/mp4",
    });

    const groupIndex = Math.ceil(card.card_index / ev.num_tags_tipo);
    const folderId = ev.drive_folder_id;
    const fileName = `TAG-${groupIndex}.mp4`;

    const result = await uploadOrReplaceVideoToDrive({
      folderId,
      fileName,
      file,
    });

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

    if (updCardsErr) {
      return NextResponse.json({ error: "updCardsErr: " + updCardsErr.message }, { status: 400 });
    }

    await supabase.storage.from("videos").remove([tempPath]);

    return NextResponse.json({
      ok: true,
      fileId: result.fileId,
      url: stableViewUrl,
      clientId,
    });
  } catch (e: any) {
    console.error("finalize-video FALLÓ:", e?.message ?? e);
    return NextResponse.json(
      { error: e?.message || "Error finalizando vídeo" },
      { status: 500 }
    );
  }
}