import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { validarTabela } from "./validador";

type Correcao = {
    linha: number; // linha real do Excel (1-based)
    coluna: string;
    antes: string;
    depois: string;
};

type ResultadoValidacao = {
    totalRegistros: number;
    errosAntes: any[];
    errosDepois: any[];
    validos: number;
    invalidos: number;
    ajustados: number;
};

export default function XmlTabela() {
    const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [workbookOriginal, setWorkbookOriginal] = useState<XLSX.WorkBook | null>(null);
    const [sheetNameOriginal, setSheetNameOriginal] = useState<string | null>(null);

    const [cabecalhos, setCabecalhos] = useState<string[]>([]);
    const [dadosOriginais, setDadosOriginais] = useState<any[]>([]);
    const [dadosCorrigidos, setDadosCorrigidos] = useState<any[]>([]);

    const [produtosValidos, setProdutosValidos] = useState<any[]>([]);
    const [produtosInvalidos, setProdutosInvalidos] = useState<any[]>([]);

    const [correcoes, setCorrecoes] = useState<Correcao[]>([]);
    const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

    const [processado, setProcessado] = useState(false);

    const COLUNAS_2_DIGITOS = ["Tipo Unidade", "NFCeCSTPIS", "NFCeCSTCOFINS"];
    const COLUNAS_DECIMAIS = ["NFCeAliqPIS", "NFCeAliqCOFINS"];

    function normalizarGrupoProdutoParaExportar(valor: string) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+e\s+/gi, " ")
            .replace(/,/g, "")
            .replace(/\s+/g, "")
            .replace(/[^A-Za-z0-9]/g, "")
            .trim();
    }

    function parsePrecoParaNumero(input: any): number | null {
        if (input === null || input === undefined) return null;

        let s = String(input)
            .replace(/R\$/gi, "")
            .replace(/\s/g, "")
            .trim();

        if (!s) return null;

        // mantém só dígitos e separadores
        s = s.replace(/[^\d.,-]/g, "");

        const lastDot = s.lastIndexOf(".");
        const lastComma = s.lastIndexOf(",");

        // caso tenha ponto e vírgula, o ÚLTIMO define o decimal
        if (lastDot !== -1 && lastComma !== -1) {
            const decimalIsComma = lastComma > lastDot;

            if (decimalIsComma) {
                // 1.234,56 -> remove milhares "." e troca "," por "."
                s = s.replace(/\./g, "").replace(",", ".");
            } else {
                // 1,234.56 -> remove milhares "," e mantém "." decimal
                s = s.replace(/,/g, "");
            }
        } else if (lastComma !== -1) {
            // só vírgula: assume vírgula decimal (pt-BR)
            s = s.replace(/\./g, ""); // pontos como milhar
            s = s.replace(",", ".");
        } else if (lastDot !== -1) {
            // só ponto: se tiver 2 dígitos após o ponto, assume decimal
            const decPart = s.split(".")[1] ?? "";
            if (decPart.length === 2) {
                // ok, "." é decimal
                // não faz nada
            } else {
                // assume "." como milhar
                s = s.replace(/\./g, "");
            }
        }

        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    function formatarPrecoBR(n: number): string {
        return n.toFixed(2).replace(".", ",");
    }

    function normalizarValor(valor: any, coluna: string) {
        if (valor === null || valor === undefined) return valor;

        let texto = String(valor);

        // Remove notação científica do Excel (ex: 7,89573E+12)
        if (/^\d+([.,]\d+)?E\+\d+$/i.test(texto)) {
            texto = Number(texto.replace(",", ".")).toFixed(0);
        }

        // Remove acentos
        texto = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Grupo Produto → NÃO mexe aqui (tratado depois)
        if (coluna === "Grupo Produto") {
            return texto;
        }

        // Nome Produto → máximo 40 caracteres
        if (coluna === "Nome Produto" && texto.length > 40) {
            texto = texto.slice(0, 40);
        }

        // Código Barra SEMPRE texto
        if (coluna === "Código Barra") {
            return texto.trim();
        }

        // Preço → sempre com vírgula e sem "R$"
        if (coluna === "Preço") {
            const n = parsePrecoParaNumero(texto);
            if (n === null) return texto;
            return formatarPrecoBR(n);
        }

        if (COLUNAS_DECIMAIS.includes(coluna)) {
            return texto
                .replace(/\s/g, "")
                .replace(/\./g, ",");
        }

        // Campos 2 dígitos → preservar texto
        if (COLUNAS_2_DIGITOS.includes(coluna)) {
            return texto.trim();
        }

        return texto.trim();
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

    function objParaLinhaAoA(obj: any, headers: string[]) {
        return headers.map((h) => obj?.[h] ?? "");
    }

    function gerarPlanilhaAPartirDoTemplate(
        dados: any[],
        nomeArquivo: string,
        aplicarTiposEspeciais = true
    ) {
        if (!workbookOriginal || !sheetNameOriginal) return;

        const wsOriginal = workbookOriginal.Sheets[sheetNameOriginal];
        const rangeOriginal = XLSX.utils.decode_range(wsOriginal["!ref"]!);

        // 1) Ler template inteiro sem mexer (mantém cabeçalhos, linhas anteriores etc)
        const todasLinhas: any[][] = [];
        for (let R = 0; R <= rangeOriginal.e.r; R++) {
            const linha: any[] = [];
            for (let C = 0; C <= rangeOriginal.e.c; C++) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = wsOriginal[addr];
                if (cell?.t === "n") linha.push(cell.v);
                else linha.push(cell?.v ?? "");
            }
            todasLinhas.push(linha);
        }

        // 2) Pega as 6 primeiras linhas e cola somente os dados filtrados
        const novasLinhas = todasLinhas.slice(0, 6);

        // garante que vamos escrever conforme os cabeçalhos atuais
        const headers = cabecalhos.length ? cabecalhos : (todasLinhas[5] ?? []).filter(Boolean);
        const aoaDados = dados.map((d) => objParaLinhaAoA(d, headers));

        // começa na linha 7 (index 6)
        aoaDados.forEach((linha) => novasLinhas.push(linha));

        const novaWs = XLSX.utils.aoa_to_sheet(novasLinhas);

        if (aplicarTiposEspeciais) {
            const rangeNovo = XLSX.utils.decode_range(novaWs["!ref"]!);

            const colCodigoBarra = headers.indexOf("Código Barra");
            const colGrupoProduto = headers.indexOf("Grupo Produto");
            const colPreco = headers.indexOf("Preço");

            // Grupo Produto como texto
            if (colGrupoProduto >= 0) {
                for (let R = 6; R <= rangeNovo.e.r; ++R) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: colGrupoProduto });
                    const cell = novaWs[addr];
                    if (cell) {
                        cell.t = "s";
                        cell.z = "@";
                    }
                }
            }

            // Código Barra como texto
            if (colCodigoBarra >= 0) {
                for (let R = 6; R <= rangeNovo.e.r; ++R) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: colCodigoBarra });
                    const cell = novaWs[addr];
                    if (cell) {
                        cell.t = "s";
                        cell.z = "@";
                    }
                }
            }

            // Preço como texto com vírgula
            if (colPreco >= 0) {
                for (let R = 6; R <= rangeNovo.e.r; ++R) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: colPreco });
                    const cell = novaWs[addr];
                    if (!cell) continue;

                    const n = parsePrecoParaNumero(cell.v);
                    if (n === null) continue;

                    const textoFinal = formatarPrecoBR(n);
                    cell.v = textoFinal;
                    cell.t = "s";
                    cell.z = "@";
                    delete (cell as any).w;
                }
            }
        }

        const novoWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(novoWb, novaWs, sheetNameOriginal);
        XLSX.writeFile(novoWb, nomeArquivo);
    }

    function exportarValidos() {
        if (!processado) return;
        gerarPlanilhaAPartirDoTemplate(produtosValidos, "produtos_validos.xlsx");
    }

    function exportarInvalidos() {
        if (!processado) return;
        gerarPlanilhaAPartirDoTemplate(produtosInvalidos, "produtos_invalidos.xlsx");
    }

    function exportarCorrecoes() {
        if (!processado || correcoes.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(
            correcoes.map((c) => ({
                Linha: c.linha,
                Coluna: c.coluna,
                Antes: c.antes,
                Depois: c.depois,
            }))
        );

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Correcoes");
        XLSX.writeFile(wb, "detalhes_correcoes.xlsx");
    }

    function exportarErros(erros: any[], nome: string) {
        const rows: any[] = [];
        erros.forEach((e) => {
            e.erros.forEach((err: any) => {
                rows.push({
                    Linha: e.linha,
                    "Código Interno": e.codigoInterno || "",
                    "Nome Produto": e.nomeProduto || "",
                    Coluna: err.coluna,
                    "Valor Atual": err.valor,
                    Erro: err.mensagem,
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Erros");
        XLSX.writeFile(wb, nome);
    }

    function aplicarCorrecoesEDetectarDiff(
        dados: any[],
        headers: string[]
    ): { corrigidos: any[]; correcoes: Correcao[] } {
        const alteracoes: Correcao[] = [];

        const corrigidos = dados.map((linha, idx) => {
            const nova: any = { ...linha, __idx: linha.__idx };

            headers.forEach((coluna) => {
                const valorOrig = nova[coluna];
                let valorCorr = normalizarValor(valorOrig, coluna);

                if (coluna === "Grupo Produto") {
                    valorCorr = normalizarGrupoProdutoParaExportar(
                        String(valorOrig ?? "")
                            .replace(/\s+/g, " ")
                            .replace(/\u00A0/g, " ")   // NBSP
                            .replace(/\u2007/g, " ")
                            .replace(/\u202F/g, " ")
                            .trim()
                    );
                }

                // registra diff (apenas quando mudou de verdade)
                const origRaw = valorOrig === null || valorOrig === undefined ? "" : String(valorOrig);
                const corrRaw = valorCorr === null || valorCorr === undefined ? "" : String(valorCorr);

                let mudou = false;

                if (coluna === "Preço") {
                    const o = parsePrecoParaNumero(origRaw);
                    const n = parsePrecoParaNumero(corrRaw);

                    if (o !== n) mudou = true;
                } else {
                    if (origRaw.trim() !== corrRaw.trim()) mudou = true;
                }

                if (mudou) {
                    const diff = destacarDiferencas(origRaw, corrRaw);
                    alteracoes.push({
                        linha: 7 + idx,
                        coluna,
                        antes: diff.antes,
                        depois: diff.depois,
                    });
                }

                // SEMPRE grava o valor limpo
                nova[coluna] = corrRaw;
            });

            return nova;
        });

        return { corrigidos, correcoes: alteracoes };
    }

    function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setErro(null);
        setResultado(null);
        setCorrecoes([]);
        setMostrarDetalhes(false);
        setProcessado(false);
        setProdutosValidos([]);
        setProdutosInvalidos([]);
        setDadosOriginais([]);
        setDadosCorrigidos([]);
        setCabecalhos([]);

        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const data = evt.target?.result as ArrayBuffer;
                const workbook = XLSX.read(data, { type: "array" });

                const sheetName = workbook.SheetNames.find(
                    (name) => name.toUpperCase().trim() === "PRODUTOS"
                );
                if (!sheetName) throw new Error('A planilha não contém uma aba chamada "PRODUTOS"');

                setWorkbookOriginal(workbook);
                setSheetNameOriginal(sheetName);

                const sheet = workbook.Sheets[sheetName];

                const range = XLSX.utils.decode_range(sheet["!ref"]!);
                const rows: any[][] = [];

                for (let R = 0; R <= range.e.r; R++) {
                    const linha: any[] = [];
                    for (let C = 0; C <= range.e.c; C++) {
                        const addr = XLSX.utils.encode_cell({ r: R, c: C });
                        const cell = sheet[addr];

                        // Restaura Código Barra numérico como texto sem notação
                        if (cell?.t === "n" && rows[5]?.[C] === "Código Barra") {
                            linha.push(cell.v.toFixed(0));
                        } else {
                            linha.push(cell?.w ?? cell?.v ?? null);
                        }
                    }
                    rows.push(linha);
                }

                if (rows.length < 7) throw new Error("A planilha precisa ter pelo menos 7 linhas");

                const rawHeaders = rows[5] ?? [];
                const headers = rawHeaders
                    .map((c) => (c ? String(c).trim() : ""))
                    .filter((c) => c !== "");

                setCabecalhos(headers);

                const dados = rows
                    .slice(6)
                    .filter((linha) => linha.some((v) => v !== null && v !== undefined && v !== ""))
                    .map((linha, idx) => {
                        const obj: any = { __idx: idx }; // 👈 índice real do produto
                        headers.forEach((header, index) => {
                            obj[header] = linha[index] ?? null;
                        });
                        return obj;
                    });

                setDadosOriginais(dados);

                const errosAntes = validarTabela(dados);

                // aplica correções + gera lista de diffs
                const { corrigidos, correcoes: diffs } = aplicarCorrecoesEDetectarDiff(dados, headers);
                setDadosCorrigidos(corrigidos);
                setCorrecoes(diffs);

                // valida novamente após correção
                const errosDepois = validarTabela(corrigidos);

                // set de linhas inválidas (linha excel -> índice dados: linha - 7)
                const invalidIdx = new Set<number>();

                errosDepois.forEach((e: any) => {
                    if (typeof e.linha === "number") {
                        const idx = e.linha - 7;   // linha Excel → índice do array
                        if (idx >= 0) invalidIdx.add(idx);
                    }
                });

                const validos = corrigidos.filter(p => !invalidIdx.has(p.__idx));
                const invalidos = corrigidos.filter(p => invalidIdx.has(p.__idx));

                // conta quantos eram inválidos e viraram válidos (ajustados)
                const invalidAntesIdx = new Set<number>();
                errosAntes.forEach((e: any) => {
                    const idx = (e.linha ?? 0) - 7;
                    if (idx >= 0) invalidAntesIdx.add(idx);
                });

                let ajustados = 0;
                validos.forEach((_: any, i: number) => {
                    // i aqui é índice no array "validos", então precisamos checar pelo índice real no "corrigidos"
                    // melhor: percorre corrigidos
                });
                ajustados = corrigidos.reduce((acc, _row, idx) => {
                    const eraInvalido = invalidAntesIdx.has(idx);
                    const agoraValido = !invalidIdx.has(idx);
                    return acc + (eraInvalido && agoraValido ? 1 : 0);
                }, 0);

                setProdutosValidos(validos);
                setProdutosInvalidos(invalidos);

                setResultado({
                    totalRegistros: corrigidos.length,
                    errosAntes,
                    errosDepois,
                    validos: validos.length,
                    invalidos: invalidos.length,
                    ajustados,
                });

                setProcessado(true);
            } catch (err: any) {
                setErro(err.message || "Erro ao processar planilha");
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
        setCorrecoes([]);
        setMostrarDetalhes(false);
        setProcessado(false);

        setProdutosValidos([]);
        setProdutosInvalidos([]);
        setDadosOriginais([]);
        setDadosCorrigidos([]);
        setCabecalhos([]);

        setWorkbookOriginal(null);
        setSheetNameOriginal(null);

        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    const disabled = !processado || loading;
    const disabledInvalidos = disabled || produtosInvalidos.length === 0;
    const disabledValidos = disabled || produtosValidos.length === 0;

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Extrator de Tabela do Excel</h1>

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

            {erro && <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">{erro}</div>}

            {/* Botões modernos (bloqueados até processar) */}
            <div className="flex flex-wrap gap-3 bg-slate-100 p-4 rounded-xl shadow-sm mb-6">
                <button
                    disabled={disabledValidos}
                    onClick={exportarValidos}
                    className={`px-4 py-2 rounded-lg text-white ${disabledValidos
                        ? "bg-slate-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                        }`}
                    title={
                        produtosValidos.length === 0
                            ? "Não há produtos válidos para exportar"
                            : ""
                    }
                >
                    📦 Exportar válidos
                </button>

                <button
                    disabled={disabledInvalidos}
                    onClick={exportarInvalidos}
                    className={`px-4 py-2 rounded-lg text-white ${disabledInvalidos
                        ? "bg-slate-400 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                        }`}
                    title={
                        produtosInvalidos.length === 0
                            ? "Não há produtos inválidos para exportar"
                            : ""
                    }
                >
                    🚫 Exportar inválidos
                </button>

                <button
                    disabled={disabled || correcoes.length === 0}
                    onClick={exportarCorrecoes}
                    className={`px-4 py-2 rounded-lg text-white ${disabled || correcoes.length === 0
                        ? "bg-slate-400 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                    title={!processado ? "Faça upload e processe a planilha primeiro" : ""}
                >
                    🧾 Baixar detalhes das correções
                </button>

                <button
                    onClick={limparTudo}
                    className="px-4 py-2 bg-slate-300 rounded-lg hover:bg-slate-400"
                >
                    🔄 Limpar
                </button>
            </div>

            {/* Resumo */}
            {resultado && (
                <div className="mb-6 grid md:grid-cols-3 gap-4">
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="text-slate-500 text-sm">Registros (linha 7+)</div>
                        <div className="text-2xl font-semibold">{resultado.totalRegistros}</div>
                    </div>

                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="text-slate-500 text-sm">Válidos (após ajustes)</div>
                        <div className="text-2xl font-semibold text-green-700">{resultado.validos}</div>
                        <div className="text-xs text-slate-500 mt-1">
                            Ajustados automaticamente: <span className="font-semibold">{resultado.ajustados}</span>
                        </div>
                    </div>

                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="text-slate-500 text-sm">Inválidos (ainda com pendência)</div>
                        <div className="text-2xl font-semibold text-red-700">{resultado.invalidos}</div>
                    </div>
                </div>
            )}

            {/* Cards de erros (PÓS correção) */}
            {resultado && resultado.errosDepois?.length > 0 && (
                <div className="mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <h2 className="text-xl font-semibold text-slate-800">
                            Pendências restantes (após correções)
                        </h2>

                        <button
                            disabled={disabled}
                            onClick={() => exportarErros(resultado.errosDepois, "inconsistencias_pos_correcao.xlsx")}
                            className={`px-4 py-2 rounded-lg text-white ${disabled ? "bg-slate-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
                                }`}
                        >
                            Exportar pendências (XLSX)
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {resultado.errosDepois.map((e: any) => (
                            <div
                                key={e.linha}
                                className="bg-red-50 border border-red-300 p-4 rounded-xl shadow-sm"
                            >
                                <h3 className="font-semibold text-red-700 mb-2">Linha {e.linha}</h3>
                                <ul className="text-sm text-red-600 list-disc ml-4 space-y-1">
                                    {e.erros.map((er: any, i: number) => (
                                        <li key={i}>
                                            <strong>{er.coluna}</strong>: {er.mensagem} — valor atual {er.valor}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Badge de sucesso */}
            {resultado && resultado.errosDepois?.length === 0 && (
                <div className="mb-6">
                    <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm">
                        Nenhuma pendência após correções 🎉
                    </span>
                </div>
            )}

            {/* Painel flutuante (canto inferior direito) com detalhes das correções */}
            {correcoes.length > 0 && (
                <div className="fixed bottom-4 right-4 z-50">
                    <button
                        onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700"
                    >
                        🧩 {correcoes.length} ajustes
                    </button>

                    {mostrarDetalhes && (
                        <div className="mt-2 w-[520px] max-h-[60vh] overflow-auto bg-white border rounded-xl shadow-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-semibold text-slate-800">Detalhes das correções</div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={exportarCorrecoes}
                                        className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                                    >
                                        ⬇ Baixar XLSX
                                    </button>

                                    <button
                                        onClick={() => setMostrarDetalhes(false)}
                                        className="text-xs text-slate-500 hover:text-slate-800"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>

                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-blue-100">
                                    <tr>
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
                                            <td className="p-2 border text-red-600">{c.antes}</td>
                                            <td className="p-2 border text-green-700">{c.depois}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
