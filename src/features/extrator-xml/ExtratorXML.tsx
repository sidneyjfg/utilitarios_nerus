import { useState, useEffect } from "react";
import JSZip from "jszip";

type ExtractedFile = {
    name: string;
    content: Blob;
    meta?: {
        chave: string;
        numero: string;
        data: string;
        natOp: string;
        cnpjEmit: string;
    };
};


export default function ExtratorXML() {
    const [zipFiles, setZipFiles] = useState<File[]>([]);
    const [searchZips, setSearchZips] = useState<File[]>([]);
    const [keys, setKeys] = useState("");

    const [results, setResults] = useState<ExtractedFile[]>([]);
    const [processing, setProcessing] = useState(false);

    const [showSummary, setShowSummary] = useState(false);
    const [summaryText, setSummaryText] = useState("");
    const [normalizeFiles, setNormalizeFiles] = useState<File[]>([]);

    const parseXMLFields = async (blob: Blob) => {
        const text = await blob.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");

        const get = (tag: string) =>
            xml.getElementsByTagName(tag)[0]?.textContent || "";

        return {
            chave: get("chNFe") || get("chCTe") || "",
            numero: get("nNF") || get("nCT") || "",
            data: get("dhEmi") || get("dEmi") || "",
            natOp: get("natOp") || "",
            cnpjEmit: get("CNPJ") || "",
        };
    };

    const normalizeDate = (date: string) => {
        if (!date) return "SEM-DATA";

        const d = date.substring(0, 7); // YYYY-MM
        return d.replace("/", "-");
    };

    const extractAnyInput = async (file: File): Promise<ExtractedFile[]> => {
        if (file.name.toLowerCase().endsWith(".xml")) {
            const meta = await parseXMLFields(file);
            return [{ name: file.name, content: file, meta }];
        }

        if (file.name.toLowerCase().endsWith(".zip")) {
            return extractZipRecursive(file);
        }

        return [];
    };


    const normalizePipeline = async () => {
        setProcessing(true);
        setResults([]);

        let all: ExtractedFile[] = [];

        for (const file of normalizeFiles) {
            const extracted = await extractAnyInput(file);
            all.push(...extracted);
        }

        const normalized: ExtractedFile[] = [];

        for (const file of all) {
            if (!file.name.toLowerCase().endsWith(".xml")) continue;

            const xml = await normalizeXML(file.content);

            normalized.push({
                name: file.name,
                content: xml,
                meta: file.meta, // 🔥 mantém dados fiscais
            });
        }

        setResults(normalized);
        setProcessing(false);
    };


    const normalizeXML = async (blob: Blob): Promise<Blob> => {
        const text = await blob.text();

        let xml = text
            .replace(/\r/g, "")
            .replace(/\n/g, "")
            .replace(/\t/g, "")
            .replace(/>\s+</g, "><")
            .trim();

        // Garante header XML
        if (!xml.startsWith("<?xml")) {
            xml = `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
        }

        return new Blob([xml], { type: "application/xml" });
    };

    const normalizeResults = async () => {
        setProcessing(true);

        const novos: ExtractedFile[] = [];

        for (const file of results) {
            if (!file.name.toLowerCase().endsWith(".xml")) continue;

            const xmlNormalizado = await normalizeXML(file.content);

            novos.push({
                name: file.name,
                content: xmlNormalizado,
                meta: file.meta, // 🔥 mantém natOp, data etc
            });
        }

        setResults(novos);
        setProcessing(false);
    };


    // Normalize filename (remove folders)
    const normalizeName = (name: string) => name.split("/").pop() || name;

    // ---------------------------------------------------------
    // Build summary AFTER results change
    // ---------------------------------------------------------
    useEffect(() => {
        if (results.length === 0) return;

        const types: Record<string, number> = {};
        let totalSize = 0;

        results.forEach((file) => {
            const ext = file.name.split(".").pop()?.toLowerCase() || "sem-extensao";
            types[ext] = (types[ext] || 0) + 1;
            totalSize += file.content.size;
        });

        const sortedLargest = [...results]
            .sort((a, b) => b.content.size - a.content.size)
            .slice(0, 5);

        let summary = `📁 Total de arquivos: ${results.length}\n`;
        summary += `📦 Tamanho total: ${(totalSize / 1024).toFixed(1)} KB\n\n`;

        summary += "🔠 Tipos de arquivo:\n";
        for (const t in types) summary += ` - ${t}: ${types[t]}\n`;

        summary += "\n🔥 Top 5 maiores arquivos:\n";
        sortedLargest.forEach((f) => {
            summary += ` - ${f.name} (${(f.content.size / 1024).toFixed(1)} KB)\n`;
        });

        setSummaryText(summary);
        setShowSummary(true);
    }, [results]);

    // -------------------------------------------------------------
    // Extração recursiva (ZIP dentro de ZIP)
    // -------------------------------------------------------------
    const extractZipRecursive = async (file: Blob): Promise<ExtractedFile[]> => {
        const zip = await JSZip.loadAsync(file);
        const output: ExtractedFile[] = [];

        for (const fullPath of Object.keys(zip.files)) {
            const entry = zip.files[fullPath];
            const flatName = normalizeName(entry.name);

            if (entry.name.toLowerCase().endsWith(".zip")) {
                const nestedBlob = await entry.async("blob");
                const nestedExtracted = await extractZipRecursive(nestedBlob);
                output.push(...nestedExtracted);
                continue;
            }

            const content = await entry.async("blob");

            // 🔥 Aqui é onde você estava perdendo tudo
            if (flatName.toLowerCase().endsWith(".xml")) {
                const meta = await parseXMLFields(content);
                output.push({ name: flatName, content, meta });
            } else {
                output.push({ name: flatName, content });
            }
        }

        return output;
    };


    const extractAll = async () => {
        setProcessing(true);
        setResults([]);

        let all: ExtractedFile[] = [];

        for (const file of zipFiles) {
            const extracted = await extractZipRecursive(file);
            all.push(...extracted);
        }

        setResults(all);
        setProcessing(false);
    };

    // -------------------------------------------------------------
    // Busca por chaves (em vários ZIPs)
    // -------------------------------------------------------------
    const filterByKeys = async () => {
        setProcessing(true);
        setResults([]);

        const lista = keys.split(/[\s,;]+/).filter(Boolean);

        let found: ExtractedFile[] = [];

        for (const zipFile of searchZips) {
            const zip = await JSZip.loadAsync(zipFile);

            for (const fullPath of Object.keys(zip.files)) {
                const entry = zip.files[fullPath];
                const flatName = normalizeName(entry.name);

                if (lista.some((k) => flatName.includes(k))) {
                    const content = await entry.async("blob");
                    found.push({ name: flatName, content });
                }
            }
        }

        setResults(found);
        setProcessing(false);
    };

    // -------------------------------------------------------------
    // DOWNLOAD ZIP FINAL
    // -------------------------------------------------------------
    const downloadZip = async () => {
        const zip = new JSZip();

        for (const file of results) {
            if (!file.meta) continue;

            const natOp = file.meta.natOp || "SEM-NATOP";
            const data = normalizeDate(file.meta.data);

            const pasta = `${natOp}/${data}`;

            zip.file(`${pasta}/${file.name}`, file.content);
        }

        const blob = await zip.generateAsync({ type: "blob" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "xml_organizados.zip";
        a.click();
        URL.revokeObjectURL(url);
    };


    return (
        <div className="max-w-6xl mx-auto mt-10 px-6 select-none">

            {/* ================= HEADER ================= */}
            <h1 className="text-3xl font-bold text-slate-800 text-center mb-2">
                📄 Organizador de XMLs Fiscais
            </h1>
            <p className="text-center text-slate-600 mb-10">
                Extraia, filtre, normalize e organize XMLs de NF-e, CT-e e MDF-e em segundos.
            </p>

            <div className="grid md:grid-cols-3 gap-8">

                {/* ================= COLUNA 1 ================= */}
                <div className="p-6 border rounded-2xl bg-white shadow-sm">
                    <h2 className="text-lg font-semibold mb-3 text-red-700">
                        1️⃣ Extrair tudo
                    </h2>

                    <p className="text-sm text-slate-600 mb-4">
                        Use quando você quer abrir um ou mais arquivos ZIP e ver todos os arquivos
                        contidos (inclusive ZIPs dentro de ZIPs).
                    </p>

                    <input
                        type="file"
                        multiple
                        accept=".zip"
                        onChange={(e) =>
                            setZipFiles(e.target.files ? Array.from(e.target.files) : [])
                        }
                    />

                    <button
                        onClick={extractAll}
                        disabled={processing || zipFiles.length === 0}
                        className="mt-4 w-full py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {processing ? "Extraindo..." : "Extrair arquivos"}
                    </button>
                </div>

                {/* ================= COLUNA 2 ================= */}
                <div className="p-6 border rounded-2xl bg-white shadow-sm">
                    <h2 className="text-lg font-semibold mb-3 text-blue-700">
                        2️⃣ Filtrar XMLs
                    </h2>

                    <p className="text-sm text-slate-600 mb-4">
                        Envie arquivos ZIP e informe qualquer informação da nota:
                        <b> chave, número, data, CNPJ ou natureza da operação</b>.
                    </p>

                    <input
                        type="file"
                        multiple
                        accept=".zip"
                        onChange={(e) =>
                            setSearchZips(e.target.files ? Array.from(e.target.files) : [])
                        }
                    />

                    <textarea
                        value={keys}
                        onChange={(e) => setKeys(e.target.value)}
                        placeholder={`Exemplos:
35240100000000000000550010000012345678901234
VENDA
2024-01
12345678000199`}
                        className="w-full border p-3 rounded-lg h-32 mt-4 font-mono text-sm"
                    />

                    <button
                        onClick={filterByKeys}
                        disabled={processing || searchZips.length === 0}
                        className="mt-4 w-full py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {processing ? "Filtrando..." : "Buscar XMLs"}
                    </button>
                </div>

                {/* ================= COLUNA 3 ================= */}
                <div className="p-6 border rounded-2xl bg-white shadow-sm">
                    <h2 className="text-lg font-semibold mb-3 text-green-700">
                        3️⃣ Normalizar & Organizar
                    </h2>

                    <p className="text-sm text-slate-600 mb-4">
                        Envie XMLs soltos ou ZIPs. O sistema irá limpar os arquivos
                        e organizá-los automaticamente por <b>Natureza da Operação</b> e <b>Mês</b>.
                    </p>

                    <input
                        type="file"
                        multiple
                        accept=".xml,.zip"
                        onChange={(e) =>
                            setNormalizeFiles(e.target.files ? Array.from(e.target.files) : [])
                        }
                    />

                    <button
                        onClick={normalizePipeline}
                        disabled={processing || normalizeFiles.length === 0}
                        className="mt-4 w-full py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                        {processing ? "Processando..." : "Normalizar e organizar"}
                    </button>
                </div>

            </div>

            {/* ================= TOAST ================= */}
            {showSummary && (
                <div className="fixed bottom-6 right-6 w-96 bg-white border border-slate-200 rounded-2xl shadow-xl p-5 z-50 animate-slideUp">
                    <h3 className="text-sm font-semibold mb-3 text-slate-800">
                        📊 Resumo do processamento
                    </h3>

                    <pre className="bg-slate-100 p-3 rounded text-xs whitespace-pre-wrap max-h-48 overflow-auto">
                        {summaryText}
                    </pre>

                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            onClick={normalizeResults}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                            🧹 Normalizar
                        </button>

                        <button
                            onClick={downloadZip}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        >
                            📦 Baixar ZIP
                        </button>

                        <button
                            onClick={() => setShowSummary(false)}
                            className="px-4 py-2 bg-gray-300 text-sm rounded-lg hover:bg-gray-400"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
