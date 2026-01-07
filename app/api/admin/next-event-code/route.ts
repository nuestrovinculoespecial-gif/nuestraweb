import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const year = new Date().getFullYear();
    const prefix = `EV-${year}-`;

    // Trae el último event_code de este año
    const { data, error } = await supabase
      .from("Eventos")
      .select("event_code")
      .like("event_code", `${prefix}%`)
      .order("event_code", { ascending: false })
      .limit(1);

    if (error) throw error;

    const last = data?.[0]?.event_code as string | undefined;

    let nextNumber = 1;
    if (last) {
      const lastNum = parseInt(last.replace(prefix, ""), 10);
      if (!Number.isNaN(lastNum)) nextNumber = lastNum + 1;
    }

    const next = `${prefix}${String(nextNumber).padStart(4, "0")}`;
    return Response.json({ ok: true, event_code: next });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
