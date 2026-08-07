// Importador: lê um ficheiro XML Modelo3IRSv2026 (tirado do Portal das Finanças) e
// devolve o modelo de dados usado pela aplicação, para continuar a preencher/editar
// a partir daí.
//
// Secções que a aplicação ainda não sabe editar (Anexos B/E/G/G1/H/J/L/SS, Quadro 07 e
// 08B/11/13 do Rosto) são preservadas tal como vieram no ficheiro importado
// ("passthrough"), para que exportar de novo não perca dados que o utilizador não tocou.
//
// Nomes de campo do Rosto confirmados contra um exemplo real (para referência futura, se
// se vier a construir interface própria para estes quadros):
//   Quadro07 — Rostoq07AT01 (ascendentes em comunhão de habitação, lista com NIF +
//     DeficienteGrau), Rostoq07BT01 (outros ascendentes/colaterais, mesma estrutura),
//     Rostoq07CT01 (crianças/jovens acolhidos, lista).
//   Quadro08B (não residentes) — Q08B04 (não residente, valor=4), Q08C06 (código do país,
//     tabela do Anexo J), Q08B07 (opta regras gerais não residentes, valor=7) — grupo
//     mutuamente exclusivo com Q08B08 (opta por regime alternativo, valor=8, não
//     confirmado); dentro desse: Q08B09 (taxas gerais art.º 68.º, valor=9) — mutuamente
//     exclusivo com Q08B10 (regras dos residentes art.º 17.º-A, valor=10, não
//     confirmado); Q08C11 (total rendimentos no estrangeiro, decimal); Q08C13/Q08C14
//     (residência fiscal parcial — datas de início/fim, AAAA-MM-DD).
//   Quadro11 (consignação IRS/IVA) — Q11B01 (entidade escolhida: valor 1=código 1101,
//     2=código 1102, 3=código 1103, 4=código 1104 — não totalmente confirmado, só se viu
//     o valor 2), Q11B01a (booleano — provavelmente corresponde à checkbox "IRS"; a
//     checkbox "IVA" e o NIF da entidade não apareceram preenchidos no exemplo).
//   Quadro13 (prazos especiais) — Q13B01 (motivo do prazo especial: valor 1/2/3/5/7
//     conforme o campo do papel assinalado — grupo mutuamente exclusivo; campo 04 é a
//     data do facto, campo06 é a lista Rostoq13T01), Q13C04 (data do facto, AAAA-MM-DD).
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

const RESIDENCIA_FISCAL_POR_COD = { "1": "continente", "2": "acores", "3": "madeira" };
const NATUREZA_DECLARACAO_POR_COD = { "1": "primeira", "2": "substituicao" };
const ASSOCIAR_IBAN_NIF_POR_COD = { "S": "sim", "N": "nao" };

