import type { DateFilter, SalesResult } from "./types";

async function autenticar(preset: any) {
  const res = await fetch("https://api.plugg.to/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=password&client_id=${preset.client_id}&client_secret=${preset.client_secret}&username=${preset.username}&password=${preset.password}`,
  });

  const data = await res.json();

  console.log("🔑 TOKEN:", data);

  return data.access_token;
}

const STATUS_VALIDOS = ["shipped", "invoiced", "delivered", "approved"];

export async function getSalesPluggto(
  preset: any,
  filter: DateFilter
): Promise<SalesResult> {
  const token = await autenticar(preset);

  const url = `https://api.plugg.to/orders?created=${filter.dataInicio}`;

  console.log("🌐 URL:", url);

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  console.log("📦 RESPOSTA COMPLETA:", data);

  const pedidos = data?.result || [];

  console.log("📊 TOTAL DE PEDIDOS RECEBIDOS:", pedidos.length);

  let totalPedidos = 0;
  let totalValor = 0;

  const statusMap: Record<string, number> = {};

  for (const p of pedidos) {
    const order = p?.Order;

    if (!order) {
      console.log("⚠️ Pedido sem estrutura Order:", p);
      continue;
    }

    const status = order.status || "SEM_STATUS";
    const canal = order.channel || "SEM_CANAL";
    const valor = Number(order.total) || 0;

    // agrupar status
    statusMap[status] = (statusMap[status] || 0) + 1;

    console.log("📄 Pedido:", {
      id: order.id,
      status,
      canal,
      valor,
    });

    if (!STATUS_VALIDOS.includes(status)) {
      console.log("❌ IGNORADO:", {
        id: order.id,
        status,
        valor,
      });
      continue;
    }

    totalPedidos++;
    totalValor += valor;
  }

  console.log("📊 STATUS AGRUPADOS:", statusMap);

  // 🔥 retorno no formato correto (evita erro no React)
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

    marketplaces: {},
  };
}