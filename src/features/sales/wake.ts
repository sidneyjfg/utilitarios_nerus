import type { SalesResult, DateFilter } from "./types";

const STATUS_VALIDOS = [1, 9, 11, 15, 18, 20, 23];

export async function getSalesWake(
  preset: { token: string },
  filter: DateFilter
): Promise<SalesResult> {
  let pagina = 1;
  const limit = 50;

  const todosPedidos: any[] = [];

  const dataInicial = `${filter.dataInicio} 00:00:00`;
  const dataFinal = `${filter.dataFim} 23:59:59`;

  while (true) {
    const url = `https://api.fbits.net/pedidos?dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=${pagina}&quantidadeRegistros=${limit}&enumTipoFiltroData=DataPedido&direcaoOrdenacao=DESC`;

    console.log("🌐 URL:", url);

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${preset.token}`,
        accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro Wake: ${text}`);
    }

    const data = await res.json();
    const pedidos = data || [];

    console.log(`📦 Página ${pagina} - recebidos:`, pedidos.length);

    if (!pedidos.length) break;

    for (const p of pedidos) {
      todosPedidos.push(p);
    }

    if (pedidos.length < limit) break;

    pagina++;
  }

  console.log("📊 TOTAL GERAL:", todosPedidos.length);

  // 🔥 cálculos
  let totalPedidos = 0;
  let totalValor = 0;

  const marketplaces: SalesResult["marketplaces"] = {};

  const statusMap: Record<number, number> = {};

  for (const p of todosPedidos) {
    const status = p.situacaoPedidoId;
    const valor = Number(p.valorTotalPedido) || 0;
    const canal = p.canalOrigem || "OUTROS";

    // debug
    statusMap[status] = (statusMap[status] || 0) + 1;

    console.log("📄 Pedido:", {
      id: p.pedidoId,
      status,
      canal,
      valor,
    });

    if (!STATUS_VALIDOS.includes(status)) {
      console.log("❌ IGNORADO:", {
        id: p.pedidoId,
        status,
        valor,
      });
      continue;
    }

    totalPedidos++;
    totalValor += valor;

    // 🔥 marketplaces
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

    // wake não tem fulfillment → tudo vai como não fulfillment
    m.naoFulfillment.pedidos++;
    m.naoFulfillment.valor += valor;
  }

  console.log("📊 STATUS AGRUPADOS:", statusMap);

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

    supportsFulfillment: false, // 🔥 novo
  };
}