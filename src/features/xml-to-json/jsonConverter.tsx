// src/features/xml-to-json/JsonConverter.tsx
import React, { useState, useRef } from "react";
import type { ChangeEvent } from "react";
import { FiCopy } from "react-icons/fi";

type OutputItem = {
  fileName: string;
  json: unknown;
};

const JsonConverter: React.FC = () => {
  const [xmlFiles, setXmlFiles] = useState<File[]>([]);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notification, setNotification] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Processar seleção de arquivos
  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setXmlFiles(files);
    setOutputs([]);
    setErrors([]);
  };

  // Função auxiliar para extrair dados do XML
  const extractData = (xmlDoc: Document) => {
    const extractValue = (path: string, context: ParentNode = xmlDoc): string | null => {
      const nodes = path.split(".");
      let currentNode: ParentNode | Element | null = context;

      for (const node of nodes) {
        if (!(currentNode instanceof Element || currentNode instanceof Document)) {
          return null;
        }
        const nextNode = currentNode.querySelector(node) as Element | null;
        if (!nextNode) return null;
        currentNode = nextNode;
      }

      return (currentNode as Element).textContent;
    };

    const extractAfterColon = (value: string | null): string | null => {
      if (value && value.includes(":")) {
        const index = value.indexOf(":") + 1;
        return value.substring(index, index + 16).trim();
      }
      return value || null;
    };

    const extractProducts = () => {
      const productNodes = xmlDoc.querySelectorAll("det");
      return Array.from(productNodes).map((productNode) => ({
        sku: extractValue("prod cProd", productNode),
        quantidade: extractValue("prod qCom", productNode),
        precoUnitario: extractValue("prod vUnCom", productNode)?.slice(0, -6) ?? null,
        idPedidoCanal: extractAfterColon(extractValue("infAdProd", productNode)),
        valorComissao: 0,
      }));
    };

    const dataPedidoRaw = extractValue("ide dhEmi");
    const dataPedido = dataPedidoRaw
      ? dataPedidoRaw.slice(0, -6) + ".323Z"
      : null;

    const dataEntrega = dataPedidoRaw
      ? dataPedidoRaw.slice(0, -15)
      : null;

    const emailBase = extractAfterColon(extractValue("det infAdProd")) ?? "cliente";
    const email = `${emailBase}@mercadolibre.com`;

    return {
      idPedidoHub: extractAfterColon(extractValue("det infAdProd")),
      idPedidoCanal: extractAfterColon(extractValue("det infAdProd")),
      dataPedido,
      dataEntrega,
      idCanal: 2,
      idLoja: "1",
      idHub: 2,
      observacoesEntrega: null,
      status: 0,
      entrega: {
        cep: extractValue("enderDest CEP"),
        numero: extractValue("enderDest nro"),
        endereco: extractValue("enderDest xLgr"),
        complemento: extractValue("enderDest xCpl"),
        bairro: extractValue("enderDest xBairro"),
        cidade: extractValue("enderDest xMun"),
        estado: extractValue("enderDest UF"),
      },
      cliente: {
        cnpjCpf:
          extractValue("dest CNPJ") ||
          extractValue("dest CPF") ||
          null,
        ie: "",
        rg: "",
        nome: extractValue("dest xNome"),
        ddd: "11",
        telefone: null,
        celular: "111111111",
        email,
        nomeFantasia: extractValue("dest xNome"),
      },
      pagamento: {
        tipoPagamento: 2,
        bandeira: 0,
        valorDesconto: extractValue("total ICMSTot vDesc"),
        valorFrete: extractValue("total ICMSTot vFrete"),
        valorTotal: extractValue("total ICMSTot vNF"),
        parcelas: 1,
      },
      fulfillment: 1,
      produtos: extractProducts(),
    };
  };

  // Converter XML → JSON
  const convertXmlToJson = () => {
    if (xmlFiles.length === 0) {
      setErrors(["Selecione pelo menos um arquivo XML válido."]);
      return;
    }

    const newOutputs: OutputItem[] = [];
    const newErrors: string[] = [];

    xmlFiles.forEach((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const parser = new DOMParser();
          const xmlString = String(reader.result);
          const xmlDoc = parser.parseFromString(xmlString, "application/xml");

          // Verificar erros no XML
          if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            throw new Error(`XML inválido: ${file.name}`);
          }

          const jsonResult = extractData(xmlDoc);
          newOutputs.push({ fileName: file.name, json: jsonResult });
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : `Ocorreu um erro ao processar ${file.name}`;
          newErrors.push(message);
        }

        // Quando todos os arquivos tiverem sido processados
        if (newOutputs.length + newErrors.length === xmlFiles.length) {
          setOutputs(newOutputs);
          setErrors(newErrors);
        }
      };

      reader.readAsText(file);
    });
  };

  // Limpar a tela
  const clearAll = () => {
    setXmlFiles([]);
    setOutputs([]);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Copiar JSON para a área de transferência
  const copyToClipboard = (jsonContent: unknown) => {
    navigator.clipboard
      .writeText(JSON.stringify(jsonContent, null, 2))
      .then(() => {
        showNotification("JSON copiado para a área de transferência!");
      })
      .catch((err) => {
        console.error("Falha ao copiar JSON: ", err);
      });
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification("");
    }, 3000);
  };

  return (
    <div className="mt-8 max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-4">
        Conversor XML → JSON
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        Selecione um ou mais arquivos XML para convertê-los em JSON com o
        formato esperado pelo hub.
      </p>

      {/* Upload */}
      <div className="bg-white border rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            multiple
            onChange={handleFileUpload}
            className="block w-full text-sm text-slate-700
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
          />

          <div className="flex gap-3">
            <button
              onClick={convertXmlToJson}
              className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Converter XML
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-full bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        {xmlFiles.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Arquivos selecionados:{" "}
            {xmlFiles.map((f) => f.name).join(", ")}
          </p>
        )}
      </div>

      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {notification}
        </div>
      )}

      {/* Erros */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">
          <strong className="block font-semibold mb-1">Erros:</strong>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Saída JSON */}
      {outputs.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Resultado JSON</h2>
          {outputs.map((output, index) => (
            <div
              key={index}
              className="relative bg-white border rounded-xl p-4 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-sm">
                    Arquivo: {output.fileName}
                  </h3>
                </div>
                <button
                  onClick={() => copyToClipboard(output.json)}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-emerald-500 text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <FiCopy size={16} />
                  Copiar JSON
                </button>
              </div>
              <pre className="text-xs bg-slate-50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(output.json, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JsonConverter;
