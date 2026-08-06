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

- Rosto (separador "Rosto" — inclui o agregado familiar, que corresponde ao Quadro 6):
  Quadros 1, 2, 3 (ano/NIF), 4/5 (tributação conjunta), 6 (dependentes, incluindo
  deficiência e guarda conjunta), 8A (residência fiscal — Continente/Açores/Madeira), 9
  (IBAN + "associar IBAN ao NIF"), 10 (natureza da declaração — 1.ª declaração/
  substituição). Os nomes dos campos (`Q08B01`, `Q09B01`/`Q09B01b`, `Q10B01`) foram
  **confirmados** contra um exemplo real (residente Continente, 1.ª declaração, associar
  IBAN = Sim). O padrão observado: um quadro pode ter um único campo cujo valor é o
  número do campo do papel assinalado (Quadro 4, 8A, 10, 13), e/ou vários campos
  independentes com nomes próprios por grupo de escolha (Quadro 8B — não residente).
  Quando o quadro importado já tem conteúdo (mesmo que inclua campos não modelados, como
  o Quadro 8B de não residentes), esse conteúdo original tem sempre prioridade sobre o
  valor calculado a partir dos campos da interface — só se gera a partir do zero quando o
  quadro vem vazio. Quadro 7 (ascendentes/colaterais), Quadro 8B (não residentes), 11
  (consignação do IRS/IVA) e 13 (prazos especiais) têm significado conhecido e nomes de
  campo já confirmados num exemplo real (ver comentários em `src/xml/parse.js`), mas
  ainda sem interface própria — os dados são preservados tal como vieram ao importar.
- Anexo A: Quadro 4 completo (rendimentos/retenções/contribuições, pagamentos por
  conta, outras deduções, seguros de desgaste rápido, incentivos fiscais, ex-residentes,
  IRS Jovem, estudantes dependentes).
- Anexo B: Quadros 1 (regime), 3 (titular/atividade), 4 (rendimentos brutos, todos os
  códigos 4A/4B/4C), 5 (regras da categoria A), 6 (retenções na fonte/pagamentos por
  conta), 7 (encargos em caso de opção pela categoria A ou ato isolado > €200.000), 8
  (alienação/desafetação/afetação de imóveis — Quadros 8A/8B/8C.1/8C.2), 9 (mais-valias —
  reinvestimento do valor de realização) e 10 (partes sociais adquiridas ao abrigo do
  regime de neutralidade fiscal). Nomes de campo dos Quadros 7, 8, 9 e 10 confirmados
  contra um exemplo real, exceto a modalidade de pagamento do Quadro 10C (só "imediato"
  confirmado). O efeito no cálculo da estimativa dos Quadros 7 (regras da categoria A) e 8
  a 10 (mais-valias) **ainda não está implementado** — regras próprias e complexas
  (art.ºs 44.º e seguintes do CIRS para mais-valias imobiliárias, art.º 10.º-A para partes
  sociais), só a captura/exportação dos dados. Quadro 17 (despesas e encargos para efeitos
  do mínimo de despesas da categoria B — 17A/17B confirmados num exemplo real, 17C/17D
  extrapolados do mesmo padrão, por confirmar). Quadros 11 a 16 e 18 (prejuízos fiscais em
  sucessão, tributação autónoma, subsídios/alojamento local/RNH/floresta, alienação de
  imóveis dos AIMI, despesas do art.º 31.º-A, mais-valias por incêndios florestais) ainda
  sem interface própria.
