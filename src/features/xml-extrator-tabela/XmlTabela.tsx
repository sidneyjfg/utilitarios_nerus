import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { validarTabela } from "./validador";

export default function XmlTabela() {
    const [resultado, setResultado] = useState<any>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [, setDadosOriginais] = useState<any[]>([]);
    const [workbookOriginal, setWorkbookOriginal] = useState<XLSX.WorkBook | null>(null);
    const [sheetNameOriginal, setSheetNameOriginal] = useState<string | null>(null);
    const [correcoes, setCorrecoes] = useState<any[]>([]);
    const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

    function normalizarValor(valor: any, coluna: string) {
        if (valor === null || valor === undefined) return valor;

        let texto = String(valor);

        // Remove notação científica do Excel (ex: 7,89573E+12)
        if (/^\d+([.,]\d+)?E\+\d+$/i.test(texto)) {
            texto = Number(texto.replace(",", ".")).toFixed(0);
        }

        // Remove acentos
        texto = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Grupo Produto → remove TODOS os espaços
        if (coluna === "Grupo Produto") {
            texto = texto.replace(/\s+/g, "");
        }

        // Nome Produto → máximo 40 caracteres
        if (coluna === "Nome Produto" && texto.length > 40) {
            texto = texto.slice(0, 40);
        }

        // Código de Barras SEMPRE texto
        if (coluna === "Código Barra") {
            return texto.trim(); // não deixa Excel converter
        }

        return texto.trim();
    }


    function exportarPlanilhaCorrigida() {
        if (!workbookOriginal || !sheetNameOriginal) return;

        const wsOriginal = workbookOriginal.Sheets[sheetNameOriginal];

        const rangeOriginal = XLSX.utils.decode_range(wsOriginal["!ref"]!);
        const todasLinhas: any[][] = [];

        for (let R = 0; R <= rangeOriginal.e.r; R++) {
            const linha: any[] = [];

            for (let C = 0; C <= rangeOriginal.e.c; C++) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = wsOriginal[addr];

                // ⚠️ w = texto exatamente como estava no Excel
                linha.push(cell?.w ?? cell?.v ?? "");
            }

            todasLinhas.push(linha);
        }

        const cabecalhos = todasLinhas[5];
        const novasLinhas = todasLinhas.slice(0, 6);

        const alteracoes: any[] = [];

        for (let i = 6; i < todasLinhas.length; i++) {
            const linha = todasLinhas[i];
            const novaLinha = [...linha];

            linha.forEach((valor, colIndex) => {
                const header = cabecalhos[colIndex];

                if (typeof valor === "string" && header) {
                    const corrigido = normalizarValor(valor, header);

                    const originalRaw = String(valor);
                    const corrigidoRaw = String(corrigido);

                    if (corrigidoRaw.trim() !== originalRaw.trim()) {
                        novaLinha[colIndex] = corrigido;
                        const diff = destacarDiferencas(originalRaw, corrigidoRaw);

                        alteracoes.push({
                            linha: i + 1,
                            coluna: header,
                            antes: diff.antes,
                            depois: diff.depois,
                        });
                    }
                }
            });

            novasLinhas.push(novaLinha);
        }

        // Se nada mudou
        if (alteracoes.length === 0) {
            alert("Nenhuma correção automática a ser aplicada.");
            return;
        }

        // Guarda alterações para UI
        setCorrecoes(alteracoes);
        setMostrarDetalhes(false);

        const novaWs = XLSX.utils.aoa_to_sheet(novasLinhas);
        // 🔒 Forçar coluna "Código Barra" como TEXTO
        const colCodigoBarra = cabecalhos.indexOf("Código Barra");
        const rangeNovo = XLSX.utils.decode_range(novaWs["!ref"]!);

        for (let R = 6; R <= rangeNovo.e.r; ++R) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: colCodigoBarra });
            const cell = novaWs[cellAddress];

            if (cell) {
                cell.t = "s"; // força string
                cell.z = "@"; // formato texto no Excel
            }
        }
        const novoWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(novoWb, novaWs, sheetNameOriginal);

        XLSX.writeFile(novoWb, "planilha_corrigida.xlsx");
    }

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

                setWorkbookOriginal(workbook);
                setSheetNameOriginal(sheetName); // agora é string garantida

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

                setDadosOriginais(dados); // 👈 guarda os dados para correção
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

    function destacarDiferencas(orig: string, novo: string) {
        let outOrig = "";
        let outNovo = "";

        const max = Math.max(orig.length, novo.length);

        for (let i = 0; i < max; i++) {
            const o = orig[i] || "";
            const n = novo[i] || "";

            if (o !== n) {
                outOrig += o === " " ? "␠" : o;
                outNovo += n === " " ? "␠" : n;
            } else {
                outOrig += o;
                outNovo += n;
            }
        }

        return { antes: outOrig, depois: outNovo };
    }


    function limparTudo() {
        setResultado(null);
        setErro(null);
        setLoading(false);
        setCorrecoes([]);
        setMostrarDetalhes(false);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }


    function exportarCorrecoes() {
        if (correcoes.length === 0) {
            alert("Nenhuma correção foi aplicada.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(correcoes.map(c => ({
            Linha: c.linha,
            Coluna: c.coluna,
            Antes: c.antes,
            Depois: c.depois,
        })));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Correcoes");

        XLSX.writeFile(wb, "detalhes_correcoes.xlsx");
    }

    function Tooltip() {
        return (
            <div className="relative group">
                <span className="ml-2 cursor-help text-slate-500 font-bold">?</span>

                <div className="absolute z-10 hidden group-hover:block w-72 p-3 text-xs text-white bg-slate-800 rounded-lg shadow-lg -top-2 left-6">
                    Correções automáticas aplicadas:
                    <br />• Remove acentos: "ágil" → "agil"
                    <br />• Remove espaços no Grupo Produto:
                    <br />&nbsp;&nbsp;"Utensílios de Xícara" → "UtensiliosdeXicara"
                    <br />• Nome Produto limitado a 40 caracteres
                    <br />&nbsp;&nbsp;Tudo após o 40º caractere é removido
                </div>
            </div>
        );
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
            {resultado && (
                <div className="mb-6 flex flex-wrap gap-4">
                    {resultado.erros.length > 0 && (
                        <button
                            onClick={() => exportarErros(resultado.erros)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Exportar erros
                        </button>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportarPlanilhaCorrigida}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Baixar planilha corrigida
                        </button>

                        <Tooltip />
                    </div>

                    {correcoes.length > 0 && (
                        <button
                            onClick={exportarCorrecoes}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Baixar detalhes das correções
                        </button>
                    )}

                    <button
                        onClick={limparTudo}
                        className="px-4 py-2 bg-slate-300 text-slate-800 rounded-lg hover:bg-slate-400"
                    >
                        Limpar
                    </button>
                </div>
            )}
            {correcoes.length > 0 && (
                <div className="mt-4 bg-blue-50 border border-blue-300 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                        <span className="text-blue-800 font-semibold">
                            {correcoes.length} valores foram corrigidos na planilha
                        </span>

                        <button
                            onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
                            className="text-blue-600 underline text-sm"
                        >
                            {mostrarDetalhes ? "Ocultar detalhes" : "Ver mais detalhes"}
                        </button>
                    </div>

                    {mostrarDetalhes && (
                        <div className="mt-3 max-h-64 overflow-auto text-sm">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-blue-100">
                                        <th className="p-2 border">Linha</th>
                                        <th className="p-2 border">Coluna</th>
                                        <th className="p-2 border">Antes</th>
                                        <th className="p-2 border">Depois</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {correcoes.map((c, i) => (
                                        <tr key={i}>
                                            <td className="p-2 border">{c.linha}</td>
                                            <td className="p-2 border">{c.coluna}</td>
                                            <td className="p-2 border text-red-700">{c.antes}</td>
                                            <td className="p-2 border text-green-700">{c.depois}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
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
