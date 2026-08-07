// Ficheiro carregado como <script> normal (não módulo) para poder ser aberto diretamente
// com duplo-clique, sem servidor. Expõe-se em window.IRSLetter.
//
// Estrutura inspirada na Demonstração de Liquidação de IRS da AT (Rendimento Global →
// Rendimento Coletável → Coleta → Coleta Líquida → Retenções/Pagamentos → Resultado),
// simplificada e em linguagem mais direta para um cliente.

(function (root) {

function formatarMoeda(valor) {
  const num = Number(valor) || 0;
  const negativo = num < 0;
  const fixo = Math.abs(num).toFixed(2);
  const [inteiro, decimal] = fixo.split(".");
  const comSeparadores = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (negativo ? "-" : "") + comSeparadores + "," + decimal;
}

function formatarPercentagem(valor) {
  return (Number(valor) * 100).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, "") + "%";
}

function linha(label, valor, opcoes) {
  const classe = opcoes && opcoes.destaque ? ' class="destaque"' : "";
  return `<tr${classe}><td>${label}</td><td>${formatarMoeda(valor)} €</td></tr>`;
}

function gerarCartaHTML({ agregado, resultado, dataGeracao }) {
  const nomeAno = agregado.ano;
  const sinalResultado = resultado.tipoResultado === "reembolso" ? "Reembolso estimado" : "Valor estimado a pagar";
  const valorAbs = formatarMoeda(Math.abs(resultado.resultado));
  const temCategoriaB = !!resultado.rendimentoBrutoB;
  const temAcrescimo = resultado.acrescimoAoRendimentoB > 0.005;
  const categoriaE = resultado.categoriaE || {};
  const temCategoriaE = categoriaE.rendimentoBrutoTaxasEspeciais > 0 || categoriaE.rendimentoBrutoTaxasLiberatorias > 0;
  const categoriaG = resultado.categoriaG || {};
  const temCategoriaG = (categoriaG.detalhe || []).length > 0;

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>Estimativa de IRS ${nomeAno}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.3rem; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.03em; color: #444; margin: 26px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  td, th { padding: 5px 8px; text-align: left; border-bottom: 1px solid #eee; }
  td:last-child { text-align: right; }
  tr.destaque td { font-weight: bold; border-top: 1px solid #999; border-bottom: none; }
  .resultado-final { margin-top: 24px; padding: 16px; background: #f7f7f5; border-radius: 6px; text-align: center; }
  .resultado-final .valor { font-size: 1.6rem; font-weight: bold; }
  .taxa-efetiva { text-align: center; color: #555; font-size: 0.85rem; margin-top: 6px; }
  .nota { font-size: 0.8rem; color: #666; margin: 4px 0 0; }
  .aviso { margin-top: 30px; padding: 12px; background: #f5f5f0; border-left: 4px solid #999; font-size: 0.85rem; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir / Guardar como PDF</button>
  <h1>Estimativa de IRS — Rendimentos de ${nomeAno}</h1>
  <p>Data de emissão: ${dataGeracao}</p>
  <p>Sujeito passivo A — NIF ${agregado.nifA}${agregado.tributacaoConjunta ? ` | Sujeito passivo B — NIF ${agregado.nifB}` : ""}</p>

  <h2>Rendimentos</h2>
  <table>
    ${resultado.rendimentoBrutoA ? `
    ${linha("Categoria A — rendimento bruto (trabalho/pensões)", resultado.rendimentoBrutoA)}
    ${linha("Categoria A — dedução específica", -resultado.deducaoEspecifica)}` : ""}
    ${temCategoriaB ? `
    ${linha("Categoria B — rendimento bruto (regime simplificado)", resultado.rendimentoBrutoB)}
    ${linha("Categoria B — após coeficiente aplicável", resultado.rendimentoTributavelBaseB)}
    ${temAcrescimo ? linha("Categoria B — acréscimo por despesas insuficientes", resultado.acrescimoAoRendimentoB) : ""}` : ""}
    ${temCategoriaE ? (categoriaE.optaEnglobamento
      ? linha("Categoria E — rendimento englobado (capitais)", categoriaE.rendimentoEnglobado)
      : linha("Categoria E — rendimento sujeito a taxa especial (capitais)", categoriaE.rendimentoBrutoTaxasEspeciais)) : ""}
    ${temCategoriaG ? linha("Categoria G — mais-valias tributáveis (50% do saldo, Anexo G Quadro 4)", categoriaG.rendimentoTributavel) : ""}
    ${linha("Rendimento coletável", resultado.rendimentoLiquido, { destaque: true })}
  </table>
  ${temAcrescimo ? `<p class="nota">O acréscimo à Categoria B reflete a regra do regime simplificado: as despesas
  comprovadas (contribuições para a Segurança Social e despesas gerais do e-fatura) têm de atingir 15%
  dos rendimentos sujeitos a coeficiente reduzido; o que falta acresce ao rendimento tributável.</p>` : ""}
  ${temCategoriaE && !categoriaE.optaEnglobamento ? `<p class="nota">Os rendimentos de capitais (Categoria E)
  não englobados são tributados à parte, à taxa especial de ${(categoriaE.taxaEspecial * 100).toFixed(0)}%
  (a confirmar consoante o tipo de rendimento), somando-se diretamente à coleta líquida.</p>` : ""}
  ${temCategoriaG ? `<p class="nota">Mais-valias imobiliárias (Anexo G, Quadro 4): saldo de
  ${formatarMoeda(categoriaG.saldo)} € entre valor de realização e valor de aquisição corrigido pela
  desvalorização monetária.
  ${categoriaG.reinvestimento && categoriaG.reinvestimento.ganhoExcluidoReinvestimento > 0
    ? `Deste saldo, ${formatarMoeda(categoriaG.reinvestimento.ganhoExcluidoReinvestimento)} € ficam excluídos
  de tributação por reinvestimento em habitação própria e permanente (Quadro 5, art.º 10.º, n.º 5, do CIRS).`
    : ""}
  Do que resta, apenas 50% é tributado quando positivo (art.º 43.º, n.º 2, do CIRS).
  ${categoriaG.linhasExcluidas > 0 ? `${categoriaG.linhasExcluidas} imóvel(is) do Quadro 4 não entra(m)
  neste cálculo (reabilitação/EGF-UGF/alienação isenta ao Estado — tratamento próprio ainda não
  implementado).` : ""}</p>` : ""}

  <h2>Apuramento do imposto</h2>
  <table>
    ${linha("Coleta (aplicando os escalões de IRS)", resultado.coletaBruta)}
    ${linha("Dedução à coleta por dependentes", -resultado.deducaoColetaDependentes)}
    ${resultado.deducaoPensoesAlimentos ? linha("Dedução à coleta — Pensões de alimentos", -resultado.deducaoPensoesAlimentos) : ""}
    ${resultado.deducaoBeneficiosDeficiencia.porLinha.filter(l => l.calculado && l.deducao > 0)
      .map(l => linha(`Dedução à coleta — ${l.codigo} ${l.label}`, -l.deducao)).join("")}
    ${resultado.deducoesArt78.porCategoria.filter(c => c.despesa > 0)
      .map(c => linha(`Dedução à coleta — ${c.label}`, -c.deducao)).join("")}
    ${temCategoriaE && !categoriaE.optaEnglobamento ? linha("Coleta especial (Categoria E)", categoriaE.coletaEspecial) : ""}
    ${linha("Coleta líquida", resultado.coletaLiquida, { destaque: true })}
  </table>

  <h2>Pagamentos já efetuados</h2>
  <table>
    ${linha("Retenções na fonte", resultado.retencoesFonte)}
    ${resultado.pagamentosPorConta ? linha("Pagamentos por conta", resultado.pagamentosPorConta) : ""}
  </table>

  <div class="resultado-final">
    <div>${sinalResultado.toUpperCase()}</div>
    <div class="valor">${valorAbs} €</div>
  </div>
  <p class="taxa-efetiva">Taxa efetiva de tributação: ${formatarPercentagem(resultado.taxaEfetiva)}</p>

  <p style="margin-top:24px">Esta estimativa segue a estrutura da Demonstração de Liquidação de IRS emitida
  pela Autoridade Tributária, mas foi simplificada e não substitui a declaração oficial submetida no
  Portal das Finanças, nem constitui aconselhamento fiscal definitivo.</p>

  <div class="aviso">
    <strong>Aviso:</strong> Estimativa gerada por ferramenta interna de simulação, com base em
    parâmetros fiscais que devem ser confirmados antes de qualquer decisão. Os valores finais podem
    diferir dos apurados pela Autoridade Tributária.
  </div>
</body>
</html>`;
}

const api = { gerarCartaHTML };

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
} else {
  root.IRSLetter = api;
}

})(typeof window !== "undefined" ? window : globalThis);
