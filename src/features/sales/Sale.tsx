import { useEffect, useState } from "react";
import { getSales } from "./index";
import type { Preset, SalesResult } from "./types";

const STORAGE_KEY = "salesPresets";

export default function Sales() {
  const [presets, setPresets] = useState<Record<string, Preset>>({});
  const [presetSelecionado, setPresetSelecionado] = useState("novo");

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<
    "anymarket" | "pluggto" | "tray" | "wake"
  >("anymarket");

  const [form, setForm] = useState<any>({});

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [resultado, setResultado] = useState<SalesResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [notification, setNotification] = useState("");

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2500);
  };

  // carregar presets
  useEffect(() => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      setPresets(JSON.parse(data));
    }
  }, []);

  const salvarPreset = () => {
    if (!nome.trim()) {
      showNotification("Informe um nome");
      return;
    }

    const novo = {
      ...presets,
      [nome]: {
        tipo,
        ...form,
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(novo));
    setPresets(novo);
    setPresetSelecionado(nome);

    showNotification("Preset salvo");
  };

  const carregarPreset = (name: string) => {
    setPresetSelecionado(name);

    if (name === "novo") {
      setNome("");
      setForm({});
      return;
    }

    const p = presets[name];
    setNome(name);
    setTipo(p.tipo);
    setForm(p);
  };

  const processar = async () => {
    if (!dataInicio || !dataFim) {
      showNotification("Informe as datas");
      return;
    }

    setLoading(true);
    setResultado(null);

    console.log("🚀 INICIANDO BUSCA");
    console.log("Preset:", { tipo, ...form });
    console.log("Período:", { dataInicio, dataFim });

    try {
      const result = await getSales(
        {
          tipo,
          ...form,
        },
        {
          dataInicio,
          dataFim,
        }
      );

      console.log("✅ RESULTADO:", result);

      setResultado(result);
    } catch (err: any) {
      console.error("❌ ERRO:", err);
      showNotification("Erro ao buscar vendas (ver console)");
    }

    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto mt-10">

      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {notification}
        </div>
      )}

      <h1 className="text-3xl font-bold mb-6">Vendas por Painel</h1>

      {/* PRESET */}
      <div className="bg-white p-6 rounded-2xl border mb-6">
        <h2 className="font-semibold mb-4">Configuração</h2>

        <select
          className="w-full mb-4 p-2 border rounded"
          value={presetSelecionado}
          onChange={(e) => carregarPreset(e.target.value)}
        >
          <option value="novo">Novo</option>
          {Object.keys(presets).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <input
          className="w-full mb-3 p-2 border rounded"
          placeholder="Nome do preset"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <select
          className="w-full mb-3 p-2 border rounded"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
        >
          <option value="anymarket">Anymarket</option>
          <option value="pluggto">PluggTo</option>
          <option value="tray">Tray</option>
          <option value="wake">Wake</option>
        </select>

        {/* CAMPOS DINÂMICOS */}
        {tipo === "anymarket" && (
          <input
            className="w-full p-2 border rounded"
            placeholder="gumgaToken"
            onChange={(e) => setForm({ gumgaToken: e.target.value })}
          />
        )}

        {tipo === "pluggto" && (
          <>
            <input
              className="w-full mb-2 p-2 border rounded"
              placeholder="username"
              onChange={(e) =>
                setForm((f: any) => ({ ...f, username: e.target.value }))
              }
            />
            <input
              className="w-full p-2 border rounded"
              placeholder="password"
              onChange={(e) =>
                setForm((f: any) => ({ ...f, password: e.target.value }))
              }
            />
            <input
              className="w-full mt-2 p-2 border rounded"
              placeholder="client_id"
              onChange={(e) =>
                setForm((f: any) => ({ ...f, client_id: e.target.value }))
              }
            />
            <input
              className="w-full mt-2 p-2 border rounded"
              placeholder="client_secret"
              onChange={(e) =>
                setForm((f: any) => ({ ...f, client_secret: e.target.value }))
              }
            />

          </>
        )}

        {tipo === "tray" && (
          <>
            <input
              className="w-full mb-2 p-2 border rounded"
              placeholder="consumer_key"
              onChange={(e) =>
                setForm((f: any) => ({
                  ...f,
                  consumer_key: e.target.value,
                }))
              }
            />
            <input
              className="w-full mb-2 p-2 border rounded"
              placeholder="consumer_secret"
              onChange={(e) =>
                setForm((f: any) => ({
                  ...f,
                  consumer_secret: e.target.value,
                }))
              }
            />
            <input
              className="w-full p-2 border rounded"
              placeholder="code"
              onChange={(e) =>
                setForm((f: any) => ({ ...f, code: e.target.value }))
              }
            />
          </>
        )}

        {tipo === "wake" && (
          <input
            className="w-full p-2 border rounded"
            placeholder="Token"
            onChange={(e) => setForm({ token: e.target.value })}
          />
        )}

        <button
          onClick={salvarPreset}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Salvar Preset
        </button>
      </div>

      {/* FILTRO */}
      <div className="bg-white p-6 rounded-2xl border mb-6">
        <h2 className="font-semibold mb-4">Período</h2>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            className="p-2 border rounded"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />

          <input
            type="date"
            className="p-2 border rounded"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
      </div>

      {/* AÇÃO */}
      <button
        onClick={processar}
        className={`w-full py-3 rounded text-white ${
          loading ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {loading ? "Buscando..." : "Buscar Vendas"}
      </button>

      {/* RESULTADO */}
      {resultado && (
        <div className="mt-6 space-y-6">

          {/* RESUMO GERAL */}
          <div className="bg-white p-6 rounded-2xl border">
            <h2 className="font-semibold mb-4">Resumo Geral</h2>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-100 p-4 rounded-xl">
                <p className="text-sm text-slate-500">Pedidos</p>
                <p className="text-2xl font-bold">
                  {resultado.totalPedidos}
                </p>
              </div>

              <div className="bg-slate-100 p-4 rounded-xl">
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold">
                  R$ {resultado.totalValor.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* FULFILLMENT */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-xl">
              <p className="text-sm">Fulfillment</p>
              <p>{resultado.fulfillment.pedidos} pedidos</p>
              <p>R$ {resultado.fulfillment.valor.toFixed(2)}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="text-sm">Não Fulfillment</p>
              <p>{resultado.naoFulfillment.pedidos} pedidos</p>
              <p>R$ {resultado.naoFulfillment.valor.toFixed(2)}</p>
            </div>
          </div>

          {/* MARKETPLACES */}
          <div className="bg-white p-6 rounded-2xl border">
            <h2 className="font-semibold mb-4">Marketplaces</h2>

            {Object.entries(resultado.marketplaces).map(([mp, data]) => (
              <div
                key={mp}
                className="border p-4 rounded-xl mb-3 bg-slate-50"
              >
                <h3 className="font-semibold mb-2">{mp}</h3>

                <p>
                  Total: {data.totalPedidos} | R${" "}
                  {data.totalValor.toFixed(2)}
                </p>

                <p className="text-green-600">
                  Fulfillment: {data.fulfillment.pedidos} | R${" "}
                  {data.fulfillment.valor.toFixed(2)}
                </p>

                <p className="text-blue-600">
                  Não Fulfillment: {data.naoFulfillment.pedidos} | R${" "}
                  {data.naoFulfillment.valor.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}