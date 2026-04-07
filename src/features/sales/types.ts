export type SalesResult = {
  totalPedidos: number;
  totalValor: number;

  fulfillment: {
    pedidos: number;
    valor: number;
  };

  naoFulfillment: {
    pedidos: number;
    valor: number;
  };

  marketplaces: Record<
    string,
    {
      totalPedidos: number;
      totalValor: number;

      fulfillment: {
        pedidos: number;
        valor: number;
      };

      naoFulfillment: {
        pedidos: number;
        valor: number;
      };
    }
  >;

  supportsFulfillment?: boolean; // ✅ AQUI
};

export type DateFilter = {
  dataInicio: string;
  dataFim: string;
};

export type Preset =
  | {
    tipo: "anymarket";
    gumgaToken: string;
    marketplaces?: string[];

  }
  | {
    tipo: "pluggto";
    client_id: string;
    client_secret: string;
    username: string;
    password: string;
  }
  | {
    tipo: "tray";
    url_tray: string;
    consumer_key: string;
    consumer_secret: string;
    code: string;
    statusValidos?: string[];
  }
  | {
    tipo: "wake";
    token: string;
  };