function parseRosto(rosto) {
  const q02 = filho(rosto, "Quadro02");
  const q03 = filho(rosto, "Quadro03");
  const q05 = filho(rosto, "Quadro05");
  const q06 = filho(rosto, "Quadro06");
  const q08 = filho(rosto, "Quadro08");
  const q09 = filho(rosto, "Quadro09");
  const q10 = filho(rosto, "Quadro10");

  const tributacaoConjunta = texto(q05, "Q05B01") === "S";

  const agregado = {
    ano: Number(texto(q02, "Q02C01")),
    nifA: texto(q03, "Q03C01"),
    nifB: tributacaoConjunta ? texto(q05, "Q05C03") : undefined,
    tributacaoConjunta,
    iban: texto(q09, "Q09C01"),
    // Ver nota em build.js: nomes de campo Q08B01/Q10B01 ainda não confirmados contra um
    // exemplo real. Se não reconhecido (ficheiro de outra origem, não residente, etc.),
    // fica undefined e o quadro original é preservado tal como veio (passthrough abaixo).
    residenciaFiscal: RESIDENCIA_FISCAL_POR_COD[texto(q08, "Q08B01")],
    naturezaDeclaracao: NATUREZA_DECLARACAO_POR_COD[texto(q10, "Q10B01")],
    associarIbanNif: ASSOCIAR_IBAN_NIF_POR_COD[texto(q09, "Q09B01")],
    dependentes: parseDependentes(q06)
  };

  // Guarda tal como veio, para não perder dados nos quadros que a app ainda não edita
  // (ou não reconhece, no caso do Quadro08/10 — ver nota acima). Só se guarda passthrough
  // quando o quadro tem mesmo conteúdo (elementos filhos) — um quadro vazio
  // (<Quadro08/>) não é guardado, para que os campos reconhecidos (Q08B01/Q10B01) e
  // editáveis na interface continuem a poder gerar o quadro a partir do zero.
  const passthrough = {};
  ["Quadro07", "Quadro08", "Quadro10", "Quadro11", "Quadro13"].forEach(nome => {
    const el = filho(rosto, nome);
    if (el && Array.from(el.childNodes).some(n => n.nodeType === 1)) {
      passthrough[nome] = serializar(el);
    }
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
  const nomes = ["AnexoG1", "AnexoJ", "AnexoL", "AnexoSS"];
  const passthrough = {};
  nomes.forEach(nome => {
    const el = filho(raiz, nome);
    if (el) passthrough[nome] = serializar(el);
  });
  return passthrough;
}

// Anexo G, Quadro 4 (alienação onerosa de imóveis): nomes de campo confirmados contra um
// exemplo real. Os restantes quadros (5-19: reinvestimento em habitação própria, partes
// sociais, criptoativos, etc.) ficam em passthrough (model.anexoGPassthrough).
function parseQuadro04AnexoG(q04) {
  if (!temConteudo(q04)) return undefined;
  return {
    imoveis: parseLinhasGenerico(filho(q04, "AnexoGq04T01")).map(l => ({
      nlinha: l.NLinha, titular: l.Titular,
      anoRealizacao: l.AnoRealizacao, mesRealizacao: l.MesRealizacao, diaRealizacao: l.DiaRealizacao,
      valorRealizacao: l.ValorRealizacao,
      anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, diaAquisicao: l.DiaAquisicao,
      valorAquisicao: l.ValorAquisicao, despesasEncargos: l.DespesasEncargos,
      freguesia: l.Freguesia, tipoPredio: l.TipoPredio, artigo: l.Artigo, fraccao: l.Fraccao, quotaParte: l.QuotaParte
    })),
    reabilitacao: parseLinhasGenerico(filho(q04, "AnexoGq04AT01")).map(l => ({
      campoQ4: l.CamposQuadro4, anoConclusao: l.AnoConclusao, mesConclusao: l.MesConclusao, diaConclusao: l.DiaConclusao
    })),
    afetacaoB1: parseLinhasGenerico(filho(q04, "AnexoGq04BT01")).map(l => ({
      titular: l.Titular, naturezaBens: l.NaturezaBens, anoAfetacao: l.AnoAfectacao, mesAfetacao: l.MesAfectacao,
      valorAfetacao: l.ValorAfetacao, anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao,
      valorAquisicao: l.ValorAquisicao, despesasEncargos: l.DespesasEncargos, freguesia: l.Freguesia, tipoPredio: l.TipoPredio
    })),
    afetacaoB2: parseLinhasGenerico(filho(q04, "AnexoGq04BT02")).map(l => ({
      titular: l.Titular, anoAfetacao: l.AnoAfetacao, mesAfetacao: l.MesAfetacao, valorAfetacao: l.ValorAfetacao,
      anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, valorAquisicao: l.ValorAquisicao
    })),
    afetacaoB3: parseLinhasGenerico(filho(q04, "AnexoGq04BT03")).map(l => ({
      titular: l.Titular, anoAfetacao: l.AnoAfetacao, mesAfetacao: l.MesAfetacao, valorAfetacao: l.ValorAfetacao,
      anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, valorAquisicao: l.ValorAquisicao,
      despesasEncargos: l.DespesasEncargos, freguesia: l.Freguesia, tipoPredio: l.TipoPredio,
      artigo: l.Artigo, fracao: l.Fracao, quotaParte: l.QuotaParte
    })),
    alienacaoEGF: parseLinhasGenerico(filho(q04, "AnexoGq04CT01")).map(l => ({ campoQ4: l.CamposQuadro4, nif: l.NIF })),
    apoioNaoReembolsavel: parseLinhasGenerico(filho(q04, "AnexoGq04DT01")).map(l => ({
      campoQ4: l.CamposQuadro4, finalidade: l.Finalidade, anoApoio: l.AnoApoio, mesApoio: l.MesApoio,
      valorApoio: l.ValorApoio, valorPatrimonialTributario: l.ValorPatrimonialTributario
    })),
    afetosAtividade3anos: parseLinhasGenerico(filho(q04, "AnexoGq04ET01")).map(l => ({
      titular: l.Titular, anoTransferencia: l.AnoTransferencia, mesTransferencia: l.MesTransferencia, diaTransferencia: l.DiaTransferencia,
      anoRealizacao: l.AnoRealizacao, mesRealizacao: l.MesRealizacao, diaRealizacao: l.DiaRealizacao, valorRealizacao: l.ValorRealizacao,
      anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, diaAquisicao: l.DiaAquisicao, valorAquisicao: l.ValorAquisicao,
      freguesia: l.Freguesia, tipoPredio: l.TipoPredio, artigo: l.Artigo, fracao: l.Fracao, quotaParte: l.QuotaParte
    })),
    alienacaoEstado: parseLinhasGenerico(filho(q04, "AnexoGq04FT01")).map(l => ({ campoQ4: l.CamposQuadro4, nifAdquirente: l.NIFAdquirente }))
  };
}

// Ver nota em build.js: nomes de campo do Quadro05 confirmados contra um exemplo real.
function parseReinvestimentoAnexoG(q05, camposNumeros) {
  const [cAno, cCamposQ4, cEmprestimo, cSemCredito, cSeguro, c24MesesAntes, cMais24Suspensao,
    cAnoAlienacao, cAnoSeguinte, cSegundoAno, cTerceiroAno, cApos36Suspensao, cSeguroAno, cSeguroAnoSeguinte] = camposNumeros;
  return {
    ano: texto(q05, `AnexoGq05C${cAno}`),
    camposQ4: parseLinhasGenerico(filho(q05, `AnexoGq05AT0${cCamposQ4}`)).map(l => l.CamposQuadro4),
    valorEmprestimoDivida: texto(q05, `AnexoGq05C${cEmprestimo}`),
    valorReinvestirSemCredito: texto(q05, `AnexoGq05C${cSemCredito}`),
    valorReinvestirSeguro: texto(q05, `AnexoGq05C${cSeguro}`),
    reinvestido24MesesAntes: texto(q05, `AnexoGq05C${c24MesesAntes}`),
    reinvestidoMais24MesesAntesSuspensao: texto(q05, `AnexoGq05C${cMais24Suspensao}`),
    reinvestidoAnoAlienacao: texto(q05, `AnexoGq05C${cAnoAlienacao}`),
    reinvestidoAnoSeguinte: texto(q05, `AnexoGq05C${cAnoSeguinte}`),
    reinvestidoSegundoAnoSeguinte: texto(q05, `AnexoGq05C${cSegundoAno}`),
    reinvestidoTerceiroAnoSeguinte: texto(q05, `AnexoGq05C${cTerceiroAno}`),
    reinvestidoApos36MesesSuspensao: texto(q05, `AnexoGq05C${cApos36Suspensao}`),
    reinvestidoSeguroAnoAlienacao: texto(q05, `AnexoGq05C${cSeguroAno}`),
    reinvestidoSeguroAnoSeguinte: texto(q05, `AnexoGq05C${cSeguroAnoSeguinte}`)
  };
}

function parseQuadro05AnexoG(q05) {
  if (!temConteudo(q05)) return undefined;
  return {
    reinvestimento1: {
      ...parseReinvestimentoAnexoG(q05, [5001, 1, 5005, 5006, 5012, 5007, 5015, 5008, 5009, 5010, 5011, 5016, 5013, 5014]),
      identificacao: {
        freguesia: texto(q05, "AnexoGq05AC1"), tipo: texto(q05, "AnexoGq05AC2"),
        artigo: texto(q05, "AnexoGq05AC3"), fracao: texto(q05, "AnexoGq05AC4"), quotaParte: texto(q05, "AnexoGq05AC5")
      }
    },
    reinvestimento2: {
      ...parseReinvestimentoAnexoG(q05, [5021, 2, 5025, 5026, 5036, 5027, 5039, 5028, 5029, 5030, 5031, 5040, 5037, 5038]),
      identificacao: {
        freguesia: texto(q05, "AnexoGq05AC6"), tipo: texto(q05, "AnexoGq05AC7"),
        artigo: texto(q05, "AnexoGq05AC8"), fracao: texto(q05, "AnexoGq05AC9"), quotaParte: texto(q05, "AnexoGq05AC10")
      }
    },
    contratosSeguroFundo: parseLinhasGenerico(filho(q05, "AnexoGq05A2T01")).map(l => ({
      campoQ5A: l.CamposQuadro5A, titular: l.Titular, codigo: l.Codigo, ano: l.Ano, mes: l.Mes, valor: l.Valor,
      nifPortugues: l.NifPortugues, pais: l.Pais, numeroFiscalUE: l.NumeroFiscalUE, beneficiario: l.Beneficiario
    })),
    amortizacaoEmprestimo: {
      campoQ4: texto(q05, "AnexoGq05C5032"), anoEmprestimo: texto(q05, "AnexoGq05C5033"),
      valorCapitalDivida: texto(q05, "AnexoGq05C5034"), valorAmortizacao: texto(q05, "AnexoGq05C5035")
    }
  };
}

// Anexo G, Quadro 9 (alienação onerosa de partes sociais e outros valores mobiliários).
function parseQuadro09AnexoG(q09) {
  const listaCampoNif = container => parseLinhasGenerico(filho(q09, container)).map(l => ({ campoQ9: l.CampoQ9, nif: l.NIF }));
  return {
    linhas: parseLinhasGenerico(filho(q09, "AnexoGq09T01")).map(l => ({
      nlinha: l.NLinha, titular: l.Titular, nif: l.NIF, codigo: l.CodEncargos,
      anoRealizacao: l.AnoRealizacao, mesRealizacao: l.MesRealizacao, diaRealizacao: l.DiaRealizacao, valorRealizacao: l.ValorRealizacao,
      anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, diaAquisicao: l.DiaAquisicao, valorAquisicao: l.ValorAquisicao,
      despesasEncargos: l.DespesasEncargos, paisContraparte: l.PaisContraparte,
      respeitaValoresMobiliarios: l.RespeitaValoresMobiliarios === undefined ? undefined : l.RespeitaValoresMobiliarios === "S"
    })),
    microPequenas: listaCampoNif("AnexoGq09AT01"),
    neutralidadeFiscal: listaCampoNif("AnexoGq09BT01"),
    permutaFusaoCisao: parseLinhasGenerico(filho(q09, "AnexoGq09CT01")).map(l => ({
      titular: l.Titular, nifEntidade: l.NIFEntidade, ano: l.Ano, mes: l.Mes, valor: l.Valor
    })),
    recapitalizacao: parseLinhasGenerico(filho(q09, "AnexoGq09DT01")).map(l => ({ campoQ9: l.CampoQ9, nif: l.NIF, participacao: l.Participacao })),
    egfUgf: listaCampoNif("AnexoGq09ET01")
  };
}

// Anexo G, Quadro 11 (organismos de investimento alternativo imobiliário).
function parseQuadro11AnexoG(q11) {
  return {
    grupoA: parseLinhasGenerico(filho(q11, "AnexoGq11AT01")).map(l => ({
      titular: l.Titular, nifEntidadeEmitente: l.NIFEntidadeEmitente, codigo: l.Codigo,
      anoRealizacao: l.AnoRealizacao, mesRealizacao: l.MesRealizacao, diaRealizacao: l.DiaRealizacao, valorRealizacao: l.ValorRealizacao,
      anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, diaAquisicao: l.DiaAquisicao, valorAquisicao: l.ValorAquisicao,
      despesasEncargos: l.DespesasEncargos
    })),
    grupoB: parseLinhasGenerico(filho(q11, "AnexoGq11BT01")).map(l => ({
      titular: l.Titular, nifEntidadeEmitente: l.NIFEntidadeEmitente, codigo: l.Codigo,
      rendimento: l.Rendimento, retencoesFonte: l.RetencoesFonte, nifEntidadeRetentora: l.NIFEntidadeRetentora
    }))
  };
}

// Anexo G, Quadro 12 (perda da qualidade de residente em território português).
function parseQuadro12AnexoG(q12) {
  const bool = tag => texto(q12, tag) !== undefined ? texto(q12, tag) === "S" : undefined;
  return {
    permutaPartesSociais: bool("AnexoGq12B01"),
    fusaoOuCisao: bool("AnexoGq12B03"),
    entradaPatrimonio: bool("AnexoGq12B05"),
    decorridos5Anos: bool("AnexoGq12B07"),
    partesSociais: parseLinhasGenerico(filho(q12, "AnexoGq12BT01")).map(l => ({
      titular: l.Titular, nifEntidadeEmitente: l.NIFEntidadeEmitente, numeroTitulos: l.NTitulos, capitalSocial: l.CapitalSocial,
      anoRealizacao: l.AnoRealizacao, mesRealizacao: l.MesRealizacao, valorRealizacao: l.ValorRealizacao,
      anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, valorAquisicao: l.ValorAquisicao, despesasEncargos: l.DespesasEncargos
    })),
    paisTransferenciaUE: texto(q12, "AnexoGq12C09"),
    paisTransferenciaOutro: texto(q12, "AnexoGq12C10"),
    modalidadePagamento: texto(q12, "AnexoGq12B11")
  };
}

// Anexo G, Quadro 14 (outros incrementos patrimoniais).
function parseQuadro14AnexoG(q14) {
  return {
    linhas: parseLinhasGenerico(filho(q14, "AnexoGq14T01")).map(l => ({
      nlinha: l.NLinha, codigoOperacao: l.CodigoOperacao, titular: l.Titular,
      rendimento: l.Rendimento, retencoes: l.Retencoes, nifEntidadeRetentora: l.NIFEntidadeRetentora
    })),
    anosAnteriores1: parseLinhasGenerico(filho(q14, "AnexoGq14AT01")).map(l => ({
      quadro: l.Quadro, nlinha: l.NLinha, anoRendimentos: l.AnoRendimentos, rendimento: l.Rendimento, nanos: l.Nanos
    })),
    anosAnteriores2: parseLinhasGenerico(filho(q14, "AnexoGq14AT02")).map(l => ({
      quadro: l.Quadro, nlinha: l.NLinha, anoRendimentos: l.AnoRendimentos, rendimento: l.Rendimento, retencoes: l.Retencoes
    }))
  };
}

// Anexo G, Quadro 6 (alienação onerosa da propriedade intelectual).
function parseQuadro06AnexoG(q06) {
  return parseLinhasGenerico(filho(q06, "AnexoGq06T01")).map(l => ({
    titular: l.Titular, valorRealizacao: l.ValorRealizacao, valorAquisicao: l.ValorAquisicao, despesasEncargos: l.DespesasEncargos
  }));
}

// Anexo G, Quadro 7 (cessão onerosa de posições contratuais/estruturas fiduciárias).
function parseQuadro07AnexoG(q07) {
  return parseLinhasGenerico(filho(q07, "AnexoGq07T01")).map(l => ({
    titular: l.Titular, codOperacao: l.CodOperacao, valorRealizacao: l.ValorRealizacao, valorAquisicao: l.ValorAquisicao
  }));
}

// Anexo G, Quadro 8 (cessão onerosa de créditos, prestações acessórias e suplementares).
function parseQuadro08AnexoG(q08) {
  return parseLinhasGenerico(filho(q08, "AnexoGq08T01")).map(l => ({
    titular: l.Titular, importanciaRecebida: l.ImportanciaRecebida, valor: l.Valor
  }));
}

// Anexo G, Quadro 10 (organismos de investimento coletivo — resgate/liquidação, opção pelo englobamento).
function parseQuadro10AnexoG(q10) {
  return parseLinhasGenerico(filho(q10, "AnexoGq10T01")).map(l => ({
    titular: l.Titular, nifEntidadeEmitente: l.NIFEntidadeEmitente, codigo: l.Codigo,
    rendimento: l.Rendimento, retencoesFonte: l.RetencoesFonte, nifEntidadeRetentora: l.NIFEntidadeRetentora
  }));
}

// Anexo G, Quadro 13 (instrumentos financeiros derivados, warrants autónomos e certificados).
function parseQuadro13AnexoG(q13) {
  return parseLinhasGenerico(filho(q13, "AnexoGq13T01")).map(l => ({
    codigoOperacao: l.CodigoOperacao, titular: l.Titular, rendimentoLiquido: l.RendimentoLiquido, paisContraparte: l.PaisContraparte
  }));
}

// Anexo G, Quadro 16 (pagamentos por conta).
function parseQuadro16AnexoG(q16) {
  return parseLinhasGenerico(filho(q16, "AnexoGq16T01")).map(l => ({ titular: l.Titular, valor: l.Valor }));
}

// Anexo G, Quadro 18 (alienação onerosa de criptoativos que não constituam valores mobiliários).
function parseGrupoQuadro18AnexoG(container) {
  return parseLinhasGenerico(container).map(l => ({
    nlinha: l.NLinha, titular: l.Titular, nifPortugues: l.NIFPortugues, codPaisEntGestora: l.CodPaisEntGestora,
    anoRealizacao: l.AnoRealizacao, mesRealizacao: l.MesRealizacao, diaRealizacao: l.DiaRealizacao, valorRealizacao: l.ValorRealizacao,
    anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, diaAquisicao: l.DiaAquisicao, valorAquisicao: l.ValorAquisicao,
    despesasEncargos: l.DespesasEncargos, codPaisContraparte: l.CodPaisContraparte
  }));
}

function parseQuadro18AnexoG(q18) {
  return {
    grupoA: parseGrupoQuadro18AnexoG(filho(q18, "AnexoGq18AT01")),
    grupoB: parseGrupoQuadro18AnexoG(filho(q18, "AnexoGq18BT01"))
  };
}

// Anexo G, Quadro 19 (transmissão onerosa de terrenos/imóveis habitacionais não destinados
// a HPP — amortização de crédito à habitação, Lei n.º 56/2023).
function parseQuadro19AnexoG(q19) {
  return parseLinhasGenerico(filho(q19, "AnexoGq19T01")).map(l => ({
    nlinha: l.NLinha, campoQ4: l.CamposQuadro4, valorAmortEmprestimo: l.ValorAmortEmprestimo,
    titular: l.Titular, nifDescendente: l.NIFDescendente, valorAmortizacao: l.ValorAmortizacao,
    anoAmortizacao: l.AnoAmortizacao, mesAmortizacao: l.MesAmortizacao, diaAmortizacao: l.DiaAmortizacao,
    freguesia: l.Freguesia, tipoPredio: l.TipoPredio, artigo: l.Artigo, fraccao: l.Fraccao, quotaParte: l.QuotaParte
  }));
}

function temDadosQuadro09AnexoGParse(q) {
  return !!(q.linhas.length || q.microPequenas.length || q.neutralidadeFiscal.length ||
    q.permutaFusaoCisao.length || q.recapitalizacao.length || q.egfUgf.length);
}

function temDadosQuadro11AnexoGParse(q) {
  return !!(q.grupoA.length || q.grupoB.length);
}

function temDadosQuadro12AnexoGParse(q) {
  return q.permutaPartesSociais !== undefined || q.fusaoOuCisao !== undefined ||
    q.entradaPatrimonio !== undefined || q.decorridos5Anos !== undefined || q.partesSociais.length > 0 ||
    q.paisTransferenciaUE !== undefined || q.paisTransferenciaOutro !== undefined || q.modalidadePagamento !== undefined;
}

function temDadosQuadro14AnexoGParse(q) {
  return !!(q.linhas.length || q.anosAnteriores1.length || q.anosAnteriores2.length);
}

function parseAnexoG(anexoG) {
  if (!anexoG) return { anexoG: undefined, anexoGPassthrough: {} };
  const q04 = filho(anexoG, "Quadro04");
  const q05 = filho(anexoG, "Quadro05");
  const q06 = filho(anexoG, "Quadro06");
  const q07 = filho(anexoG, "Quadro07");
  const q08 = filho(anexoG, "Quadro08");
  const q09 = filho(anexoG, "Quadro09");
  const q10 = filho(anexoG, "Quadro10");
  const q11 = filho(anexoG, "Quadro11");
  const q12 = filho(anexoG, "Quadro12");
  const q13 = filho(anexoG, "Quadro13");
  const q14 = filho(anexoG, "Quadro14");
  const q15 = filho(anexoG, "Quadro15");
  const q16 = filho(anexoG, "Quadro16");
  const q17 = filho(anexoG, "Quadro17");
  const q18 = filho(anexoG, "Quadro18");
  const q19 = filho(anexoG, "Quadro19");
  const quadro04 = parseQuadro04AnexoG(q04);
  const quadro05 = parseQuadro05AnexoG(q05);
  const quadro06 = temConteudo(q06) ? parseQuadro06AnexoG(q06) : undefined;
  const quadro07 = temConteudo(q07) ? parseQuadro07AnexoG(q07) : undefined;
  const quadro08 = temConteudo(q08) ? parseQuadro08AnexoG(q08) : undefined;
  const quadro09 = temConteudo(q09) ? parseQuadro09AnexoG(q09) : undefined;
  const quadro10 = temConteudo(q10) ? parseQuadro10AnexoG(q10) : undefined;
  const quadro11 = temConteudo(q11) ? parseQuadro11AnexoG(q11) : undefined;
  const quadro12 = temConteudo(q12) ? parseQuadro12AnexoG(q12) : undefined;
  const quadro13 = temConteudo(q13) ? parseQuadro13AnexoG(q13) : undefined;
  const quadro14 = temConteudo(q14) ? parseQuadro14AnexoG(q14) : undefined;
  const quadro15OptaEnglobamento = texto(q15, "AnexoGq15B01") !== undefined ? texto(q15, "AnexoGq15B01") === "S" : undefined;
  const quadro16 = temConteudo(q16) ? parseQuadro16AnexoG(q16) : undefined;
  const quadro17TotalEstrangeiro = texto(q17, "AnexoGq17C01");
  const quadro18 = temConteudo(q18) ? parseQuadro18AnexoG(q18) : undefined;
  const quadro19 = temConteudo(q19) ? parseQuadro19AnexoG(q19) : undefined;

  const passthrough = {};
  if (temConteudo(q06) && !(quadro06 && quadro06.length)) passthrough.Quadro06 = serializar(q06);
  if (temConteudo(q07) && !(quadro07 && quadro07.length)) passthrough.Quadro07 = serializar(q07);
  if (temConteudo(q08) && !(quadro08 && quadro08.length)) passthrough.Quadro08 = serializar(q08);
  if (temConteudo(q09) && !(quadro09 && temDadosQuadro09AnexoGParse(quadro09))) passthrough.Quadro09 = serializar(q09);
  if (temConteudo(q10) && !(quadro10 && quadro10.length)) passthrough.Quadro10 = serializar(q10);
  if (temConteudo(q11) && !(quadro11 && temDadosQuadro11AnexoGParse(quadro11))) passthrough.Quadro11 = serializar(q11);
  if (temConteudo(q12) && !(quadro12 && temDadosQuadro12AnexoGParse(quadro12))) passthrough.Quadro12 = serializar(q12);
  if (temConteudo(q13) && !(quadro13 && quadro13.length)) passthrough.Quadro13 = serializar(q13);
  if (temConteudo(q14) && !(quadro14 && temDadosQuadro14AnexoGParse(quadro14))) passthrough.Quadro14 = serializar(q14);
  if (temConteudo(q15) && quadro15OptaEnglobamento === undefined) passthrough.Quadro15 = serializar(q15);
  if (temConteudo(q16) && !(quadro16 && quadro16.length)) passthrough.Quadro16 = serializar(q16);
  if (temConteudo(q17) && quadro17TotalEstrangeiro === undefined) passthrough.Quadro17 = serializar(q17);
  if (temConteudo(q18) && !(quadro18 && (quadro18.grupoA.length || quadro18.grupoB.length))) passthrough.Quadro18 = serializar(q18);
  if (temConteudo(q19) && !(quadro19 && quadro19.length)) passthrough.Quadro19 = serializar(q19);

  const anexoGModel = (quadro04 || quadro05 || (quadro06 && quadro06.length) || (quadro07 && quadro07.length) ||
    (quadro08 && quadro08.length) || (quadro09 && temDadosQuadro09AnexoGParse(quadro09)) || (quadro10 && quadro10.length) ||
    (quadro11 && temDadosQuadro11AnexoGParse(quadro11)) || (quadro12 && temDadosQuadro12AnexoGParse(quadro12)) ||
    (quadro13 && quadro13.length) || (quadro14 && temDadosQuadro14AnexoGParse(quadro14)) ||
    quadro15OptaEnglobamento !== undefined || (quadro16 && quadro16.length) || quadro17TotalEstrangeiro !== undefined ||
    (quadro18 && (quadro18.grupoA.length || quadro18.grupoB.length)) || (quadro19 && quadro19.length)) ? {} : undefined;
  if (anexoGModel) {
    if (quadro04) anexoGModel.quadro04 = quadro04;
    if (quadro05) anexoGModel.quadro05 = quadro05;
    if (quadro06 && quadro06.length) anexoGModel.quadro06 = quadro06;
    if (quadro07 && quadro07.length) anexoGModel.quadro07 = quadro07;
    if (quadro08 && quadro08.length) anexoGModel.quadro08 = quadro08;
    if (quadro09 && temDadosQuadro09AnexoGParse(quadro09)) anexoGModel.quadro09 = quadro09;
    if (quadro10 && quadro10.length) anexoGModel.quadro10 = quadro10;
    if (quadro11 && temDadosQuadro11AnexoGParse(quadro11)) anexoGModel.quadro11 = quadro11;
    if (quadro12 && temDadosQuadro12AnexoGParse(quadro12)) anexoGModel.quadro12 = quadro12;
    if (quadro13 && quadro13.length) anexoGModel.quadro13 = quadro13;
    if (quadro14 && temDadosQuadro14AnexoGParse(quadro14)) anexoGModel.quadro14 = quadro14;
    if (quadro15OptaEnglobamento !== undefined) anexoGModel.quadro15OptaEnglobamento = quadro15OptaEnglobamento;
    if (quadro16 && quadro16.length) anexoGModel.quadro16 = quadro16;
    if (quadro17TotalEstrangeiro !== undefined) anexoGModel.quadro17TotalEstrangeiro = quadro17TotalEstrangeiro;
    if (quadro18 && (quadro18.grupoA.length || quadro18.grupoB.length)) anexoGModel.quadro18 = quadro18;
    if (quadro19 && quadro19.length) anexoGModel.quadro19 = quadro19;
  }

  return { anexoG: anexoGModel, anexoGPassthrough: passthrough };
}

// Anexo E (rendimentos de capitais): nomes de campo confirmados contra um exemplo real.
function parseAnexoE(anexoE) {
  if (!anexoE) return { anexoE: undefined };

  const q04 = filho(anexoE, "Quadro04");
  const q05 = filho(anexoE, "Quadro05");

  const e = {};
  e.rendimentosTaxasEspeciais = parseLinhasGenerico(filho(q04, "AnexoEq04AT01")).map(l => ({
    nlinha: l.NLinha, nif: l.NIF, codigo: l.CodRendimentos, titular: l.Titular, rendimento: l.Rendimentos
  }));
  e.optaEnglobamento = texto(q04, "AnexoEq04B01") === "S";
  e.rendimentosTaxasLiberatorias = parseLinhasGenerico(filho(q04, "AnexoEq04BT01")).map(l => ({
    nlinha: l.NLinha, nif: l.NIF, codigo: l.CodRendimentos, titular: l.Titular, rendimento: l.Rendimentos, retencao: l.Retencoes
  }));

  e.rendimentosAnosAnteriores5A = parseLinhasGenerico(filho(q05, "AnexoEq05AT01")).map(l => ({
    quadro: l.Quadro, nlinha: l.NLinha, anoRendimentos: l.AnoRendimentos, rendimento: l.Rendimento, nanos: l.Nanos
  }));
  e.rendimentosAnosAnteriores5B = parseLinhasGenerico(filho(q05, "AnexoEq05BT01")).map(l => ({
    quadro: l.Quadro, nlinha: l.NLinha, anoRendimentos: l.AnoRendimentos, rendimento: l.Rendimento, retencoesFonte: l.RetencoesFonte
  }));

  return { anexoE: e };
}

// Códigos dos quadros 4A/4B/4C do Anexo B, pela ordem em que aparecem no formulário em papel.
const ANEXOB_CODIGOS_4A = [401, 419, 420, 421, 402, 415, 416, 417, 403, 404, 422, 405, 406, 407, 408, 409, 418, 410, 411, 412, 413, 414];
const ANEXOB_CODIGOS_4B = [451, 452, 459, 453, 454, 455, 456, 457, 460, 458];
const ANEXOB_CODIGOS_4C = [481, 482];

function temConteudo(el) {
  return !!(el && Array.from(el.childNodes).some(n => n.nodeType === 1));
}

const ANEXOB_Q07_TODOS = [701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722];

// Ver nota em build.js: nomes de campo do Quadro07 e Quadro17A/17B confirmados contra um
// exemplo real; Quadro17C (campos 17051-17054) e 17D extrapolados do mesmo padrão, por
// confirmar.
function parseQuadro07(q07) {
  if (!temConteudo(q07)) return undefined;
  const despesas = {};
  ANEXOB_Q07_TODOS.forEach(c => {
    const v = texto(q07, `AnexoBq07C${c}`);
    if (v !== undefined) despesas[c] = v;
  });
  return {
    despesas,
    entidadesSS: parseLinhasGenerico(filho(q07, "AnexoBq07BT01")).map(l => ({ nif: l.NIFEntidades, valor: l.Valor })),
    segurosDesgasteRapido: parseLinhasGenerico(filho(q07, "AnexoBq07CT01")).map(l => ({
      profissaoCodigo: l.ProfissaoCodigo, valor: l.Valor, nifPortugues: l.NIFPortugues, pais: l.Pais, numeroFiscalUE: l.NumeroFiscalUE
    })),
    prediosArt41: parseLinhasGenerico(filho(q07, "AnexoBq07DT01")).map(l => ({
      freguesia: l.Freguesia, tipo: l.Tipo, artigo: l.Artigo, fraccao: l.Fraccao, quotaParte: l.QuotaParte,
      valorPCI: l.ValorRendimentoPCI, valorASP: l.ValorRendimentoASP
    })),
    anosSilvicolasPlurianual: texto(q07, "AnexoBq07C781")
  };
}

function parseQuadro17(q17) {
  if (!temConteudo(q17)) return undefined;
  return {
    contribuicoesSS: texto(q17, "AnexoBq17C17001"),
    importacoesIntracomunitarias: texto(q17, "AnexoBq17C17002"),
    entidadesSS: parseLinhasGenerico(filho(q17, "AnexoBq17BT01")).map(l => ({ nif: l.NIF, valor: l.Valor })),
    optaDespesasAlternativa: texto(q17, "AnexoBq17B01") === "S",
    despesasPessoal: texto(q17, "AnexoBq17C17051"),
    rendasImoveis: texto(q17, "AnexoBq17C17052"),
    outrasDespesasParcial: texto(q17, "AnexoBq17C17053"),
    outrasDespesasTotal: texto(q17, "AnexoBq17C17054"),
    rendasImoveisAfetas: parseLinhasGenerico(filho(q17, "AnexoBq17DT01")).map(l => ({
      nif: l.NIF, valor: l.Valor, afetacaoParcial: l.AfetacaoParcial === "true", afetacaoTotal: l.AfetacaoTotal === "true"
    }))
  };
}

function parseQuadro08AnexoB(q08) {
  if (!temConteudo(q08)) return undefined;
  return {
    houveAlienacaoImoveis: texto(q08, "AnexoBq08B01") === "S",
    houveAfetacaoImoveis: texto(q08, "AnexoBq08B03") === "S",
    imoveisAlienados: parseLinhasGenerico(filho(q08, "AnexoBq08AT01")).map(l => ({
      freguesia: l.Freguesia, tipo: l.Tipo, artigo: l.Artigo, fraccao: l.Fraccao, quotaParte: l.QuotaParte,
      codigo: l.Codigo, ano: l.AnoVendaDesafetacaoAfetacao, mes: l.MesVendaDesafetacaoAfetacao,
      dia: l.DiaVendaDesafetacaoAfetacao, valor: l.ValorVendaDesafetacaoAfetacao, campoQ4: l.CampoQ4,
      valorDefinitivo: l.ValorDefinitivo, art139circ: l.Art139CIRC === "true"
    })),
    imoveisAfetos2021: texto(q08, "AnexoBq08B05") === "S",
    optaRegimeTransitorio: texto(q08, "AnexoBq08B07") === "S",
    imoveisRegimeTransitorio: parseLinhasGenerico(filho(q08, "AnexoBq08BT01")).map(l => ({
      freguesia: l.Freguesia, tipo: l.Tipo, artigo: l.Artigo, fracao: l.Fracao, quotaParte: l.QuotaParte,
      codigo: l.Codigo, ano: l.AnoAfetacao, mes: l.MesAfetacao, dia: l.DiaAfetacao
    })),
    houveAlienacao2021: texto(q08, "AnexoBq08B09") === "S",
    imoveisAlienados2021: parseLinhasGenerico(filho(q08, "AnexoBq08CT01")).map(l => ({
      freguesia: l.Freguesia, tipo: l.Tipo, artigo: l.Artigo, fracao: l.Fracao, quotaParte: l.QuotaParte,
      ano: l.AnoVenda, mes: l.MesVenda, dia: l.DiaVenda, valor: l.ValorVenda, campoQ4: l.CampoQ4,
      valorDefinitivo: l.ValorDefinitivo, art139circ: l.Art139CIRC === "true"
    })),
    houveDesafetacao2021: texto(q08, "AnexoBq08B11") === "S",
    houveAfetacao2021: texto(q08, "AnexoBq08B13") === "S",
    imoveisDesafetadosAfetados2021: parseLinhasGenerico(filho(q08, "AnexoBq08CT02")).map(l => ({
      freguesia: l.Freguesia, tipo: l.Tipo, artigo: l.Artigo, fracao: l.Fracao, quotaParte: l.QuotaParte,
      codigo: l.Codigo, ano: l.AnoDesafetacaoAfetacao, mes: l.MesDesafetacaoAfetacao, dia: l.DiaDesafetacaoAfetacao
    }))
  };
}

function parseQuadro09AnexoB(q09) {
  if (!temConteudo(q09)) return undefined;
  return {
    linhas: parseLinhasGenerico(filho(q09, "AnexoBq09T01")).map(l => ({
      ativosFixosTangiveis: l.AtivosFixosTangiveis, ativosIntangiveis: l.AtivosIntangiveis,
      ativosBiologicosNaoConsumiveis: l.AtivosBiologicosNaoConsumiveis
    }))
  };
}

const ANEXOB_Q10_MODALIDADE_POR_VALOR = { "1": "imediato", "2": "diferido", "3": "fracionado" };

function parseQuadro10AnexoB(q10) {
  if (!temConteudo(q10)) return undefined;
  return {
    alienacaoPartesSociais: texto(q10, "AnexoBq10B01") === "S",
    perdaQualidadeResidente: texto(q10, "AnexoBq10B03") === "S",
    partesSociais: parseLinhasGenerico(filho(q10, "AnexoBq10BT01")).map(l => ({
      entidadeEmitente: l.EntidadeEmitente, codigos: l.Codigos, numeroTitulos: l.NTitulos, capitalSocial: l.CapitalSocial,
      anoRealizacao: l.AnoRealizacao, mesRealizacao: l.MesRealizacao, valorRealizacao: l.ValorRealizacao,
      anoAquisicao: l.AnoAquisicao, mesAquisicao: l.MesAquisicao, valorAquisicao: l.ValorAquisicao,
      despesasEncargos: l.DespesasEncargos
    })),
    destinoUE: texto(q10, "AnexoBq10C05"),
    destinoOutro: texto(q10, "AnexoBq10C06"),
    modalidadePagamento: ANEXOB_Q10_MODALIDADE_POR_VALOR[texto(q10, "AnexoBq10B07")]
  };
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

  const q07 = filho(anexoB, "Quadro07");
  const q08 = filho(anexoB, "Quadro08");
  const q09b = filho(anexoB, "Quadro09");
  const q10b = filho(anexoB, "Quadro10");
  const q17 = filho(anexoB, "Quadro17");
  b.quadro07 = parseQuadro07(q07);
  b.quadro08 = parseQuadro08AnexoB(q08);
  b.quadro09 = parseQuadro09AnexoB(q09b);
  b.quadro10 = parseQuadro10AnexoB(q10b);
  b.quadro17 = parseQuadro17(q17);

  const passthrough = {};
  [11, 12, 13, 14, 15, 16, 18].forEach(i => {
    const numero = String(i).padStart(2, "0");
    const elQ = filho(anexoB, `Quadro${numero}`);
    if (temConteudo(elQ)) passthrough[`Quadro${numero}`] = serializar(elQ);
  });

  // Sinal direto (a partir da estrutura do XML) de que há atividade real de Anexo B,
  // usado para decidir se se deve voltar a emitir os quadros 3B/5/6 ao reexportar
  // sem reduzir tudo a um "Não" implícito quando não há realmente nada preenchido.
  const anexoBTemDados = temConteudo(q01) || temConteudo(q04) || temConteudo(q05) || temConteudo(q06) ||
    temConteudo(q07) || temConteudo(q08) || temConteudo(q09b) || temConteudo(q10b) || temConteudo(q17) ||
    Object.keys(passthrough).length > 0;

  return { anexoB: b, anexoBPassthrough: passthrough, anexoBTemDados };
}

function parseAnexoH(anexoH) {
  if (!anexoH) return { anexoH: undefined, anexoHPassthrough: {} };

  const q04 = filho(anexoH, "Quadro04");
  const q05 = filho(anexoH, "Quadro05");
  const q06 = filho(anexoH, "Quadro06");

  const h = {};

  h.rendimentosIsentos = parseLinhasGenerico(filho(q04, "AnexoHq04T01")).map(l => ({
    codigo: l.CodRendimentos, titular: l.Titular, rendimento: l.Rendimentos,
    retencao: l.RetencaoIRS, nifPortugues: l.NifPortugues, pais: l.Pais, numeroFiscalUE: l.NumeroFiscalUE
  }));

  h.propriedadeIntelectual = parseLinhasGenerico(filho(q05, "AnexoHq05T01")).map(l => ({
    titular: l.Titular, montante: l.MontanteRendimento
  }));

  h.pensoesAlimentos = parseLinhasGenerico(filho(q06, "AnexoHq06AT01")).map(l => ({
    sujeitoPassivo: l.SujeitoPassivo, nifBeneficiario: l.NifBeneficiario, valor: l.ValorPensao
  }));

  h.beneficiosDeficiencia = parseLinhasGenerico(filho(q06, "AnexoHq06BT01")).map(l => ({
    codigo: l.CodBeneficio, titular: l.Titular, importancia: l.ImportanciaAplicada,
    nifPortugues: l.NifPortugues, pais: l.Pais, numeroFiscalUE: l.NumeroFiscalUE
  }));

  const passthrough = {};
  // Quadro 6C (opção de declarar despesas em alternativa aos valores comunicados à AT) vive
  // dentro do Quadro06, junto com as pensões/benefícios — preserva-se só esses campos.
  if (temConteudo(q06)) {
    const camposQ06C = ["AnexoHq06B01", "AnexoHq06CT01", "AnexoHq06CT02", "AnexoHq06B03", "AnexoHq06CT03", "AnexoHq06CT04"];
    const fragmento = camposQ06C.map(tag => serializar(filho(q06, tag))).filter(Boolean).join("");
    if (fragmento) passthrough.Quadro06C = fragmento;
  }
  ["Quadro07", "Quadro08", "Quadro09", "Quadro10"].forEach(nome => {
    const elQ = filho(anexoH, nome);
    if (temConteudo(elQ)) passthrough[nome] = serializar(elQ);
  });

  return { anexoH: h, anexoHPassthrough: passthrough };
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
  const anexoE = filho(raiz, "AnexoE");
  const anexoG = filho(raiz, "AnexoG");
  const anexoH = filho(raiz, "AnexoH");

  const { agregado, rostoPassthrough } = parseRosto(rosto);
  const { anexoA: anexoAModel, extrasAnexoA } = parseAnexoA(anexoA);
  const { anexoB: anexoBModel, anexoBPassthrough, anexoBTemDados } = parseAnexoB(anexoB);
  const { anexoE: anexoEModel } = parseAnexoE(anexoE);
  const { anexoG: anexoGModel, anexoGPassthrough } = parseAnexoG(anexoG);
  const { anexoH: anexoHModel, anexoHPassthrough } = parseAnexoH(anexoH);
  const anexosPassthrough = parseAnexosPassthrough(raiz);

  return {
    agregado,
    anexoA: anexoAModel,
    extrasAnexoA,
    anexoB: anexoBModel,
    anexoBPassthrough,
    anexoBTemDados,
    anexoE: anexoEModel,
    anexoG: anexoGModel,
    anexoGPassthrough,
    anexoH: anexoHModel,
    anexoHPassthrough,
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
