import type { SalesResult, DateFilter } from "./types";

type AnymarketOrder = {
    id: number;
    total: number;
    status: string;
    marketPlace: string;
    fulfillment: boolean;
};

const STATUS_VALIDOS = [
    "DELIVERED_ISSUE",
    "PAID_WAITING_SHIP",
    "INVOICED",
    "PAID_WAITING_DELIVERY",
    "CONCLUDED",
];

function calcularDetalhado(pedidos: AnymarketOrder[]): SalesResult {
    let totalPedidos = 0;
    let totalValor = 0;

    let fulfillmentPedidos = 0;
    let fulfillmentValor = 0;

    let naoFulfillmentPedidos = 0;
    let naoFulfillmentValor = 0;

    const marketplaces: SalesResult["marketplaces"] = {};

    for (const p of pedidos) {
        const valor = p.total || 0;
        const mp = p.marketPlace || "OUTROS";

        totalPedidos++;
        totalValor += valor;

        // geral
        if (p.fulfillment) {
            fulfillmentPedidos++;
            fulfillmentValor += valor;
        } else {
            naoFulfillmentPedidos++;
            naoFulfillmentValor += valor;
        }

        // marketplace
        if (!marketplaces[mp]) {
            marketplaces[mp] = {
                totalPedidos: 0,
                totalValor: 0,
                fulfillment: { pedidos: 0, valor: 0 },
                naoFulfillment: { pedidos: 0, valor: 0 },
            };
        }

        const m = marketplaces[mp];

        m.totalPedidos++;
        m.totalValor += valor;

        if (p.fulfillment) {
            m.fulfillment.pedidos++;
            m.fulfillment.valor += valor;
        } else {
            m.naoFulfillment.pedidos++;
            m.naoFulfillment.valor += valor;
        }
    }

    return {
        totalPedidos,
        totalValor,
        fulfillment: {
            pedidos: fulfillmentPedidos,
            valor: fulfillmentValor,
        },
        naoFulfillment: {
            pedidos: naoFulfillmentPedidos,
            valor: naoFulfillmentValor,
        },
        marketplaces,
    };
}

export async function getSalesAnymarket(
    preset: { gumgaToken: string; marketplaces?: string[] },
    filter: DateFilter
): Promise<SalesResult> {
    const limit = 100;
    let offset = 0;

    const inicio = `${filter.dataInicio}T00:00:00Z`;
    const fim = `${filter.dataFim}T23:59:59Z`;

    // 🔥 guarda tudo
    const todosPedidos: AnymarketOrder[] = [];

    while (true) {
        const url = `https://api.anymarket.com.br/v2/orders?createdAfter=${inicio}&createdBefore=${fim}&limit=${limit}&offset=${offset}`;

        const res = await fetch(url, {
            headers: {
                gumgaToken: preset.gumgaToken,
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Erro AnyMarket: ${text}`);
        }

        const data = await res.json();
        const pedidos: AnymarketOrder[] = data?.content || [];
        const statusSet = new Set<string>();

        if (!pedidos.length) break;

        for (const p of pedidos) {
            statusSet.add(p.status);
            if (!STATUS_VALIDOS.includes(p.status)) continue;

            todosPedidos.push(p); // 🔥 guarda tudo
        }
        console.log(`Página offset ${offset} STATUS:`, Array.from(statusSet));
        offset += limit;

        if (offset > 10000) break;
    }

    // 🔥 SEM FILTRO (base total)
    const base = calcularDetalhado(todosPedidos);

    // 🔥 COM FILTRO (se tiver)
    const filtrado = preset.marketplaces?.length
        ? calcularDetalhado(
            todosPedidos.filter((p) =>
                preset.marketplaces!.includes(p.marketPlace)
            )
        )
        : base;

    return filtrado;
}