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

function listaPortugues(itens) {
  if (!itens.length) return "";
  if (itens.length === 1) return itens[0];
  return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
}

// Cabeçalho ao estilo de uma carta de acompanhamento ("transmittal letter"): saudação
// pelo nome, quando indicado; sem nome, mantém-se a identificação simples por NIF.
function cabecalhoDestinatario(agregado) {
  const nomes = [];
  if (agregado.nomeA) nomes.push(agregado.nomeA);
  if (agregado.tributacaoConjunta && agregado.nomeB) nomes.push(agregado.nomeB);

  if (!nomes.length) {
    return `<p>Sujeito passivo A — NIF ${agregado.nifA}${agregado.tributacaoConjunta ? ` | Sujeito passivo B — NIF ${agregado.nifB}` : ""}</p>`;
  }

  const saudacaoNome = nomes.length > 1 ? "Exmos. Senhores" : "Exmo(a). Senhor(a)";
  const nifs = agregado.tributacaoConjunta && agregado.nifB
    ? `NIF ${agregado.nifA} (${agregado.nomeA || "sujeito passivo A"}) e NIF ${agregado.nifB} (${agregado.nomeB || "sujeito passivo B"})`
    : `NIF ${agregado.nifA}`;

  return `<p class="saudacao">${saudacaoNome} ${escHTML(listaPortugues(nomes))},</p>
  <p>Junto se remete a estimativa do Imposto sobre o Rendimento das Pessoas Singulares (IRS)
  relativa aos rendimentos de ${agregado.ano}, elaborada com base nos elementos disponibilizados.</p>
  <p class="nota">${nifs}</p>`;
}

