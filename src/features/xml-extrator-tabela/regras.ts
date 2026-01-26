export const regras = {
    "Código Interno": {
        unique: true,
    },
    "Nome Produto": {
        unique: true,
        maxLength: 40,
    },
    "Código Barra": {
        unique: true,
    },
    "Grupo Produto": {
        pattern: /^[A-Za-z0-9]+$/, // sem espaço, sem cedilha, sem til
    },
    "Tipo Unidade": {
        required: true,
        length: 2,
    },
    "Preço": {
        min: 0.01,
        required: true,
    },
    "NFCeNCM": {
        digits: 8,
        required: true,
    },
    "NFCeCFOP": {
        digits: 4,
        required: true,
    },
    "NFCeCST": {
        digits: 3,
        required: true,
    },

    "NFCeCEST": {
        requiredIf: (linha: any) => String(linha["NFCeCST"]) === "110",

        requiredIfMessage: (linha: any) =>
            `NFCeCST está "${linha["NFCeCST"]}", logo NFCeCEST deve estar preenchido obrigatoriamente`,

        validate: (valor: any, linha: any) => {
            // Se CST ≠ 110 → ignora completamente o campo
            if (String(linha["NFCeCST"]) !== "110") {
                return true;
            }

            // CST = 110 → obrigatório
            if (valor === null || valor === undefined || String(valor).trim() === "" || Number(valor) === 0) {
                return "deve ser preenchido quando NFCeCST for 110";
            }

            const s = String(valor).trim();

            if (!/^\d{7}$/.test(s)) {
                return "deve conter exatamente 7 dígitos quando NFCeCST for 110";
            }

            return true;
        }
    },
    "NFCeCSTPIS": {
        digits: 2,
        min: 1,
        required: true,
    },
    "NFCeAliqPIS": {
        min: 0.0001,
        required: true,
    },
    "NFCeCSTCOFINS": {
        digits: 2,
        required: true,
    },
    "NFCeAliqCOFINS": {
        min: 0.0001,
        required: true,
    },
};
