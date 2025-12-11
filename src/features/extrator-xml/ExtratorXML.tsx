import { useState, useEffect } from "react";
import JSZip from "jszip";

type ExtractedFile = {
    name: string;
    content: Blob;
};

export default function ExtratorXML() {
    const [zipFiles, setZipFiles] = useState<File[]>([]);
    const [searchZips, setSearchZips] = useState<File[]>([]);
    const [keys, setKeys] = useState("");

    const [results, setResults] = useState<ExtractedFile[]>([]);
    const [processing, setProcessing] = useState(false);

    const [showSummary, setShowSummary] = useState(false);
    const [summaryText, setSummaryText] = useState("");

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
            output.push({ name: flatName, content });
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

        results.forEach((file) => zip.file(file.name, file.content));

        const blob = await zip.generateAsync({ type: "blob" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resultado.zip";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-3xl mx-auto mt-10 select-none">

            <h1 className="text-2xl font-bold mb-6">Extrator e Filtro de XMLs</h1>

            {/* ------------------ */}
            {/* EXTRATOR COMPLETO */}
            {/* ------------------ */}
            <div className="p-4 border rounded-xl bg-white shadow-sm mb-8">
                <h2 className="text-lg font-semibold mb-2">1️⃣ Extrair tudo (ZIP + ZIP interno)</h2>

                <input
                    type="file"
                    multiple
                    accept=".zip"
                    onChange={(e) => setZipFiles(e.target.files ? Array.from(e.target.files) : [])}
                />

                <button
                    onClick={extractAll}
                    disabled={processing || zipFiles.length === 0}
                    className="mt-3 px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                    {processing ? "Processando..." : "Extrair tudo"}
                </button>
            </div>

            {/* ----------------------- */}
            {/* FILTRAR POR CHAVES     */}
            {/* ----------------------- */}
            <div className="p-4 border rounded-xl bg-white shadow-sm mb-8">
                <h2 className="text-lg font-semibold mb-2">2️⃣ Buscar arquivos por chave (em vários ZIPs)</h2>

                <input
                    type="file"
                    multiple
                    accept=".zip"
                    onChange={(e) => setSearchZips(e.target.files ? Array.from(e.target.files) : [])}
                />

                <label className="block mt-4 font-medium">Chaves</label>
                <textarea
                    value={keys}
                    onChange={(e) => setKeys(e.target.value)}
                    className="w-full border p-2 rounded h-24 mt-1"
                />

                <button
                    onClick={filterByKeys}
                    disabled={processing || searchZips.length === 0}
                    className="mt-3 px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                    {processing ? "Buscando..." : "Buscar por chaves"}
                </button>
            </div>

            {/* ======================================================== */}
            {/*       TOAST — Resumo no canto inferior direito           */}
            {/* ======================================================== */}
            {showSummary && (
                <div
                    className="fixed bottom-4 right-4 w-80 md:w-96 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-50 
               animate-slideUp"
                >
                    <h3 className="text-sm font-semibold mb-2 text-slate-800">
                        📄 Resumo da Extração
                    </h3>

                    <pre className="bg-slate-100 p-2 rounded text-xs whitespace-pre-wrap max-h-40 overflow-auto">
                        {summaryText}
                    </pre>

                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={downloadZip}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                            Baixar ZIP
                        </button>

                        <button
                            onClick={() => setShowSummary(false)}
                            className="px-3 py-1 bg-gray-300 text-xs rounded hover:bg-gray-400"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
