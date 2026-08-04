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

  function calcularEstimativa({ agregado, anexoA, parametros }) {
    const somaA = somaRendimentosCategoriaA(anexoA.linhas);
    const dedEspecifica = deducaoEspecificaCategoriaA(somaA.contribuicoes, parametros);
    const rendimentoLiquido = Math.max(0, somaA.rendimentos - dedEspecifica);

    const divisor = agregado.tributacaoConjunta
      ? parametros.quocienteConjugal.divisorCasadosConjunta
      : parametros.quocienteConjugal.divisorOutros;

    const rendimentoColetavel = rendimentoLiquido;
    const quociente = rendimentoColetavel / divisor;
    const coletaPorQuociente = aplicarEscaloes(quociente, parametros.escaloesIRS);
    const coletaBruta = coletaPorQuociente * divisor;

    const dedColetaDependentes = deducaoPorDependentes(agregado.dependentes || [], parametros);
    const coletaLiquida = Math.max(0, coletaBruta - dedColetaDependentes);

    const retencoesTotais = somaA.retencoes;
    const resultado = retencoesTotais - coletaLiquida; // positivo = reembolso, negativo = a pagar

    return {
      rendimentoBruto: somaA.rendimentos,
      deducaoEspecifica: dedEspecifica,
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
