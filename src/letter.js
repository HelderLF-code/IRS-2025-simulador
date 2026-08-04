// Ficheiro carregado como <script> normal (não módulo) para poder ser aberto diretamente
// com duplo-clique, sem servidor. Expõe-se em window.IRSLetter.

(function (root) {

function gerarCartaHTML({ agregado, resultado, dataGeracao }) {
  const nomeAno = agregado.ano;
  const sinalResultado = resultado.tipoResultado === "reembolso" ? "reembolso estimado" : "valor estimado a pagar";
  const valorAbs = Math.abs(resultado.resultado).toFixed(2);

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>Estimativa de IRS ${nomeAno}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.3rem; border-bottom: 2px solid #333; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td, th { padding: 6px 8px; text-align: left; border-bottom: 1px solid #ddd; }
  .total { font-weight: bold; font-size: 1.1rem; }
  .aviso { margin-top: 30px; padding: 12px; background: #f5f5f0; border-left: 4px solid #999; font-size: 0.85rem; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir / Guardar como PDF</button>
  <h1>Estimativa de IRS — Rendimentos de ${nomeAno}</h1>
  <p>Data de emissão: ${dataGeracao}</p>
  <p>Sujeito passivo A — NIF ${agregado.nifA}${agregado.tributacaoConjunta ? ` | Sujeito passivo B — NIF ${agregado.nifB}` : ""}</p>

  <table>
    <tr><td>Rendimento bruto (Categoria A)</td><td>${resultado.rendimentoBruto.toFixed(2)} €</td></tr>
    <tr><td>Dedução específica</td><td>${resultado.deducaoEspecifica.toFixed(2)} €</td></tr>
    <tr><td>Rendimento líquido</td><td>${resultado.rendimentoLiquido.toFixed(2)} €</td></tr>
    <tr><td>Coleta bruta de IRS</td><td>${resultado.coletaBruta.toFixed(2)} €</td></tr>
    <tr><td>Dedução à coleta (dependentes)</td><td>${resultado.deducaoColetaDependentes.toFixed(2)} €</td></tr>
    <tr><td>Coleta líquida</td><td>${resultado.coletaLiquida.toFixed(2)} €</td></tr>
    <tr><td>Retenções na fonte já efetuadas</td><td>${resultado.retencoesTotais.toFixed(2)} €</td></tr>
    <tr class="total"><td>${sinalResultado.toUpperCase()}</td><td>${valorAbs} €</td></tr>
  </table>

  <p>Esta estimativa foi calculada com base nos dados fornecidos, considerando apenas rendimentos da
  categoria A (trabalho dependente e/ou pensões). Não substitui a declaração oficial submetida no
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
