# Histórico de versões — Alafcell Assistec

Segunda casa = funcionalidade nova. Terceira casa = correção. A primeira não muda.

---

## 0.3.0 — 31/08/2026

Fotografia no site inteiro, e a operação para subir ao servidor.

**As fotos** (`ferramentas/baixar-imagens.cjs`)
- 29 imagens do Unsplash (licença livre, inclusive comercial), baixadas em WebP
  a 1200px — 2,8 MB no total. Ficam **no projeto**, e não consumidas por link do
  fornecedor: link de banco de imagem muda de endereço e o site aparece com
  buraco no lugar da foto, sem erro em lugar nenhum.
- Cada arquivo tem a **assinatura conferida** depois de baixar. Um HTML de erro
  salvo como `.webp` grava sem reclamar e só é descoberto na tela.
- Gera uma **folha de contato** (`assets/img/banco/conferir.html`) e o
  `CREDITOS.md`. A folha responde a única pergunta que nenhum teste automático
  responde: a foto que veio é do assunto certo?
- Cinco fotos vieram 404 (eram Unsplash+) e quatro não batiam com o assunto —
  trocadas depois de olhar a folha de contato.

**Onde elas entram**
- Topo da home: a foto da oficina **dentro da tela do aparelho**, com a
  varredura de luz por cima. É o conceito em uma peça.
- Capa de cada um dos 8 serviços, no cartão e na página.
- Foto em cada um dos 12 produtos da loja.
- Capa das 3 matérias, no cartão e no artigo.
- Busca e leva (com o pulso por cima), garantia, contato, e a faixa vermelha.

**O tratamento** é um só para toda foto de conteúdo: dessatura, escurece e
recebe um véu de grafite; no hover volta ao natural e sobe. Sem isso, doze
fotógrafos diferentes puxam a página para doze lados e o conjunto vira mural.

**Operação**
- `deploy.sh` — backup, git, npm, fotos, semear, **provas**, restart. As provas
  rodam antes do restart: falhou, o site continua no ar com a versão anterior.
  Confere o canonical a cada entrega e grita se a demonstração ainda estiver ativa.
- `criar-site.sh` — DNS, vhost com gzip e cache, certificado, renovação.
- `verificar.sh` — conferir de fora: 15 páginas, 404 de verdade, canonical,
  robots × sitemap coerentes, cabeçalhos e cinco arquivos que não podem vazar.
- `operacao/` — unidade do systemd (sem `MemoryDenyWriteExecute`, que mata o V8),
  backup diário às 03:40 com atraso sorteado.
- `ferramentas/backup.cjs` — `VACUUM INTO`, e não `cp`: em WAL, copiar só o `.db`
  produz um arquivo que abre sem erro e está desatualizado.
- `testes/provar.cjs` — **48 provas** em banco temporário: dinheiro, carrinho,
  privacidade do pedido e da OS, Pix, endereço de trabalho, preços.
  **12 sabotagens, 12 pegas.**
- `SUBIR.md` e `.gitignore` (todo padrão ancorado — `dados/` solto já engoliu
  código em outro projeto do parque).

### Corrigido no caminho

- **`/saude` passou a dizer se a demonstração está ativa** (`demo`, `pixDemo`).
  O aviso do log só é lido por quem está no terminal naquele minuto; assim o
  deploy e o monitoramento também enxergam.
- **O verificador gritava em toda execução local:** comparava o canonical com o
  endereço pedido, e por 127.0.0.1 eles nunca batem. Passou a comparar com o
  `ALAFCELL_SITE` — verificador que grita sempre é verificador que ninguém lê.
- **Uma prova era cega:** a nota interna da bancada usava a situação "reparo",
  que já tinha etapa pública; a deduplicação escondia a nota por acidente e a
  prova passava mesmo com o filtro `publico` removido.
- Fotos de produto sem `width`/`height`, o que fazia a grade pular ao carregar.
- Crase dentro de template literal derrubou o `paginas.js` de novo.

---

## 0.2.0 — 31/08/2026

As sete telas públicas, para apresentação ao cliente.

**Consertos** (`/consertos/`)
- Lista dos serviços com preço "a partir de" e prazo real.
- Recorte por marca (`?marca=`) e a **tabela completa de um aparelho** (`?modelo=`) — é o
  endereço que responde "quanto custa trocar a tela do iPhone 11 em Caruaru".