- Anexo E (rendimentos de capitais): Quadro 4A (rendimentos sujeitos a taxas especiais,
  art.º 72.º CIRS), opção pelo englobamento, Quadro 4B (rendimentos sujeitos a taxas
  liberatórias, art.º 71.º CIRS — só relevante com englobamento) e Quadro 5A/5B
  (rendimentos de anos anteriores, art.º 74.º CIRS). Nomes de campo confirmados contra um
  exemplo real. Entra no cálculo da estimativa: sem optar pelo englobamento, os
  rendimentos do Quadro 4A são tributados à taxa especial `taxaEspecialCategoriaE`
  (28% por omissão) e essa coleta soma-se diretamente à coleta líquida (não passa pelos
  escalões nem pelas deduções à coleta gerais); com englobamento, os rendimentos dos
  Quadros 4A e 4B somam-se ao rendimento global e são tributados nos escalões gerais, com
  crédito das retenções do Quadro 4B. **A taxa de 28% é só a mais comum — o art.º 72.º do
  CIRS tem taxas diferentes consoante o tipo de rendimento (ex: 35% para entidades em
  regime fiscal privilegiado), que as instruções de preenchimento não especificam por
  código — por confirmar antes de uso real com rendimentos sujeitos a taxa diferente.**
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
  também contam para o mínimo de despesas da Categoria B. As despesas comprovadas para
  esse mínimo somam ainda as contribuições para a Segurança Social e as importações/
  aquisições intracomunitárias relacionadas com a atividade (Anexo B, Quadro 17A); se o
  titular optar por declarar despesas com pessoal/rendas de imóveis/outras despesas em
  alternativa ao e-fatura (Quadro 17C), só essas contam (não se somam ao e-fatura). Os
  restantes códigos do Quadro 6B do Anexo H (mecenato científico/social/cultural/
  ambiental, donativos a igrejas, etc.) ficam registados no XML mas fora do cálculo — tal
  como a opção pelas regras da categoria A no Anexo B (Quadro 5/7), cujos dados já são
  capturados e exportados mas ainda não têm efeito na estimativa calculada.
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
- **Navegação por separadores**: o formulário está organizado em separadores (Agregado
  Familiar, Anexo A, Anexo B, Despesas e-Fatura, Anexo H) com uma barra lateral de
  navegação, para não ficar uma página só a crescer à medida que se adicionam anexos.
  Os botões "Calcular estimativa" / "Exportar XML" / "Gerar carta" ficam sempre visíveis,
  fora dos separadores.

A estrutura XML dos Anexos G, G1, J, L, SS ainda **não** está mapeada em detalhe — são
emitidos apenas com o cabeçalho ano/NIF quando se começa em branco. O mesmo se aplica aos
Quadros 11-16 e 18 do Anexo B e ao Quadro 6C + Quadros 7-10 do Anexo H. Ao **importar** uma
declaração que já tenha dados nessas secções, esses dados são preservados tal como
estavam (mas ainda não podem ser vistos/editados na interface) e mantidos ao exportar de
novo — para não haver perda de informação.

## Por confirmar / próximos passos

1. **Rosto Quadros 7, 8B, 11, 13** — significado e nomes de campo já confirmados num
   exemplo real (ver comentários em `src/xml/parse.js`), mas ainda sem interface própria.
2. **Anexo B/J/L/SS com 2 sujeitos passivos** — confirmar como o segundo anexo se repete
   (atributo `id` com o NIF de cada titular) quando ambos têm rendimentos próprios nesse anexo.
3. **Anexo B, Quadro 17C/17D** — nomes de campo (`AnexoBq17C17051-17054`, `AnexoBq17DT01`)
   extrapolados do padrão confirmado no 17A/17B, não validados contra um exemplo com a
   opção "declarar despesas em alternativa" preenchida. **Anexo B, Quadro 10C — modalidade
   de pagamento** — só se confirmou o valor 1 = imediato; 2 = diferido e 3 = fracionado são
   extrapolados por analogia (ordem no formulário), não confirmados. **Anexo B, Quadros 7 a
   10 → efeito no cálculo**: os dados de encargos da opção pela categoria A (Quadro 7,
   limites dos artigos 25.º/27.º do CIRS) e de mais-valias (Quadros 8, 9 e 10 — alienação
   de imóveis, reinvestimento, partes sociais) já são capturados e exportados, mas a
   estimativa ainda não os usa no cálculo — regras próprias e complexas (correção
   monetária, percentagem de exclusão de tributação, prazos de detenção, etc.) por
   implementar. **Anexo B, Quadros 11-16 e 18** — prejuízos fiscais em sucessão,
   tributação autónoma, subsídios/alojamento local/RNH/floresta, alienação de imóveis dos
   AIMI, despesas do art.º 31.º-A, mais-valias por incêndios florestais — ainda sem
   interface própria.
4. **Anexo H, Quadro 6B** — calculados os códigos 601 a 607; os de mecenato (609 em
   diante — científico/social/cultural/ambiental/donativos, dezenas de códigos com
   condições de elegibilidade próprias) continuam só registados no XML, sem entrar no
   cálculo. Os limites/taxas de 601-607 são os que têm menos confirmação em toda a app —
   as instruções do anexo não indicam percentagens (vêm do Estatuto dos Benefícios
   Fiscais), por confirmar antes de uso real, principalmente os códigos 603 a 606.
   Quadro 6C (despesas declaradas em alternativa às da AT) e Quadros 7-10 também por
   implementar.
5. Cada anexo por implementar (G, G1, J, L, SS) vai precisar de um exemplo XML preenchido
   + as respetivas instruções de preenchimento, tal como foi feito para os Anexos A, B, E
   e H.
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
