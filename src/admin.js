"use strict";
/* ==========================================================================
   ADMIN — a API do painel do dono da loja

   ---------------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE

   O conteúdo do site inteiro foi montado para ser preenchido por quem é dono
   dele: endereço, horário, telefone, CNPJ, os textos de cada seção, os
   serviços que a loja conserta, as marcas e modelos que aparecem no orçamento,
   e as matérias do blog. Até aqui nada disso tinha tela — o site subiu com
   "Preencha o endereço no painel" escrito na página, e o painel não existia.

   ---------------------------------------------------------------------------
   O QUE ELE NÃO FAZ, E POR QUÊ

   NÃO TEM "PUBLICAR". No BemEstarClinic, que serviu de modelo para a
   organização das telas, existe um botão de publicar porque lá as páginas são
   arquivos HTML com marcadores, reescritos a cada publicação. Aqui as páginas
   são geradas a cada pedido, direto do banco: salvar JÁ é publicar, e um botão
   a mais só criaria a dúvida de "será que salvou mesmo?".

   NÃO EDITA A LOJA. Produtos, preços de conserto, pedidos e ordens de serviço
   ficam de fora: a loja virtual saiu na 0.4.0 e o preço de conserto também.
   Oferecer telas para o que não aparece no site seria convidar o dono a
   preencher o que ninguém vai ler.

   ---------------------------------------------------------------------------
   A REGRA QUE ATRAVESSA TUDO AQUI

   O QUE PODE SER GRAVADO É DECIDIDO NO SERVIDOR, NUNCA NA TELA. Cada tabela
   editável declara suas colunas em `CAMPOS`, e o que chegar fora dessa lista é
   descartado sem aviso. Sem isso, um POST montado à mão trocaria `ativo`,
   `ordem` ou qualquer coluna que a tela não mostra — e a tela é só a parte que
   se vê da porta.
   ========================================================================== */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { Q, txt, ajuste } = require("./db");
const Painel = require("./painel");
const { sanitizarHtml, semHtml } = require("./html-seguro");

const RAIZ = path.join(__dirname, "..");
const PASTA_UPLOAD = path.join(RAIZ, "assets", "img", "uploads");

/* ==========================================================================
   O QUE CADA TABELA ACEITA

   A lista é a autorização. Uma coluna que não está aqui não é gravada por esta
   API nem que venha no corpo do pedido — vale para `id`, para `criado` e para
   qualquer coisa que alguém acrescente ao banco amanhã sem pensar no painel.
   ========================================================================== */
const CAMPOS = {
  servicos: ["slug", "nome", "categoria", "chamada", "descricao", "sintomas",
             "prazo_horas", "garantia_dias", "icone", "destaque", "ordem", "ativo", "foto"],
  marcas: ["slug", "nome", "logo", "ordem", "ativo"],
  modelos: ["marca_id", "slug", "nome", "ano", "popular", "ordem", "ativo"],
  posts: ["slug", "titulo", "resumo", "corpo", "capa", "etiqueta", "autor", "publicado", "data"],
  /* SEM `slug`: avaliação não tem página própria nem endereço. Acrescentar o
     campo só porque as outras tabelas têm faria o servidor gerar um slug que
     ninguém usa. */
  avaliacoes: ["autor", "texto", "estrelas", "quando", "ordem", "ativo", "do_google"],
  faq: ["pergunta", "resposta", "ordem", "ativo"],
};

/* ==========================================================================
   OS CAMPOS QUE ACEITAM FORMATAÇÃO

   Desde a 0.8.0 o painel edita com editor de texto, e o que chega é HTML. Ele
   é filtrado AQUI, na gravação — nunca só na tela.

   Trava de navegador se contorna mandando o texto direto para a API com um
   `curl`; e filtrar só na hora de exibir deixaria o HTML perigoso descansando
   no banco, pronto para vazar por qualquer outra rota que o leia (a API do
   painel, um backup, um relatório).

   O QUE NÃO ESTÁ NESTA LISTA é limpo de marcação, não escapado: são campos que
   viram `<title>`, `alt`, atributo ou dado estruturado, onde uma tag apareceria
   literalmente na cara do visitante ou quebraria o JSON-LD.
   ========================================================================== */
const CAMPOS_RICOS = {
  servicos: ["chamada", "descricao", "sintomas"],
  posts: ["resumo", "corpo"],
  avaliacoes: ["texto"],
  /* A resposta aceita formatação: ela vira parágrafo na página E texto da
     resposta no dado estruturado, onde o Google aceita marcação simples. A
     PERGUNTA não: ela é o texto da pergunta no resultado da busca, onde
     marcação apareceria literalmente. */
  faq: ["resposta"],
  marcas: [], modelos: [],
};

