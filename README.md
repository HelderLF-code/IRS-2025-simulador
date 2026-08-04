# Simulador de IRS 2025 (offline)

Aplicação web local (corre 100% no browser, sem ligação à internet) para calcular uma
estimativa de IRS, gerar uma carta de estimativa para o cliente, e exportar o XML da
declaração no formato `Modelo3IRSv2026` usado pelo Portal das Finanças.

## Como correr

Usa o ficheiro `simulador-irs.html` — é um único ficheiro autónomo (sem pastas, sem
dependências), gerado a partir dos ficheiros em `src/` e `data/`. Basta abri-lo com
duplo-clique; abre diretamente no browser por defeito. Não precisa de instalação de
nada (nem Python, nem servidor, nem ligação à internet).

`index.html` (a versão modular, que carrega `src/*.js` separadamente) é só para
desenvolvimento — não é o que se distribui ao utilizador final, porque depende dos
caminhos relativos para as pastas `src/` e `data/` se manterem intactos.

Depois de alterar algo em `src/` ou `data/`, correr `node scripts/build.js` para
regenerar o `simulador-irs.html`.

## Estado atual

- Rosto: Quadros 1, 2, 3 (ano/NIF), 4/5 (tributação conjunta), 6 (dependentes,
  incluindo deficiência e guarda conjunta), 9 (IBAN).
- Anexo A: Quadro 4 completo (rendimentos/retenções/contribuições, pagamentos por
  conta, outras deduções, seguros de desgaste rápido, incentivos fiscais, ex-residentes,
  IRS Jovem, estudantes dependentes).
- Anexo B: Quadros 1 (regime), 3 (titular/atividade), 4 (rendimentos brutos, todos os
  códigos 4A/4B/4C), 5 (regras da categoria A) e 6 (retenções na fonte/pagamentos por
  conta). Quadros 7 a 18 (alienação de imóveis, mais-valias de partes sociais, atividade
  agrícola plurianual, alojamento local, etc.) ainda sem interface própria.
- Cálculo: Categoria A/H (dedução específica só quando há rendimento dessa categoria) +
  Categoria B em regime simplificado (coeficientes do art.º 31.º do CIRS, e o "acréscimo
  ao rendimento" quando as despesas comprovadas não atingem 15% dos rendimentos sujeitos
  a coeficiente reduzido — validado contra uma Demonstração de Liquidação real da AT),
  quociente conjugal, escalões de IRS, dedução à coleta por dependente.
- Exportação XML validada byte-a-byte contra 4 exemplos reais fornecidos (esqueleto vazio,
  sujeito passivo único, casal com tributação conjunta e dependente em guarda conjunta,
  e uma declaração completa com todos os anexos preenchidos).
- Estimativa no ecrã e carta ao cliente estruturadas como a Demonstração de Liquidação de
  IRS da AT (Rendimento Coletável → Coleta → Coleta Líquida → Retenções/Pagamentos →
  Resultado), simplificada, com valores formatados com separador de milhares (100.000,00).
- **Importação de XML**: permite carregar uma declaração já exportada do Portal das
  Finanças e continuar a trabalhar a partir dela, em vez de começar sempre em branco.
  Testado com round-trip perfeito (importar e voltar a exportar sem alterar nada dá
  exatamente o mesmo ficheiro) em todos os exemplos fornecidos.

A estrutura XML dos Anexos E, G, G1, H, J, L, SS ainda **não** está mapeada em detalhe
— são emitidos apenas com o cabeçalho ano/NIF quando se começa em branco. O mesmo se
aplica aos Quadros 7-18 do Anexo B. Ao **importar** uma declaração que já tenha dados
nessas secções, esses dados são preservados tal como estavam (mas ainda não podem ser
vistos/editados na interface) e mantidos ao exportar de novo — para não haver perda de
informação.

## Por confirmar / próximos passos

1. **Rosto Quadros 7, 8, 10, 11, 13** — apareceram sempre vazios nos exemplos dados;
   significado ainda desconhecido (possivelmente residência fiscal, opções de tributação,
   assinatura). Preciso de um exemplo preenchido ou das instruções do Rosto.
2. **Anexo B/J/L/SS com 2 sujeitos passivos** — confirmar como o segundo anexo se repete
   (atributo `id` com o NIF de cada titular) quando ambos têm rendimentos próprios nesse anexo.
3. **Anexo B, Quadros 7-18** — encargos, alienação de imóveis, mais-valias de partes
   sociais, atividade agrícola plurianual, alojamento local, etc.
4. Cada anexo por implementar (E, G, G1, H, J, L, SS) vai precisar de um exemplo XML
   preenchido + as respetivas instruções de preenchimento, tal como foi feito para os
   Anexos A e B.
5. **Parâmetros fiscais em `data/parametros_2025.js`** (escalões, IAS, deduções) são a
   melhor estimativa disponível — devem ser confirmados contra a Tabela de Retenção/OE2025
   antes de qualquer estimativa ser entregue a um cliente real.
6. **Deduções à coleta (art.º 78.º e seguintes do CIRS)** — campo para carregar
   manualmente as despesas do e-fatura (despesas gerais familiares, saúde, educação,
   imóveis, exigência de fatura, etc.) e calcular a dedução efetiva de cada uma
   (com os respetivos limites), tal como aparece na secção "Deduções à Coleta" da
   Demonstração de Liquidação da AT. Atualmente a app só desconta a dedução por
   dependentes.

## Estrutura do código

```
index.html          formulário e interface
src/calc.js          motor de cálculo (Categoria A)
src/xml/build.js      gerador do XML Modelo3IRSv2026
src/xml/parse.js      importador do XML Modelo3IRSv2026
src/letter.js         gerador da carta/estimativa em HTML
data/parametros_2025.js  escalões, deduções, IAS (a validar)
examples/             modelos de dados de teste, validados contra XML reais
```

Todos os ficheiros `.js` são scripts normais (não módulos), carregados por `index.html`
via `<script src="...">`, precisamente para que a aplicação funcione ao abrir o ficheiro
diretamente (`file://`) sem precisar de servidor.
