# Simulador de IRS 2025 (offline)

Aplicação web local (corre 100% no browser, sem ligação à internet) para calcular uma
estimativa de IRS, gerar uma carta de estimativa para o cliente, e exportar o XML da
declaração no formato `Modelo3IRSv2026` usado pelo Portal das Finanças.

## Como correr

Não é possível abrir `index.html` diretamente com duplo-clique (os browsers bloqueiam
`import` de módulos JS a partir de `file://`). É preciso servir a pasta com um servidor
local simples:

```
cd IRS-2025-simulador
python3 -m http.server 8000
```

Depois abre `http://localhost:8000` no browser.

## Estado atual (Fase 1)

- Rosto: Quadros 1, 2, 3 (ano/NIF), 4/5 (tributação conjunta), 6 (dependentes,
  incluindo deficiência e guarda conjunta), 9 (IBAN).
- Anexo A: Quadro 4 completo (rendimentos/retenções/contribuições, pagamentos por
  conta, outras deduções, seguros de desgaste rápido, incentivos fiscais, ex-residentes,
  IRS Jovem, estudantes dependentes).
- Cálculo: Categoria A/H — dedução específica, quociente conjugal, escalões de IRS,
  dedução à coleta por dependente.
- Exportação XML validada byte-a-byte contra 3 exemplos reais fornecidos (esqueleto vazio,
  sujeito passivo único, casal com tributação conjunta e dependente em guarda conjunta).
- Geração de carta/estimativa para o cliente (HTML imprimível → PDF via browser).

A estrutura XML dos Anexos B, E, G, G1, H, J, L, SS ainda **não** está mapeada em detalhe
— são emitidos apenas com o cabeçalho ano/NIF (tal como aparecem numa declaração sem dados
nesses anexos), para manter o XML estruturalmente válido enquanto essas fases não avançam.

## Por confirmar / próximos passos

1. **Rosto Quadros 7, 8, 10, 11, 13** — apareceram sempre vazios nos exemplos dados;
   significado ainda desconhecido (possivelmente residência fiscal, opções de tributação,
   assinatura). Preciso de um exemplo preenchido ou das instruções do Rosto.
2. **Anexo B/J/L/SS com 2 sujeitos passivos** — confirmar como o segundo anexo se repete
   (atributo `id` com o NIF de cada titular) quando ambos têm rendimentos próprios nesse anexo.
3. Cada anexo por implementar (B, E, G, G1, H, J, L, SS) vai precisar de um exemplo XML
   preenchido + as respetivas instruções de preenchimento, tal como foi feito para o Anexo A.
4. **Parâmetros fiscais em `data/parametros_2025.json`** (escalões, IAS, deduções) são a
   melhor estimativa disponível — devem ser confirmados contra a Tabela de Retenção/OE2025
   antes de qualquer estimativa ser entregue a um cliente real.

## Estrutura do código

```
index.html          formulário e interface
src/calc.js          motor de cálculo (Categoria A)
src/xml/build.js      gerador do XML Modelo3IRSv2026
src/letter.js         gerador da carta/estimativa em HTML
data/parametros_2025.json  escalões, deduções, IAS (a validar)
examples/             modelos de dados de teste, validados contra XML reais
```