- Página de cada serviço com a tabela por aparelho ordenada **por preço**, os sintomas na
  linguagem do cliente, ficha de prazo/garantia/orçamento e `Service` no Schema.org.

**Busca e leva** (`/busca-e-leva/`)
- Os cinco passos, a comparação explícita com o "busca e leva por transportadora" das
  franquias, e o formulário de agendamento com endereço e janela de horário.
- Campo isca contra robô: preenchido, o envio é aceito em silêncio e descartado.

**Loja** (`/loja/`, `/loja/:categoria/`, `/produto/:slug/`)
- Vitrine com abas por categoria, ordenação por preço e recorte próprio para **seminovos**.
- O seminovo mostra **saúde da bateria e estado** na vitrine, não escondidos na descrição.
- Sem foto, entra o desenho da categoria em SVG — o cartão nunca fica quebrado.
- Ficha técnica que muda com a condição do produto.

**Carrinho e checkout** (`/carrinho/`, `/checkout/`, `/pedido/:codigo/`)
- Carrinho em cookie guardando só `{id, q}`; **o preço é sempre recalculado no servidor**.
- Checkout de uma tela só, sem cadastro.
- **Pix copia e cola gerado aqui** (padrão EMV do Banco Central, com CRC16) e **QR em SVG
  montado no servidor** — sem gateway, sem taxa e sem dependência externa.
- A tela do pedido só abre para o navegador que comprou, por cookie: o código sozinho não
  mostra os dados de ninguém.
- Estoque baixa na mesma transação do pedido.

**Blog** (`/blog/`, `/blog/:slug/`)
- Índice e matéria, com tempo de leitura, `BlogPosting` e chamada para o orçamento no fim.

**Contato e privacidade** (`/contato/`, `/privacidade/`)
- Canais diretos antes do formulário — numa assistência, quem escreve quer resposta hoje.
- Política de privacidade que lista campo por campo o que cada formulário coleta, por
  quanto tempo fica e como pedir a exclusão.

**Acompanhar o conserto** (`/acompanhar/`)
- Consulta por **código + os quatro últimos dígitos do telefone**; resposta idêntica para
  código inexistente e telefone errado; freio de 5 tentativas por IP a cada 10 minutos.
- Linha do tempo com as oito etapas, a atual acesa e a engrenagem girando nela.
- Nota interna da bancada (`publico = 0`) não aparece.

**Conteúdo de demonstração** (`src/demo.js`)
- Preços de referência, 12 produtos, 3 matérias e a ordem `DEMO-01`. Só entra com as
  tabelas vazias, e sai inteiro com `ALAFCELL_DEMO=nao`.
- Chave Pix de demonstração deliberadamente inválida, com aviso alto a cada subida.

### Corrigido no caminho

- **A consulta de OS consumia o balde de spam dos formulários.** Quem acompanhasse o
  conserto algumas vezes ficava sem conseguir agendar a coleta depois — a trava punindo
  justamente o cliente ansioso. O acompanhamento tem trava própria e saiu do balde geral.
- **O brilho da capa alargava a página em 36px** no celular: o pseudo-elemento passava 10%
  para fora da seção e criava barra de rolagem horizontal em toda tela interna.
  Recortado com `overflow: clip`, que não quebra `position: sticky`.
- **Botão longo não cabia em 345px.** "Ver todos os consertos e os preços" media 358px e
  empurrava a home inteira; com `white-space: nowrap` ele não tinha como ceder. Abaixo de
  420px o rótulo passa a quebrar.
- Descrição da loja tinha 53 caracteres — curta demais para o Google, que completa o
  espaço com trecho aleatório da página.

---

## 0.1.0 — 31/08/2026

Fundação: servidor, banco, sistema visual, layout e home.

- Logotipo extraído do PDF com transparência real (a camada de fundo preto foi cortada do
  fluxo do PDF antes de renderizar), favicons e imagem de compartilhamento.
- Paleta medida no arquivo do logotipo, com a regra de contraste do vermelho documentada.
- Engrenagem de doze dentes em SVG como motivo da interface.
- Página inicial na ordem das perguntas de quem chega, e não na ordem administrativa.
- Endereço de trabalho fora do índice do Google, automaticamente.
