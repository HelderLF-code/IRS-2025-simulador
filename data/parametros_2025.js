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
  },
  // Coeficientes de desvalorização da moeda a aplicar aos bens e direitos alienados durante
  // o ano de 2025 (Portaria n.º 382/2025/1, de 11 de novembro — art.ºs 47.º do CIRC e 50.º
  // do CIRS). Usados na correção monetária do valor de aquisição de imóveis (Anexo G,
  // Quadro 4) quando tiverem decorrido mais de 24 meses entre a aquisição e a realização.
  // "de" em falta significa "sem limite inferior" (anos até 1903).
  coeficientesDesvalorizacaoMoeda: [
    { ate: 1903, coeficiente: 5585.78 },
    { de: 1904, ate: 1910, coeficiente: 5199.71 },
    { de: 1911, ate: 1914, coeficiente: 4987.11 },
    { de: 1915, ate: 1915, coeficiente: 4437.01 },
    { de: 1916, ate: 1916, coeficiente: 3631.71 },
    { de: 1917, ate: 1917, coeficiente: 2899.18 },
    { de: 1918, ate: 1918, coeficiente: 2068.48 },
    { de: 1919, ate: 1919, coeficiente: 1585.26 },
    { de: 1920, ate: 1920, coeficiente: 1047.47 },
    { de: 1921, ate: 1921, coeficiente: 683.44 },
    { de: 1922, ate: 1922, coeficiente: 506.14 },
    { de: 1923, ate: 1923, coeficiente: 309.74 },
    { de: 1924, ate: 1924, coeficiente: 260.75 },
    { de: 1925, ate: 1936, coeficiente: 224.73 },
    { de: 1937, ate: 1939, coeficiente: 218.25 },
    { de: 1940, ate: 1940, coeficiente: 183.66 },
    { de: 1941, ate: 1941, coeficiente: 163.12 },
    { de: 1942, ate: 1942, coeficiente: 140.83 },
    { de: 1943, ate: 1943, coeficiente: 119.93 },
    { de: 1944, ate: 1950, coeficiente: 101.78 },
    { de: 1951, ate: 1957, coeficiente: 93.40 },
    { de: 1958, ate: 1963, coeficiente: 87.82 },
    { de: 1964, ate: 1964, coeficiente: 83.92 },
    { de: 1965, ate: 1965, coeficiente: 80.83 },
    { de: 1966, ate: 1966, coeficiente: 77.26 },
    { de: 1967, ate: 1969, coeficiente: 72.24 },
    { de: 1970, ate: 1970, coeficiente: 66.89 },
    { de: 1971, ate: 1971, coeficiente: 63.67 },
    { de: 1972, ate: 1972, coeficiente: 59.52 },
    { de: 1973, ate: 1973, coeficiente: 54.11 },
    { de: 1974, ate: 1974, coeficiente: 41.50 },
    { de: 1975, ate: 1975, coeficiente: 35.46 },
    { de: 1976, ate: 1976, coeficiente: 29.71 },
    { de: 1977, ate: 1977, coeficiente: 22.76 },
    { de: 1978, ate: 1978, coeficiente: 17.83 },
    { de: 1979, ate: 1979, coeficiente: 14.07 },
    { de: 1980, ate: 1980, coeficiente: 12.68 },
    { de: 1981, ate: 1981, coeficiente: 10.37 },
    { de: 1982, ate: 1982, coeficiente: 8.61 },
    { de: 1983, ate: 1983, coeficiente: 6.89 },
    { de: 1984, ate: 1984, coeficiente: 5.35 },
    { de: 1985, ate: 1985, coeficiente: 4.48 },
    { de: 1986, ate: 1986, coeficiente: 4.04 },
    { de: 1987, ate: 1987, coeficiente: 3.71 },
    { de: 1988, ate: 1988, coeficiente: 3.33 },
    { de: 1989, ate: 1989, coeficiente: 3.00 },
    { de: 1990, ate: 1990, coeficiente: 2.69 },
    { de: 1991, ate: 1991, coeficiente: 2.38 },
    { de: 1992, ate: 1992, coeficiente: 2.18 },
    { de: 1993, ate: 1993, coeficiente: 2.01 },
    { de: 1994, ate: 1994, coeficiente: 1.92 },
    { de: 1995, ate: 1995, coeficiente: 1.84 },
    { de: 1996, ate: 1996, coeficiente: 1.80 },
    { de: 1997, ate: 1997, coeficiente: 1.77 },
    { de: 1998, ate: 1998, coeficiente: 1.72 },
    { de: 1999, ate: 1999, coeficiente: 1.70 },
    { de: 2000, ate: 2000, coeficiente: 1.67 },
    { de: 2001, ate: 2001, coeficiente: 1.55 },
    { de: 2002, ate: 2002, coeficiente: 1.49 },
    { de: 2003, ate: 2003, coeficiente: 1.45 },
    { de: 2004, ate: 2004, coeficiente: 1.43 },
    { de: 2005, ate: 2005, coeficiente: 1.40 },
    { de: 2006, ate: 2006, coeficiente: 1.34 },
    { de: 2007, ate: 2007, coeficiente: 1.32 },
    { de: 2008, ate: 2008, coeficiente: 1.28 },
    { de: 2009, ate: 2009, coeficiente: 1.30 },
    { de: 2010, ate: 2010, coeficiente: 1.28 },
    { de: 2011, ate: 2011, coeficiente: 1.24 },
    { de: 2012, ate: 2015, coeficiente: 1.20 },
    { de: 2016, ate: 2016, coeficiente: 1.19 },
    { de: 2017, ate: 2017, coeficiente: 1.18 },
    { de: 2018, ate: 2020, coeficiente: 1.17 },
    { de: 2021, ate: 2021, coeficiente: 1.16 },
    { de: 2022, ate: 2022, coeficiente: 1.06 },
    { de: 2023, ate: 2023, coeficiente: 1.02 },
    { de: 2024, ate: 2024, coeficiente: 1.00 }
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PARAMETROS_2025;
} else {
  root.PARAMETROS_2025 = PARAMETROS_2025;
}

})(typeof window !== "undefined" ? window : globalThis);
