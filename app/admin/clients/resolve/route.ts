import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1) Intento: q como event_code exacto
  const { data: evExact } = await supabase
    .from("Eventos")
    .select("client_id, events_id, event_code")
    .eq("event_code", q)
    .limit(1)
    .maybeSingle();

  if (evExact?.client_id) {
    return NextResponse.json({
      ok: true,
      kind: "event_code",
      client_id: evExact.client_id,
      events_id: evExact.events_id,
    });
  }

  // 2) Intento: q contenido en event_code (por si pegan parte)
  const { data: evLike } = await supabase
    .from("Eventos")
    .select("client_id, events_id, event_code")
    .ilike("event_code", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (evLike?.client_id) {
    return NextResponse.json({
      ok: true,
      kind: "event_code_like",
      client_id: evLike.client_id,
      events_id: evLike.events_id,
    });
  }

  return NextResponse.json({ ok: false, reason: "not_found" });
}
