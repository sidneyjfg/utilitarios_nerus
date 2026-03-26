import { useEffect, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
type Preset = {
    authorization: string;
    loja: string;
};

export default function XmlSearch() {
    const STORAGE_KEY = "xmlSearchPresets";

    const [presetList, setPresetList] = useState<string[]>([]);
    const [selectedPreset, setSelectedPreset] = useState("novo");

    const [nome, setNome] = useState("");
    const [authorization, setAuthorization] = useState("");
    const [loja, setLoja] = useState("");

    const [inputChaves, setInputChaves] = useState("");
    const [output, setOutput] = useState("");
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState("");
    const [zipBlob, setZipBlob] = useState<Blob | null>(null);

    // -------------------------
    // Notificação
    // -------------------------
    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(""), 2500);
    };

    // -------------------------
    // Carregar presets
    // -------------------------
    useEffect(() => {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return;

        const presets = JSON.parse(data);
        setPresetList(Object.keys(presets));
    }, []);

    // -------------------------
    // Selecionar preset
    // -------------------------
    const loadPreset = (name: string) => {
        setSelectedPreset(name);

        if (name === "novo") {
            setNome("");
            setAuthorization("");
            setLoja("");
            return;
        }

        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return;

        const presets = JSON.parse(data);
        const p: Preset = presets[name];

        setNome(name);
        setAuthorization(p.authorization);
        setLoja(p.loja);
    };

    // -------------------------
    // Salvar preset
    // -------------------------
    const savePreset = () => {
        if (!nome.trim()) {
            showNotification("Informe um nome para o preset");
            return;
        }

        const data = localStorage.getItem(STORAGE_KEY);
        const presets = data ? JSON.parse(data) : {};

        presets[nome] = {
            authorization,
            loja,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));

        if (!presetList.includes(nome)) {
            setPresetList((prev) => [...prev, nome]);
        }

        setSelectedPreset(nome);
        showNotification("Preset salvo!");
    };

    // -------------------------
    // Parse CSV (#)
    // -------------------------
    const parseCSV = (text: string) => {
        const linhas = text.split(/\r\n|\n|\r/).slice(1);
        console.log("Texto CSV:", text);
        console.log("Linhas:", linhas);
        const chaves: string[] = [];

        linhas.forEach((linha) => {
            if (!linha.trim()) return;

            const colunas = linha.split("#");

            const situacao = colunas[5]?.trim().toLowerCase().replace(/"/g, "");
            const chave = colunas[14]?.trim().replace(/"/g, "");
            console.log("Linha:", linha);
            console.log("Colunas:", colunas);
            console.log("Situação:", situacao);
            console.log("Chave:", chave);
            if (!chave) return;

            if (situacao !== "rejeitada") {
                chaves.push(chave);
            }
        });

        return chaves;
    };

    // -------------------------
    // Upload CSV
    // -------------------------
    const handleFile = async (file: File) => {
        const text = await file.text();
        const chaves = parseCSV(text);

        setInputChaves(chaves.join("\n"));
        showNotification(`${chaves.length} chaves carregadas`);
    };

    // -------------------------
    // Buscar ID
    // -------------------------
    const buscarId = async (chave: string) => {
        const res = await fetch(
            `https://nerus-edoc.net/api/Nfes/pesquisar?chave=${chave}`,
            {
                headers: {
                    Authorization: authorization,
                    numeroLoja: loja,
                },
            }
        );

        const data = await res.json();
        console.log("Resposta ID para chave ", chave, " : ", data);
        // ⚠️ Ajustar se necessário conforme retorno real
        return data[0].idImportacao;
    };

    // -------------------------
    // Buscar XML
    // -------------------------
    const buscarXML = async (id: string) => {
        const res = await fetch(
            `https://nerus-edoc.net/api/Nfes/obterxml?id=${id}`,
            {
                headers: {
                    Authorization: authorization,
                    numeroLoja: loja,
                },
            }
        );

        const data = await res.json();

        return data?.xml;
    };

    const limparTudo = () => {
        setInputChaves("");
        setOutput("");
        setZipBlob(null);
        showNotification("Dados limpos");
    };

    // -------------------------
    // Processo completo
    // -------------------------
    const processar = async () => {
        if (!authorization) {
            showNotification("Authorization não informado");
            return;
        }

        if (!loja) {
            showNotification("Número da loja não informado");
            return;
        }

        if (!inputChaves.trim()) {
            showNotification("Nenhuma chave informada");
            return;
        }

        setLoading(true);
        setOutput("");

        const lista = inputChaves.split(/[\s,;\n]+/).filter(Boolean);
        console.log("INPUT CHAVES:", inputChaves);
        const resultados: string[] = [];

        const zip = new JSZip(); // 🔥 cria zip

        console.log("Iniciando busca para", lista.length, "chaves\n ", lista);

        for (const chave of lista) {
            try {
                const id = await buscarId(chave);

                if (!id) {
                    resultados.push(`❌ ${chave} -> ID não encontrado`);
                    continue;
                }

                const xml = await buscarXML(id);

                if (xml) {
                    // 🔥 adiciona arquivo no zip
                    zip.file(`${chave}.xml`, xml);
                }

                resultados.push(`✅ ${chave}`);
            } catch (err) {
                resultados.push(`❌ ${chave} -> ERRO`);
            }
        }

        // 🔥 gerar zip
        if (Object.keys(zip.files).length > 0) {
            const blob = await zip.generateAsync({ type: "blob" });

            setZipBlob(blob); // 🔥 guarda zip ao invés de baixar

            showNotification(`${Object.keys(zip.files).length} XMLs prontos para download`);
        } else {
            showNotification("Nenhum XML encontrado");
        }

        setOutput(resultados.join("\n"));
        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto mt-10">
            {notification && (
                <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50">
                    {notification}
                </div>
            )}
            {/* Título */}
            <h1 className="text-3xl font-bold mb-6 text-slate-900">
                Buscar XML por Chave NFe
            </h1>

            {/* BLOCO 1 - PRESET */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">

                <h2 className="font-semibold text-slate-800 mb-4">
                    Configuração
                </h2>

                {/* Select */}
                <div className="mb-4">
                    <label className="text-sm text-slate-600">Preset</label>
                    <select
                        className="w-full mt-1 p-2 border rounded-lg"
                        value={selectedPreset}
                        onChange={(e) => loadPreset(e.target.value)}
                    >
                        <option value="novo">Novo</option>
                        {presetList.map((p) => (
                            <option key={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {/* Grid 2 colunas */}
                <div className="grid md:grid-cols-2 gap-4">

                    <input
                        className="p-2 border rounded-lg"
                        placeholder="Nome do preset"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                    />

                    <input
                        className="p-2 border rounded-lg"
                        placeholder="Número da Loja"
                        value={loja}
                        onChange={(e) => setLoja(e.target.value)}
                    />
                </div>

                <div className="mt-4">
                    <input
                        className="w-full p-2 border rounded-lg"
                        placeholder="Authorization"
                        value={authorization}
                        onChange={(e) => setAuthorization(e.target.value)}
                    />
                </div>

                <button
                    onClick={savePreset}
                    className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                    Salvar Preset
                </button>
            </div>

            {/* BLOCO 2 - INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">

                <h2 className="font-semibold text-slate-800 mb-4">
                    Entrada de dados
                </h2>

                {/* Upload */}
                <div className="mb-4">
                    <label className="text-sm text-slate-600 block mb-1">
                        Importar CSV (#)
                    </label>

                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFile(file);
                        }}
                        className="block w-full text-sm"
                    />
                </div>

                {/* Textarea */}
                <textarea
                    className="w-full p-3 border rounded-lg h-40"
                    placeholder="Ou cole as chaves aqui..."
                    value={inputChaves}
                    onChange={(e) => setInputChaves(e.target.value)}
                />
            </div>

            {/* BLOCO 3 - AÇÃO */}
            <div className="flex justify-between items-center flex-wrap gap-3">

                <span className="text-sm text-slate-500">
                    {inputChaves
                        ? `${inputChaves.split(/\n/).filter(Boolean).length} chaves`
                        : ""}
                </span>

                <div className="flex gap-2">

                    {/* LIMPAR */}
                    <button
                        onClick={limparTudo}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-sm"
                    >
                        Limpar
                    </button>

                    {/* PROCESSAR */}
                    <button
                        onClick={processar}
                        disabled={loading}
                        className={`px-6 py-3 rounded-xl text-white shadow-sm
                ${loading
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700"
                            }`}
                    >
                        {loading ? "Processando..." : "Buscar XMLs"}
                    </button>

                </div>
            </div>

            {zipBlob && (
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={() => saveAs(zipBlob, "xmls_nfe.zip")}
                        className="px-5 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700"
                    >
                        Baixar ZIP
                    </button>
                </div>
            )}
            {/* OUTPUT */}
            {output && (
                <div className="mt-6 bg-slate-900 text-green-400 p-4 rounded-xl text-xs max-h-[500px] overflow-auto whitespace-pre-wrap">
                    {output}
                </div>
            )}
        </div>
    );
}