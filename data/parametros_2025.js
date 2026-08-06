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
  minimoContribuicoesCategoriaB: 4462.15,
  // Taxa especial aplicada aos rendimentos de capitais do Anexo E — Quadro 4A (art.º 72.º
  // do CIRS) quando NÃO se opta pelo englobamento — 28% é a taxa mais comum para
  // rendimentos de capitais (mesma taxa liberatória "padrão" do art.º 71.º), mas o art.º
  // 72.º tem taxas diferentes consoante o tipo de rendimento (ex: entidades em regime fiscal
  // privilegiado a 35%) que as instruções de preenchimento do Anexo E não especificam por
  // código. A VALIDAR antes de uso real — se algum cliente tiver rendimentos sujeitos a uma
  // taxa diferente de 28%, o valor calculado para a Categoria E estará errado.
  taxaEspecialCategoriaE: 0.28,
  // Deduções à coleta por despesas gerais (art.º 78.º e seguintes do CIRS), a partir dos
  // totais anuais registados no e-fatura. "porAgregado: true" nos limites significa que o
  // limite duplica em tributação conjunta (2 sujeitos passivos); os restantes são já por
  // agregado.
  deducoesArt78: {
    geraisFamiliares: { taxa: 0.35, limite: 250, porAgregado: true, label: "Despesas gerais e familiares" },
    saude: { taxa: 0.15, limite: 1000, porAgregado: false, label: "Despesas de saúde e seguros de saúde" },
    educacao: { taxa: 0.30, limite: 800, porAgregado: false, label: "Despesas de educação e formação" },
    imoveis: { taxa: 0.15, limite: 296, porAgregado: false, label: "Encargos com imóveis (juros/rendas habitação)" },
    exigenciaFatura: { taxa: 0.15, limite: 250, porAgregado: true, label: "Dedução por exigência de fatura (IVA)" }
  },
  // Deduções à coleta do Anexo H, Quadro 6B — só os códigos mais comuns (PPR, regimes
  // complementares de poupança-reforma, e despesas/benefícios de pessoas com deficiência).
  // Os restantes códigos do quadro (mecenato científico/social/cultural/ambiental, doações
  // a igrejas, etc. — dezenas de códigos, cada um com condições de elegibilidade próprias)
  // ficam de fora do cálculo, mas continuam a ser exportados no XML tal como preenchidos.
  //
  // *** Estes valores são os que têm menos confirmação em toda a app — as instruções do
  // anexo não indicam percentagens/limites (vêm do Estatuto dos Benefícios Fiscais e do
  // CIRS). Confirmar antes de qualquer uso real, em especial os limites dos códigos 603 a 606. ***
  //
  // "limitePorIdade" aplica-se a 601/602: o limite depende da idade do titular em 31/12.
  // Se a idade não for indicada, usa-se por omissão o escalão mais baixo (>50 anos), para
  // não sobrestimar a dedução.
  deducoesAnexoHQuadro6B: {
    601: {
      label: "PPR — Planos individuais de poupança-reforma",
      taxa: 0.20,
      limitePorIdade: [
        { ateIdade: 35, limite: 400 },
        { ateIdade: 50, limite: 350 },
        { ateIdade: null, limite: 300 }
      ]
    },
    602: {
      label: "Regimes complementares de segurança social",
      taxa: 0.25,
      limitePorIdade: [
        { ateIdade: 35, limite: 400 },
        { ateIdade: 50, limite: 350 },
        { ateIdade: null, limite: 300 }
      ]
    },
    603: { label: "Regime Público de Capitalização", taxa: 0.20, limite: null },
    604: { label: "Contribuições reforma por velhice (sujeito passivo com deficiência)", taxa: 0.25, limite: null },
    605: { label: "Seguros de vida / contribuições (pessoas com deficiência)", taxa: 0.25, limite: null },
    606: { label: "Despesas de educação e reabilitação (pessoas com deficiência)", taxa: 0.30, limite: null },
    607: { label: "Encargos com reabilitação urbana", taxa: 0.30, limite: 500 }
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PARAMETROS_2025;
} else {
  root.PARAMETROS_2025 = PARAMETROS_2025;
}

})(typeof window !== "undefined" ? window : globalThis);
