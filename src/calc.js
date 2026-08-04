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

  function deducaoEspecificaCategoriaA(contribuicoesObrigatorias, parametros) {
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
  // Não cobre ainda a opção pelas regras da categoria A nem os encargos do quadro 7.
  function calcularRendimentoCategoriaB(anexoB, parametros) {
    const rendimentos = (anexoB && anexoB.rendimentosBrutos) || [];
    const coeficientes = parametros.coeficientesCategoriaB || {};
    const coeficienteOmissao = parametros.coeficienteOmissao ?? 1;

    const rendimentoBruto = rendimentos.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    const rendimentoTributavel = rendimentos.reduce((acc, r) => {
      const coef = coeficientes[Number(r.codigo)] ?? coeficienteOmissao;
      return acc + (Number(r.valor) || 0) * coef;
    }, 0);

    const ret = (anexoB && anexoB.retencoes) || {};
    return {
      rendimentoBruto,
      rendimentoTributavel,
      retencoes: Number(ret.retencoesFonte) || 0,
      pagamentosPorConta: Number(ret.pagamentosPorConta) || 0
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

  function calcularEstimativa({ agregado, anexoA, anexoB, parametros }) {
    const somaA = somaRendimentosCategoriaA(anexoA.linhas);
    const dedEspecifica = deducaoEspecificaCategoriaA(somaA.contribuicoes, parametros);
    const rendimentoLiquidoA = Math.max(0, somaA.rendimentos - dedEspecifica);

    const categoriaB = calcularRendimentoCategoriaB(anexoB, parametros);

    const rendimentoLiquido = rendimentoLiquidoA + categoriaB.rendimentoTributavel;

    const divisor = agregado.tributacaoConjunta
      ? parametros.quocienteConjugal.divisorCasadosConjunta
      : parametros.quocienteConjugal.divisorOutros;

    const rendimentoColetavel = rendimentoLiquido;
    const quociente = rendimentoColetavel / divisor;
    const coletaPorQuociente = aplicarEscaloes(quociente, parametros.escaloesIRS);
    const coletaBruta = coletaPorQuociente * divisor;

    const dedColetaDependentes = deducaoPorDependentes(agregado.dependentes || [], parametros);
    const coletaLiquida = Math.max(0, coletaBruta - dedColetaDependentes);

    const retencoesTotais = somaA.retencoes + categoriaB.retencoes + categoriaB.pagamentosPorConta;
    const resultado = retencoesTotais - coletaLiquida; // positivo = reembolso, negativo = a pagar

    return {
      rendimentoBrutoA: somaA.rendimentos,
      deducaoEspecifica: dedEspecifica,
      rendimentoLiquidoA,
      rendimentoBrutoB: categoriaB.rendimentoBruto,
      rendimentoTributavelB: categoriaB.rendimentoTributavel,
      rendimentoBruto: somaA.rendimentos + categoriaB.rendimentoBruto,
      rendimentoLiquido,
      divisorQuociente: divisor,
      coletaBruta,
      deducaoColetaDependentes: dedColetaDependentes,
      coletaLiquida,
      retencoesTotais,
      resultado,
      tipoResultado: resultado >= 0 ? "reembolso" : "a pagar"
    };
  }

  const api = {
    somaRendimentosCategoriaA,
    deducaoEspecificaCategoriaA,
    calcularRendimentoCategoriaB,
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
