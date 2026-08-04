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
- Anexo H: Quadro 4 (rendimentos isentos), Quadro 5 (propriedade intelectual isenta),
  Quadro 6A (pensões de alimentos — dedução direta à coleta, art.º 83.º-A) e Quadro 6B
  (benefícios fiscais/deficiência — códigos 601 a 607 com cálculo próprio; código com
  campo de código dá sugestões via lista de autocompletar). Quadro 6C (opção de declarar
  despesas em alternativa às comunicadas à AT) e Quadros 7-10 ainda sem interface própria.
- Cálculo: Categoria A/H (dedução específica só quando há rendimento dessa categoria) +
  Categoria B em regime simplificado (coeficientes do art.º 31.º do CIRS, e o "acréscimo
  ao rendimento" quando as despesas comprovadas não atingem 15% dos rendimentos sujeitos
  a coeficiente reduzido — validado contra uma Demonstração de Liquidação real da AT),
  quociente conjugal, escalões de IRS, dedução à coleta por dependente, dedução por
  pensões de alimentos e por benefícios/despesas de pessoas com deficiência — códigos 601
  (PPR), 602 (regimes complementares), 603 (Regime Público de Capitalização), 604-606
  (deficiência) e 607 (reabilitação urbana), com limites por idade nos códigos 601/602 —
  e deduções à coleta por despesas do e-fatura (art.º 78.º e seguintes do CIRS — gerais e
  familiares, saúde, educação, imóveis, exigência de fatura), cujos totais declarados
  também contam para o mínimo de despesas da Categoria B. Os restantes códigos do Quadro
  6B (mecenato científico/social/cultural/ambiental, donativos a igrejas, etc.) ficam
  registados no XML mas fora do cálculo.
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

A estrutura XML dos Anexos E, G, G1, J, L, SS ainda **não** está mapeada em detalhe — são
emitidos apenas com o cabeçalho ano/NIF quando se começa em branco. O mesmo se aplica aos
Quadros 7-18 do Anexo B e ao Quadro 6C + Quadros 7-10 do Anexo H. Ao **importar** uma
declaração que já tenha dados nessas secções, esses dados são preservados tal como
estavam (mas ainda não podem ser vistos/editados na interface) e mantidos ao exportar de
novo — para não haver perda de informação.

## Por confirmar / próximos passos

1. **Rosto Quadros 7, 8, 10, 11, 13** — apareceram sempre vazios nos exemplos dados;
   significado ainda desconhecido (possivelmente residência fiscal, opções de tributação,
   assinatura). Preciso de um exemplo preenchido ou das instruções do Rosto.
2. **Anexo B/J/L/SS com 2 sujeitos passivos** — confirmar como o segundo anexo se repete
   (atributo `id` com o NIF de cada titular) quando ambos têm rendimentos próprios nesse anexo.
3. **Anexo B, Quadros 7-18** — encargos, alienação de imóveis, mais-valias de partes
   sociais, atividade agrícola plurianual, alojamento local, etc.
4. **Anexo H, Quadro 6B** — calculados os códigos 601 a 607; os de mecenato (609 em
   diante — científico/social/cultural/ambiental/donativos, dezenas de códigos com
   condições de elegibilidade próprias) continuam só registados no XML, sem entrar no
   cálculo. Os limites/taxas de 601-607 são os que têm menos confirmação em toda a app —
   as instruções do anexo não indicam percentagens (vêm do Estatuto dos Benefícios
   Fiscais), por confirmar antes de uso real, principalmente os códigos 603 a 606.
   Quadro 6C (despesas declaradas em alternativa às da AT) e Quadros 7-10 também por
   implementar.
5. Cada anexo por implementar (E, G, G1, J, L, SS) vai precisar de um exemplo XML
   preenchido + as respetivas instruções de preenchimento, tal como foi feito para os
   Anexos A, B e H.
6. **Parâmetros fiscais em `data/parametros_2025.js`** (escalões, IAS, deduções) são a
   melhor estimativa disponível — devem ser confirmados contra a Tabela de Retenção/OE2025
   antes de qualquer estimativa ser entregue a um cliente real.
7. **Deduções à coleta (art.º 78.º e seguintes do CIRS)** — implementadas (despesas gerais
   e familiares, saúde, educação, imóveis, exigência de fatura), com taxas e limites em
   `data/parametros_2025.js` (a validar). Falta ainda o limite geral e decrescente por
   escalão de rendimento (art.º 78.º-B) que reduz o total de deduções para rendimentos
   coletáveis mais altos — a app aplica os limites por categoria mas não esse teto global.

## Convenção: campos de código

Todos os campos de "código" (código de rendimento, código de benefício, etc.) usam um
`<input>` de texto normal com uma lista de sugestões (`<datalist>`) ao lado da tabela —
nunca um `<select>` rígido. Isto porque:

- Um `<select>` só com os códigos mais comuns causa perda silenciosa de dados ao importar
  uma declaração com um código fora dessa lista (foi um bug real, corrigido no Anexo A —
  o campo de código do Quadro 4A só tinha 4 das 19 opções possíveis).
- O `<datalist>` dá as sugestões mais úteis, mas continua a aceitar qualquer valor, incluindo
  códigos raros que a app ainda não lista (ex: os códigos de mecenato do Anexo H).

Ao adicionar um anexo novo com um campo de código, seguir o mesmo padrão: `<input list="idDoDatalist">`
+ `<datalist id="idDoDatalist">` com as opções mais comuns desse quadro, com o código e uma
descrição curta (`<option value="401">401 — Descrição</option>`).

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
