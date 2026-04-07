import type { SalesResult, DateFilter } from "./types";

async function autenticar(preset: any) {
  const res = await fetch(`${preset.url_tray}/web_api/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      consumer_key: preset.consumer_key,
      consumer_secret: preset.consumer_secret,
      code: preset.code,
    }),
  });

  const data = await res.json();
  return data.access_token;
}

export async function getSalesTray(
  preset: any,
  filter: DateFilter
): Promise<SalesResult> {
  const token = await autenticar(preset);

  let page = 1;
  const limit = 50;

  const todosPedidos: any[] = [];

  const modified = `${filter.dataInicio},${filter.dataFim}`;

  while (true) {
    const url = `${preset.url_tray}/web_api/orders?access_token=${token}&page=${page}&limit=${limit}&modified=${modified}`;

    console.log("🌐 URL:", url);

    const res = await fetch(url);
    const data = await res.json();

    const pedidos = data?.Orders || [];

    console.log(`📦 Página ${page} - recebidos:`, pedidos.length);

    if (!pedidos.length) break;

    todosPedidos.push(...pedidos);

    if (pedidos.length < limit) break;

    page++;
  }

  console.log("📊 TOTAL GERAL:", todosPedidos.length);

  const statusValidos = preset.statusValidos || [];

  let totalPedidos = 0;
  let totalValor = 0;

  const marketplaces: SalesResult["marketplaces"] = {};

  for (const p of todosPedidos) {
    const order = p.Order;

    if (!order) continue;

    const status = order.status;
    const valor = Number(order.total) || 0;

    // fallback (Tray não tem marketplace real)
    const canal = order.payment_form || "OUTROS";

    if (statusValidos.length && !statusValidos.includes(status)) continue;

    totalPedidos++;
    totalValor += valor;

    if (!marketplaces[canal]) {
      marketplaces[canal] = {
        totalPedidos: 0,
        totalValor: 0,
        fulfillment: { pedidos: 0, valor: 0 },
        naoFulfillment: { pedidos: 0, valor: 0 },
      };
    }

    const m = marketplaces[canal];

    m.totalPedidos++;
    m.totalValor += valor;
    m.naoFulfillment.pedidos++;
    m.naoFulfillment.valor += valor;
  }

  return {
    totalPedidos,
    totalValor,

    fulfillment: {
      pedidos: 0,
      valor: 0,
    },

    naoFulfillment: {
      pedidos: totalPedidos,
      valor: totalValor,
    },

    marketplaces,

    supportsFulfillment: false,
  };
}