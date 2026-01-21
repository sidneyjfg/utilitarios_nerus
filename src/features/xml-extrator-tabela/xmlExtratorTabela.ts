import { XMLParser } from "fast-xml-parser";

export type XmlTabelaResultado = {
  cabecalhos: string[];
  totalRegistros: number;
  dados: Record<string, any>[];
};

export function extrairTabelaDoXml(xml: string): XmlTabelaResultado {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true
  });

  const json = parser.parse(xml);

  // Compatível com XML simples e XML de Excel
  const linhas =
    json?.Planilha?.Linha ||
    json?.Workbook?.Worksheet?.Table?.Row ||
    [];

  if (!linhas || linhas.length < 7) {
    throw new Error("XML não possui linhas suficientes (mínimo 7)");
  }

  // Linha 6 → cabeçalhos
  const linhaCabecalho = linhas[5];
  const colunasCabecalho = linhaCabecalho?.Coluna || linhaCabecalho?.Cell || [];

  const cabecalhos = colunasCabecalho.map((c: any) => {
    if (typeof c === "string") return c;
    if (c?.Data) return String(c.Data);
    return String(c);
  });

  // Linha 7 → dados
  const dados = linhas.slice(6).map((linha: any) => {
    const colunas = linha?.Coluna || linha?.Cell || [];
    const obj: any = {};

    cabecalhos.forEach((cabecalho: string, index: number) => {
      const valor = colunas[index];
      if (typeof valor === "string") obj[cabecalho] = valor;
      else if (valor?.Data) obj[cabecalho] = String(valor.Data);
      else obj[cabecalho] = null;
    });

    return obj;
  });

  return {
    cabecalhos,
    totalRegistros: dados.length,
    dados
  };
}
