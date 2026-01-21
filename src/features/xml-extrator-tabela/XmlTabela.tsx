import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { validarTabela } from "./validador";

export default function XmlTabela() {
    const [resultado, setResultado] = useState<any>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    function exportarErros(erros: any[]) {
        const rows: any[] = [];

        erros.forEach((e) => {
            e.erros.forEach((erro: any) => {
                rows.push({
                    Linha: e.linha,
                    "Código Interno": e.codigoInterno || "",
                    "Nome Produto": e.nomeProduto || "",
                    Coluna: erro.coluna,
                    "Valor Atual": erro.valor,
                    Erro: erro.mensagem,
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, "Erros");

        XLSX.writeFile(wb, "inconsistencias.xlsx");
    }


    function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setErro(null);
        setResultado(null);

        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const data = evt.target?.result as ArrayBuffer;

                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames.find(
                    (name) => name.toUpperCase().trim() === "PRODUTOS"
                );

                if (!sheetName) {
                    throw new Error('A planilha não contém uma aba chamada "PRODUTOS"');
                }

                const sheet = workbook.Sheets[sheetName];

                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                // DEBUG — mostra todas as linhas lidas do Excel
                console.log("📄 Todas as linhas da planilha:", rows);

                // Linha 6 (index 5)
                console.log("📌 Linha 6 (cabeçalhos brutos):", rows[5]);

                // Linhas 7+
                console.log("📌 Linhas 7+ (dados brutos):", rows.slice(6));

                if (rows.length < 7) {
                    throw new Error("A planilha precisa ter pelo menos 7 linhas");
                }

                // Linha 6 → cabeçalhos
                const rawHeaders = rows[5];

                // Remove colunas vazias
                const cabecalhos = rawHeaders
                    .map((c) => (c ? String(c).trim() : ""))
                    .filter((c) => c !== "");

                // Linhas 7+ → dados
                const dados = rows
                    .slice(6)
                    .filter((linha) => linha.some((v) => v !== null && v !== undefined && v !== ""))
                    .map((linha) => {
                        const obj: any = {};

                        cabecalhos.forEach((header, index) => {
                            obj[header] = linha[index] ?? null;
                        });

                        return obj;
                    });
                console.log("🧾 Cabeçalhos processados:", cabecalhos);
                console.log("📊 Dados processados:", dados);
                const erros = validarTabela(dados);

                setResultado({
                    totalRegistros: dados.length,
                    erros
                });

            } catch (err: any) {
                setErro(err.message);
            } finally {
                setLoading(false);
            }
        };

        reader.onerror = () => {
            setErro("Erro ao ler o arquivo");
            setLoading(false);
        };

        reader.readAsArrayBuffer(file);
    }


    function limparTudo() {
        setResultado(null);
        setErro(null);
        setLoading(false);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }



    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">
                Extrator de Tabela do Excel
            </h1>

            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUpload}
                className="mb-6"
            />
            {loading && (
                <div className="mt-4 flex items-center gap-3 text-red-700">
                    <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Processando planilha…</span>
                </div>
            )}
            {erro && (
                <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">
                    {erro}
                </div>
            )}
            {resultado && resultado.erros.length > 0 && (
                <button
                    onClick={() => exportarErros(resultado.erros)}
                    className="mb-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                    Exportar erros para Excel
                </button>
            )}
            {resultado && (
                <button
                    onClick={limparTudo}
                    className="mb-6 ml-4 px-4 py-2 bg-slate-300 text-slate-800 rounded-lg hover:bg-slate-400"
                >
                    Limpar
                </button>
            )}

            {resultado && (
                <>
                    <div className="mb-6 flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                            Total de registros analisados:{" "}
                            <span className="font-semibold">{resultado.totalRegistros}</span>
                        </div>

                        {resultado.erros.length === 0 && (
                            <span className="bg-green-100 text-green-700 px-4 py-1 rounded-full text-sm">
                                Nenhuma inconsistência encontrada 🎉
                            </span>
                        )}
                    </div>

                    {resultado.erros.length > 0 && (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {resultado.erros.map((e: any) => (
                                <div
                                    key={e.linha}
                                    className="bg-red-50 border border-red-300 p-4 rounded-xl shadow-sm"
                                >
                                    <h3 className="font-semibold text-red-700 mb-2">
                                        Linha {e.linha}
                                    </h3>

                                    <ul className="text-sm text-red-600 list-disc ml-4 space-y-1">
                                        {e.erros.map((erro: any, i: number) => (
                                            <li key={i}>
                                                <strong>{erro.coluna}</strong>: {erro.mensagem} — valor atual {erro.valor}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
