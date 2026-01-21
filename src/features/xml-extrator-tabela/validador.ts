import { regras } from "./regras";

function fmtValor(valor: any) {
    if (valor === null || valor === undefined || String(valor).trim() === "") return "vazio";
    return `"${String(valor).trim()}"`;
}

function isBlank(valor: any) {
    return valor === null || valor === undefined || String(valor).trim() === "";
}

export function validarTabela(dados: any[]) {
    const erros: any[] = [];

    // Guarda ocorrências de valores para colunas unique: {coluna: {valor: [linhas...]}}
    const unicos: Record<string, Record<string, number[]>> = {};
    Object.entries(regras).forEach(([coluna, regra]: any) => {
        if (regra.unique) unicos[coluna] = {};
    });

    dados.forEach((linha, index) => {
        // Ignora linha totalmente vazia (mas se tiver qualquer campo preenchido, valida)
        const temAlgo = Object.values(linha).some(
            (v) => v !== null && v !== undefined && String(v).trim() !== ""
        );
        if (!temAlgo) return;

        const errosLinha: { coluna: string; valor: string; mensagem: string }[] = [];
        const linhaExcel = index + 7;

        Object.entries(regras).forEach(([coluna, regra]: any) => {
            const valor = linha[coluna];

            // ===== required =====
            if (regra.required) {
                const invalido = isBlank(valor) || Number(valor) === 0;
                if (invalido) {
                    errosLinha.push({
                        coluna,
                        valor: fmtValor(valor),
                        mensagem: "é obrigatório",
                    });
                }
            }

            // ===== requiredIf =====
            if (regra.requiredIf && regra.requiredIf(linha)) {
                if (isBlank(valor) || Number(valor) === 0) {
                    errosLinha.push({
                        coluna,
                        valor: fmtValor(valor),
                        mensagem: "é obrigatório para este CST",
                    });
                }
            }

            // ===== unique (apenas coleta aqui; erro é gerado depois) =====
            if (regra.unique && !isBlank(valor)) {
                const key = String(valor).trim();
                if (!unicos[coluna][key]) unicos[coluna][key] = [linhaExcel];
                else unicos[coluna][key].push(linhaExcel);
            }

            // ===== maxLength =====
            if (regra.maxLength && !isBlank(valor)) {
                const s = String(valor);
                if (s.length > regra.maxLength) {
                    errosLinha.push({
                        coluna,
                        valor: fmtValor(valor),
                        mensagem: `ultrapassa ${regra.maxLength} caracteres`,
                    });
                }
            }

            // ===== digits =====
            if (regra.digits && !isBlank(valor)) {
                const s = String(valor).trim();
                if (!/^\d+$/.test(s) || s.length !== regra.digits) {
                    errosLinha.push({
                        coluna,
                        valor: fmtValor(valor),
                        mensagem: `deve conter exatamente ${regra.digits} dígitos`,
                    });
                }
            }

            // ===== min =====
            if (regra.min !== undefined) {
                if (!isBlank(valor)) {
                    const num = Number(valor);
                    if (Number.isNaN(num) || num < regra.min) {
                        errosLinha.push({
                            coluna,
                            valor: fmtValor(valor),
                            mensagem: `inválido (mínimo ${regra.min})`,
                        });
                    }
                }
            }

            // ===== pattern =====
            if (regra.pattern && !isBlank(valor)) {
                const s = String(valor);
                if (!regra.pattern.test(s)) {
                    errosLinha.push({
                        coluna,
                        valor: fmtValor(valor),
                        mensagem: "possui caracteres inválidos",
                    });
                }
            }

            // ===== length exata =====
            if (regra.length && !isBlank(valor)) {
                const s = String(valor).trim();
                if (s.length !== regra.length) {
                    errosLinha.push({
                        coluna,
                        valor: fmtValor(valor),
                        mensagem: `deve ter exatamente ${regra.length} caracteres`,
                    });
                }
            }
        });

        if (errosLinha.length > 0) {
            erros.push({
                linha: linhaExcel,
                erros: errosLinha,
                // opcional: incluir identificador para mostrar no card (melhora MUITO)
                codigoInterno: linha["Código Interno"] ?? null,
                nomeProduto: linha["Nome Produto"] ?? null,
            });
        }
    });

    // ===== Gerar erros de duplicidade com valor + linhas =====
    Object.entries(unicos).forEach(([coluna, valores]) => {
        Object.entries(valores).forEach(([valor, linhas]) => {
            if (linhas.length > 1) {
                linhas.forEach((linhaExcel) => {
                    let item = erros.find((e) => e.linha === linhaExcel);
                    if (!item) {
                        item = { linha: linhaExcel, erros: [] };
                        erros.push(item);
                    }
                    item.erros.push({
                        coluna,
                        valor: `"${valor}"`,
                        mensagem: `duplicado nas linhas ${linhas.join(", ")}`
                    });
                });
            }
        });
    });

    // (opcional) ordenar por linha para ficar bonito no UI
    erros.sort((a, b) => a.linha - b.linha);

    return erros;
}