/* Colunas que são SIM/NÃO no banco (0 ou 1). A tela manda `true`/`false`, e o
   SQLite guardaria o texto "true" — que é verdadeiro em toda comparação e faz
   um serviço desativado continuar aparecendo no site. */
/* `do_google` entra aqui: sem isso a tela manda "true" e o SQLite guarda o
   TEXTO, que e verdadeiro em toda comparacao — a mesma armadilha de type
   affinity que ja fez item desativado continuar no site. */
const BOOLEANOS = new Set(["ativo", "destaque", "popular", "publicado", "do_google"]);
/* Colunas numéricas: `""` num campo inteiro vira 0 e não string vazia. */
const NUMEROS = new Set(["prazo_horas", "garantia_dias", "ordem", "marca_id", "ano", "estrelas"]);

const ORDENACAO = {
  servicos: "ordem, nome",
  marcas: "ordem, nome",
  modelos: "marca_id, ordem, nome",
  posts: "data DESC, id DESC",
  avaliacoes: "ordem, id",
  faq: "ordem, id",
};

/* ==========================================================================
   SLUG — o endereço da matéria e do serviço

   Gerado a partir do nome quando o campo vem vazio, e sempre limpo: é ele que
   entra na URL. Um slug com acento ou espaço vira `%C3%A7` no link que a loja
   manda por WhatsApp.
   ========================================================================== */
