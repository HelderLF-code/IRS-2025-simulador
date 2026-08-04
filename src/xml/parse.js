// Importador: lê um ficheiro XML Modelo3IRSv2026 (tirado do Portal das Finanças) e
// devolve o modelo de dados usado pela aplicação, para continuar a preencher/editar
// a partir daí.
//
// Secções que a aplicação ainda não sabe editar (Anexos B/E/G/G1/H/J/L/SS, e os
// Quadros 07/08/10/11/13 do Rosto) são preservadas tal como vieram no ficheiro
// importado ("passthrough"), para que exportar de novo não perca dados que o
// utilizador não tocou.
//
// Ficheiro carregado como <script> normal (não módulo), tal como os restantes.

(function (root) {

function filhos(el, tag) {
  if (!el) return [];
  return Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.tagName === tag);
}

function filho(el, tag) {
  return filhos(el, tag)[0];
}

function texto(el, tag) {
  const f = filho(el, tag);
  return f ? f.textContent : undefined;
}

function serializar(el) {
  if (!el) return undefined;
  // O XMLSerializer repete o xmlns por defeito em cada elemento serializado
  // isoladamente; removê-lo porque já está declarado uma vez na raiz do documento.
  return new XMLSerializer().serializeToString(el)
    .replace(/ xmlns="http:\/\/www\.dgci\.gov\.pt\/2009\/Modelo3IRSv2026"/g, "");
}

// Lê um contentor tipo <AnexoAq04BT01><AnexoAq04BT01-Linha numero="1">...</...-Linha></...>
// e devolve um array de objetos simples {TagDoCampo: valor, ...} tal como aparecem no XML.
function parseLinhasGenerico(container) {
  if (!container) return [];
  const linhas = Array.from(container.childNodes).filter(n => n.nodeType === 1);
  return linhas.map(linha => {
    const obj = {};
    Array.from(linha.childNodes).filter(n => n.nodeType === 1).forEach(campo => {
      obj[campo.tagName] = campo.textContent;
    });
    return obj;
  });
}

function parseDependentes(quadro06) {
  const deficientes = parseLinhasGenerico(filho(quadro06, "Rostoq06BT01")).map(l => ({
    nif: l.NIF,
    deficienteGrau: l.DeficienteGrau ? Number(l.DeficienteGrau) : undefined,
    guardaConjunta: false
  }));

  const guardaConjunta = parseLinhasGenerico(filho(quadro06, "Rostoq06BT03")).map(l => ({
    nif: l.NIF,
    deficienteGrau: l.DeficienteGrau ? Number(l.DeficienteGrau) : undefined,
    guardaConjunta: true,
    respParentais: l.RespParentais,
    nifProgenitor: l.NifProgenitor,
    integraAgregadoSP: l.IntegraAgregadoSP === "true",
    partilhaDespesas: l.PartilhaDespesas,
    residenciaAlternada: l.ResidenciaAlternada === "S"
  }));

  return [...deficientes, ...guardaConjunta];
}

function parseRosto(rosto) {
  const q02 = filho(rosto, "Quadro02");
  const q03 = filho(rosto, "Quadro03");
  const q05 = filho(rosto, "Quadro05");
  const q06 = filho(rosto, "Quadro06");
  const q09 = filho(rosto, "Quadro09");

  const tributacaoConjunta = texto(q05, "Q05B01") === "S";

  const agregado = {
    ano: Number(texto(q02, "Q02C01")),
    nifA: texto(q03, "Q03C01"),
    nifB: tributacaoConjunta ? texto(q05, "Q05C03") : undefined,
    tributacaoConjunta,
    iban: texto(q09, "Q09C01"),
    dependentes: parseDependentes(q06)
  };

  // Guarda tal como veio, para não perder dados nos quadros que a app ainda não edita.
  const passthrough = {};
  ["Quadro07", "Quadro08", "Quadro10", "Quadro11", "Quadro13"].forEach(nome => {
    const el = filho(rosto, nome);
    if (el) passthrough[nome] = serializar(el);
  });

  return { agregado, rostoPassthrough: passthrough };
}

function parseAnexoA(anexoA) {
  if (!anexoA) return { anexoA: { linhas: [] }, extrasAnexoA: {} };
  const q04 = filho(anexoA, "Quadro04");

  const linhas = parseLinhasGenerico(filho(q04, "AnexoAq04AT01")).map(l => ({
    nifEntidade: l.NIF,
    codRendimento: l.CodRendimentos,
    titular: l.Titular,
    rendimentos: l.Rendimentos,
    retencoes: l.Retencoes,
    contribuicoes: l.Contribuicoes,
    retSobretaxa: l.RetSobretaxa,
    quotizacoes: l.Quotizacoes
  }));

  // Secções sem interface própria ainda: preservam-se tal como vieram, para reexportar sem perdas.
  const extras = {
    pagamentosPorConta: parseLinhasGenerico(filho(q04, "AnexoAq04BT01")),
    outrasDeducoes: parseLinhasGenerico(filho(q04, "AnexoAq04CT01")),
    segurosDesgasteRapido: parseLinhasGenerico(filho(q04, "AnexoAq04CT02")),
    incentivoParticipacoesSociais: parseLinhasGenerico(filho(q04, "AnexoAq04DT01")),
    incentivoStartups: parseLinhasGenerico(filho(q04, "AnexoAq04DT02")),
    exResidentes: parseLinhasGenerico(filho(q04, "AnexoAq04ET01")),
    irsJovemAntigo: parseLinhasGenerico(filho(q04, "AnexoAq04FT01")),
    irsJovem: parseLinhasGenerico(filho(q04, "AnexoAq04FT02")),
    estudantesDependentes: parseLinhasGenerico(filho(q04, "AnexoAq04GT01"))
  };
  // Remove listas vazias para não poluir o modelo.
  Object.keys(extras).forEach(k => { if (extras[k].length === 0) delete extras[k]; });

  return { anexoA: { linhas }, extrasAnexoA: extras };
}

function parseAnexosPassthrough(raiz) {
  const nomes = ["AnexoB", "AnexoE", "AnexoG", "AnexoG1", "AnexoH", "AnexoJ", "AnexoL", "AnexoSS"];
  const passthrough = {};
  nomes.forEach(nome => {
    const el = filho(raiz, nome);
    if (el) passthrough[nome] = serializar(el);
  });
  return passthrough;
}

function parseModelo3XML(xmlTexto) {
  const doc = new DOMParser().parseFromString(xmlTexto, "application/xml");
  const erro = doc.querySelector("parsererror");
  if (erro) {
    throw new Error("O ficheiro não parece ser um XML válido: " + erro.textContent.slice(0, 200));
  }

  const raiz = doc.documentElement;
  if (!raiz || raiz.tagName !== "Modelo3IRSv2026") {
    throw new Error("Este ficheiro não parece ser uma declaração Modelo 3 de IRS (Modelo3IRSv2026).");
  }

  const rosto = filho(raiz, "Rosto");
  const anexoA = filho(raiz, "AnexoA");

  const { agregado, rostoPassthrough } = parseRosto(rosto);
  const { anexoA: anexoAModel, extrasAnexoA } = parseAnexoA(anexoA);
  const anexosPassthrough = parseAnexosPassthrough(raiz);

  return { agregado, anexoA: anexoAModel, extrasAnexoA, rostoPassthrough, anexosPassthrough };
}

const api = { parseModelo3XML };

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
} else {
  root.IRSXml = Object.assign(root.IRSXml || {}, api);
}

})(typeof window !== "undefined" ? window : globalThis);
