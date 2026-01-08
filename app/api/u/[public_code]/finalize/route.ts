import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { replaceDriveFileContent } from "@/lib/drive";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ public_code: string }> }
) {
  try {
    const { public_code } = await params;
    console.log("FINALIZE public_code:", public_code);
    const { tempPath, mimeType } = await req.json();

    if (!tempPath) {
      return NextResponse.json({ error: "Missing tempPath" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1) Buscar la card
    const { data: card, error } = await supabase
      .from("cards")
      .select("card_id, drive_file_id, upload_enabled")
      .eq("public_code", public_code)
      .single();

    if (error || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (!card.upload_enabled) {
      return NextResponse.json({ error: "Upload disabled" }, { status: 403 });
    }

    // 2) Descargar temp desde Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("videos")
      .download(tempPath);

    if (downloadError || !fileData) {
      console.error(downloadError);
      return NextResponse.json(
        { error: "Cannot download temp file" },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3) Reemplazar contenido en Drive (MISMO fileId)
    await replaceDriveFileContent({
      fileId: card.drive_file_id,
      buffer,
      mimeType: mimeType || "video/mp4",
    });

    // 4) Borrar temp
    await supabase.storage.from("videos").remove([tempPath]);

    // 5) Marcar estado
    await supabase
      .from("cards")
      .update({
        video_actualizado: true,
        upload_enabled: false,
        upload_disabled_at: new Date().toISOString(),
        recorded_at: new Date().toISOString(),
      })
      .eq("card_id", card.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
