import type { DateFilter, SalesResult } from "./types";

async function autenticar(preset: any) {
  const res = await fetch("https://api.plugg.to/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=password&client_id=2b0b2d876040e1dd877c66c3f2a1e479&client_secret=30d0629499e504d6990fa1cbc2315e7f&username=${preset.username}&password=${preset.password}`,
  });

  const data = await res.json();
  return data.access_token;
}

const STATUS_VALIDOS = ["shipped", "invoiced", "delivered", "approved"];

export async function getSalesPluggto(
  preset: any,
  filter: DateFilter
): Promise<SalesResult> {
  const token = await autenticar(preset);

  const res = await fetch(
    `https://api.plugg.to/orders?created=${filter.dataInicio}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  const pedidos = data?.result || [];

  let totalPedidos = 0;
  let totalValor = 0;

  for (const p of pedidos) {
    if (!STATUS_VALIDOS.includes(p.status)) continue;

    totalPedidos++;
    totalValor += p.total || 0;
  }

  return { totalPedidos, totalValor };
}