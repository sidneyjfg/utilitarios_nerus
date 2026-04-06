import type { SalesResult, DateFilter } from "./types";

const STATUS_VALIDOS = ["Pago", "Enviado", "Entregue"];

export async function getSalesWake(
  preset: { token: string },
  filter: DateFilter
): Promise<SalesResult> {
  const res = await fetch(
    `https://api.fbits.net/pedidos?dataInicial=${filter.dataInicio}&dataFinal=${filter.dataFim}`,
    {
      headers: {
        Authorization: `Basic ${preset.token}`,
        accept: "application/json",
      },
    }
  );

  const data = await res.json();
  const pedidos = data || [];

  let totalPedidos = 0;
  let totalValor = 0;

  for (const p of pedidos) {
    if (!STATUS_VALIDOS.includes(p.status)) continue;

    totalPedidos++;
    totalValor += p.valorTotal || 0;
  }

  return { totalPedidos, totalValor };
}