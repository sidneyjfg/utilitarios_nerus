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
        digits: 7,
        requiredIf: (linha: any) => String(linha["NFCeCST"]) === "110",
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
        min: 1,
        required: true,
    },
    "NFCeAliqCOFINS": {
        min: 0.0001,
        required: true,
    },
};
