// Gerador do XML Modelo3IRSv2026, a partir do modelo de dados da aplicação.
// A estrutura foi obtida por engenharia inversa de 3 exemplos reais fornecidos pelo utilizador
// (um esqueleto vazio, um sujeito passivo único com Anexo A preenchido, e um casal com
// tributação conjunta + dependente com deficiência em guarda conjunta).
//
// Partes ainda não mapeadas (ficam com a estrutura "esqueleto" tal como observada nos exemplos,
// até serem fornecidos exemplos preenchidos): Rosto Quadro07/08/10/11/13, e os conteúdos dos
// Anexos B/E/G/G1/H/J/L/SS (apenas o cabeçalho ano+NIF é preenchido).
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
  "Rendimentos", "Retencoes", "Contribuicoes", "RetSobretaxa", "Quotizacoes"
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

function buildRosto(model) {
  const { ano, nifA, nifB, tributacaoConjunta, iban, dependentes = [] } = model.agregado;
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

  return `<Rosto>` +
    `<QuadroInicio/>` +
    `<Quadro01>${el("Q01C01", 3697)}</Quadro01>` +
    `<Quadro02>${el("Q02C01", ano)}</Quadro02>` +
    `<Quadro03>${el("Q03C01", nifA)}</Quadro03>` +
    quadro04 +
    quadro05 +
    quadro06 +
    (passthrough.Quadro07 || `<Quadro07>${el("Rostoq07AT01")}${el("Rostoq07BT01")}${el("Rostoq07CT01")}</Quadro07>`) +
    (passthrough.Quadro08 || `<Quadro08/>`) +
    `<Quadro09>${el("Q09C01", iban)}</Quadro09>` +
    (passthrough.Quadro10 || `<Quadro10/>`) +
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

  const quadrosRaros = Array.from({ length: 12 }, (_, i) => {
    const numero = String(i + 7).padStart(2, "0");
    return pass[`Quadro${numero}`] || `<Quadro${numero}/>`;
  }).join("");

  return `<AnexoB id="${esc(nifA)}">` +
    `<Quadro00/>` +
    quadro01 +
    `<Quadro02>${el("AnexoBq02C01", ano)}</Quadro02>` +
    quadro03 +
    quadro04 +
    quadro05 +
    quadro06 +
    quadrosRaros +
    `</AnexoB>`;
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
    partes.push(pass.AnexoE || buildAnexoEsqueleto("AnexoE", "AnexoE", model, ["04", "05"], true));
    partes.push(pass.AnexoG || buildAnexoEsqueleto("AnexoG", "AnexoG", model, Array.from({length: 16}, (_, i) => String(i + 4).padStart(2, "0")), true));
    partes.push(pass.AnexoG1 || buildAnexoEsqueleto("AnexoG1", "AnexoG1", model, ["04", "05", "06", "07", "08"], true));
    partes.push(pass.AnexoH || buildAnexoEsqueleto("AnexoH", "AnexoH", model, ["04", "05", "06", "07", "08", "09", "10"], true));
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
