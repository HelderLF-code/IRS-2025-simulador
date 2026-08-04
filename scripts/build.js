// Junta index.html + os ficheiros JS referenciados num único ficheiro autónomo
// (simulador-irs.html), para poder ser aberto sem depender de outros ficheiros
// ao lado (sem pastas, sem zip, sem risco de caminhos relativos partidos).
//
// Correr com: node scripts/build.js

const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");

const saida = html.replace(
  /<script src="\.\/([^"]+)"><\/script>/g,
  (_match, caminho) => {
    const conteudo = fs.readFileSync(path.join(raiz, caminho), "utf8");
    return `<script>\n${conteudo}\n</script>`;
  }
);

fs.writeFileSync(path.join(raiz, "simulador-irs.html"), saida);
console.log("Gerado: simulador-irs.html");
