import { useEffect, useState } from "react";
import { FiCopy } from "react-icons/fi";

type Platform = "any" | "tray" | "plugg";

type Preset = {
  platform: Platform;
  url: string;
  user: string;
  oi: string;
};

export default function ReenvioPedidos() {
  const STORAGE_KEY = "utilitariosReenvioPresets";

  const [presetList, setPresetList] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("novo"); 

  const [cliente, setCliente] = useState("");
  const [platform, setPlatform] = useState<Platform>("any");
  const [url, setUrl] = useState("");
  const [user, setUser] = useState("");
  const [oi, setOi] = useState("");
  const [ids, setIds] = useState("");
  const [output, setOutput] = useState("");

  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState("");
  const [showAll, setShowAll] = useState(false);

  // ---------------------------------
  // Carregar presets ao iniciar
  // ---------------------------------
  useEffect(() => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;

    const presets = JSON.parse(data);
    setPresetList(Object.keys(presets));
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2500);
  };

  // ---------------------------------
  // Selecionar um preset existente
  // ---------------------------------
  const loadPreset = (presetName: string) => {
    setSelectedPreset(presetName);

    if (presetName === "novo") {
      setCliente("");
      setUrl("");
      setOi("");
      setUser("");
      return;
    }

    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;

    const presets = JSON.parse(data);
    const p: Preset = presets[presetName];

    setCliente(presetName);
    setPlatform(p.platform);
    setUrl(p.url);
    setOi(p.oi);
    setUser(p.user ?? "");
  };

  // ---------------------------------
  // Salvar preset
  // ---------------------------------
  const savePreset = () => {
    if (!cliente || cliente.trim().length === 0) {
      showNotification("Defina um nome de cliente antes de salvar!");
      return;
    }

    const data = localStorage.getItem(STORAGE_KEY);
    const presets = data ? JSON.parse(data) : {};

    presets[cliente] = {
      platform,
      url,
      oi,
      user,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));

    if (!presetList.includes(cliente)) {
      setPresetList((prev) => [...prev, cliente]);
    }

    setSelectedPreset(cliente);
    showNotification(`Preset salvo para "${cliente}"`);
  };

  // ---------------------------------
  // Gerar CURLs
  // ---------------------------------
  const generateCurl = () => {
    const idList = ids.split(/[\s,;]+/).filter(Boolean);
    let commands = "";

    idList.forEach((id) => {
      if (platform === "any") {
        commands += `
curl --location '${url}' \\
--header 'Content-Type: application/json' \\
--data '{
  "type": "ORDER",
  "content": { "id": "${id}", "oi": "${oi}" }
}'
`.trim() + "\n\n";
      }

      if (platform === "plugg") {
        commands += `
curl --location '${url}' \\
--header 'Content-Type: application/json' \\
--data '{
  "id": "${id}",
  "action": "created",
  "user": ${user},
  "changes": { "status": false, "stock": false, "price": false },
  "type": "orders"
}'
`.trim() + "\n\n";
      }

      if (platform === "tray") {
        commands += `
curl --location '${url}' \\
--header 'Content-Type: application/json' \\
--data '{"orderId":${id},"act":"created"}'
`.trim() + "\n\n";
      }
    });

    setOutput(commands);
    setShowAll(false);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      showNotification("Comandos copiados!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 relative">

      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg animate-fade">
          {notification}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-4">Gerador de CURLs – Reenvio de Pedidos</h1>

      {/* SELECIONAR PRESET */}
      <div className="mb-4">
        <label className="font-medium">Selecionar Preset</label>
        <select
          className="block w-full mt-1 p-2 border rounded"
          value={selectedPreset}
          onChange={(e) => loadPreset(e.target.value)}
        >
          <option value="novo">Novo cliente</option>
          {presetList.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* CLIENTE */}
      <div className="mb-4">
        <label className="font-medium">Nome do Cliente</label>
        <input
          className="block w-full mt-1 p-2 border rounded"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
        />
      </div>

      <button
        onClick={savePreset}
        className="mb-6 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Salvar preset deste cliente
      </button>

      {/* PLATAFORMA */}
      <div className="mb-4">
        <label className="font-medium">Plataforma</label>
        <select
          className="block w-full mt-1 p-2 border rounded"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
        >
          <option value="any">Anymarket</option>
          <option value="tray">Tray</option>
          <option value="plugg">PluggTo</option>
        </select>
      </div>

      {/* CAMPOS */}
      <div className="mb-4">
        <label className="font-medium">URL</label>
        <input
          className="block w-full mt-1 p-2 border rounded"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      {platform === "plugg" && (
        <div className="mb-4">
          <label className="font-medium">User</label>
          <input
            className="block w-full mt-1 p-2 border rounded"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </div>
      )}

      {platform === "any" && (
        <div className="mb-4">
          <label className="font-medium">OI</label>
          <input
            className="block w-full mt-1 p-2 border rounded"
            value={oi}
            onChange={(e) => setOi(e.target.value)}
          />
        </div>
      )}

      {/* IDs */}
      <div className="mb-4">
        <label className="font-medium">IDs</label>
        <textarea
          className="block w-full mt-1 p-2 border rounded h-32"
          value={ids}
          onChange={(e) => setIds(e.target.value)}
        />
      </div>

      <button
        onClick={generateCurl}
        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
      >
        Gerar CURLs
      </button>

      {/* Resultados */}
      {output && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Comandos</h2>

            <button
              className={`flex items-center gap-2 text-sm px-3 py-1 rounded
              ${copied ? "bg-green-600 text-white" : "bg-slate-200 hover:bg-slate-300"}
            `}
              onClick={copyAll}
            >
              <FiCopy />
              {copied ? "Copiado!" : "Copiar tudo"}
            </button>
          </div>

          <pre className="bg-slate-900 text-green-400 text-xs p-4 rounded overflow-x-auto max-h-96 whitespace-pre-wrap">
            {showAll
              ? output
              : (() => {
                  const parts = output.trim().split("\n\n");
                  const preview = parts.slice(0, 3).join("\n\n");
                  const rest = parts.length - 3;
                  return preview + (rest > 0 ? `\n\n... e mais ${rest} comandos` : "");
                })()}
          </pre>

          {output.split("\n\n").length > 3 && (
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              {showAll ? "Ocultar" : "Mostrar tudo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
