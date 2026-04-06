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
    username: string;
    password: string;
  }
  | {
    tipo: "tray";
    consumer_key: string;
    consumer_secret: string;
    code: string;
    statusValidos?: string[];
  }
  | {
    tipo: "wake";
    token: string;
  };