function escHTML(texto) {
  return String(texto === undefined || texto === null ? "" : texto)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Agrupa linhas de uma tabela de rendimentos pela nota/origem opcional que o utilizador
// preencheu (ex: "EDP", "JP Morgan"), somando o campo monetário indicado. Linhas sem nota
// não aparecem aqui — ficam só no total da categoria, sem discriminação própria.
function notasPorOrigem(linhas, campoValor) {
  const mapa = new Map();
  (linhas || []).forEach(l => {
    const chave = (l.nota || "").trim();
    if (!chave) return;
    const valor = Number(l[campoValor]) || 0;
    mapa.set(chave, (mapa.get(chave) || 0) + valor);
  });
  return [...mapa.entries()].map(([nota, valor]) => ({ nota, valor }));
}

// Frase narrativa, em vez de uma simples lista, descrevendo o que foi considerado em
// cada categoria e de onde veio — só quando há pelo menos uma linha com nota
// preenchida (sem notas, a categoria fica só com o total, sem esta frase). Quando uma
// única nota cobre a totalidade do valor, evita repetir o valor ("...pagos pela
// entidade EDP."); com várias origens, ou quando as notas não cobrem tudo, enumera-as
// e, havendo diferença, refere-a como "origem não especificada".
function fraseOrigem(totalCategoria, itens, { descricao, preposicaoSingular, verbo = "considerados" }) {
  if (!itens || !itens.length) return "";
  const somaNotas = itens.reduce((acc, i) => acc + i.valor, 0);
  const resto = totalCategoria - somaNotas;
  const coberturaTotal = itens.length === 1 && Math.abs(resto) < 0.005;

  let corpo;
  if (coberturaTotal) {
    corpo = `${preposicaoSingular} ${escHTML(itens[0].nota)}`;
  } else {
    const partes = itens.map(i => `${escHTML(i.nota)} (${formatarMoeda(i.valor)} €)`);
    corpo = `provenientes de ${listaPortugues(partes)}`;
    if (resto > 0.005) corpo += `, além de ${formatarMoeda(resto)} € de origem não especificada`;
  }
  return `<p class="nota">Foram ${verbo} ${formatarMoeda(totalCategoria)} € ${descricao}, ${corpo}.</p>`;
}

// Tabelas de rendimento com nota de origem que ainda não entram no motor de cálculo
// (Anexo G Quadros 9/18, e todo o Anexo J — regime de não residentes). Mesmo assim, a
// carta regista o que lá está, com um verbo diferente ("registados", não
// "considerados") para não sugerir que esses valores influenciaram a estimativa.
const TABELAS_SEM_CALCULO = [
  { chave: "anexoG09", campoValor: "valorRealizacao",
    descricao: "de valor de realização na alienação de partes sociais e valores mobiliários (Anexo G, Quadro 9)",
    preposicaoSingular: "relativo a" },
  { chave: "anexoG18A", campoValor: "valorRealizacao",
    descricao: "de valor de realização na alienação de criptoativos (Anexo G, Quadro 18A)",
    preposicaoSingular: "relativo a" },
  { chave: "anexoG18B", campoValor: "valorRealizacao",
    descricao: "de valor de realização na alienação de criptoativos (Anexo G, Quadro 18B)",
    preposicaoSingular: "relativo a" },
  { chave: "anexoJ04A", campoValor: "rendimentoBruto",
    descricao: "de rendimentos do trabalho dependente obtidos no estrangeiro (Anexo J, Quadro 4A)",
    preposicaoSingular: "pagos pela entidade" },
  { chave: "anexoJ05A", campoValor: "rendimentoBruto",
    descricao: "de rendimentos de pensões obtidos no estrangeiro (Anexo J, Quadro 5A)",
    preposicaoSingular: "provenientes de" },
  { chave: "anexoJ06A", campoValor: "rendimento",
    descricao: "de rendimentos empresariais e profissionais obtidos no estrangeiro (Anexo J, Quadro 6A)",
    preposicaoSingular: "provenientes de" },
  { chave: "anexoJ07A", campoValor: "rendimentoLiquido",
    descricao: "de rendimentos prediais obtidos no estrangeiro (Anexo J, Quadro 7A)",
    preposicaoSingular: "relativo a" },
  { chave: "anexoJ08A", campoValor: "rendimentoBruto",
    descricao: "de rendimentos de capitais obtidos no estrangeiro (Anexo J, Quadro 8A)",
    preposicaoSingular: "recebidos de" },
  { chave: "anexoJ091A", campoValor: "valorRealizacao",
    descricao: "de valor de realização na alienação de imóveis no estrangeiro (Anexo J, Quadro 9.1A)",
    preposicaoSingular: "relativo a" },
  { chave: "anexoJ092A", campoValor: "valorRealizacao",
    descricao: "de valor de realização na alienação de partes sociais e valores mobiliários no estrangeiro (Anexo J, Quadro 9.2A)",
    preposicaoSingular: "relativo a" },
  { chave: "anexoJ094A", campoValor: "valorRealizacao",
    descricao: "de valor de realização na alienação de criptoativos no estrangeiro (Anexo J, Quadro 9.4A)",
    preposicaoSingular: "relativo a" }
];

function frasesSemCalculo(notas) {
  const n = notas || {};
  return TABELAS_SEM_CALCULO
    .map(cfg => {
      const linhas = n[cfg.chave] || [];
      const total = linhas.reduce((acc, l) => acc + (Number(l[cfg.campoValor]) || 0), 0);
      const itens = notasPorOrigem(linhas, cfg.campoValor);
      return fraseOrigem(total, itens, { descricao: cfg.descricao, preposicaoSingular: cfg.preposicaoSingular, verbo: "registados" });
    })
    .filter(Boolean)
    .join("\n  ");
}

// Notas administrativas (regime de tributação, dependentes, contas no estrangeiro,
// IBAN de reembolso) — identificação rápida do que foi considerado, ao estilo de uma
// carta de acompanhamento. Só aparecem quando há algo a dizer (nunca uma lista vazia).
function notasAdministrativas(agregado, notas) {
  const n = notas || {};
  const itens = [];

  itens.push(agregado.tributacaoConjunta ? "Tributação conjunta" : "Tributação separada");

  const dependentes = n.dependentes || [];
  if (dependentes.length) {
    const nomes = dependentes.map(d => escHTML(d.nome || d.nif || "(sem identificação)"));
    itens.push(`${dependentes.length} dependente(s): ${listaPortugues(nomes)}`);
  }

  const contasIban = (n.contasEstrangeiroIbanBic || []).filter(c => c.iban);
  const contasOutras = (n.contasEstrangeiroOutras || []).filter(c => c.outrosNumIdentificacao);
  const totalContas = contasIban.length + contasOutras.length;
  if (totalContas) {
    const identificacoes = [...contasIban.map(c => escHTML(c.iban)), ...contasOutras.map(c => escHTML(c.outrosNumIdentificacao))];
    itens.push(`${totalContas} conta(s) no estrangeiro declarada(s) (Anexo J, Quadro 11): ${listaPortugues(identificacoes)}`);
  }

  if (agregado.iban) itens.push(`IBAN para reembolso: ${escHTML(agregado.iban)}`);

  if (!itens.length) return "";
  return `<ul class="elementos-considerados">${itens.map(i => `<li>${i}</li>`).join("")}</ul>`;
}

function gerarCartaHTML({ agregado, resultado, notas, dataGeracao }) {
  const nomeAno = agregado.ano;
  const sinalResultado = resultado.tipoResultado === "reembolso" ? "Reembolso estimado" : "Valor estimado a pagar";
  const valorAbs = formatarMoeda(Math.abs(resultado.resultado));
  const temCategoriaB = !!resultado.rendimentoBrutoB;
  const temAcrescimo = resultado.acrescimoAoRendimentoB > 0.005;
  const categoriaE = resultado.categoriaE || {};
  const temCategoriaE = categoriaE.rendimentoBrutoTaxasEspeciais > 0 || categoriaE.rendimentoBrutoTaxasLiberatorias > 0;
  const categoriaG = resultado.categoriaG || {};
  const temCategoriaG = (categoriaG.detalhe || []).length > 0;
  const categoriaGQuadro07 = resultado.categoriaGQuadro07 || {};
  const temCategoriaGQuadro07 = (categoriaGQuadro07.detalhe || []).length > 0;

  // Discriminação por origem (nota opcional em cada linha de rendimento) — só para
  // informação do cliente, não altera nenhum valor calculado.
  const n = notas || {};
  const notasA = notasPorOrigem(n.anexoA, "rendimentos");
  const notasB = notasPorOrigem(n.anexoB, "valor");
  const notasE4A = notasPorOrigem(n.anexoE4A, "rendimento");
  const notasE4B = notasPorOrigem(n.anexoE4B, "rendimento");
  const notasEEnglobado = [...notasE4A, ...notasE4B];
  const notasG04 = notasPorOrigem(n.anexoG04, "valorRealizacao");
  const notasG07 = notasPorOrigem(n.anexoG07, "valorRealizacao");
  const totalRealizacaoG04 = (n.anexoG04 || []).reduce((acc, l) => acc + (Number(l.valorRealizacao) || 0), 0);
  const totalRealizacaoG07 = (n.anexoG07 || []).reduce((acc, l) => acc + (Number(l.valorRealizacao) || 0), 0);

  const fraseA = fraseOrigem(resultado.rendimentoBrutoA, notasA,
    { descricao: "de rendimentos do trabalho dependente e de pensões (Categoria A)", preposicaoSingular: "pagos pela entidade" });
  const fraseB = fraseOrigem(resultado.rendimentoBrutoB, notasB,
    { descricao: "de rendimentos empresariais e profissionais (Categoria B)", preposicaoSingular: "provenientes de" });
  const fraseE = temCategoriaE ? fraseOrigem(
    categoriaE.optaEnglobamento ? categoriaE.rendimentoEnglobado : categoriaE.rendimentoBrutoTaxasEspeciais,
    categoriaE.optaEnglobamento ? notasEEnglobado : notasE4A,
    { descricao: "de rendimentos de capitais — juros e dividendos (Categoria E)", preposicaoSingular: "recebidos de" }
  ) : "";
  const fraseG04 = fraseOrigem(totalRealizacaoG04, notasG04,
    { descricao: "de valor de realização nas alienações de imóveis (Anexo G, Quadro 4)", preposicaoSingular: "relativo ao imóvel identificado como" });
  const fraseG07 = fraseOrigem(totalRealizacaoG07, notasG07,
    { descricao: "de valor de realização em cessões de posições contratuais/direitos (Anexo G, Quadro 7)", preposicaoSingular: "relativo a" });
  const frasesOutros = frasesSemCalculo(n);
  const notasAdmin = notasAdministrativas(agregado, n);

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
  .saudacao { font-weight: bold; margin-top: 18px; }
  .elementos-considerados { font-size: 0.85rem; color: #444; margin: 8px 0 0; padding-left: 20px; }
  .elementos-considerados li { margin-bottom: 2px; }
  .aviso { margin-top: 30px; padding: 12px; background: #f5f5f0; border-left: 4px solid #999; font-size: 0.85rem; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir / Guardar como PDF</button>
  <h1>Estimativa de IRS — Rendimentos de ${nomeAno}</h1>
  <p>Data de emissão: ${dataGeracao}</p>
  ${cabecalhoDestinatario(agregado)}
  ${notasAdmin}

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
    ${temCategoriaGQuadro07 ? linha("Categoria G — mais-valias tributáveis (50% do saldo, Anexo G Quadro 7)", categoriaGQuadro07.rendimentoTributavel) : ""}
    ${linha("Rendimento coletável", resultado.rendimentoLiquido, { destaque: true })}
  </table>
  ${fraseA}
  ${fraseB}
  ${temAcrescimo ? `<p class="nota">O acréscimo à Categoria B reflete a regra do regime simplificado: as despesas
  comprovadas (contribuições para a Segurança Social e despesas gerais do e-fatura) têm de atingir 15%
  dos rendimentos sujeitos a coeficiente reduzido; o que falta acresce ao rendimento tributável.</p>` : ""}
  ${fraseE}
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
  ${fraseG04}
  ${temCategoriaGQuadro07 ? `<p class="nota">Cessão de posições contratuais/direitos sobre bens imóveis
  (Anexo G, Quadro 7): saldo de ${formatarMoeda(categoriaGQuadro07.saldo)} € entre valor de realização e
  valor de aquisição do direito, do qual apenas 50% é tributado quando positivo (art.º 43.º, n.º 2, do
  CIRS).</p>` : ""}
  ${fraseG07}
  ${frasesOutros ? `
  <h2>Outros elementos registados</h2>
  <p class="nota">Os valores seguintes foram registados na aplicação mas ainda não têm reflexo nesta
  estimativa (ver aviso final sobre o âmbito atual do cálculo):</p>
  ${frasesOutros}` : ""}

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
