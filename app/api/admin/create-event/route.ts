import { createClient } from "@supabase/supabase-js";

type Payload = {
  cliente?: {
    id_cliente?: number;           // si ya existe, pásalo y listo
    nombre_apellidos?: string;
    telefono_contacto?: string;
    email?: string;                // si tu tabla tiene columna email, úsala
    dni?: string;
  };
  evento: {
    tipo_evento?: string;
    fecha_evento?: string;         // "YYYY-MM-DD"
    descripcion_evento?: string;
    pagado?: boolean;
    url_video_inicial?: string;
    drive_folder_id?: string;
  };
  cards: Array<{
    card_code: string;
    final_video_url: string;
  }>;
};

function supa() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getNextEventCode(supabase: ReturnType<typeof supa>) {
  const year = new Date().getFullYear();
  const prefix = `EV-${year}-`;

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

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  const supabase = supa();

  try {
    const body = (await req.json()) as Payload;
    console.log("PAYLOAD_RECIBIDO:", body);


    if (!body?.evento) {
      return Response.json({ ok: false, error: "Falta 'evento'." }, { status: 400 });
    }
    if (!Array.isArray(body.cards) || body.cards.length === 0) {
      return Response.json({ ok: false, error: "Falta 'cards' (mínimo 1 tarjeta)." }, { status: 400 });
    }
    for (const c of body.cards) {
      if (!c.card_code || !c.final_video_url) {
        return Response.json({ ok: false, error: "Cada card necesita card_code y final_video_url." }, { status: 400 });
      }
    }

    // 1) Cliente: usar existente si viene id_cliente; si no, intentar buscar por teléfono/email; si no, crear.
    let id_cliente: number | null = null;

    const cli = body.cliente ?? {};
    if (typeof cli.id_cliente === "number") {
      id_cliente = cli.id_cliente;
    } else {
      // Buscar por teléfono
      if (cli.telefono_contacto) {
        const { data, error } = await supabase
          .from("clientes")
          .select("id_cliente")
          .eq("telefono_contacto", cli.telefono_contacto)
          .limit(1);

        if (!error && data?.length) id_cliente = data[0].id_cliente;
      }

      // Buscar por email (si tu tabla tiene columna email; si no, lo ignoramos)
      if (!id_cliente && cli.email) {
        const { data, error } = await supabase
          .from("clientes")
          .select("id_cliente")
          // si no existe columna email, dará error y simplemente lo ignoramos
          .eq("email", cli.email)
          .limit(1);

        if (!error && data?.length) id_cliente = data[0].id_cliente;
      }

      // Crear si no existe
      if (!id_cliente) {
        if (!cli.nombre_apellidos) {
          return Response.json(
            { ok: false, error: "Para crear cliente nuevo falta cliente.nombre_apellidos (o pasa id_cliente existente)." },
            { status: 400 }
          );
        }

        // Intento 1: insertar con email (si existe)
        const baseInsert: any = {
          nombre_apellidos: cli.nombre_apellidos,
          telefono_contacto: cli.telefono_contacto ?? null,
          dni: cli.dni ?? null,
        };
        const withEmail: any = { ...baseInsert, ...(cli.email ? { email: cli.email } : {}) };

        let inserted = await supabase
          .from("clientes")
          .insert(withEmail)
          .select("id_cliente")
          .single();

        // Si falla por columna email inexistente, reintenta sin email
        if (inserted.error && cli.email) {
          inserted = await supabase
            .from("clientes")
            .insert(baseInsert)
            .select("id_cliente")
            .single();
        }

        if (inserted.error) throw inserted.error;
        id_cliente = inserted.data.id_cliente;
      }
    }

    // 2) Crear evento con event_code autogenerado
    const event_code = await getNextEventCode(supabase);

    const evInsert = {
      event_code,
      client_id: id_cliente,
      tipo_evento: body.evento.tipo_evento ?? null,
      fecha_evento: body.evento.fecha_evento ?? null,
      descripcion_evento: body.evento.descripcion_evento ?? null,
      pagado: body.evento.pagado ?? false,
      url_video_inicial: body.evento.url_video_inicial ?? null,
      drive_folder_id: body.evento.drive_folder_id ?? null,
    };

    const { data: ev, error: evErr } = await supabase
      .from("Eventos")
      .insert(evInsert)
      .select("events_id,event_code")
      .single();

    if (evErr) throw evErr;

    // 3) Crear cards: guardamos el vínculo usando cards.event_id = event_code (texto)
    const cardsToInsert = body.cards.map((c) => ({
      event_id: ev.event_code,            // vínculo lógico (texto)
      card_code: c.card_code,
      final_video_url: c.final_video_url,
      video_actualizado: true,            // como la NFC lleva final, lo marcamos true
    }));

    const { error: cardsErr } = await supabase
      .from("cards")
      .insert(cardsToInsert);

    if (cardsErr) throw cardsErr;

    return Response.json({
      ok: true,
      event: { events_id: ev.events_id, event_code: ev.event_code },
      cliente: { id_cliente },
      cards_count: body.cards.length,
    });
 } catch (e: any) {
    const errorPayload = {
      ok: false,
      message: e?.message ?? String(e),
      name: e?.name,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
      stack: e?.stack,
    };
    return Response.json(errorPayload, { status: 500 });
  }


}