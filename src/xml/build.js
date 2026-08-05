// Gerador do XML Modelo3IRSv2026, a partir do modelo de dados da aplicação.
// A estrutura foi obtida por engenharia inversa de 3 exemplos reais fornecidos pelo utilizador
// (um esqueleto vazio, um sujeito passivo único com Anexo A preenchido, e um casal com
// tributação conjunta + dependente com deficiência em guarda conjunta).
//
// Partes ainda não mapeadas (ficam com a estrutura "esqueleto" tal como observada nos exemplos,
// até serem fornecidos exemplos preenchidos): Rosto Quadro07/08B/11/13, Anexo B Quadros
// 11-16/18, e os conteúdos dos Anexos G/G1/J/L/SS (apenas o cabeçalho ano+NIF é preenchido).
//
// Ficheiro carregado como <script> normal (não módulo) para poder ser aberto diretamente
// com duplo-clique, sem servidor. Expõe-se em window.IRSXml.

(function (root) {

function esc(valor) {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function el(nome, conteudo) {
  if (conteudo === undefined || conteudo === null || conteudo === "") {
    return `<${nome}/>`;
  }
  return `<${nome}>${conteudo}</${nome}>`;
}

const CAMPOS_MONETARIOS = new Set([
  "Valor", "MontanteGanho", "ValorUnitario", "ValorTotal",
  "Rendimentos", "Retencoes", "Contribuicoes", "RetSobretaxa", "Quotizacoes",
  "RetencaoIRS", "MontanteRendimento", "ValorPensao", "ImportanciaAplicada"
]);

function formatarValor(tag, v) {
  if (CAMPOS_MONETARIOS.has(tag) && v !== "" && !isNaN(Number(v))) {
    return Number(v).toFixed(2);
  }
  return v;
}

function linha(container, numero, campos) {
  const corpo = Object.entries(campos)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([tag, v]) => el(tag, esc(formatarValor(tag, v))))
    .join("");
  return `<${container}-Linha numero="${numero}">${corpo}</${container}-Linha>`;
}

function listaComLinhas(container, linhasDados) {
  if (!linhasDados || linhasDados.length === 0) {
    return el(container);
  }
  const corpo = linhasDados.map((campos, i) => linha(container, i + 1, campos)).join("");
  return `<${container}>${corpo}</${container}>`;
}

const COD_RESIDENCIA_FISCAL = { continente: 1, acores: 2, madeira: 3 };
const COD_NATUREZA_DECLARACAO = { primeira: 1, substituicao: 2 };

function buildRosto(model) {
  const { ano, nifA, nifB, tributacaoConjunta, iban, residenciaFiscal, naturezaDeclaracao, associarIbanNif, dependentes = [] } = model.agregado;
  const passthrough = model.rostoPassthrough || {};

  const quadro04 = tributacaoConjunta ? `<Quadro04>${el("Q04B01", 1)}</Quadro04>` : `<Quadro04/>`;
  const quadro05 = tributacaoConjunta
    ? `<Quadro05>${el("Q05B01", "S")}${el("Q05C03", nifB)}</Quadro05>`
    : `<Quadro05/>`;

  const deficientes = dependentes.filter(d => d.deficienteGrau && !d.guardaConjunta).map(d => ({
    NIF: d.nif,
    DeficienteGrau: d.deficienteGrau
  }));
  const guardaConjunta = dependentes.filter(d => d.guardaConjunta).map(d => ({
    NIF: d.nif,
    DeficienteGrau: d.deficienteGrau,
    RespParentais: d.respParentais,
    NifProgenitor: d.nifProgenitor,
    IntegraAgregadoSP: d.integraAgregadoSP,
    PartilhaDespesas: d.partilhaDespesas,
    ResidenciaAlternada: d.residenciaAlternada ? "S" : "N"
  }));

  const quadro06 = `<Quadro06>` +
    listaComLinhas("Rostoq06BT01", deficientes) +
    el("Rostoq06BT02") +
    listaComLinhas("Rostoq06BT03", guardaConjunta) +
    el("Rostoq06CT01") +
    `</Quadro06>`;

  // Quadro08 (residência fiscal) e Quadro10 (natureza da declaração): nomes de campo
  // (Q08B01/Q10B01, um único campo cujo valor é o número do campo do papel assinalado)
  // confirmados contra um exemplo real (Q08B01=1 para Continente, Q10B01=1 para 1.ª
  // declaração). Só cobrem os casos mais comuns (residente, Continente/Açores/Madeira;
  // 1.ª declaração/substituição). O passthrough tem sempre prioridade sobre o valor
  // calculado quando existe (quadro importado com conteúdo) — para não perder campos que
  // a app ainda não modela (ex: Quadro08B de não residentes) só porque reconhecemos um dos
  // campos. Isto significa que alterar o dropdown depois de importar uma declaração que já
  // tinha estes quadros preenchidos não se reflete na exportação — só se aplica a partir
  // de um quadro em branco.
  const codResidencia = COD_RESIDENCIA_FISCAL[residenciaFiscal];
  const quadro08 = passthrough.Quadro08 || (codResidencia
    ? `<Quadro08>${el("Q08B01", codResidencia)}</Quadro08>`
    : `<Quadro08/>`);

  const codNatureza = COD_NATUREZA_DECLARACAO[naturezaDeclaracao];
  const quadro10 = passthrough.Quadro10 || (codNatureza
    ? `<Quadro10>${el("Q10B01", codNatureza)}</Quadro10>`
    : `<Quadro10/>`);

  // Quadro09 — "Pretende que a AT associe este IBAN aos seus dados de identificação do
  // NIF...?" Confirmado num exemplo real (ordem das tags incluída): Sim ->
  // Q09B01b="true" seguido de Q09B01="S" (o significado exato do sufixo "b" não está
  // documentado nas instruções; assume-se que só aparece quando a resposta é "Sim", por
  // ser o único caso observado).
  const quadro09Extra = associarIbanNif === "sim" ? `${el("Q09B01b", "true")}${el("Q09B01", "S")}`
    : associarIbanNif === "nao" ? el("Q09B01", "N")
    : "";

  return `<Rosto>` +
    `<QuadroInicio/>` +
    `<Quadro01>${el("Q01C01", 3697)}</Quadro01>` +
    `<Quadro02>${el("Q02C01", ano)}</Quadro02>` +
    `<Quadro03>${el("Q03C01", nifA)}</Quadro03>` +
    quadro04 +
    quadro05 +
    quadro06 +
    (passthrough.Quadro07 || `<Quadro07>${el("Rostoq07AT01")}${el("Rostoq07BT01")}${el("Rostoq07CT01")}</Quadro07>`) +
    quadro08 +
    `<Quadro09>${el("Q09C01", iban)}${quadro09Extra}</Quadro09>` +
    quadro10 +
    (passthrough.Quadro11 || `<Quadro11/>`) +
    (passthrough.Quadro13 || `<Quadro13>${el("Rostoq13T01")}</Quadro13>`) +
    `</Rosto>`;
}

function buildAnexoA(model) {
  const { ano, nifA, nifB, tributacaoConjunta } = model.agregado;
  const a = model.anexoA || {};

  const somaCampo = (campo) =>
    (a.linhas || []).reduce((acc, l) => acc + (Number(l[campo]) || 0), 0).toFixed(2);

  const quadro03 = tributacaoConjunta
    ? `<Quadro03>${el("AnexoAq03C01", nifA)}${el("AnexoAq03C02", nifB)}</Quadro03>`
    : `<Quadro03>${el("AnexoAq03C01", nifA)}</Quadro03>`;

  const linhasAT01 = (a.linhas || []).map(l => ({
    NIF: l.nifEntidade,
    CodRendimentos: l.codRendimento,
    Titular: l.titular,
    Rendimentos: Number(l.rendimentos || 0).toFixed(2),
    Retencoes: Number(l.retencoes || 0).toFixed(2),
    Contribuicoes: Number(l.contribuicoes || 0).toFixed(2),
    RetSobretaxa: Number(l.retSobretaxa || 0).toFixed(2),
    Quotizacoes: Number(l.quotizacoes || 0).toFixed(2)
  }));

  const quadro04 =
    `<Quadro04>` +
    listaComLinhas("AnexoAq04AT01", linhasAT01) +
    el("AnexoAq04AT01SomaC01", somaCampo("rendimentos")) +
    el("AnexoAq04AT01SomaC02", somaCampo("retencoes")) +
    el("AnexoAq04AT01SomaC03", somaCampo("contribuicoes")) +
    el("AnexoAq04AT01SomaC04", somaCampo("retSobretaxa")) +
    el("AnexoAq04AT01SomaC05", somaCampo("quotizacoes")) +
    listaComLinhas("AnexoAq04BT01", a.pagamentosPorConta) +
    listaComLinhas("AnexoAq04CT01", a.outrasDeducoes) +
    listaComLinhas("AnexoAq04CT02", a.segurosDesgasteRapido) +
    listaComLinhas("AnexoAq04DT01", a.incentivoParticipacoesSociais) +
    listaComLinhas("AnexoAq04DT02", a.incentivoStartups) +
    listaComLinhas("AnexoAq04ET01", a.exResidentes) +
    listaComLinhas("AnexoAq04FT01", a.irsJovemAntigo) +
    listaComLinhas("AnexoAq04FT02", a.irsJovem) +
    listaComLinhas("AnexoAq04GT01", a.estudantesDependentes) +
    `</Quadro04>`;

  return `<AnexoA>` +
    `<Quadro02>${el("AnexoAq02C01", ano)}</Quadro02>` +
    quadro03 +
    quadro04 +
    `<Quadro05>${el("AnexoAq05AT01")}${el("AnexoAq05BT01")}</Quadro05>` +
    `<Quadro06>${el("AnexoAq06T01")}</Quadro06>` +
    `</AnexoA>`;
}

// Anexo E (rendimentos de capitais — categoria E): nomes de campo confirmados contra um
// exemplo real. Quadro4A (taxas especiais, art.º 72.º CIRS), Quadro4B (taxas liberatórias,
// art.º 71.º CIRS, só relevante se optar pelo englobamento) e Quadro5A/5B (rendimentos de
// anos anteriores, art.º 74.º CIRS). Não afeta ainda o cálculo da estimativa (rendimentos
// de capitais não estão cobertos pelo motor de cálculo atual, focado nas Categorias A/B).
function buildAnexoE(model) {
  const { ano, nifA, nifB, tributacaoConjunta } = model.agregado;
  const e = model.anexoE || {};
  const quadro03 = tributacaoConjunta
    ? `<Quadro03>${el("AnexoEq03C01", nifA)}${el("AnexoEq03C02", nifB)}</Quadro03>`
    : `<Quadro03>${el("AnexoEq03C01", nifA)}</Quadro03>`;

  const taxasEspeciais = e.rendimentosTaxasEspeciais || [];
  const taxasLiberatorias = e.rendimentosTaxasLiberatorias || [];
  const somaTaxasEspeciais = taxasEspeciais.reduce((a, r) => a + (Number(r.rendimento) || 0), 0);
  const somaTaxasLiberatoriasRend = taxasLiberatorias.reduce((a, r) => a + (Number(r.rendimento) || 0), 0);
  const somaTaxasLiberatoriasRet = taxasLiberatorias.reduce((a, r) => a + (Number(r.retencao) || 0), 0);

  const temQuadro04 = taxasEspeciais.length || taxasLiberatorias.length || !!e.optaEnglobamento;
  const quadro04 = temQuadro04
    ? `<Quadro04>` +
      listaComLinhas("AnexoEq04AT01", taxasEspeciais.map((r, i) => ({
        NLinha: r.nlinha || (401 + i), NIF: r.nif, CodRendimentos: r.codigo, Titular: r.titular,
        Rendimentos: moeda(r.rendimento)
      }))) +
      (taxasEspeciais.length ? el("AnexoEq04AT01SomaC01", moeda(somaTaxasEspeciais)) : "") +
      el("AnexoEq04B01", e.optaEnglobamento ? "S" : "N") +
      listaComLinhas("AnexoEq04BT01", taxasLiberatorias.map((r, i) => ({
        NLinha: r.nlinha || (451 + i), NIF: r.nif, CodRendimentos: r.codigo, Titular: r.titular,
        Rendimentos: moeda(r.rendimento), Retencoes: moeda(r.retencao)
      }))) +
      (taxasLiberatorias.length ? el("AnexoEq04BT01SomaC01", moeda(somaTaxasLiberatoriasRend)) + el("AnexoEq04BT01SomaC02", moeda(somaTaxasLiberatoriasRet)) : "") +
      `</Quadro04>`
    : `<Quadro04/>`;

  const anosAnteriores5A = e.rendimentosAnosAnteriores5A || [];
  const anosAnteriores5B = e.rendimentosAnosAnteriores5B || [];
  const quadro05 = (anosAnteriores5A.length || anosAnteriores5B.length)
    ? `<Quadro05>` +
      listaComLinhas("AnexoEq05AT01", anosAnteriores5A.map(r => ({
        Quadro: r.quadro, NLinha: r.nlinha, AnoRendimentos: r.anoRendimentos, Rendimento: moeda(r.rendimento), Nanos: r.nanos
      }))) +
      listaComLinhas("AnexoEq05BT01", anosAnteriores5B.map(r => ({
        Quadro: r.quadro, NLinha: r.nlinha, AnoRendimentos: r.anoRendimentos, Rendimento: moeda(r.rendimento), RetencoesFonte: moeda(r.retencoesFonte)
      }))) +
      `</Quadro05>`
    : `<Quadro05/>`;

  return `<AnexoE>` +
    `<Quadro02>${el("AnexoEq02C01", ano)}</Quadro02>` +
    quadro03 +
    quadro04 +
    quadro05 +
    `</AnexoE>`;
}

// Anexos ainda não mapeados em detalhe (Fase 3+): emite apenas o cabeçalho ano+NIF,
// tal como observado nos exemplos fornecidos, mantendo o esqueleto vazio nos restantes quadros.
function buildAnexoEsqueleto(nomeAnexo, prefixo, model, quadrosVazios, temC02) {
  const { ano, nifA, nifB, tributacaoConjunta } = model.agregado;
  const camposQ03 = temC02 && tributacaoConjunta
    ? `${el(`${prefixo}q03C01`, nifA)}${el(`${prefixo}q03C02`, nifB)}`
    : el(`${prefixo}q03C01`, nifA);

  return `<${nomeAnexo}>` +
    `<Quadro02>${el(`${prefixo}q02C01`, ano)}</Quadro02>` +
    `<Quadro03>${camposQ03}</Quadro03>` +
    quadrosVazios.map(q => `<Quadro${q}/>`).join("") +
    `</${nomeAnexo}>`;
}

// Códigos dos quadros 4A/4B/4C, pela ordem em que aparecem no formulário em papel
// (não é ordem numérica — ex: 459 aparece antes de 454 no quadro 4B).
const ANEXOB_CODIGOS_4A = [401, 419, 420, 421, 402, 415, 416, 417, 403, 404, 422, 405, 406, 407, 408, 409, 418, 410, 411, 412, 413, 414];
const ANEXOB_CODIGOS_4B = [451, 452, 459, 453, 454, 455, 456, 457, 460, 458];
const ANEXOB_CODIGOS_4C = [481, 482];

// Quadro 7A do Anexo B (encargos em caso de opção pela categoria A, ou ato isolado
// > €200.000): coluna esquerda = rendimentos profissionais/comerciais/industriais
// (soma em SomaC01), coluna direita = rendimentos agrícolas/silvícolas/pecuários
// (soma em SomaC02). Nomes de campo e ordem confirmados contra um exemplo real.
const ANEXOB_Q07_CAMPOS_PROF = [701, 703, 705, 707, 709, 711, 713, 715, 717, 719, 721];
const ANEXOB_Q07_CAMPOS_AGRICOLA = [702, 704, 706, 708, 710, 712, 714, 716, 718, 720, 722];
const ANEXOB_Q07_TODOS = [701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722];

function moeda(v) {
  return Number(v || 0).toFixed(2);
}

// Nomes de campo confirmados contra um exemplo real (todos os campos 701-722, mesmo a
// 0,00, são emitidos assim que o quadro está "ativo" — não há omissão condicional como
// no quadro 4).
function buildQuadro07(q07) {
  if (!q07) return `<Quadro07/>`;
  const despesas = q07.despesas || {};
  const somaProf = ANEXOB_Q07_CAMPOS_PROF.reduce((acc, c) => acc + (Number(despesas[c]) || 0), 0);
  const somaAgricola = ANEXOB_Q07_CAMPOS_AGRICOLA.reduce((acc, c) => acc + (Number(despesas[c]) || 0), 0);

  const entidadesSS = listaComLinhas("AnexoBq07BT01", (q07.entidadesSS || []).map(e => ({
    NIFEntidades: e.nif, Valor: moeda(e.valor)
  })));
  const seguros = listaComLinhas("AnexoBq07CT01", (q07.segurosDesgasteRapido || []).map(s => ({
    ProfissaoCodigo: s.profissaoCodigo, Valor: moeda(s.valor), NIFPortugues: s.nifPortugues,
    Pais: s.pais, NumeroFiscalUE: s.numeroFiscalUE
  })));
  const predios = listaComLinhas("AnexoBq07DT01", (q07.prediosArt41 || []).map(p => ({
    Freguesia: p.freguesia, Tipo: p.tipo, Artigo: p.artigo, Fraccao: p.fraccao, QuotaParte: p.quotaParte,
    ValorRendimentoPCI: moeda(p.valorPCI), ValorRendimentoASP: moeda(p.valorASP)
  })));

  return `<Quadro07>` +
    ANEXOB_Q07_TODOS.map(c => el(`AnexoBq07C${c}`, moeda(despesas[c]))).join("") +
    el("AnexoBq07SomaC01", moeda(somaProf)) +
    el("AnexoBq07SomaC02", moeda(somaAgricola)) +
    entidadesSS + seguros + predios +
    (q07.anosSilvicolasPlurianual ? el("AnexoBq07C781", q07.anosSilvicolasPlurianual) : "") +
    `</Quadro07>`;
}

// Quadro 17 do Anexo B (despesas e encargos, art.º 31.º n.ºs 2 e 13 do CIRS): 17A/17B
// confirmados contra um exemplo real. 17C (declarar despesas com pessoal/rendas/outras em
// alternativa aos valores comunicados à AT, campos 17051-17054 e respetiva SOMA) e 17D
// (rendas de imóveis afetas à atividade) não apareciam preenchidos nesse exemplo (a opção
// 17C estava em "Não") — nomes de campo extrapolados do mesmo padrão do 17A/17B, por
// confirmar quando se tiver um exemplo com a opção "Sim".
function buildQuadro17(q17) {
  if (!q17) return `<Quadro17/>`;

  const temA = q17.contribuicoesSS !== undefined && q17.contribuicoesSS !== "";
  const temB = q17.importacoesIntracomunitarias !== undefined && q17.importacoesIntracomunitarias !== "";
  const soma17A = (temA ? Number(q17.contribuicoesSS) : 0) + (temB ? Number(q17.importacoesIntracomunitarias) : 0);

  const entidadesSS = listaComLinhas("AnexoBq17BT01", (q17.entidadesSS || []).map(e => ({
    CampoQ17A: "17001", NIF: e.nif, Valor: moeda(e.valor)
  })));

  const optaAlternativa = !!q17.optaDespesasAlternativa;
  const camposAlternativa = optaAlternativa
    ? el("AnexoBq17C17051", moeda(q17.despesasPessoal)) +
      el("AnexoBq17C17052", moeda(q17.rendasImoveis)) +
      el("AnexoBq17C17053", moeda(q17.outrasDespesasParcial)) +
      el("AnexoBq17C17054", moeda(q17.outrasDespesasTotal)) +
      el("AnexoBq17SomaC02", moeda(
        (Number(q17.despesasPessoal) || 0) + (Number(q17.rendasImoveis) || 0) +
        (Number(q17.outrasDespesasParcial) || 0) + (Number(q17.outrasDespesasTotal) || 0)
      ))
    : "";

  const rendasAfetas = listaComLinhas("AnexoBq17DT01", (q17.rendasImoveisAfetas || []).map(r => ({
    NIF: r.nif, Valor: moeda(r.valor),
    AfetacaoParcial: r.afetacaoParcial ? "true" : undefined,
    AfetacaoTotal: r.afetacaoTotal ? "true" : undefined
  })));

  return `<Quadro17>` +
    (temA ? el("AnexoBq17C17001", moeda(q17.contribuicoesSS)) : "") +
    (temB ? el("AnexoBq17C17002", moeda(q17.importacoesIntracomunitarias)) : "") +
    el("AnexoBq17SomaC01", moeda(soma17A)) +
    entidadesSS +
    el("AnexoBq17B01", optaAlternativa ? "S" : "N") +
    camposAlternativa +
    rendasAfetas +
    `</Quadro17>`;
}

function temDadosQuadro07(q07) {
  if (!q07) return false;
  const despesas = q07.despesas || {};
  return Object.values(despesas).some(v => Number(v) > 0) ||
    (q07.entidadesSS && q07.entidadesSS.length > 0) ||
    (q07.segurosDesgasteRapido && q07.segurosDesgasteRapido.length > 0) ||
    (q07.prediosArt41 && q07.prediosArt41.length > 0) ||
    !!q07.anosSilvicolasPlurianual;
}

function temDadosQuadro17(q17) {
  if (!q17) return false;
  return q17.contribuicoesSS !== undefined && q17.contribuicoesSS !== "" ||
    q17.importacoesIntracomunitarias !== undefined && q17.importacoesIntracomunitarias !== "" ||
    (q17.entidadesSS && q17.entidadesSS.length > 0) ||
    !!q17.optaDespesasAlternativa ||
    (q17.rendasImoveisAfetas && q17.rendasImoveisAfetas.length > 0);
}

// Quadro 8 do Anexo B (alienação/desafetação/afetação de direitos reais sobre bens
// imóveis): nomes de campo confirmados contra um exemplo real. Só cobre a captura/
// exportação dos dados — não afeta o cálculo de mais-valias na estimativa (regras
// próprias e complexas do art.º 44.º e seguintes do CIRS, ainda por implementar).
function buildQuadro08AnexoB(q08) {
  if (!q08) return `<Quadro08/>`;

  const at01 = listaComLinhas("AnexoBq08AT01", (q08.imoveisAlienados || []).map(p => ({
    Freguesia: p.freguesia, Tipo: p.tipo, Artigo: p.artigo, Fraccao: p.fraccao, QuotaParte: p.quotaParte,
    Codigo: p.codigo, AnoVendaDesafetacaoAfetacao: p.ano, MesVendaDesafetacaoAfetacao: p.mes,
    DiaVendaDesafetacaoAfetacao: p.dia, ValorVendaDesafetacaoAfetacao: moeda(p.valor),
    CampoQ4: p.campoQ4, ValorDefinitivo: p.valorDefinitivo !== undefined && p.valorDefinitivo !== "" ? moeda(p.valorDefinitivo) : undefined,
    Art139CIRC: p.art139circ ? "true" : undefined
  })));
  const somaAT01C01 = (q08.imoveisAlienados || []).reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const somaAT01C02 = (q08.imoveisAlienados || []).reduce((a, p) => a + (Number(p.valorDefinitivo) || 0), 0);

  const bt01 = listaComLinhas("AnexoBq08BT01", (q08.imoveisRegimeTransitorio || []).map(p => ({
    Freguesia: p.freguesia, Tipo: p.tipo, Artigo: p.artigo, Fracao: p.fracao, QuotaParte: p.quotaParte,
    Codigo: p.codigo, AnoAfetacao: p.ano, MesAfetacao: p.mes, DiaAfetacao: p.dia
  })));

  const ct01 = listaComLinhas("AnexoBq08CT01", (q08.imoveisAlienados2021 || []).map(p => ({
    Freguesia: p.freguesia, Tipo: p.tipo, Artigo: p.artigo, Fracao: p.fracao, QuotaParte: p.quotaParte,
    AnoVenda: p.ano, MesVenda: p.mes, DiaVenda: p.dia, ValorVenda: moeda(p.valor),
    CampoQ4: p.campoQ4, ValorDefinitivo: p.valorDefinitivo !== undefined && p.valorDefinitivo !== "" ? moeda(p.valorDefinitivo) : undefined,
    Art139CIRC: p.art139circ ? "true" : undefined
  })));
  const somaCT01C01 = (q08.imoveisAlienados2021 || []).reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const somaCT01C02 = (q08.imoveisAlienados2021 || []).reduce((a, p) => a + (Number(p.valorDefinitivo) || 0), 0);

  const ct02 = listaComLinhas("AnexoBq08CT02", (q08.imoveisDesafetadosAfetados2021 || []).map(p => ({
    Freguesia: p.freguesia, Tipo: p.tipo, Artigo: p.artigo, Fracao: p.fracao, QuotaParte: p.quotaParte,
    Codigo: p.codigo, AnoDesafetacaoAfetacao: p.ano, MesDesafetacaoAfetacao: p.mes, DiaDesafetacaoAfetacao: p.dia
  })));

  return `<Quadro08>` +
    el("AnexoBq08B01", q08.houveAlienacaoImoveis ? "S" : "N") +
    el("AnexoBq08B03", q08.houveAfetacaoImoveis ? "S" : "N") +
    at01 +
    ((q08.imoveisAlienados || []).length ? el("AnexoBq08AT01SomaC01", moeda(somaAT01C01)) + el("AnexoBq08AT01SomaC02", moeda(somaAT01C02)) : "") +
    el("AnexoBq08B05", q08.imoveisAfetos2021 ? "S" : "N") +
    el("AnexoBq08B07", q08.optaRegimeTransitorio ? "S" : "N") +
    bt01 +
    el("AnexoBq08B09", q08.houveAlienacao2021 ? "S" : "N") +
    ct01 +
    ((q08.imoveisAlienados2021 || []).length ? el("AnexoBq08CT01SomaC01", moeda(somaCT01C01)) + el("AnexoBq08CT01SomaC02", moeda(somaCT01C02)) : "") +
    el("AnexoBq08B11", q08.houveDesafetacao2021 ? "S" : "N") +
    el("AnexoBq08B13", q08.houveAfetacao2021 ? "S" : "N") +
    ct02 +
    `</Quadro08>`;
}

function temDadosQuadro08AnexoB(q08) {
  if (!q08) return false;
  return !!q08.houveAlienacaoImoveis || !!q08.houveAfetacaoImoveis || !!q08.imoveisAfetos2021 ||
    !!q08.optaRegimeTransitorio || !!q08.houveAlienacao2021 || !!q08.houveDesafetacao2021 || !!q08.houveAfetacao2021 ||
    (q08.imoveisAlienados && q08.imoveisAlienados.length > 0) ||
    (q08.imoveisRegimeTransitorio && q08.imoveisRegimeTransitorio.length > 0) ||
    (q08.imoveisAlienados2021 && q08.imoveisAlienados2021.length > 0) ||
    (q08.imoveisDesafetadosAfetados2021 && q08.imoveisDesafetadosAfetados2021.length > 0);
}

// Quadro 9 do Anexo B (mais-valias — concretização do reinvestimento do valor de
// realização): nomes de campo confirmados contra um exemplo real.
function buildQuadro09AnexoB(q09) {
  if (!q09 || !(q09.linhas || []).length) return `<Quadro09/>`;
  return `<Quadro09>` +
    listaComLinhas("AnexoBq09T01", q09.linhas.map(l => ({
      AtivosFixosTangiveis: moeda(l.ativosFixosTangiveis), AtivosIntangiveis: moeda(l.ativosIntangiveis),
      AtivosBiologicosNaoConsumiveis: moeda(l.ativosBiologicosNaoConsumiveis)
    }))) +
    `</Quadro09>`;
}

function temDadosQuadro09AnexoB(q09) {
  return !!(q09 && q09.linhas && q09.linhas.length > 0);
}

// Quadro 10 do Anexo B (partes sociais adquiridas ao abrigo do regime de neutralidade
// fiscal): nomes de campo confirmados contra um exemplo real, exceto o mapeamento
// completo de "modalidade de pagamento" (10C) — só se confirmou o valor 1 = imediato
// (campo07 do papel); 2 = diferido e 3 = fracionado são extrapolados por analogia (a
// ordem em que aparecem no formulário), não confirmados.
const ANEXOB_Q10_MODALIDADE = { imediato: 1, diferido: 2, fracionado: 3 };

function buildQuadro10AnexoB(q10) {
  if (!q10) return `<Quadro10/>`;
  const partesSociais = q10.partesSociais || [];
  const somaC01 = partesSociais.reduce((a, p) => a + (Number(p.valorRealizacao) || 0), 0);
  const somaC02 = partesSociais.reduce((a, p) => a + (Number(p.valorAquisicao) || 0), 0);
  const somaC03 = partesSociais.reduce((a, p) => a + (Number(p.despesasEncargos) || 0), 0);
  const modalidade = ANEXOB_Q10_MODALIDADE[q10.modalidadePagamento];

  return `<Quadro10>` +
    el("AnexoBq10B01", q10.alienacaoPartesSociais ? "S" : "N") +
    el("AnexoBq10B03", q10.perdaQualidadeResidente ? "S" : "N") +
    listaComLinhas("AnexoBq10BT01", partesSociais.map(p => ({
      EntidadeEmitente: p.entidadeEmitente, Codigos: p.codigos, NTitulos: p.numeroTitulos, CapitalSocial: p.capitalSocial,
      AnoRealizacao: p.anoRealizacao, MesRealizacao: p.mesRealizacao, ValorRealizacao: moeda(p.valorRealizacao),
      AnoAquisicao: p.anoAquisicao, MesAquisicao: p.mesAquisicao, ValorAquisicao: moeda(p.valorAquisicao),
      DespesasEncargos: moeda(p.despesasEncargos)
    }))) +
    (partesSociais.length ? el("AnexoBq10SomaC01", moeda(somaC01)) + el("AnexoBq10SomaC02", moeda(somaC02)) + el("AnexoBq10SomaC03", moeda(somaC03)) : "") +
    (q10.destinoUE ? el("AnexoBq10C05", q10.destinoUE) : "") +
    (q10.destinoOutro ? el("AnexoBq10C06", q10.destinoOutro) : "") +
    (modalidade ? el("AnexoBq10B07", modalidade) : "") +
    `</Quadro10>`;
}

function temDadosQuadro10AnexoB(q10) {
  if (!q10) return false;
  return !!q10.alienacaoPartesSociais || !!q10.perdaQualidadeResidente ||
    (q10.partesSociais && q10.partesSociais.length > 0) || !!q10.destinoUE || !!q10.destinoOutro || !!q10.modalidadePagamento;
}

// AnexoB/J/L/SS têm atributo id=NIF e repetem-se por sujeito passivo quando ambos têm
// atividade/rendimentos próprios nesse anexo. Nesta fase ainda não temos exemplo preenchido
// nem confirmação de como fica o segundo anexo repetido, por isso emite-se apenas o esqueleto
// para o sujeito passivo A.
//
// Quadros 1, 3, 4, 5 e 6 são construídos a partir do modelo (dados editáveis na interface).
// Quadros 7 a 18 (situações mais raras: alienação de imóveis, mais-valias de partes sociais,
// atividade agrícola plurianual, alojamento local, etc.) ainda não têm interface própria —
// são preservados tal como vieram de uma importação (model.anexoBPassthrough), ou ficam
// vazios se se começar uma declaração em branco.
function buildAnexoB(model) {
  const { ano, nifA, nifB, tributacaoConjunta } = model.agregado;
  const b = model.anexoB || {};
  const pass = model.anexoBPassthrough || {};
  const campoC02 = tributacaoConjunta ? el("AnexoBq03C02", nifB) : "";

  const quadro01 = (b.regimeSimplificado || b.atoIsolado || b.naturezaProfComInd || b.naturezaAgricola)
    ? `<Quadro01>` +
      (b.regimeSimplificado ? el("AnexoBq01B01", 1) : "") +
      (b.atoIsolado ? el("AnexoBq01B02", 1) : "") +
      (b.naturezaProfComInd ? el("AnexoBq01B03", true) : "") +
      (b.naturezaAgricola ? el("AnexoBq01B04", true) : "") +
      `</Quadro01>`
    : `<Quadro01/>`;

  const quadro03 = `<Quadro03>` +
    el("AnexoBq03C01", nifA) +
    campoC02 +
    el("AnexoBq03B03", b.herancaIndivisa ? "S" : "N") +
    el("AnexoBq03C05", b.nifTitular || nifA) +
    (b.nifHerancaIndivisa ? el("AnexoBq03C06", b.nifHerancaIndivisa) : "") +
    (b.codigoAtividade ? el("AnexoBq03C07", b.codigoAtividade) : "") +
    (b.codigoCAEProf ? el("AnexoBq03C08", b.codigoCAEProf) : "") +
    (b.codigoCAEAgricola ? el("AnexoBq03C09", b.codigoCAEAgricola) : "") +
    (b.estabelecimentoEstavel !== undefined ? el("AnexoBq03B10", b.estabelecimentoEstavel ? "S" : "N") : "") +
    (b.exResidentesAno ? el("AnexoBq03C12", b.exResidentesAno) : "") +
    (b.regime910Comunicacao !== undefined ? el("AnexoBq03B13", b.regime910Comunicacao ? "S" : "N") : "") +
    (b.regime910NifEstabelecimento ? el("AnexoBq03C15", b.regime910NifEstabelecimento) : "") +
    (b.regime910CodPais ? el("AnexoBq03C16", b.regime910CodPais) : "") +
    (b.irsJovemAntigoAno ? el("AnexoBq03C17a", b.irsJovemAntigoAno) : "") +
    (b.irsJovemAntigoNivel ? el("AnexoBq03C17b", b.irsJovemAntigoNivel) : "") +
    (b.irsJovemAntigoNif ? el("AnexoBq03C17c", b.irsJovemAntigoNif) : "") +
    (b.irsJovemAntigoPais ? el("AnexoBq03C17d", b.irsJovemAntigoPais) : "") +
    (b.irsJovemNovoOpcao !== undefined ? el("AnexoBq03B18", b.irsJovemNovoOpcao ? "S" : "N") : "") +
    `</Quadro03>`;

  const rendimentos = b.rendimentosBrutos || [];
  const valorPorCodigo = (codigo) => {
    const item = rendimentos.find(r => Number(r.codigo) === codigo);
    return item ? Number(item.valor || 0) : undefined;
  };
  const somaGrupo = (codigos) => codigos.reduce((acc, c) => acc + (valorPorCodigo(c) || 0), 0);
  const camposGrupo = (codigos) => codigos
    .map(c => { const v = valorPorCodigo(c); return v !== undefined ? el(`AnexoBq04C${c}`, v.toFixed(2)) : ""; })
    .join("");

  const quadro04 = rendimentos.length
    ? `<Quadro04>` +
      camposGrupo(ANEXOB_CODIGOS_4A) +
      el("AnexoBq04SomaC01", somaGrupo(ANEXOB_CODIGOS_4A).toFixed(2)) +
      camposGrupo(ANEXOB_CODIGOS_4B) +
      el("AnexoBq04SomaC02", somaGrupo(ANEXOB_CODIGOS_4B).toFixed(2)) +
      camposGrupo(ANEXOB_CODIGOS_4C) +
      el("AnexoBq04SomaC03", somaGrupo(ANEXOB_CODIGOS_4C).toFixed(2)) +
      `</Quadro04>`
    : `<Quadro04/>`;

  const quadro05 = b.categoriaA
    ? `<Quadro05>${el("AnexoBq05B01", b.categoriaA.unicaEntidade ? "S" : "N")}${el("AnexoBq05B03", b.categoriaA.optaRegrasCategoriaA ? "S" : "N")}</Quadro05>`
    : `<Quadro05/>`;

  const ret = b.retencoes;
  const quadro06 = ret && (ret.rendimentosSujeitos || ret.retencoesFonte || ret.pagamentosPorConta || (ret.entidades && ret.entidades.length))
    ? `<Quadro06>` +
      el("AnexoBq06C601", Number(ret.rendimentosSujeitos || 0).toFixed(2)) +
      el("AnexoBq06C602", Number(ret.retencoesFonte || 0).toFixed(2)) +
      el("AnexoBq06C603", Number(ret.pagamentosPorConta || 0).toFixed(2)) +
      listaComLinhas("AnexoBq06T01", (ret.entidades || []).map(e => ({ NIF: e.nif, Valor: e.valor }))) +
      `</Quadro06>`
    : `<Quadro06/>`;

  const quadro07 = temDadosQuadro07(b.quadro07)
    ? buildQuadro07(b.quadro07)
    : (pass.Quadro07 || `<Quadro07/>`);
  const quadro08 = temDadosQuadro08AnexoB(b.quadro08)
    ? buildQuadro08AnexoB(b.quadro08)
    : (pass.Quadro08 || `<Quadro08/>`);
  const quadro09 = temDadosQuadro09AnexoB(b.quadro09)
    ? buildQuadro09AnexoB(b.quadro09)
    : (pass.Quadro09 || `<Quadro09/>`);
  const quadro10 = temDadosQuadro10AnexoB(b.quadro10)
    ? buildQuadro10AnexoB(b.quadro10)
    : (pass.Quadro10 || `<Quadro10/>`);
  const quadro17 = temDadosQuadro17(b.quadro17)
    ? buildQuadro17(b.quadro17)
    : (pass.Quadro17 || `<Quadro17/>`);

  const quadros11a16 = [11, 12, 13, 14, 15, 16].map(i => {
    const numero = String(i).padStart(2, "0");
    return pass[`Quadro${numero}`] || `<Quadro${numero}/>`;
  }).join("");
  const quadro18 = pass.Quadro18 || `<Quadro18/>`;

  return `<AnexoB id="${esc(nifA)}">` +
    `<Quadro00/>` +
    quadro01 +
    `<Quadro02>${el("AnexoBq02C01", ano)}</Quadro02>` +
    quadro03 +
    quadro04 +
    quadro05 +
    quadro06 +
    quadro07 +
    quadro08 +
    quadro09 +
    quadro10 +
    quadros11a16 +
    quadro17 +
    quadro18 +
    `</AnexoB>`;
}

// Quadros 4 (rendimentos isentos), 5 (propriedade intelectual isenta) e 6A/6B (pensões de
// alimentos, benefícios fiscais/deficiência) são construídos a partir do modelo. O Quadro 6C
// (opção de declarar despesas de saúde/educação/imóveis/lares em alternativa aos valores
// comunicados à AT) e os Quadros 7-10 (info. de imóveis, acréscimos por incumprimento,
// incentivos à recapitalização, famílias de acolhimento) ainda não têm interface própria e
// ficam preservados tal como vierem de uma importação.
function buildAnexoH(model) {
  const { ano, nifA, nifB, tributacaoConjunta } = model.agregado;
  const h = model.anexoH || {};
  const pass = model.anexoHPassthrough || {};

  const quadro03 = tributacaoConjunta
    ? `<Quadro03>${el("AnexoHq03C01", nifA)}${el("AnexoHq03C02", nifB)}</Quadro03>`
    : `<Quadro03>${el("AnexoHq03C01", nifA)}</Quadro03>`;

  const isentos = (h.rendimentosIsentos || []).map(r => ({
    CodRendimentos: r.codigo, Titular: r.titular, Rendimentos: r.rendimento,
    RetencaoIRS: r.retencao, NifPortugues: r.nifPortugues, Pais: r.pais, NumeroFiscalUE: r.numeroFiscalUE
  }));
  const somaIsentosRend = (h.rendimentosIsentos || []).reduce((a, r) => a + (Number(r.rendimento) || 0), 0);
  const somaIsentosRet = (h.rendimentosIsentos || []).reduce((a, r) => a + (Number(r.retencao) || 0), 0);
  const quadro04 = isentos.length
    ? `<Quadro04>` + listaComLinhas("AnexoHq04T01", isentos) +
      el("AnexoHq04T01SomaC01", somaIsentosRend.toFixed(2)) +
      el("AnexoHq04T01SomaC02", somaIsentosRet.toFixed(2)) +
      `</Quadro04>`
    : `<Quadro04/>`;

  const propInt = (h.propriedadeIntelectual || []).map(p => ({ Titular: p.titular, MontanteRendimento: p.montante }));
  const somaPropInt = (h.propriedadeIntelectual || []).reduce((a, p) => a + (Number(p.montante) || 0), 0);
  const quadro05 = propInt.length
    ? `<Quadro05>` + listaComLinhas("AnexoHq05T01", propInt) + el("AnexoHq05T01SomaC01", somaPropInt.toFixed(2)) + `</Quadro05>`
    : `<Quadro05/>`;

  const pensoes = (h.pensoesAlimentos || []).map(p => ({ SujeitoPassivo: p.sujeitoPassivo, NifBeneficiario: p.nifBeneficiario, ValorPensao: p.valor }));
  const somaPensoes = (h.pensoesAlimentos || []).reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const beneficios = (h.beneficiosDeficiencia || []).map(b => ({
    CodBeneficio: b.codigo, Titular: b.titular, ImportanciaAplicada: b.importancia,
    NifPortugues: b.nifPortugues, Pais: b.pais, NumeroFiscalUE: b.numeroFiscalUE
  }));
  const somaBeneficios = (h.beneficiosDeficiencia || []).reduce((a, b) => a + (Number(b.importancia) || 0), 0);

  const quadro06CDefeito = `${el("AnexoHq06B01", "N")}<AnexoHq06CT01/><AnexoHq06CT02/>${el("AnexoHq06B03", "N")}<AnexoHq06CT03/><AnexoHq06CT04/>`;
  const temQuadro06 = pensoes.length > 0 || beneficios.length > 0 || !!pass.Quadro06C;
  const quadro06 = temQuadro06
    ? `<Quadro06>` +
      listaComLinhas("AnexoHq06AT01", pensoes) +
      el("AnexoHq06AT01SomaC01", somaPensoes.toFixed(2)) +
      listaComLinhas("AnexoHq06BT01", beneficios) +
      el("AnexoHq06BT01SomaC01", somaBeneficios.toFixed(2)) +
      (pass.Quadro06C || quadro06CDefeito) +
      `</Quadro06>`
    : `<Quadro06/>`;

  const quadrosRestantes = ["Quadro07", "Quadro08", "Quadro09", "Quadro10"]
    .map(q => pass[q] || `<${q}/>`).join("");

  return `<AnexoH>` +
    `<Quadro02>${el("AnexoHq02C01", ano)}</Quadro02>` +
    quadro03 +
    quadro04 +
    quadro05 +
    quadro06 +
    quadrosRestantes +
    `</AnexoH>`;
}

function buildAnexoJ(model) {
  const { ano, nifA, nifB, tributacaoConjunta } = model.agregado;
  const campoC02 = tributacaoConjunta ? el("AnexoJq03C02", nifB) : "";
  return `<AnexoJ id="${esc(nifA)}">` +
    `<Quadro02>${el("AnexoJq02C01", ano)}</Quadro02>` +
    `<Quadro03>${el("AnexoJq03C01", nifA)}${campoC02}${el("AnexoJq03C03", nifA)}</Quadro03>` +
    Array.from({ length: 8 }, (_, i) => `<Quadro${String(i + 4).padStart(2, "0")}/>`).join("") +
    `</AnexoJ>`;
}

function buildAnexoL(model) {
  const { ano, nifA, nifB, tributacaoConjunta } = model.agregado;
  const campoC02 = tributacaoConjunta ? el("AnexoLq03C02", nifB) : "";
  return `<AnexoL id="${esc(nifA)}">` +
    `<Quadro01/>` +
    `<Quadro02>${el("AnexoLq02C01", ano)}</Quadro02>` +
    `<Quadro03>${el("AnexoLq03C01", nifA)}${campoC02}${el("AnexoLq03C03", nifA)}</Quadro03>` +
    Array.from({ length: 4 }, (_, i) => `<Quadro${String(i + 4).padStart(2, "0")}/>`).join("") +
    `</AnexoL>`;
}

function buildAnexoSS(model) {
  const { ano, nifA } = model.agregado;
  return `<AnexoSS id="${esc(nifA)}">` +
    `<Quadro01/>` +
    `<Quadro02>${el("AnexoSSq02C04", ano)}</Quadro02>` +
    `<Quadro03>${el("AnexoSSq03C06", nifA)}</Quadro03>` +
    `<Quadro04/><Quadro05/><Quadro06/>` +
    `</AnexoSS>`;
}

function buildModelo3XML(model) {
  const partes = [];
  partes.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  partes.push(
    `<Modelo3IRSv2026 xmlns="http://www.dgci.gov.pt/2009/Modelo3IRSv2026" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versao="1" ` +
    `xsi:schemaLocation="http://www.dgci.gov.pt/2009/Modelo3IRSv2026 Modelo3IRSv2026.xsd">`
  );
  partes.push(buildRosto(model));
  partes.push(buildAnexoA(model));

  if (model.incluirAnexosVazios !== false) {
    const pass = model.anexosPassthrough || {};
    partes.push(buildAnexoB(model));
    partes.push(buildAnexoE(model));
    partes.push(pass.AnexoG || buildAnexoEsqueleto("AnexoG", "AnexoG", model, Array.from({length: 16}, (_, i) => String(i + 4).padStart(2, "0")), true));
    partes.push(pass.AnexoG1 || buildAnexoEsqueleto("AnexoG1", "AnexoG1", model, ["04", "05", "06", "07", "08"], true));
    partes.push(buildAnexoH(model));
    partes.push(pass.AnexoJ || buildAnexoJ(model));
    partes.push(pass.AnexoL || buildAnexoL(model));
    partes.push(pass.AnexoSS || buildAnexoSS(model));
  }

  partes.push(`</Modelo3IRSv2026>`);
  return partes.join("\n");
}

const api = { buildModelo3XML };

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
} else {
  root.IRSXml = api;
}

})(typeof window !== "undefined" ? window : globalThis);
