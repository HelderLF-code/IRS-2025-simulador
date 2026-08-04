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
  const nomes = ["AnexoE", "AnexoG", "AnexoG1", "AnexoH", "AnexoJ", "AnexoL", "AnexoSS"];
  const passthrough = {};
  nomes.forEach(nome => {
    const el = filho(raiz, nome);
    if (el) passthrough[nome] = serializar(el);
  });
  return passthrough;
}

// Códigos dos quadros 4A/4B/4C do Anexo B, pela ordem em que aparecem no formulário em papel.
const ANEXOB_CODIGOS_4A = [401, 419, 420, 421, 402, 415, 416, 417, 403, 404, 422, 405, 406, 407, 408, 409, 418, 410, 411, 412, 413, 414];
const ANEXOB_CODIGOS_4B = [451, 452, 459, 453, 454, 455, 456, 457, 460, 458];
const ANEXOB_CODIGOS_4C = [481, 482];

function temConteudo(el) {
  return !!(el && Array.from(el.childNodes).some(n => n.nodeType === 1));
}

function parseAnexoB(anexoB) {
  if (!anexoB) return { anexoB: undefined, anexoBPassthrough: {}, anexoBTemDados: false };

  const q01 = filho(anexoB, "Quadro01");
  const q03 = filho(anexoB, "Quadro03");
  const q04 = filho(anexoB, "Quadro04");
  const q05 = filho(anexoB, "Quadro05");
  const q06 = filho(anexoB, "Quadro06");

  const b = {};

  if (temConteudo(q01)) {
    b.regimeSimplificado = !!texto(q01, "AnexoBq01B01");
    b.atoIsolado = !!texto(q01, "AnexoBq01B02");
    b.naturezaProfComInd = texto(q01, "AnexoBq01B03") === "true";
    b.naturezaAgricola = texto(q01, "AnexoBq01B04") === "true";
  }

  if (q03) {
    const camposSN = (tag) => { const v = texto(q03, tag); return v === undefined ? undefined : v === "S"; };
    b.herancaIndivisa = camposSN("AnexoBq03B03");
    b.nifTitular = texto(q03, "AnexoBq03C05");
    b.nifHerancaIndivisa = texto(q03, "AnexoBq03C06");
    b.codigoAtividade = texto(q03, "AnexoBq03C07");
    b.codigoCAEProf = texto(q03, "AnexoBq03C08");
    b.codigoCAEAgricola = texto(q03, "AnexoBq03C09");
    b.estabelecimentoEstavel = camposSN("AnexoBq03B10");
    b.exResidentesAno = texto(q03, "AnexoBq03C12");
    b.regime910Comunicacao = camposSN("AnexoBq03B13");
    b.regime910NifEstabelecimento = texto(q03, "AnexoBq03C15");
    b.regime910CodPais = texto(q03, "AnexoBq03C16");
    b.irsJovemAntigoAno = texto(q03, "AnexoBq03C17a");
    b.irsJovemAntigoNivel = texto(q03, "AnexoBq03C17b");
    b.irsJovemAntigoNif = texto(q03, "AnexoBq03C17c");
    b.irsJovemAntigoPais = texto(q03, "AnexoBq03C17d");
    b.irsJovemNovoOpcao = camposSN("AnexoBq03B18");
  }

  if (q04) {
    const rendimentos = [];
    [...ANEXOB_CODIGOS_4A, ...ANEXOB_CODIGOS_4B, ...ANEXOB_CODIGOS_4C].forEach(codigo => {
      const v = texto(q04, `AnexoBq04C${codigo}`);
      if (v !== undefined) rendimentos.push({ codigo, valor: v });
    });
    b.rendimentosBrutos = rendimentos;
  }

  if (temConteudo(q05)) {
    b.categoriaA = {
      unicaEntidade: texto(q05, "AnexoBq05B01") === "S",
      optaRegrasCategoriaA: texto(q05, "AnexoBq05B03") === "S"
    };
  }

  if (temConteudo(q06)) {
    b.retencoes = {
      rendimentosSujeitos: texto(q06, "AnexoBq06C601"),
      retencoesFonte: texto(q06, "AnexoBq06C602"),
      pagamentosPorConta: texto(q06, "AnexoBq06C603"),
      entidades: parseLinhasGenerico(filho(q06, "AnexoBq06T01")).map(l => ({ nif: l.NIF, valor: l.Valor }))
    };
  }

  const passthrough = {};
  for (let i = 7; i <= 18; i++) {
    const numero = String(i).padStart(2, "0");
    const elQ = filho(anexoB, `Quadro${numero}`);
    if (temConteudo(elQ)) passthrough[`Quadro${numero}`] = serializar(elQ);
  }

  // Sinal direto (a partir da estrutura do XML) de que há atividade real de Anexo B,
  // usado para decidir se se deve voltar a emitir os quadros 3B/5/6 ao reexportar
  // sem reduzir tudo a um "Não" implícito quando não há realmente nada preenchido.
  const anexoBTemDados = temConteudo(q01) || temConteudo(q04) || temConteudo(q05) || temConteudo(q06) ||
    Object.keys(passthrough).length > 0;

  return { anexoB: b, anexoBPassthrough: passthrough, anexoBTemDados };
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
  const anexoB = filho(raiz, "AnexoB");

  const { agregado, rostoPassthrough } = parseRosto(rosto);
  const { anexoA: anexoAModel, extrasAnexoA } = parseAnexoA(anexoA);
  const { anexoB: anexoBModel, anexoBPassthrough, anexoBTemDados } = parseAnexoB(anexoB);
  const anexosPassthrough = parseAnexosPassthrough(raiz);

  return {
    agregado,
    anexoA: anexoAModel,
    extrasAnexoA,
    anexoB: anexoBModel,
    anexoBPassthrough,
    anexoBTemDados,
    rostoPassthrough,
    anexosPassthrough
  };
}

const api = { parseModelo3XML };

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
} else {
  root.IRSXml = Object.assign(root.IRSXml || {}, api);
}

})(typeof window !== "undefined" ? window : globalThis);
