"use strict";
/* ==========================================================================
   ALAFCELL ASSISTEC — banco

   SQLite, um arquivo. Tudo o que o site mostra sai daqui: textos, tabela de
   preços de conserto, produtos da loja, pedidos, ordens de serviço e blog.
   Não existe HTML com conteúdo escrito dentro — o que o painel grava é o que
   a página mostra no pedido seguinte, sem passo de publicação que alguém
   possa esquecer de rodar.

   ---------------------------------------------------------------------------
   O ESQUEMA SEGUE O NEGÓCIO, E ESTE NEGÓCIO SÃO DOIS

   A Alafcell conserta E vende. Não são dois sites colados: são duas metades
   que se alimentam — quem chega com a tela quebrada às vezes sai comprando um
   seminovo, e quem compra volta para consertar. O esquema mantém as duas com
   tabelas próprias, e não força uma a caber no formato da outra:

   1. CONSERTO TEM PREÇO POR APARELHO, e não preço só. "Troca de tela" custa
      uma coisa num Moto G e outra num iPhone 15. Por isso o preço vive no
      cruzamento MODELO × SERVIÇO, e não dentro do serviço — que obrigaria a
      escrever "a partir de R$ 150" e deixar o cliente descobrir o resto no
      balcão, que é exatamente o que os concorrentes fazem.

   2. LINHA DE PREÇO QUE NÃO EXISTE NÃO É PREÇO ZERO. O cruzamento completo
      seria uma matriz de centenas de linhas em branco. Aqui só existe linha
      para o que a loja preencheu; o resto simplesmente não mostra preço e cai
      no orçamento, que é a verdade.

   3. ORDEM DE SERVIÇO É LINHA DO TEMPO, não campo de situação. O cliente quer
      saber ONDE está o aparelho dele; um campo `situacao` diz o agora e apaga
      o antes. As etapas ficam em tabela própria, e a situação atual é a última
      etapa — assim "chegou 9h, orçamento 11h, aprovado 11h40" existe.

   4. DINHEIRO EM CENTAVOS, NÚMERO INTEIRO. Carrinho soma; ponto flutuante
      erra centavo ao somar, e o erro aparece justamente no total, que é o
      número que o cliente confere. Real com casa decimal em banco de loja é
      dívida técnica que vence no primeiro pedido grande.
   ========================================================================== */
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const RAIZ = path.join(__dirname, "..");
const CAMINHO = process.env.ALAFCELL_DB || path.join(RAIZ, "data", "alafcell.db");

fs.mkdirSync(path.dirname(CAMINHO), { recursive: true });

const db = new Database(CAMINHO);
/* WAL: leitura e escrita não se bloqueiam. Uma ordem de serviço sendo gravada
   no balcão não pode travar a loja de quem está navegando pelo celular. */
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
/* ==========================================================================
   TEXTOS DO SITE

   Cada trecho editável é uma linha. 'grupo' é a tela do painel onde ele
   aparece — sem isso o /admin vira uma lista de duzentos campos soltos e o
   cliente desiste de editar.

   É AQUI que moram endereço, telefone, horário e CNPJ. Escritos no código,
   eles viram uma caçada por arquivo no dia em que a loja mudar de ponto.
   ========================================================================== */
CREATE TABLE IF NOT EXISTS config (
  chave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL DEFAULT '',
  grupo  TEXT NOT NULL DEFAULT 'geral',
  rotulo TEXT NOT NULL DEFAULT '',
  ajuda  TEXT NOT NULL DEFAULT '',
  tipo   TEXT NOT NULL DEFAULT 'texto',   -- texto | area | rico | imagem | url | cor | numero
  ordem  INTEGER NOT NULL DEFAULT 0
);

/* ==========================================================================
   APARELHOS

   Marca e modelo separados porque a busca real do cliente é em dois passos
   ("é Samsung" → "é o A54"), e porque a página de marca é uma porta de entrada
   de busca com volume próprio: "assistência Samsung Caruaru".
   ========================================================================== */
