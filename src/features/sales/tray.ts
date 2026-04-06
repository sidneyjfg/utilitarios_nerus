import type { SalesResult, DateFilter } from "./types";

async function autenticar(preset: any) {
  const res = await fetch(
    "https://SEU_DOMINIO/web_api/auth",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        consumer_key: preset.consumer_key,
        consumer_secret: preset.consumer_secret,
        code: preset.code,
      }),
    }
  );

  const data = await res.json();
  return data.access_token;
}

export async function getSalesTray(
  preset: any,
  filter: DateFilter
): Promise<SalesResult> {
  const token = await autenticar(preset);

  const res = await fetch(
    `https://SEU_DOMINIO/web_api/orders?access_token=${token}&date=${filter.dataInicio}`
  );

  const data = await res.json();
  const pedidos = data?.Orders || [];

  const statusValidos = preset.statusValidos || [];

  let totalPedidos = 0;
  let totalValor = 0;

  for (const p of pedidos) {
    const status = p.Order?.status;

    if (statusValidos.length && !statusValidos.includes(status)) continue;

    totalPedidos++;
    totalValor += Number(p.Order?.total || 0);
  }

  return { totalPedidos, totalValor };
}