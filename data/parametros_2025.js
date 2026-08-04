// Parâmetros fiscais (escalões, deduções, IAS) para os rendimentos de 2025.
//
// *** VALORES A VALIDAR antes de qualquer uso com clientes reais ***
// Estes números refletem a melhor estimativa disponível, mas devem ser confirmados
// contra a Tabela de Retenção / OE2025 / Portal das Finanças antes de qualquer
// estimativa ser entregue a um cliente. Só é preciso editar os números abaixo —
// não é preciso mexer no resto do ficheiro.
//
// Ficheiro carregado como <script> normal (não módulo) para poder ser aberto
// diretamente com duplo-clique, sem servidor. Expõe-se em window.PARAMETROS_2025.

(function (root) {

const PARAMETROS_2025 = {
  ano: 2025,
  IAS: 522.50,
  escaloesIRS: [
    { ate: 8059,  taxa: 0.13  },
    { ate: 12160, taxa: 0.165 },
    { ate: 17233, taxa: 0.22  },
    { ate: 22306, taxa: 0.25  },
    { ate: 28400, taxa: 0.32  },
    { ate: 41629, taxa: 0.355 },
    { ate: 44987, taxa: 0.435 },
    { ate: 83696, taxa: 0.45  },
    { ate: null,  taxa: 0.48  }
  ],
  deducaoEspecificaCategoriaA: {
    minimo: 4462.15,
    descricao: "Maior valor entre este mínimo e as contribuições obrigatórias efetivamente descontadas (SS/CGA/ADSE)."
  },
  deducoesColeta: {
    porDependente1: 600,
    porDependenteAdicional: 750,
    porDependenteAte3Anos: 300,
    porAscendente: 635
  },
  quocienteConjugal: {
    divisorCasadosConjunta: 2,
    divisorOutros: 1
  },
  // Coeficientes do regime simplificado (art.º 31.º do CIRS) por código de rendimento
  // do Anexo B. Cobre os códigos mais comuns — os que faltarem usam coeficienteOmissao
  // (1.00 = sem redução, resultado mais conservador/mais alto enquanto não confirmado).
  coeficientesCategoriaB: {
    401: 0.15, 402: 0.15, 419: 0.15, 420: 0.15, 421: 0.15,
    415: 0.15, 416: 0.15, 417: 0.35,
    403: 0.75,
    404: 0.35,
    405: 0.95, 406: 0.95, 408: 0.95, 410: 0.95, 411: 0.95,
    412: 0.30,
    451: 0.15, 452: 0.15,
    454: 0.95,
    455: 0.30,
    457: 0.15, 458: 0.15,
    460: 0
  },
  coeficienteOmissao: 1.00,
  // Regra do "acréscimo ao rendimento" (mínimo de despesas, regime simplificado): para os
  // rendimentos sujeitos a estes coeficientes, as despesas comprovadas têm de atingir 15%
  // desse rendimento; o que faltar acresce ao rendimento tributável.
  coeficientesComMinimoDespesas: [0.75, 0.35],
  // Mínimo de despesas com contribuições para a Segurança Social consideradas para efeitos
  // desta regra, mesmo sem nada declarado (replica o valor visto na Demonstração de
  // Liquidação da AT, que coincide com o mínimo da dedução específica da categoria A).
  minimoContribuicoesCategoriaB: 4462.15
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PARAMETROS_2025;
} else {
  root.PARAMETROS_2025 = PARAMETROS_2025;
}

})(typeof window !== "undefined" ? window : globalThis);
