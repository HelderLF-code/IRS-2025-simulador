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

  function calcularEstimativa({ agregado, anexoA, anexoB, anexoE, anexoH, despesasEFatura, parametros }) {
    const somaA = somaRendimentosCategoriaA(anexoA.linhas);
    const dedEspecifica = deducaoEspecificaCategoriaA(somaA.rendimentos, somaA.contribuicoes, parametros);
    const rendimentoLiquidoA = Math.max(0, somaA.rendimentos - dedEspecifica);

    const deducoesArt78 = calcularDeducoesArt78(despesasEFatura, agregado, parametros);
    const categoriaB = calcularRendimentoCategoriaB(anexoB, deducoesArt78.totalDespesas, parametros);
    const categoriaE = calcularRendimentoCategoriaE(anexoE, parametros);

    // Rendimento Global (englobamento): soma dos rendimentos de cada categoria antes das
    // deduções específicas — a de categoria B já vem líquida do coeficiente/acréscimo. A
    // Categoria E só entra aqui quando se opta pelo englobamento (senão é tributada à parte,
    // na coleta especial abaixo).
    const rendimentoGlobal = somaA.rendimentos + categoriaB.rendimentoTributavel + categoriaE.rendimentoEnglobado;
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
