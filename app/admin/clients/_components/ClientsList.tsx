import Link from "next/link";

export default function ClientsList({
  clients,
}: {
  clients: Array<{
    id_cliente: number;
    nombre?: string | null;
    email?: string | null;
    telefono?: string | null;
    created_at?: string | null;
  }>;
}) {
  return (
    <div className="border rounded">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="text-left p-3">Cliente</th>
            <th className="text-left p-3">Contacto</th>
            <th className="text-left p-3">Alta</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id_cliente} className="border-b last:border-b-0">
              <td className="p-3">
                <div className="font-medium">
                  {c.nombre ?? `Cliente #${c.id_cliente}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {c.id_cliente}
                </div>
              </td>
              <td className="p-3">
                <div>{c.email ?? "-"}</div>
                <div>{c.telefono ?? "-"}</div>
              </td>
              <td className="p-3">
                {c.created_at ? new Date(c.created_at).toLocaleString() : "-"}
              </td>
              <td className="p-3 text-right">
                <Link className="underline" href={`/admin/clients/${c.id_cliente}`}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr>
              <td className="p-6 text-center text-muted-foreground" colSpan={4}>
                Sin resultados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