CREATE TABLE IF NOT EXISTS marcas (
  id     INTEGER PRIMARY KEY,
  slug   TEXT NOT NULL UNIQUE,
  nome   TEXT NOT NULL,
  logo   TEXT NOT NULL DEFAULT '',
  ordem  INTEGER NOT NULL DEFAULT 0,
  ativo  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS modelos (
  id        INTEGER PRIMARY KEY,
  marca_id  INTEGER NOT NULL REFERENCES marcas(id) ON DELETE CASCADE,
  slug      TEXT NOT NULL UNIQUE,
  nome      TEXT NOT NULL,
  ano       INTEGER,
  popular   INTEGER NOT NULL DEFAULT 0,   -- aparece na lista curta da home
  ordem     INTEGER NOT NULL DEFAULT 0,
  ativo     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_modelo_marca ON modelos(marca_id, ativo);

/* ==========================================================================
   SERVIÇOS DE CONSERTO

   'prazo_horas' é NÚMERO, não texto. É o dado que a Alafcell vende — o site
   inteiro é organizado em torno do tempo sem celular — e guardado como "1 a 2
   dias" ele não ordena, não compara e não vira "pronto hoje" na tela.

   'garantia_dias' idem: 90 dias é promessa contratual, e escrita à mão em
   cada serviço ela diverge no dia em que a loja mudar a política.
   ========================================================================== */
CREATE TABLE IF NOT EXISTS servicos (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  categoria     TEXT NOT NULL DEFAULT 'tela',  -- tela|bateria|carga|camera|audio|placa|software|outros
  chamada       TEXT NOT NULL DEFAULT '',
  descricao     TEXT NOT NULL DEFAULT '',
  sintomas      TEXT NOT NULL DEFAULT '',      -- um por linha: como o cliente descreve o problema
  prazo_horas   INTEGER NOT NULL DEFAULT 24,
  garantia_dias INTEGER NOT NULL DEFAULT 90,
  icone         TEXT NOT NULL DEFAULT 'tela',
  destaque      INTEGER NOT NULL DEFAULT 0,
  ordem         INTEGER NOT NULL DEFAULT 0,
  ativo         INTEGER NOT NULL DEFAULT 1
);

/* --------------------------------------------------------------- preços
   O cruzamento. Só existe linha para o que a loja preencheu.

   'preco' em CENTAVOS e "a partir de": peça de tela tem qualidade original e
   paralela, e prometer o valor exato sem ver o aparelho é prometer o que não
   se pode cumprir. O site diz de onde parte; o balcão fecha.

   UNIQUE no par impede a linha duplicada — dois preços para o mesmo conserto
   do mesmo aparelho é o tipo de dado que ninguém percebe até o cliente
   apontar duas telas com valores diferentes. */
CREATE TABLE IF NOT EXISTS precos (
  id          INTEGER PRIMARY KEY,
  modelo_id   INTEGER NOT NULL REFERENCES modelos(id) ON DELETE CASCADE,
  servico_id  INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  preco       INTEGER NOT NULL DEFAULT 0,     -- centavos, "a partir de"
  prazo_horas INTEGER,                        -- vazio = o prazo padrão do serviço
  observacao  TEXT NOT NULL DEFAULT '',
  ativo       INTEGER NOT NULL DEFAULT 1,
  UNIQUE (modelo_id, servico_id)
);
CREATE INDEX IF NOT EXISTS ix_preco_servico ON precos(servico_id, ativo);

/* ==========================================================================
   LOJA

   Um produto por linha, com CONDIÇÃO no próprio produto — e não duas tabelas
   para novo e seminovo. Eles compartilham tudo (nome, foto, preço, estoque) e
   diferem em três campos; separar dobraria o cadastro e a listagem.

   Os campos de seminovo ficam vazios no novo. Isso é de propósito: no
   seminovo, saúde da bateria e estado são O QUE decide a compra, e escondê-los
   num campo de texto livre tira do cliente a única informação que ele quer.
   ========================================================================== */
CREATE TABLE IF NOT EXISTS produtos (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  categoria     TEXT NOT NULL DEFAULT 'acessorio', -- smartphone|acessorio|periferico
  condicao      TEXT NOT NULL DEFAULT 'novo'
                CHECK (condicao IN ('novo','seminovo','recondicionado')),
  marca_id      INTEGER REFERENCES marcas(id),
  chamada       TEXT NOT NULL DEFAULT '',
  descricao     TEXT NOT NULL DEFAULT '',
  preco         INTEGER NOT NULL DEFAULT 0,   -- centavos
  preco_de      INTEGER NOT NULL DEFAULT 0,   -- centavos; 0 = sem valor riscado
  parcelas      INTEGER NOT NULL DEFAULT 12,
  estoque       INTEGER NOT NULL DEFAULT 0,
  sku           TEXT NOT NULL DEFAULT '',
  /* --- só fazem sentido no seminovo --- */
  cor           TEXT NOT NULL DEFAULT '',
  armazenamento TEXT NOT NULL DEFAULT '',
  bateria       INTEGER,                      -- saúde em %, o número que decide a compra
  estado        TEXT NOT NULL DEFAULT '',     -- A | B | C
  garantia_meses INTEGER NOT NULL DEFAULT 3,
  destaque      INTEGER NOT NULL DEFAULT 0,
  ativo         INTEGER NOT NULL DEFAULT 1,
  criado        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_produto_cat ON produtos(categoria, ativo);

/* Fotos em tabela própria: aparelho seminovo se vende com quatro ângulos e a
   marca de uso aparecendo. Um campo 'foto' no produto obrigaria a esconder
   justamente o que dá confiança. */
CREATE TABLE IF NOT EXISTS produto_fotos (
  id          INTEGER PRIMARY KEY,
  produto_id  INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  arquivo     TEXT NOT NULL,
  alt         TEXT NOT NULL DEFAULT '',
  ordem       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_foto_produto ON produto_fotos(produto_id, ordem);

/* ==========================================================================
   PEDIDOS
   ========================================================================== */
CREATE TABLE IF NOT EXISTS pedidos (
  id          INTEGER PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  documento   TEXT NOT NULL DEFAULT '',
  telefone    TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  cep         TEXT NOT NULL DEFAULT '',
  endereco    TEXT NOT NULL DEFAULT '',
  bairro      TEXT NOT NULL DEFAULT '',
  cidade      TEXT NOT NULL DEFAULT '',
  entrega     TEXT NOT NULL DEFAULT 'retirada',  -- retirada | entrega | correios
  frete       INTEGER NOT NULL DEFAULT 0,        -- centavos
  observacao  TEXT NOT NULL DEFAULT '',
  total       INTEGER NOT NULL DEFAULT 0,        -- centavos
  pagamento   TEXT NOT NULL DEFAULT 'pix',       -- pix | cartao | link | balcao
  pago        INTEGER NOT NULL DEFAULT 0,
  situacao    TEXT NOT NULL DEFAULT 'novo',      -- novo|pago|separando|enviado|entregue|cancelado
  criado      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id          INTEGER PRIMARY KEY,
  pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id  INTEGER REFERENCES produtos(id),
  /* A descrição é COPIADA no momento do pedido, não lida por join na hora de
     mostrar. Se o produto for renomeado ou sair de linha, o pedido antigo
     continua dizendo o que foi vendido de fato. */
  descricao   TEXT NOT NULL,
  quantidade  INTEGER NOT NULL DEFAULT 1,
  preco       INTEGER NOT NULL DEFAULT 0,        -- centavos, unitário
  subtotal    INTEGER NOT NULL DEFAULT 0
);

/* ==========================================================================
   ORDEM DE SERVIÇO — o conserto

   O 'codigo' é o que o cliente digita para acompanhar. Ele é SORTEADO, e não
   sequencial: com AC-0001 qualquer pessoa lê a ordem do vizinho trocando o
   número, e ali dentro tem nome, telefone e aparelho.

   E o código sozinho não abre: a consulta pública exige código + os quatro
   últimos dígitos do telefone. Um código sorteado de seis caracteres ainda é
   adivinhável em escala; o segundo fator custa nada para quem é dono do
   aparelho e mata a varredura.
   ========================================================================== */
CREATE TABLE IF NOT EXISTS ordens (
  id            INTEGER PRIMARY KEY,
  codigo        TEXT NOT NULL UNIQUE,
  cliente       TEXT NOT NULL,
  telefone      TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  modelo_id     INTEGER REFERENCES modelos(id),
  aparelho      TEXT NOT NULL DEFAULT '',        -- texto livre: nem tudo está no catálogo
  imei          TEXT NOT NULL DEFAULT '',
  senha_aparelho TEXT NOT NULL DEFAULT '',
  defeito       TEXT NOT NULL DEFAULT '',
  acessorios    TEXT NOT NULL DEFAULT '',        -- o que veio junto: capa, chip, cartão
  orcamento     INTEGER NOT NULL DEFAULT 0,      -- centavos
  aprovado      INTEGER NOT NULL DEFAULT 0,
  situacao      TEXT NOT NULL DEFAULT 'recebido',
  coleta        INTEGER NOT NULL DEFAULT 0,      -- veio pelo busca e leva?
  prazo         TEXT,                            -- data prometida
  entregue      TEXT,
  criado        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_ordem_situacao ON ordens(situacao, criado);

/* A linha do tempo. É ela que o cliente vê na consulta pública — por isso
   'publico' existe: anotação interna ("peça chegou torta, cobrar fornecedor")
   não pode aparecer para quem digitou o código. */
CREATE TABLE IF NOT EXISTS ordem_etapas (
  id         INTEGER PRIMARY KEY,
  ordem_id   INTEGER NOT NULL REFERENCES ordens(id) ON DELETE CASCADE,
  situacao   TEXT NOT NULL,     -- recebido|diagnostico|orcamento|aprovado|reparo|teste|pronto|entregue|recusado
  nota       TEXT NOT NULL DEFAULT '',
  publico    INTEGER NOT NULL DEFAULT 1,
  autor      TEXT NOT NULL DEFAULT '',
  criado     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_etapa_ordem ON ordem_etapas(ordem_id, criado);

/* ==========================================================================
   BUSCA E LEVA

   Tabela própria, e não "contato com assunto = coleta". É o diferencial do
   negócio contra três concorrentes de franquia, e o que diferencia um pedido
   de coleta de uma mensagem é ter ENDEREÇO e JANELA DE HORÁRIO — sem os dois
   o motoboy não sai.
   ========================================================================== */
CREATE TABLE IF NOT EXISTS coletas (
  id         INTEGER PRIMARY KEY,
  nome       TEXT NOT NULL,
  telefone   TEXT NOT NULL,
  endereco   TEXT NOT NULL DEFAULT '',
  bairro     TEXT NOT NULL DEFAULT '',
  referencia TEXT NOT NULL DEFAULT '',
  aparelho   TEXT NOT NULL DEFAULT '',
  problema   TEXT NOT NULL DEFAULT '',
  periodo    TEXT NOT NULL DEFAULT 'manha',   -- manha | tarde
  quando     TEXT NOT NULL DEFAULT '',
  situacao   TEXT NOT NULL DEFAULT 'novo',    -- novo|agendado|coletado|cancelado
  ordem_id   INTEGER REFERENCES ordens(id),   -- vira OS quando o aparelho chega
  criado     TEXT NOT NULL DEFAULT (datetime('now'))
);

/* ==========================================================================
   BLOG
   ========================================================================== */
  /* ------------------------------------------------------------------------
     AVALIAÇÕES DO GOOGLE

     Copiadas à mão da ficha da loja, porque a API do Google é paga e a
     raspagem quebra a cada mudança do HTML deles.

     'estrelas' existe mesmo o site só mostrando 5: guardar a nota real é o que
     permite a regra ("só as de 5") viver numa consulta, e não na disciplina de
     quem cadastra. Uma avaliação de 4 pode ser cadastrada e simplesmente não
     aparece — o que é diferente de não poder ser registrada.

     'autor' guarda o primeiro nome como aparece no Google. Nome completo de
     cliente num site aberto é dado pessoal exposto sem necessidade.
     ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------
     PUBLICACAO — o instantaneo do que esta no ar

     O site le daqui; o painel edita as tabelas. Publicar copia uma coisa na
     outra, numa linha so — e por ser uma linha so, a troca e atomica: nao
     existe instante em que metade do site e nova e metade e velha.

     'dados' e o JSON inteiro do conteudo. Guardar tudo junto parece
     desperdicio ate a primeira vez em que alguem precisa saber o que estava
     no ar em determinada data.
     ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------
     FAQ — as perguntas frequentes

     Nao e enfeite de pagina: e a superficie de busca deste site. Como landing
     de pagina unica, ele tem UMA pagina para ranquear; cada pergunta aqui
     responde uma busca de cauda longa ("quanto tempo demora para trocar a
     tela") sem precisar de pagina nova — que e justamente o que o cliente
     removeu na 0.4.0.

     "ativo" em vez de apagar: pergunta fora de epoca (promocao, feriado) volta
     no ano seguinte, e reescrever de memoria perde o texto que ja funcionava.
     ------------------------------------------------------------------------ */
  CREATE TABLE IF NOT EXISTS faq (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    pergunta TEXT NOT NULL DEFAULT '',
    resposta TEXT NOT NULL DEFAULT '',
    ordem    INTEGER NOT NULL DEFAULT 0,
    ativo    INTEGER NOT NULL DEFAULT 1,
    criado   TEXT
  );

  /* ------------------------------------------------------------------------
     GOOGLE_CACHE — a ultima resposta da Places API

     Uma linha so (id = 1). Cada consulta a API e cobrada, e as avaliacoes
     mudam de mes em mes, nao de minuto em minuto: buscar a cada visita
     transformaria uma pagina popular numa fatura.

     Guardar tambem e o que mantem o site de pe quando a busca falha — cota
     estourada ou queda de rede nao pode apagar as avaliacoes da pagina.
     ------------------------------------------------------------------------ */
  CREATE TABLE IF NOT EXISTS google_cache (
    id     INTEGER PRIMARY KEY CHECK (id = 1),
    dados  TEXT NOT NULL,
    criado TEXT
  );

  CREATE TABLE IF NOT EXISTS publicacao (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    quem   TEXT NOT NULL DEFAULT '',
    dados  TEXT NOT NULL,
    criado TEXT
  );

  CREATE TABLE IF NOT EXISTS avaliacoes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    autor     TEXT NOT NULL DEFAULT '',
    texto     TEXT NOT NULL DEFAULT '',
    estrelas  INTEGER NOT NULL DEFAULT 5,
    quando    TEXT NOT NULL DEFAULT '',
    /* Veio da ficha do Google (copiada de la) ou chegou por outro caminho?
       DECLARADO por quem cadastra, nao adivinhado: o credito "Avaliacao no
       Google" e uma afirmacao verificavel — quem clicar no selo vai procurar.
       Padrao 1 porque e o que a tela pede; texto que chegou por WhatsApp ou
       formulario e desmarcado na hora de cadastrar. */
    do_google INTEGER NOT NULL DEFAULT 1,
    ordem     INTEGER NOT NULL DEFAULT 0,
    ativo     INTEGER NOT NULL DEFAULT 1,
    criado    TEXT
  );

CREATE TABLE IF NOT EXISTS posts (
  id        INTEGER PRIMARY KEY,
  slug      TEXT NOT NULL UNIQUE,
  titulo    TEXT NOT NULL,
  resumo    TEXT NOT NULL DEFAULT '',
  corpo     TEXT NOT NULL DEFAULT '',
  capa      TEXT NOT NULL DEFAULT '',
  etiqueta  TEXT NOT NULL DEFAULT '',
  autor     TEXT NOT NULL DEFAULT '',
  publicado INTEGER NOT NULL DEFAULT 1,
  data      TEXT NOT NULL DEFAULT (date('now')),
  criado    TEXT NOT NULL DEFAULT (datetime('now'))
);

/* ==========================================================================
   MENSAGENS E MEDIÇÃO
   ========================================================================== */
CREATE TABLE IF NOT EXISTS contatos (
  id        INTEGER PRIMARY KEY,
  nome      TEXT NOT NULL,
  telefone  TEXT NOT NULL DEFAULT '',
  email     TEXT NOT NULL DEFAULT '',
  assunto   TEXT NOT NULL DEFAULT '',
  mensagem  TEXT NOT NULL DEFAULT '',
  lido      INTEGER NOT NULL DEFAULT 0,
  criado    TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Contagem por dia e por página, sem cookie e sem terceiro. O IP entra como
   HASH com sal do dia: dá para contar visitante único e não dá para saber de
   quem era o endereço depois — IP é dado pessoal pela LGPD, e o que não se
   guarda não vaza. */
CREATE TABLE IF NOT EXISTS acessos (
  id      INTEGER PRIMARY KEY,
  dia     TEXT NOT NULL,
  rota    TEXT NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  criado  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_acesso_dia ON acessos(dia, rota);

/* ==========================================================================
   QUEM ENTRA NOS PAINÉIS

   Um cadastro só, com PAPEL — e não duas tabelas de usuário, uma por painel.
   O dono usa os dois: edita o texto da home de manhã e cadastra o seminovo à
   tarde. Dois cadastros significariam duas senhas para a mesma pessoa, e a
   segunda vira bilhete colado no monitor.

     admin    → seções do site (textos, blog, mensagens)
     tecnico  → ordens de serviço e etapas
     loja     → produtos, estoque, pedidos
     dono     → tudo

   Senha em scrypt com sal por usuário. Nunca em texto, nunca hash sem sal —
   que para senha curta é o mesmo que texto.
   ========================================================================== */
CREATE TABLE IF NOT EXISTS usuarios (
  id       INTEGER PRIMARY KEY,
  usuario  TEXT NOT NULL UNIQUE,
  nome     TEXT NOT NULL DEFAULT '',
  senha    TEXT NOT NULL,               -- sal:hash (scrypt)
  papel    TEXT NOT NULL DEFAULT 'admin'
           CHECK (papel IN ('admin','tecnico','loja','dono')),
  ativo    INTEGER NOT NULL DEFAULT 1,
  entrou   TEXT,
  criado   TEXT NOT NULL DEFAULT (datetime('now'))
);

/* A sessão vive no banco, não em memória: um restart do serviço no meio do
   expediente derrubaria todo mundo do painel sem motivo. */
CREATE TABLE IF NOT EXISTS sessoes (
  token      TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira     TEXT NOT NULL,
  criado     TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Trilha do que foi mexido. Numa loja com técnico, vendedor e dono editando
   preço, "quem baixou o valor do seminovo?" é pergunta que aparece. */
CREATE TABLE IF NOT EXISTS auditoria (
  id       INTEGER PRIMARY KEY,
  usuario  TEXT NOT NULL DEFAULT '',
  acao     TEXT NOT NULL,
  alvo     TEXT NOT NULL DEFAULT '',
  detalhe  TEXT NOT NULL DEFAULT '',
  criado   TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* ==========================================================================
   COLUNAS QUE CHEGAREM DEPOIS

   `CREATE TABLE IF NOT EXISTS` não altera tabela existente — quem já tem o
   banco rodando não ganharia a coluna nova, e o site quebraria na primeira
   consulta que a usasse. Aqui cada coluna é acrescentada se faltar, e a
   atualização do banco do cliente acontece sozinha na subida.
   ========================================================================== */
function coluna(tabela, nome, definicao) {
  const tem = db.prepare(`PRAGMA table_info(${tabela})`).all()
    .some((c) => c.name === nome);
  if (!tem) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${nome} ${definicao}`);
}
/* A foto de capa do serviço chegou na 0.3.0, com as imagens de banco. Quem já
   tinha o banco rodando ganha a coluna aqui, sem migração manual. */
coluna("servicos", "foto", "TEXT NOT NULL DEFAULT ''");

/* ==========================================================================
   COLUNAS QUE NASCERAM DEPOIS

   `CREATE TABLE IF NOT EXISTS` nao acrescenta coluna em tabela que ja existe:
   o banco do cliente ficaria sem ela e toda consulta que a mencionasse
   quebraria — em producao, na primeira visita depois do deploy.

   Cada linha e idempotente: se a coluna ja esta la, o SQLite recusa e a gente
   ignora. Nao ha "migracao pela metade" para acompanhar.
   ========================================================================== */
for (const alteracao of [
  "ALTER TABLE avaliacoes ADD COLUMN do_google INTEGER NOT NULL DEFAULT 1",
]) {
  try { db.exec(alteracao); } catch { /* a coluna ja existe */ }
}

/* ==========================================================================
   CONSULTAS — camada fina, só para não espalhar SQL pelo projeto
   ========================================================================== */
const Q = {
  todos: (sql, ...p) => db.prepare(sql).all(...p),
  um:    (sql, ...p) => db.prepare(sql).get(...p),
  roda:  (sql, ...p) => db.prepare(sql).run(...p),
  db,
};

/* Texto do site com padrão embutido. O padrão fica AQUI, na chamada, e não
   numa tabela de "valores iniciais": assim a página sempre tem o que mostrar,
   mesmo que a linha nunca tenha sido criada — que é o estado do site no dia
   em que ele sobe, antes de o cliente preencher qualquer coisa. */
/* ==========================================================================
   O TEXTO QUE O SITE MOSTRA E O QUE ESTA PUBLICADO

   Aqui, e nao em cada chamada: `txt()` e usado em mais de cem pontos, e trocar
   um por um deixaria justamente o esquecido mostrando rascunho no ar.

   O painel NAO usa esta funcao para editar — ele le a tabela `config` direto
   (ver `src/admin.js`), que e o rascunho. Sao caminhos diferentes de
   proposito: um mostra o que o visitante ve, o outro mostra o que esta sendo
   escrito.

   O `require` fica DENTRO da funcao porque `publicado.js` requer `db.js`: no
   topo, os dois se esperariam e um deles receberia um modulo pela metade.
   ========================================================================== */
function txt(chave, padrao = "") {
  const valor = require("./publicado").textos()[chave];
  return valor !== undefined && valor !== "" ? valor : padrao;
}

/* Grava um texto e, se não existir, cria já com grupo e rótulo — é isso que
   faz o campo aparecer no painel sem eu ter de cadastrá-lo antes. */
function ajuste(chave, valor, meta = {}) {
  const existe = Q.um("SELECT chave FROM config WHERE chave = ?", chave);
  if (existe) {
    Q.roda("UPDATE config SET valor = ? WHERE chave = ?", String(valor), chave);
  } else {
    Q.roda(
      `INSERT INTO config (chave, valor, grupo, rotulo, ajuda, tipo, ordem)
       VALUES (?,?,?,?,?,?,?)`,
      chave, String(valor), meta.grupo || "geral", meta.rotulo || chave,
      meta.ajuda || "", meta.tipo || "texto", meta.ordem || 0);
  }
}

/* ==========================================================================
   SEMEAR UM TEXTO — sem apagar o que o cliente escreveu

   `ajuste()` sobrescreve, e e isso que o painel precisa quando o dono salva.
   Mas o CONTEUDO INICIAL roda a cada entrega (o `deploy.sh` chama `semear()`),
   e ali sobrescrever significa **apagar tudo o que o cliente digitou**:
   endereco, telefone, horario, os textos de todas as secoes voltavam ao
   padrao no dia seguinte, sem erro e sem aviso.

   A divisao e por dono:

     · `valor`  -> e do CLIENTE. So entra quando a chave nasce.
     · `rotulo`, `ajuda`, `grupo`, `tipo`, `ordem` -> sao MEUS: descrevem o
       campo no painel e precisam poder melhorar a cada versao.

   Por isso o metadado e atualizado sempre e o valor, nunca.
   ========================================================================== */
function semearTexto(chave, valor, meta = {}) {
  const existe = Q.um("SELECT chave FROM config WHERE chave = ?", chave);
  if (!existe) return ajuste(chave, valor, meta);
  Q.roda(
    `UPDATE config SET grupo = ?, rotulo = ?, ajuda = ?, tipo = ?, ordem = ?
      WHERE chave = ?`,
    meta.grupo || "geral", meta.rotulo || chave, meta.ajuda || "",
    meta.tipo || "texto", meta.ordem || 0, chave);
}

/* ==========================================================================
   COMPLETAR UM CAMPO QUE ESTA VAZIO

   `semearTexto` nunca toca no valor — o que e certo para texto, e insuficiente
   para o cadastro da loja: os campos ja EXISTEM no banco (vazios), entao um
   padrao novo nunca chegaria neles.

   Aqui o valor entra **so quando esta vazio**. Nada que a pessoa tenha escrito
   e sobrescrito; o que estava em branco deixa de estar.

   Reservado a DADO DE IDENTIDADE (endereco, telefone, coordenadas): campo de
   contato vazio deixa o site pior e o valor e verificavel na ficha publica do
   negocio. Texto de marketing nao entra aqui — aquilo e opiniao do dono, e
   vazio pode ser escolha.
   ========================================================================== */
function completarSeVazio(chave, valor) {
  const l = Q.um("SELECT valor FROM config WHERE chave = ?", chave);
  if (!l) return;                       /* nao existe: quem cria e o semearTexto */
  const atual = String(l.valor || "").trim();
  /* O texto de espera conta como vazio: ele existe para ser trocado, e deixa-lo
     no ar e pior do que preencher com o dado real. */
  if (atual && !/^preencha /i.test(atual)) return;
  Q.roda("UPDATE config SET valor = ? WHERE chave = ?", String(valor), chave);
}

/* ==========================================================================
   ATUALIZAR SO O QUE AINDA E O TEXTO QUE NOS ESCREVEMOS

   Um texto padrao pode melhorar depois — porque a redacao ficou melhor, ou
   porque as palavras nao eram as que o cliente digita na busca. Mas o campo ja
   existe no banco de quem instalou antes, e `semearTexto` (de proposito) nunca
   toca no valor.

   A pergunta certa nao e "esta vazio?", e sim **"alguem mexeu nisto?"**. Se o
   valor e EXATAMENTE o padrao anterior, ninguem mexeu, e melhorar e seguro. Se
   mudou uma virgula, a decisao foi do dono e fica como esta.

   Por isso o padrao ANTIGO e um parametro: e ele que separa "nunca editado" de
   "editado". Sem ele, so haveria sobrescrever ou desistir.
   ========================================================================== */
function atualizarSeIntocado(chave, valorAntigo, valorNovo) {
  const l = Q.um("SELECT valor FROM config WHERE chave = ?", chave);
  if (!l) return;
  if (String(l.valor) !== String(valorAntigo)) return;   /* o dono mexeu: respeitar */
  Q.roda("UPDATE config SET valor = ? WHERE chave = ?", String(valorNovo), chave);
}

/* ==========================================================================
   DINHEIRO

   Entra como centavos inteiros e sai formatado. As duas funções ficam juntas
   de propósito: quem lê `centavos("1.234,50")` ao lado de `reais(123450)`
   entende na hora que o banco guarda um e a tela mostra o outro.
   ========================================================================== */
const reais = (c) => "R$ " + (Number(c || 0) / 100)
  .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Aceita "1.234,50", "1234.50" e "1234" — é o que o cliente digita no painel.
   O ponto só é separador decimal quando NÃO houver vírgula; com os dois, o
   ponto é milhar. Sem essa regra, "1.234,50" viraria R$ 1,23. */
function centavos(v) {
  if (typeof v === "number") return Math.round(v * 100);
  let s = String(v || "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Math.round((Number(s) || 0) * 100);
}

/* ==========================================================================
   CÓDIGO PÚBLICO — ordem de serviço e pedido

   Sorteado, não sequencial: com AC-0001 qualquer pessoa lê a ordem do vizinho
   trocando o número, e ali dentro tem nome, telefone e aparelho.

   O alfabeto não tem I, O, 0 nem 1. O código é ditado por telefone e escrito
   à mão num comprovante — e "I ou 1?" transforma o acompanhamento numa
   ligação para a loja, que é justamente o que ele veio evitar.
   ========================================================================== */
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function codigo(prefixo, tamanho = 6) {
  const crypto = require("node:crypto");
  let s = "";
  for (const b of crypto.randomBytes(tamanho)) s += ALFABETO[b % ALFABETO.length];
  return `${prefixo}-${s}`;
}

/* Código que ainda não existe na tabela. O sorteio pode repetir; sem esta
   volta, o UNIQUE derrubaria o cadastro na cara do atendente com o cliente
   no balcão. */
function codigoLivre(tabela, prefixo) {
  for (let i = 0; i < 20; i++) {
    const c = codigo(prefixo);
    if (!Q.um(`SELECT 1 FROM ${tabela} WHERE codigo = ?`, c)) return c;
  }
  /* 20 colisões seguidas em 32^6 possibilidades não acontece por acaso —
     é banco cheio ou sorteio quebrado. Melhor falhar alto do que gravar
     um código repetido. */
  throw new Error("não consegui sortear um código livre para " + tabela);
}

module.exports = { Q, txt, ajuste, semearTexto, completarSeVazio, atualizarSeIntocado, reais, centavos, codigo, codigoLivre, CAMINHO, db };
