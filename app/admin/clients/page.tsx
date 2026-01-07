import ClientsList from "./_components/ClientsList";
import { createClient } from "@/lib/supabase/server";
import ClientsSearch from "./_components/ClientsSearch";
import Link from "next/link";


export default async function Page({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q ?? "").trim();
  const supabase = await createClient();

  let query = supabase
    .from("clientes")
    .select("id_cliente, nombre_apellidos, email, telefono_contacto, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) {
    query = query.or(
      `nombre_apellidos.ilike.%${q}%,email.ilike.%${q}%,telefono_contacto.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <div className="p-6 space-y-4">
    <div className="flex items-end justify-between gap-3">
  <div>
    <h1 className="text-xl font-semibold">Clientes</h1>
    <p className="text-sm text-muted-foreground">
      Buscar y entrar a la ficha.
    </p>
  </div>

  <div className="flex items-center gap-3">
    <ClientsSearch />

    <Link
      href="/admin/clients/new"
      className="rounded bg-black px-3 py-2 text-sm text-white"
    >
      + Nuevo cliente
    </Link>
  </div>
</div>


      <ClientsList clients={data ?? []} />
    </div>
  );
}
