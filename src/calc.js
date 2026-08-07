// Motor de cálculo de IRS - Categoria A (trabalho dependente / pensões)
// Cobre apenas a Fase 1: rendimentos de categoria A, sujeito passivo único ou tributação conjunta,
// dedução específica e deduções à coleta por dependente. Restantes categorias ainda não incluídas.
//
// Ficheiro carregado como <script> normal (não módulo) para poder ser aberto diretamente
// com duplo-clique, sem servidor. Expõe-se em window.IRSCalc.

(function (root) {

  function somaRendimentosCategoriaA(linhasAnexoA) {
    return linhasAnexoA.reduce((acc, linha) => {
      acc.rendimentos += Number(linha.rendimentos) || 0;
      acc.retencoes += Number(linha.retencoes) || 0;
      acc.contribuicoes += Number(linha.contribuicoes) || 0;
      return acc;
    }, { rendimentos: 0, retencoes: 0, contribuicoes: 0 });
  }

  // A dedução específica só se aplica quando há de facto rendimento de categoria A/H
  // (sem isso, não faz sentido aplicar o mínimo — reflete o "Rendimento Global: 0,00"
  // e "Deduções Específicas: 0,00" que aparece na Demonstração de Liquidação da AT
  // quando não há rendimentos dessa categoria).
  function deducaoEspecificaCategoriaA(rendimentoBrutoA, contribuicoesObrigatorias, parametros) {
    if (!rendimentoBrutoA) return 0;
    return Math.max(contribuicoesObrigatorias, parametros.deducaoEspecificaCategoriaA.minimo);
  }

  function aplicarEscaloes(rendimentoColetavel, escaloes) {
    let imposto = 0;
    let limiteAnterior = 0;
    for (const escalao of escaloes) {
      const limite = escalao.ate === null ? Infinity : escalao.ate;
      if (rendimentoColetavel > limiteAnterior) {
        const fatia = Math.min(rendimentoColetavel, limite) - limiteAnterior;
        imposto += fatia * escalao.taxa;
        limiteAnterior = limite;
      } else {
        break;
      }
    }
    return imposto;
  }

  // Regime simplificado (art.º 31.º do CIRS): aplica o coeficiente de cada código de
  // rendimento ao respetivo valor bruto para obter o rendimento tributável da Categoria B.
  //
  // Inclui a regra do "acréscimo ao rendimento" (mínimo de despesas, art.º 31.º n.ºs 2 e
  // 13 do CIRS): para os rendimentos sujeitos aos coeficientes 0,75 e 0,35, as despesas
  // comprovadas têm de atingir 15% desses rendimentos; se ficarem abaixo desse mínimo, a
  // diferença acresce ao rendimento tributável — replica a secção "Verificação das
  // despesas da categoria B" da Demonstração de Liquidação da AT.
  //
  // As despesas comprovadas somam: contribuições para a Segurança Social conexas com a
  // atividade + importações/aquisições intracomunitárias relacionadas (Anexo B, Quadro
  // 17A, campos 17001/17002) e, por regra, as despesas gerais e familiares comunicadas à
  // AT via e-fatura — a não ser que o titular tenha optado (Quadro 17C) por declarar em
  // alternativa as despesas com pessoal/rendas de imóveis/outras despesas relacionadas
  // com a atividade, caso em que só essas contam (não se somam ao e-fatura).
  //
  // Não cobre ainda a opção pelas regras da categoria A (Quadro 7A).
  function calcularRendimentoCategoriaB(anexoB, despesasEFaturaTotal, parametros) {
    const rendimentos = (anexoB && anexoB.rendimentosBrutos) || [];
    const coeficientes = parametros.coeficientesCategoriaB || {};
    const coeficienteOmissao = parametros.coeficienteOmissao ?? 1;
    const coeficientesComMinimoDespesas = parametros.coeficientesComMinimoDespesas || [];

    const rendimentoBruto = rendimentos.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);

    let rendimentoTributavelBase = 0;
    let rendimentoRelevanteMinimo = 0;
    rendimentos.forEach(r => {
      const coef = coeficientes[Number(r.codigo)] ?? coeficienteOmissao;
      const valor = Number(r.valor) || 0;
      rendimentoTributavelBase += valor * coef;
      if (coeficientesComMinimoDespesas.includes(coef)) {
        rendimentoRelevanteMinimo += valor;
      }
    });

    const q17 = (anexoB && anexoB.quadro17) || {};
    const contribuicoesSS = Number(q17.contribuicoesSS) || 0;
    const importacoes = Number(q17.importacoesIntracomunitarias) || 0;
    const despesasBase = q17.optaDespesasAlternativa
      ? (Number(q17.despesasPessoal) || 0) + (Number(q17.rendasImoveis) || 0) +
        (Number(q17.outrasDespesasParcial) || 0) + (Number(q17.outrasDespesasTotal) || 0)
      : Number(despesasEFaturaTotal || 0);
    const despesasDeclaradas = contribuicoesSS + importacoes + despesasBase;
    const despesasCalculadas = Math.max(despesasDeclaradas, parametros.minimoContribuicoesCategoriaB || 0);
    const valorMinimoDespesas = rendimentoRelevanteMinimo * 0.15;
    const acrescimoAoRendimento = Math.max(0, valorMinimoDespesas - despesasCalculadas);

    const rendimentoTributavel = rendimentoTributavelBase + acrescimoAoRendimento;

    const ret = (anexoB && anexoB.retencoes) || {};
    return {
      rendimentoBruto,
      rendimentoTributavelBase,
      despesasCalculadas,
      valorMinimoDespesas,
      acrescimoAoRendimento,
      rendimentoTributavel,
      retencoes: Number(ret.retencoesFonte) || 0,
      pagamentosPorConta: Number(ret.pagamentosPorConta) || 0
    };
  }

  // Deduções à coleta por despesas gerais (art.º 78.º e seguintes do CIRS), a partir dos
  // totais anuais por categoria (tipicamente consultados no e-fatura). Cada categoria tem
  // uma taxa e um limite (que pode duplicar em tributação conjunta). Não inclui ainda o
  // limite geral e decrescente por escalão de rendimento previsto no art.º 78.º-B.
  function calcularDeducoesArt78(despesasEFatura, agregado, parametros) {
    const config = parametros.deducoesArt78 || {};
    const divisor = agregado.tributacaoConjunta
      ? parametros.quocienteConjugal.divisorCasadosConjunta
      : parametros.quocienteConjugal.divisorOutros;

    const porCategoria = Object.keys(config).map(chave => {
      const cfg = config[chave];
      const despesa = Number((despesasEFatura && despesasEFatura[chave]) || 0);
      const limite = cfg.porAgregado ? cfg.limite * divisor : cfg.limite;
      const deducao = Math.min(despesa * cfg.taxa, limite);
      return { chave, label: cfg.label, despesa, taxa: cfg.taxa, limite, deducao };
    });

    const totalDespesas = porCategoria.reduce((acc, c) => acc + c.despesa, 0);
    const totalDeducao = porCategoria.reduce((acc, c) => acc + c.deducao, 0);

    return { porCategoria, totalDespesas, totalDeducao };
  }

  // Dedução à coleta por pensões de alimentos pagas (art.º 83.º-A do CIRS, Anexo H Quadro 6A):
  // dedução de 100% do valor pago, sem limite (excluindo beneficiários do agregado familiar,
  // que já teriam dedução pelo art.º 78.º).
  function calcularDeducaoPensoesAlimentos(anexoH) {
    return ((anexoH && anexoH.pensoesAlimentos) || []).reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  }

  function limitePorIdade(cfg, idade) {
    if (idade === undefined || idade === null || idade === "") {
      // Sem idade indicada: usa o escalão mais baixo, para não sobrestimar a dedução.
      return cfg.limitePorIdade[cfg.limitePorIdade.length - 1].limite;
    }
    const escalao = cfg.limitePorIdade.find(e => e.ateIdade === null || Number(idade) < e.ateIdade);
    return escalao.limite;
  }

  // Dedução à coleta do Anexo H, Quadro 6B — só os códigos mais comuns (ver
  // parametros.deducoesAnexoHQuadro6B); mecenato e restantes códigos ficam de fora.
  function calcularDeducaoBeneficiosDeficiencia(anexoH, parametros) {
    const config = parametros.deducoesAnexoHQuadro6B || {};
    const linhas = (anexoH && anexoH.beneficiosDeficiencia) || [];

    const porLinha = linhas.map(b => {
      const cfg = config[Number(b.codigo)];
      if (!cfg) return { codigo: b.codigo, calculado: false, importancia: Number(b.importancia) || 0, deducao: 0 };

      const importancia = Number(b.importancia) || 0;
      const limite = cfg.limitePorIdade ? limitePorIdade(cfg, b.idade) : cfg.limite;
      const deducao = limite === null ? importancia * cfg.taxa : Math.min(importancia * cfg.taxa, limite);
      return { codigo: b.codigo, label: cfg.label, calculado: true, importancia, taxa: cfg.taxa, limite, deducao };
    });

    const totalDeducao = porLinha.reduce((acc, l) => acc + l.deducao, 0);
    const naoCalculados = porLinha.filter(l => !l.calculado).length;

    return { porLinha, totalDeducao, naoCalculados };
  }

  // Categoria E (rendimentos de capitais, Anexo E): sem opção pelo englobamento, os
  // rendimentos do Quadro 4A (taxas especiais, art.º 72.º CIRS) são tributados à taxa
  // especial (parametros.taxaEspecialCategoriaE — A VALIDAR, o art.º 72.º tem taxas
  // diferentes consoante o tipo de rendimento) e essa coleta soma-se diretamente à coleta
  // líquida, sem entrar no rendimento coletável nem nas deduções à coleta gerais (mesma
  // lógica das taxas liberatórias/autónomas). Os rendimentos do Quadro 4B (taxas
  // liberatórias, art.º 71.º CIRS) já estão definitivamente tributados por retenção na
  // fonte e não entram na estimativa nesse caso.
  // Com opção pelo englobamento, os rendimentos de ambos os quadros somam-se ao rendimento
  // global e são tributados nos escalões gerais como os das restantes categorias, com
  // crédito das retenções já efetuadas (Quadro 4B).
  function calcularRendimentoCategoriaE(anexoE, parametros) {
    const e = anexoE || {};
    const taxasEspeciais = e.rendimentosTaxasEspeciais || [];
    const taxasLiberatorias = e.rendimentosTaxasLiberatorias || [];
    const somaTaxasEspeciais = taxasEspeciais.reduce((acc, r) => acc + (Number(r.rendimento) || 0), 0);
    const somaTaxasLiberatoriasRend = taxasLiberatorias.reduce((acc, r) => acc + (Number(r.rendimento) || 0), 0);
    const somaTaxasLiberatoriasRet = taxasLiberatorias.reduce((acc, r) => acc + (Number(r.retencao) || 0), 0);

    if (e.optaEnglobamento) {
      return {
        optaEnglobamento: true,
        rendimentoBrutoTaxasEspeciais: somaTaxasEspeciais,
        rendimentoBrutoTaxasLiberatorias: somaTaxasLiberatoriasRend,
        rendimentoEnglobado: somaTaxasEspeciais + somaTaxasLiberatoriasRend,
        coletaEspecial: 0,
        retencoes: somaTaxasLiberatoriasRet
      };
    }

    const taxa = parametros.taxaEspecialCategoriaE ?? 0.28;
    return {
      optaEnglobamento: false,
      rendimentoBrutoTaxasEspeciais: somaTaxasEspeciais,
      rendimentoBrutoTaxasLiberatorias: somaTaxasLiberatoriasRend,
      rendimentoEnglobado: 0,
      coletaEspecial: somaTaxasEspeciais * taxa,
      taxaEspecial: taxa,
      retencoes: 0
    };
  }

  // Devolve o coeficiente de desvalorização da moeda (Portaria em vigor, art.º 50.º do
  // CIRS) para o ano de aquisição indicado. Anos fora da tabela (ex: o próprio ano da
  // alienação) devolvem 1 — sem correção, que é o resultado correto quando não há 24 meses
  // de diferença entre aquisição e realização.
  function coeficienteDesvalorizacaoMoeda(anoAquisicao, parametros) {
    const ano = Number(anoAquisicao);
    if (!ano) return 1;
    const tabela = parametros.coeficientesDesvalorizacaoMoeda || [];
    for (const linha of tabela) {
      const de = linha.de === undefined ? -Infinity : linha.de;
      if (ano >= de && ano <= linha.ate) return linha.coeficiente;
    }
    return 1;
  }

  // A correção monetária só se aplica quando tiverem decorrido mais de 24 meses entre a
  // data de aquisição e a data de realização (art.º 50.º, n.º 1, do CIRS). Mês/dia em falta
  // assumem-se como o início do período (dia/mês 1), o que é conservador (não sobrestima os
  // meses decorridos).
  function decorreramMaisDe24Meses(anoA, mesA, diaA, anoR, mesR, diaR) {
    if (!anoA || !anoR) return false;
    const dataA = new Date(Number(anoA), (Number(mesA) || 1) - 1, Number(diaA) || 1);
    const dataR = new Date(Number(anoR), (Number(mesR) || 1) - 1, Number(diaR) || 1);
    let meses = (dataR.getFullYear() - dataA.getFullYear()) * 12 + (dataR.getMonth() - dataA.getMonth());
    if (dataR.getDate() < dataA.getDate()) meses -= 1;
    return meses > 24;
  }

  // Campos "efetivamente reinvestidos" do Quadro 5 do Anexo G (excluem os campos 5006/5012
  // e 5026/5036, que são só a "intenção de reinvestimento" declarada, não o valor já
  // concretizado — só este último conta para a isenção, art.º 10.º, n.º 5, do CIRS).
  const CAMPOS_REINVESTIDO_EFETIVO = [
    "reinvestido24MesesAntes", "reinvestidoMais24MesesAntesSuspensao",
    "reinvestidoAnoAlienacao", "reinvestidoAnoSeguinte", "reinvestidoSegundoAnoSeguinte",
    "reinvestidoTerceiroAnoSeguinte", "reinvestidoApos36MesesSuspensao",
    "reinvestidoSeguroAnoAlienacao", "reinvestidoSeguroAnoSeguinte"
  ];

  // Isenção por reinvestimento em habitação própria e permanente (art.º 10.º, n.º 5, do
  // CIRS): a fração do ganho que fica excluída de tributação é proporcional ao valor de
  // realização efetivamente reinvestido, sobre o valor de realização líquido do empréstimo
  // amortizado com o produto da venda —
  //   ganho excluído = ganho da(s) linha(s) alienada(s) × [valor reinvestido / (valor de
  //   realização - valor em dívida do empréstimo amortizado)]
  // limitado a 100% (reinvestimento total ou superior exclui a totalidade do ganho). Só se
  // aplica ao ganho (uma menos-valia não é "excluída" — não há nada a excluir).
  function calcularExclusaoReinvestimento(r, linhasPorCampo) {
    const semDados = { valorRealizacaoTotal: 0, valorReinvestido: 0, valorEmprestimoDivida: 0, ganhoDasLinhas: 0, racio: 0, ganhoExcluido: 0 };
    if (!r || !(r.camposQ4 || []).length) return semDados;

    const linhas = r.camposQ4.map(c => linhasPorCampo.get(String(c))).filter(Boolean);
    if (!linhas.length) return semDados;

    const valorRealizacaoTotal = linhas.reduce((acc, l) => acc + l.valorRealizacao, 0);
    const ganhoDasLinhas = Math.max(0, linhas.reduce((acc, l) => acc + l.resultado, 0));
    const valorReinvestido = CAMPOS_REINVESTIDO_EFETIVO.reduce((acc, campo) => acc + (Number(r[campo]) || 0), 0);
    const valorEmprestimoDivida = Number(r.valorEmprestimoDivida) || 0;
    const denominador = valorRealizacaoTotal - valorEmprestimoDivida;
    const racio = denominador > 0 ? Math.min(1, valorReinvestido / denominador) : 0;
    const ganhoExcluido = ganhoDasLinhas * racio;

    return { valorRealizacaoTotal, valorReinvestido, valorEmprestimoDivida, ganhoDasLinhas, racio, ganhoExcluido };
  }

  // Anexo G, Quadro 4 (alienação onerosa de imóveis, art.º 10.º do CIRS): mais-valia/
  // menos-valia de cada linha = valor de realização - (valor de aquisição × coeficiente de
  // desvalorização da moeda, quando aplicável) - despesas e encargos. Ao saldo global das
  // linhas "normais" é ainda subtraído o ganho excluído por reinvestimento em habitação
  // própria (Quadro 5, quando aplicável); o que restar só é tributado em 50% quando
  // positivo (art.º 43.º, n.º 2, do CIRS) e entra no rendimento global por englobamento (as
  // mais-valias imobiliárias não têm opção de tributação autónoma, ao contrário das do
  // Quadro 4A/4C).
  //
  // Ficam de fora deste cálculo (tratamento próprio, ainda não implementado — não somam ao
  // saldo nem entram no rendimento tributável):
  //  - linhas referenciadas no Quadro 4A (imóveis recuperados/reabilitação) — sujeitas a
  //    tributação autónoma, salvo opção pelo englobamento no Quadro 15;
  //  - linhas referenciadas no Quadro 4C (alienação a EGF/UGF) — também tributação autónoma;
  //  - linhas referenciadas no Quadro 4F (alienação ao Estado/RA/entidades públicas) —
  //    isentas de tributação (art.º 71.º-A, n.º 7, do EBF).
  function calcularSaldoQuadro4AnexoG(quadro04, quadro05, parametros) {
    const q4 = quadro04 || {};
    const imoveis = q4.imoveis || [];
    const camposExcluidos = new Set(
      [
        ...(q4.reabilitacao || []).map(r => r.campoQ4),
        ...(q4.alienacaoEGF || []).map(c => c.campoQ4),
        ...(q4.alienacaoEstado || []).map(f => f.campoQ4)
      ]
        .filter(v => v !== undefined && v !== "")
        .map(String)
    );

    const comCampo = imoveis.map((i, idx) => ({ ...i, campo: String(i.nlinha || (4001 + idx)) }));
    const linhasTributaveis = comCampo.filter(i => !camposExcluidos.has(i.campo));

    const detalhe = linhasTributaveis.map(i => {
      const temCorrecao = decorreramMaisDe24Meses(i.anoAquisicao, i.mesAquisicao, i.diaAquisicao, i.anoRealizacao, i.mesRealizacao, i.diaRealizacao);
      const coeficiente = temCorrecao ? coeficienteDesvalorizacaoMoeda(i.anoAquisicao, parametros) : 1;
      const valorRealizacao = Number(i.valorRealizacao) || 0;
      const valorAquisicao = Number(i.valorAquisicao) || 0;
      const despesasEncargos = Number(i.despesasEncargos) || 0;
      const valorAquisicaoCorrigido = valorAquisicao * coeficiente;
      const resultado = valorRealizacao - valorAquisicaoCorrigido - despesasEncargos;
      return { campo: i.campo, valorRealizacao, valorAquisicao, coeficiente, valorAquisicaoCorrigido, despesasEncargos, resultado };
    });

    const saldo = detalhe.reduce((acc, l) => acc + l.resultado, 0);

    const linhasPorCampo = new Map(detalhe.map(l => [l.campo, l]));
    const q5 = quadro05 || {};
    const exclusao1 = calcularExclusaoReinvestimento(q5.reinvestimento1, linhasPorCampo);
    const exclusao2 = calcularExclusaoReinvestimento(q5.reinvestimento2, linhasPorCampo);
    const ganhoExcluidoReinvestimento = exclusao1.ganhoExcluido + exclusao2.ganhoExcluido;

    const saldoAposReinvestimento = saldo - ganhoExcluidoReinvestimento;
    const rendimentoTributavel = saldoAposReinvestimento > 0 ? saldoAposReinvestimento * 0.5 : 0;

    return {
      detalhe,
      saldo,
      reinvestimento: { exclusao1, exclusao2, ganhoExcluidoReinvestimento },
      saldoAposReinvestimento,
      rendimentoTributavel,
      linhasExcluidas: imoveis.length - linhasTributaveis.length
    };
  }

  function deducaoPorDependentes(dependentes, parametros) {
    return dependentes.reduce((total, dep, idx) => {
      let valor = idx === 0
        ? parametros.deducoesColeta.porDependente1
        : parametros.deducoesColeta.porDependenteAdicional;
      if (dep.idadeAte3Anos) {
        valor += parametros.deducoesColeta.porDependenteAte3Anos;
      }
      return total + valor;
    }, 0);
  }

  function calcularEstimativa({ agregado, anexoA, anexoB, anexoE, anexoG, anexoH, despesasEFatura, parametros }) {
    const somaA = somaRendimentosCategoriaA(anexoA.linhas);
    const dedEspecifica = deducaoEspecificaCategoriaA(somaA.rendimentos, somaA.contribuicoes, parametros);
    const rendimentoLiquidoA = Math.max(0, somaA.rendimentos - dedEspecifica);

    const deducoesArt78 = calcularDeducoesArt78(despesasEFatura, agregado, parametros);
    const categoriaB = calcularRendimentoCategoriaB(anexoB, deducoesArt78.totalDespesas, parametros);
    const categoriaE = calcularRendimentoCategoriaE(anexoE, parametros);
    const categoriaG = calcularSaldoQuadro4AnexoG(anexoG && anexoG.quadro04, anexoG && anexoG.quadro05, parametros);

    // Rendimento Global (englobamento): soma dos rendimentos de cada categoria antes das
    // deduções específicas — a de categoria B já vem líquida do coeficiente/acréscimo. A
    // Categoria E só entra aqui quando se opta pelo englobamento (senão é tributada à parte,
    // na coleta especial abaixo). A Categoria G (mais-valias do Quadro 4 do Anexo G) entra
    // sempre por englobamento, já com a exclusão de 50% aplicada.
    const rendimentoGlobal = somaA.rendimentos + categoriaB.rendimentoTributavel + categoriaE.rendimentoEnglobado + categoriaG.rendimentoTributavel;
    const rendimentoLiquido = rendimentoGlobal - dedEspecifica; // = Rendimento Coletável

    const divisor = agregado.tributacaoConjunta
      ? parametros.quocienteConjugal.divisorCasadosConjunta
      : parametros.quocienteConjugal.divisorOutros;

    const rendimentoColetavel = rendimentoLiquido;
    const quociente = rendimentoColetavel / divisor;
    const coletaPorQuociente = aplicarEscaloes(quociente, parametros.escaloesIRS);
    const coletaBruta = coletaPorQuociente * divisor;

    const dedColetaDependentes = deducaoPorDependentes(agregado.dependentes || [], parametros);
    const dedPensoesAlimentos = calcularDeducaoPensoesAlimentos(anexoH);
    const deducaoBeneficios = calcularDeducaoBeneficiosDeficiencia(anexoH, parametros);
    const dedColetaTotal = dedColetaDependentes + deducoesArt78.totalDeducao + dedPensoesAlimentos + deducaoBeneficios.totalDeducao;
    // A coleta especial da Categoria E (taxas do art.º 72.º) soma-se depois das deduções à
    // coleta gerais — tal como as taxas liberatórias/autónomas, não é reduzida por elas.
    const coletaLiquida = Math.max(0, coletaBruta - dedColetaTotal) + categoriaE.coletaEspecial;

    const retencoesFonte = somaA.retencoes + categoriaB.retencoes + categoriaE.retencoes;
    const pagamentosPorConta = categoriaB.pagamentosPorConta;
    const retencoesTotais = retencoesFonte + pagamentosPorConta;
    const resultado = retencoesTotais - coletaLiquida; // positivo = reembolso, negativo = a pagar
    const taxaEfetiva = rendimentoLiquido > 0 ? coletaLiquida / rendimentoLiquido : 0;

    return {
      rendimentoBrutoA: somaA.rendimentos,
      deducaoEspecifica: dedEspecifica,
      rendimentoLiquidoA,
      rendimentoBrutoB: categoriaB.rendimentoBruto,
      rendimentoTributavelBaseB: categoriaB.rendimentoTributavelBase,
      acrescimoAoRendimentoB: categoriaB.acrescimoAoRendimento,
      despesasCalculadasB: categoriaB.despesasCalculadas,
      valorMinimoDespesasB: categoriaB.valorMinimoDespesas,
      rendimentoTributavelB: categoriaB.rendimentoTributavel,
      categoriaE,
      categoriaG,
      rendimentoBruto: somaA.rendimentos + categoriaB.rendimentoBruto,
      rendimentoGlobal,
      rendimentoLiquido,
      divisorQuociente: divisor,
      coletaBruta,
      deducaoColetaDependentes: dedColetaDependentes,
      deducoesArt78,
      deducaoPensoesAlimentos: dedPensoesAlimentos,
      deducaoBeneficiosDeficiencia: deducaoBeneficios,
      deducaoColetaTotal: dedColetaTotal,
      coletaLiquida,
      retencoesFonte,
      pagamentosPorConta,
      retencoesTotais,
      taxaEfetiva,
      resultado,
      tipoResultado: resultado >= 0 ? "reembolso" : "a pagar"
    };
  }

  const api = {
    somaRendimentosCategoriaA,
    deducaoEspecificaCategoriaA,
    calcularRendimentoCategoriaB,
    calcularRendimentoCategoriaE,
    calcularSaldoQuadro4AnexoG,
    coeficienteDesvalorizacaoMoeda,
    calcularDeducoesArt78,
    calcularDeducaoPensoesAlimentos,
    calcularDeducaoBeneficiosDeficiencia,
    aplicarEscaloes,
    deducaoPorDependentes,
    calcularEstimativa
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.IRSCalc = api;
  }

})(typeof window !== "undefined" ? window : globalThis);
