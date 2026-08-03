// Gerador do XML Modelo3IRSv2026, a partir do modelo de dados da aplicação.
// A estrutura foi obtida por engenharia inversa de 3 exemplos reais fornecidos pelo utilizador
// (um esqueleto vazio, um sujeito passivo único com Anexo A preenchido, e um casal com
// tributação conjunta + dependente com deficiência em guarda conjunta).
//
// Partes ainda não mapeadas (ficam com a estrutura "esqueleto" tal como observada nos exemplos,
// até serem fornecidos exemplos preenchidos): Rosto Quadro07/08/10/11/13, e os conteúdos dos
// Anexos B/E/G/G1/H/J/L/SS (apenas o cabeçalho ano+NIF é preenchido).

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
    `<Quadro07>${el("Rostoq07AT01")}${el("Rostoq07BT01")}${el("Rostoq07CT01")}</Quadro07>` +
    `<Quadro08/>` +
    `<Quadro09>${el("Q09C01", iban)}</Quadro09>` +
    `<Quadro10/>` +
    `<Quadro11/>` +
    `<Quadro13>${el("Rostoq13T01")}</Quadro13>` +
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

// AnexoB/J/L/SS têm atributo id=NIF e repetem-se por sujeito passivo quando ambos têm
// atividade/rendimentos próprios nesse anexo. Nesta fase ainda não temos exemplo preenchido
// nem confirmação de como fica o segundo anexo repetido, por isso emite-se apenas o esqueleto
// para o sujeito passivo A, tal como visto nos exemplos.
function buildAnexoB(model) {
  const { ano, nifA, nifB, tributacaoConjunta } = model.agregado;
  const campoC02 = tributacaoConjunta ? el("AnexoBq03C02", nifB) : "";
  return `<AnexoB id="${esc(nifA)}">` +
    `<Quadro00/><Quadro01/>` +
    `<Quadro02>${el("AnexoBq02C01", ano)}</Quadro02>` +
    `<Quadro03>${el("AnexoBq03C01", nifA)}${campoC02}${el("AnexoBq03B03", "N")}${el("AnexoBq03C05", nifA)}</Quadro03>` +
    Array.from({ length: 15 }, (_, i) => `<Quadro${String(i + 4).padStart(2, "0")}/>`).join("") +
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

export function buildModelo3XML(model) {
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
    partes.push(buildAnexoB(model));
    partes.push(buildAnexoEsqueleto("AnexoE", "AnexoE", model, ["04", "05"], true));
    partes.push(buildAnexoEsqueleto("AnexoG", "AnexoG", model, Array.from({length: 16}, (_, i) => String(i + 4).padStart(2, "0")), true));
    partes.push(buildAnexoEsqueleto("AnexoG1", "AnexoG1", model, ["04", "05", "06", "07", "08"], true));
    partes.push(buildAnexoEsqueleto("AnexoH", "AnexoH", model, ["04", "05", "06", "07", "08", "09", "10"], true));
    partes.push(buildAnexoJ(model));
    partes.push(buildAnexoL(model));
    partes.push(buildAnexoSS(model));
  }

  partes.push(`</Modelo3IRSv2026>`);
  return partes.join("\n");
}