function slugificar(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   /* tira o acento, mantém a letra */
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* Slug único na tabela. Dois posts com o mesmo endereço fariam o segundo
   responder o primeiro — e ninguém entenderia por que a matéria nova não abre. */
function slugLivre(tabela, base, id) {
  let s = base || "item";
  let n = 2;
  for (;;) {
    const existe = id
      ? Q.um(`SELECT id FROM ${tabela} WHERE slug = ? AND id <> ?`, s, id)
      : Q.um(`SELECT id FROM ${tabela} WHERE slug = ?`, s);
    if (!existe) return s;
    s = `${base}-${n++}`;
  }
}

/* ==========================================================================
   LIMPEZA DE UM REGISTRO QUE CHEGA DA TELA
   ========================================================================== */
function limpar(tabela, corpo, id) {
  const dados = {};
  for (const campo of CAMPOS[tabela]) {
    if (!(campo in corpo)) continue;
    let v = corpo[campo];
    if (BOOLEANOS.has(campo)) v = (v === true || v === 1 || v === "1" || v === "true") ? 1 : 0;
    else if (NUMEROS.has(campo)) v = Number(String(v).replace(/\D/g, "")) || 0;
    else if ((CAMPOS_RICOS[tabela] || []).includes(campo)) v = sanitizarHtml(v);
    /* `semHtml`, e nao `sanitizarHtml`: o nome do servico vai para o <option>
       do seletor e para a mensagem do WhatsApp, e o titulo do post vira
       <title>. Marcacao nesses lugares aparece literalmente. */
    else v = semHtml(v);
    dados[campo] = v;
  }
  /* O slug nasce do nome quando ninguém digitou um. */
  if (CAMPOS[tabela].includes("slug")) {
    const nome = dados.nome || dados.titulo || corpo.nome || corpo.titulo || "";
    const base = slugificar(dados.slug || nome);
    dados.slug = slugLivre(tabela, base, id);
  }
  return dados;
}

function listar(tabela) {
  return Q.todos(`SELECT * FROM ${tabela} ORDER BY ${ORDENACAO[tabela]}`);
}

function gravar(tabela, id, corpo) {
  const dados = limpar(tabela, corpo, id);
  const campos = Object.keys(dados);
  if (!campos.length) return { erro: "nada para gravar" };

  if (id) {
    const jogo = campos.map((c) => `${c} = ?`).join(", ");
    Q.roda(`UPDATE ${tabela} SET ${jogo} WHERE id = ?`, ...campos.map((c) => dados[c]), id);
    return { ok: true, id: Number(id) };
  }
  const marcas = campos.map(() => "?").join(", ");
  const r = Q.roda(`INSERT INTO ${tabela} (${campos.join(", ")}) VALUES (${marcas})`,
    ...campos.map((c) => dados[c]));
  return { ok: true, id: Number(r.lastInsertRowid) };
}

/* ==========================================================================
   APAGAR — com a conferência que a tela não faz

   Marca com modelo dentro não some: os modelos ficariam órfãos, apontando para
   uma marca que não existe, e sumiriam do seletor de orçamento sem que ninguém
   entendesse por quê. O recado diz o que fazer.
   ========================================================================== */
function apagar(tabela, id) {
  if (tabela === "marcas") {
    const n = Q.um("SELECT COUNT(*) c FROM modelos WHERE marca_id = ?", id).c;
    if (n > 0) {
      return { erro: `Esta marca tem ${n} modelo(s). Apague ou mude os modelos antes — `
                   + `senão eles somem do seletor de orçamento sem aviso.` };
    }
  }
  Q.roda(`DELETE FROM ${tabela} WHERE id = ?`, id);
  return { ok: true };
}

/* ==========================================================================
   TEXTOS DO SITE

   Vêm agrupados como o painel mostra. `ajuste()` grava; chave que não existe é
   ignorada — campo novo se declara em `conteudo-inicial.js`, que é onde ele
   nasce com grupo, rótulo e ajuda.
   ========================================================================== */
const ROTULO_GRUPO = {
  marca: "Marca e contato",
  etapas: "Como funciona",
  confianca: "Por que confiar",
  blog: "Blog",
  google: "Recomendações",
  loja: "A loja",
  home: "Página inicial",
  coleta: "Busca e leva",
  legal: "Garantia e prazos",
  medicao: "Medição (Analytics)",
  pagamento: "Pagamento",
};

function textos() {
  const linhas = Q.todos(
    "SELECT chave, valor, grupo, rotulo, ajuda, tipo, ordem FROM config ORDER BY grupo, ordem, chave");
  const grupos = [];
  for (const l of linhas) {
    let g = grupos.find((x) => x.grupo === l.grupo);
    if (!g) { g = { grupo: l.grupo, rotulo: ROTULO_GRUPO[l.grupo] || l.grupo, campos: [] }; grupos.push(g); }
    g.campos.push(l);
  }
  return grupos;
}

/* ==========================================================================
   O DESTINO DO CAMPO DECIDE SE ELE ACEITA FORMATAÇÃO

   O painel edita com editor de texto onde o campo é do tipo `area`; nos demais
   é uma linha só. Mas o tipo não basta para decidir o filtro: `loja.horario_dados`
   é `area` e vai para o dado estruturado do Google, `confianca.foto_alt` é `area`
   e vira o `alt` de uma imagem. Marcação nesses dois não fica feia — ela
   quebra o JSON-LD e aparece dentro do atributo.

   Por isso a lista é por DESTINO, não por tipo.
   ========================================================================== */
const TEXTO_PURO = new Set([
  "loja.horario_dados",   /* vira JSON-LD (openingHours) */
  "confianca.foto_alt",   /* vira o atributo alt */
  "marca.nome",           /* vira <title> e o nome no Schema.org */
  "marca.cnpj", "marca.telefone", "marca.whatsapp", "marca.email",
  "loja.cidade", "loja.uf", "loja.cep", "loja.bairro",
  "loja.latitude", "loja.longitude",
  "medicao.ga4", "medicao.pixel",
  "pagamento.pix_chave", "pagamento.pix_nome",
  "google.nota", "google.total",
]);

function gravarTextos(corpo) {
  let n = 0;
  for (const [chave, valor] of Object.entries(corpo)) {
    const atual = Q.um("SELECT chave, tipo FROM config WHERE chave = ?", chave);
    if (!atual) continue;
    const cru = String(valor == null ? "" : valor);
    /* So o DESTINO decide. Nao dá para usar o tipo: `home.titulo` é de uma
       linha e usa <em> para o destaque da marca — limpá-lo tiraria a
       identidade visual do topo da página. */
    const limpo = TEXTO_PURO.has(chave) ? semHtml(cru) : sanitizarHtml(cru);
    ajuste(chave, limpo);
    n++;
  }
  return { ok: true, gravados: n };
}

/* ==========================================================================
   ACESSOS

   A contagem é a da tabela `acessos`, que o próprio site alimenta: sem cookie,
   sem terceiro e guardando só um código embaralhado do IP. Ela não depende do
   Google — por isso o painel nunca fica cego, mesmo com o visitante recusando
   os cookies de medição.
   ========================================================================== */
function acessos() {
  const dia = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const n = (sql, ...p) => Number(Q.um(sql, ...p).c || 0);
  return {
    total: n("SELECT COUNT(*) c FROM acessos"),
    hoje: n("SELECT COUNT(*) c FROM acessos WHERE dia = ?", dia(0)),
    semana: n("SELECT COUNT(*) c FROM acessos WHERE dia >= ?", dia(7)),
    mes: n("SELECT COUNT(*) c FROM acessos WHERE dia >= ?", dia(30)),
    visitantes: n("SELECT COUNT(DISTINCT ip_hash) c FROM acessos"),
    visitantesMes: n("SELECT COUNT(DISTINCT ip_hash) c FROM acessos WHERE dia >= ?", dia(30)),
    porDia: Q.todos(
      "SELECT dia, COUNT(*) total FROM acessos WHERE dia >= ? GROUP BY dia ORDER BY dia", dia(30)),
    topRotas: Q.todos(
      "SELECT rota, COUNT(*) total FROM acessos GROUP BY rota ORDER BY total DESC LIMIT 12"),
    primeiro: (Q.um("SELECT MIN(dia) d FROM acessos") || {}).d || null,
  };
}

/* ==========================================================================
   IMAGENS

   Upload sem biblioteca de imagem: o projeto não tem `sharp`, então o arquivo é
   guardado como veio. O que ISSO exige em troca é conferência de verdade na
   entrada, e ela é feita pelos BYTES, não pela extensão nem pelo que o
   navegador diz ser.

   Extensão e `Content-Type` são texto que o cliente escolhe. Um `.png` pode ser
   um script; confiar neles é a diferença entre uma pasta de imagens e uma
   pasta de arquivos executáveis com nome bonito.

   ⚠ SEM REDIMENSIONAMENTO. Foto direto do celular tem 4000px e vários MB, e
   vai para o site do jeito que veio — o teto de 3 MB existe para isso não
   virar uma home de 12 MB. Quando entrar `sharp`, é aqui que ele entra.
   ========================================================================== */
const TIPOS_IMAGEM = [
  { ext: ".webp", teste: (b) => b.slice(0, 4).toString("ascii") === "RIFF"
                             && b.slice(8, 12).toString("ascii") === "WEBP" },
  { ext: ".png", teste: (b) => b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { ext: ".jpg", teste: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

const TETO_IMAGEM = 3 * 1024 * 1024;

function tipoDaImagem(buf) {
  if (!buf || buf.length < 12) return null;
  return TIPOS_IMAGEM.find((t) => t.teste(buf)) || null;
}

function gravarImagem(buf) {
  if (buf.length > TETO_IMAGEM) {
    return { erro: `A imagem tem ${(buf.length / 1048576).toFixed(1)} MB e o limite é 3 MB. `
                 + `Reduza antes de enviar — o site não redimensiona.` };
  }
  const tipo = tipoDaImagem(buf);
  if (!tipo) return { erro: "Isso não é uma imagem JPG, PNG ou WEBP." };

  /* Nome SORTEADO, e não o nome do arquivo enviado. O nome que vem do
     navegador é texto do cliente: pode ter barra, `..`, ou repetir o de outra
     foto e sobrescrevê-la sem ninguém notar. */
  fs.mkdirSync(PASTA_UPLOAD, { recursive: true });
  const nome = crypto.randomBytes(8).toString("hex") + tipo.ext;
  fs.writeFileSync(path.join(PASTA_UPLOAD, nome), buf);
  return { ok: true, caminho: `/assets/img/uploads/${nome}` };
}

/* ==========================================================================
   ENTRAR

   O freio é por IP e vale para o painel inteiro: sem ele, o formulário de
   entrada é uma porta aberta para tentar senha à vontade. Cinco por dez
   minutos é folgado para quem erra e apertado para quem adivinha.
   ========================================================================== */
const baldes = new Map();
function freioEntrada(ip) {
  const agora = Date.now();
  const b = baldes.get(ip) || { n: 0, ate: agora + 600000 };
  if (agora > b.ate) { b.n = 0; b.ate = agora + 600000; }
  b.n += 1;
  baldes.set(ip, b);
  if (baldes.size > 5000) baldes.clear();
  return b.n <= 5;
}

function entrar(usuario, senha) {
  const u = Q.um("SELECT * FROM usuarios WHERE usuario = ? AND ativo = 1", String(usuario || "").trim());
  /* A mesma resposta para usuário inexistente e senha errada: dizer "usuário
     não existe" entrega a lista de quem tem conta. */
  if (!u || !Painel.confere(senha, u.senha)) return null;
  return u;
}

module.exports = {
  CAMPOS, listar, gravar, apagar, textos, gravarTextos, acessos,
  gravarImagem, entrar, freioEntrada, slugificar, TETO_IMAGEM,
};
