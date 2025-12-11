// src/App.tsx
import { Routes, Route, Link } from "react-router-dom";
import Home from "./routes/Home";
import JsonConverter from "./features/xml-to-json/jsonConverter";
import ReenvioPedidos from "./features/reenvio/ReenvioPedidos";
import ExtratorXML from "./features/extrator-xml/ExtratorXML";

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-red-700 text-white py-4 shadow-sm">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link
            to="/"
            className="text-2xl font-bold tracking-tight hover:opacity-90 transition-opacity"
          >
            Utilitários Nerus
          </Link>

          <span className="text-sm opacity-90">
            Ferramentas úteis • 100% Frontend
          </span>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/xml-to-json" element={<JsonConverter />} />
          <Route path="/reenviar-pedidos" element={<ReenvioPedidos />} />
          <Route path="/extrator-xml" element={<ExtratorXML />} />
        </Routes>
      </main>

      {/* Rodapé */}
      <footer className="border-t bg-white py-4 mt-6">
        <div className="container mx-auto px-4 text-xs text-slate-500 text-center">
          Utilitários Nerus • {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

export default App;
