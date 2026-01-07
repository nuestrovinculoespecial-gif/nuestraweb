"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}


export async function createClientAction(formData: FormData) {
     console.log("ENTRIES:", Array.from(formData.entries()));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;

  if (!nombre) throw new Error("Nombre obligatorio");

  const supabase = supabaseAdmin();

  // Ajusta aquí los campos reales de tu tabla clientes
  const { data, error } = await supabase
    .from("clientes")
    .insert({ nombre_apellidos: nombre, email })
    .select("id_cliente")
    .single();

  if (error) throw new Error(error.message);

  redirect(`/admin/clients/${data.id_cliente}`);
}
