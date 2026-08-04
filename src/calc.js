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
  // Inclui a regra do "acréscimo ao rendimento" (mínimo de despesas): para os rendimentos
  // sujeitos aos coeficientes 0,75 e 0,35, as despesas comprovadas (contribuições para a
  // Segurança Social + despesas gerais registadas no e-fatura) têm de atingir 15% desses
  // rendimentos; se ficarem abaixo desse mínimo, a diferença acresce ao rendimento
  // tributável — replica a secção "Verificação das despesas da categoria B" da
  // Demonstração de Liquidação da AT.
  //
  // Não cobre ainda a opção pelas regras da categoria A nem os restantes encargos do quadro 7.
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

    const despesasDeclaradas = Number((anexoB && anexoB.contribuicoesSS) || 0) + Number(despesasEFaturaTotal || 0);
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

  function calcularEstimativa({ agregado, anexoA, anexoB, anexoH, despesasEFatura, parametros }) {
    const somaA = somaRendimentosCategoriaA(anexoA.linhas);
    const dedEspecifica = deducaoEspecificaCategoriaA(somaA.rendimentos, somaA.contribuicoes, parametros);
    const rendimentoLiquidoA = Math.max(0, somaA.rendimentos - dedEspecifica);

    const deducoesArt78 = calcularDeducoesArt78(despesasEFatura, agregado, parametros);
    const categoriaB = calcularRendimentoCategoriaB(anexoB, deducoesArt78.totalDespesas, parametros);

    // Rendimento Global (englobamento): soma dos rendimentos de cada categoria antes das
    // deduções específicas — a de categoria B já vem líquida do coeficiente/acréscimo.
    const rendimentoGlobal = somaA.rendimentos + categoriaB.rendimentoTributavel;
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
    const dedColetaTotal = dedColetaDependentes + deducoesArt78.totalDeducao + dedPensoesAlimentos;
    const coletaLiquida = Math.max(0, coletaBruta - dedColetaTotal);

    const retencoesFonte = somaA.retencoes + categoriaB.retencoes;
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
      rendimentoBruto: somaA.rendimentos + categoriaB.rendimentoBruto,
      rendimentoGlobal,
      rendimentoLiquido,
      divisorQuociente: divisor,
      coletaBruta,
      deducaoColetaDependentes: dedColetaDependentes,
      deducoesArt78,
      deducaoPensoesAlimentos: dedPensoesAlimentos,
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
    calcularDeducoesArt78,
    calcularDeducaoPensoesAlimentos,
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
