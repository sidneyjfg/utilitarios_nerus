// src/routes/Home.tsx
import { Link } from "react-router-dom";
import { FiCpu, FiFolder, FiTable, FiTool, FiZap } from "react-icons/fi";

const utilities = [
  {
    title: "Conversor XML → JSON",
    description:
      "Converta arquivos XML de notas fiscais em JSON estruturado para integração.",
    path: "/xml-to-json",
    badge: "Ativo",
    icon: <FiCpu size={24} />,
  },
  {
    title: "Reenvio de Pedidos",
    description: "Reenvie pedidos para os hubs Anymarket, TrayCommerce ou PluggTo rapidamente.",
    path: "/reenviar-pedidos",
    badge: "Ativo",
    icon: <FiZap size={24} />, // importe FiZap do react-icons/fi
  },
  {
    title: "Extrair e Buscar XMLs em ZIPs",
    description: "Extraia ZIPs recursivamente normalize XMLs e filtre XMLs por nome, com resumo automático.",
    path: "/extrator-xml",
    badge: "Ativo",
    icon: <FiFolder size={24} />,
  },
  {
    title: "Validador POS Controle",
    description:
      "Lê planilhas Excel ignorando linhas 1–5 e use a 6ª como cabeçalhos.",
    path: "/xml-tabela",
    badge: "Ativo",
    icon: <FiTable size={24} />,
  },
  {
    title: "Outra funcionalidade",
    description: "Mais utilidades serão adicionadas futuramente.",
    path: "#",
    badge: "Em breve",
    disabled: true,
    icon: <FiTool size={24} />,
  },
];

function Home() {
  return (
    <div className="mt-10 select-none">
      {/* Título */}
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-3">
        Utilitários Nérus
      </h1>

      {/* Subtítulo */}
      <p className="text-slate-600 mb-10 max-w-xl text-sm leading-relaxed">
        Ferramentas rápidas, simples e totalmente executadas no navegador.
        Escolha um utilitário abaixo.
      </p>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {utilities.map((util) => (
          <div
            key={util.title}
            className={`border border-slate-200 bg-white rounded-2xl p-6 shadow-sm transition-all 
              ${util.disabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:shadow-md hover:-translate-y-1"
              }`}
          >
            {/* Ícone + Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-red-50 text-red-700">
                {util.icon}
              </div>

              <span
                className={`text-xs px-3 py-1 rounded-full ${util.badge === "Ativo"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
                  }`}
              >
                {util.badge}
              </span>
            </div>

            {/* Título */}
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              {util.title}
            </h2>

            {/* Descrição */}
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {util.description}
            </p>

            {/* Botão */}
            {util.disabled ? (
              <button
                disabled
                className="w-full text-sm py-2 rounded-full border border-slate-300 text-slate-400 cursor-not-allowed"
              >
                Em desenvolvimento
              </button>
            ) : (
              <Link
                to={util.path}
                className="w-full inline-flex items-center justify-center text-sm py-2 rounded-full 
                bg-red-600 text-white hover:bg-red-700 transition-all"
              >
                Acessar
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;
