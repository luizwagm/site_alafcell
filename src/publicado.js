"use strict";
/* ==========================================================================
   PUBLICADO — o que está no ar, separado do que está sendo escrito

   ---------------------------------------------------------------------------
   O PROBLEMA QUE ISTO RESOLVE

   Até a 0.6.0 o site lia as tabelas direto: salvar no painel era publicar. Isso
   é rápido e simples, e tem um custo que só aparece no uso — quem mexe em três
   telas deixa o site pela metade entre um salvamento e outro. O cliente que
   entra nesse intervalo vê o endereço novo com o horário velho.

   Agora existem duas versões de tudo:

     · RASCUNHO   as tabelas (config, servicos, marcas, modelos, posts,
                  avaliacoes). É o que o painel edita.
     · PUBLICADO  um INSTANTÂNEO em JSON, gravado na tabela `publicacao`.
                  É o que o site lê.

   Publicar é copiar um no outro — uma linha nova, gravada de uma vez.

   ---------------------------------------------------------------------------
   POR QUE INSTANTÂNEO, E NÃO UMA COLUNA "rascunho" EM CADA TABELA

   A coluna espelho obrigaria a duplicar TODAS as colunas de seis tabelas, e a
   cada campo novo alguém teria de lembrar de duplicá-lo também — o tipo de
   disciplina que falha em silêncio: o campo esquecido passaria a ir ao ar sem
   publicação, e ninguém descobriria até alguém reclamar.

   O instantâneo não tem esse problema: ele guarda o que existe, do jeito que
   existe. Campo novo entra sozinho.

   De brinde vem o HISTÓRICO: cada publicação é uma linha, com data e autor. Dá
   para ver quando o site mudou pela última vez — e, no futuro, voltar atrás.

   ---------------------------------------------------------------------------
   O CACHE

   O site lê o instantâneo em TODA página. Sem cache, seriam um SELECT e um
   JSON.parse de alguns KB por visita. O cache em memória é invalidado ao
   publicar; como o processo é um só, não há sincronia entre máquinas para
   fazer dar errado.
   ========================================================================== */
const { Q } = require("./db");

/* ==========================================================================
   O MODO RASCUNHO

   Uma flag de processo, e não um parâmetro carregado de função em função.

   Ela existe para a pré-visualização: o painel precisa renderizar as MESMAS
   páginas do site lendo o rascunho, e passar um parâmetro exigiria mudar a
   assinatura de `home`, `layout`, `blog`, `txt` e de tudo que eles chamam —
   dezenas de pontos, cada um uma chance de esquecer.

   ISTO SÓ É SEGURO PORQUE A RENDERIZAÇÃO É SÍNCRONA. `better-sqlite3` é
   síncrono e as páginas são montadas sem `await` no meio, então nenhum outro
   pedido roda entre ligar e desligar a flag. Se um dia entrar `await` no
   caminho de renderização, isto vira uma condição de corrida — dois pedidos
   simultâneos, um deles vendo o rascunho do outro. O `try/finally` do
   `comoRascunho` garante que ela sempre volta.
   ========================================================================== */
let RASCUNHO = false;

function comoRascunho(fn) {
  RASCUNHO = true;
  try { return fn(); }
  finally { RASCUNHO = false; }
}

const lendoRascunho = () => RASCUNHO;

/* ==========================================================================
   MONTAR O INSTANTÂNEO

   Só o que o SITE mostra. Preços, ordens, pedidos e contatos ficam de fora:
   não aparecem em página nenhuma, e carregá-los aqui engordaria o JSON que é
   lido a cada visita.
   ========================================================================== */
function montar() {
  return {
    versao: 1,
    textos: Object.fromEntries(
      Q.todos("SELECT chave, valor FROM config").map((c) => [c.chave, c.valor])),
    servicos: Q.todos(
      "SELECT * FROM servicos WHERE ativo = 1 ORDER BY destaque DESC, ordem"),
    marcas: Q.todos("SELECT * FROM marcas WHERE ativo = 1 ORDER BY ordem"),
    modelos: Q.todos(
      `SELECT m.*, ma.nome AS marca_nome, ma.slug AS marca_slug, ma.ordem AS marca_ordem
         FROM modelos m JOIN marcas ma ON ma.id = m.marca_id
        WHERE m.ativo = 1 AND ma.ativo = 1
        ORDER BY ma.ordem, m.ordem`),
    posts: Q.todos(
      "SELECT * FROM posts WHERE publicado = 1 ORDER BY data DESC, id DESC"),
    /* AS AVALIAÇÕES: do Google quando a busca está configurada, do cadastro
       manual quando não está.

       Uma fonte de cada vez, e não as duas misturadas: somadas, ninguém
       saberia dizer de onde veio cada cartão — e uma avaliação digitada à mão
       ao lado de uma do Google, com o mesmo selo, seria fazer passar por
       verificado o que não é.

       As duas regras do cliente valem nas duas fontes: só 5 estrelas, no
       máximo 3. */
    avaliacoes: (() => {
      const G = require("./google");
      if (G.configurado()) {
        const g = G.guardadas();
        /* Vindas da API, sao do Google por definicao — o site nao precisa
           perguntar a ninguem. */
        if (g && g.avaliacoes && g.avaliacoes.length)
          return g.avaliacoes.slice(0, 3).map((a) => ({ ...a, do_google: 1 }));
        return [];
      }
      return Q.todos(
        `SELECT autor, texto, quando, do_google FROM avaliacoes
          WHERE ativo = 1 AND estrelas = 5 AND texto <> ''
          ORDER BY ordem, id`);
    })(),
    /* As perguntas frequentes. Regra na CONSULTA, como as avaliações: o que
       está desativado não chega a ser publicado, em vez de depender de a tela
       lembrar de filtrar. */
    faq: Q.todos(
      `SELECT pergunta, resposta FROM faq
        WHERE ativo = 1 AND pergunta <> '' AND resposta <> ''
        ORDER BY ordem, id`),
    /* A nota e o total: os do Google mandam quando ele está ligado, senão os
       digitados. Assim o selo nunca mostra um número que contradiz os
       cartões logo abaixo. */
    google: (() => {
      const G = require("./google");
      const g = G.configurado() ? G.guardadas() : null;
      return {
        nota: (g && g.nota) || "",
        total: (g && g.total) || "",
        link: (g && g.link) || "",
        doGoogle: !!(g && g.avaliacoes && g.avaliacoes.length),
      };
    })(),
    precos: Q.todos(
      `SELECT servico_id, MIN(preco) AS minimo FROM precos
        WHERE ativo = 1 AND preco > 0 GROUP BY servico_id`),
  };
}

/* ==========================================================================
   O QUE ESTÁ NO AR
   ========================================================================== */
let CACHE = null;

function atual() {
  if (RASCUNHO) return montar();          /* pré-visualização */
  if (CACHE) return CACHE;
  const linha = Q.um("SELECT dados FROM publicacao ORDER BY id DESC LIMIT 1");
  if (!linha) {
    /* NUNCA PUBLICOU. Em vez de servir um site vazio — que é o que uma
       instalação nova veria —, o rascunho vale como publicado até alguém
       apertar o botão pela primeira vez. Um site que nasce em branco parece
       quebrado, e a primeira impressão seria de defeito, não de "falta
       publicar". */
    return montar();
  }
  try { CACHE = JSON.parse(linha.dados); }
  catch { CACHE = montar(); }             /* JSON corrompido: o site não cai */
  return CACHE;
}

function publicar(quem) {
  const dados = montar();
  Q.roda("INSERT INTO publicacao (quem, dados, criado) VALUES (?,?,?)",
    String(quem || ""), JSON.stringify(dados), new Date().toISOString());
  CACHE = dados;
  /* Histórico com teto: guardar todas as publicações de anos faria o banco
     crescer sem que ninguém olhasse. Vinte é o bastante para voltar atrás. */
  Q.roda(`DELETE FROM publicacao WHERE id NOT IN
          (SELECT id FROM publicacao ORDER BY id DESC LIMIT 20)`);
  return ultima();
}

function ultima() {
  const l = Q.um("SELECT id, quem, criado FROM publicacao ORDER BY id DESC LIMIT 1");
  return l || null;
}

/* ==========================================================================
   HÁ ALTERAÇÃO ESPERANDO?

   Compara o rascunho com o que está no ar. Comparar JSON inteiro é grosseiro e
   é exatamente o que se quer: qualquer diferença conta, inclusive a que eu não
   previ. Uma comparação campo a campo esqueceria o campo novo de amanhã, e o
   painel diria "tudo publicado" com alteração parada.
   ========================================================================== */
function haMudancas() {
  const l = Q.um("SELECT dados FROM publicacao ORDER BY id DESC LIMIT 1");
  if (!l) return true;                    /* nunca publicou */
  return l.dados !== JSON.stringify(montar());
}

/* ==========================================================================
   AS LEITURAS DO SITE

   Uma função por coisa que a página pede, para o instantâneo poder mudar de
   formato sem sair procurando `.textos[` pelo projeto.
   ========================================================================== */
const textos = () => atual().textos || {};
const servicos = (limite) => {
  const t = atual().servicos || [];
  return limite ? t.slice(0, limite) : t;
};
const marcas = () => atual().marcas || [];
const modelos = () => atual().modelos || [];
const populares = (limite = 6) =>
  (atual().modelos || []).filter((m) => m.popular).slice(0, limite);
const posts = (limite) => {
  const t = atual().posts || [];
  return limite ? t.slice(0, limite) : t;
};
const postPorSlug = (slug) =>
  (atual().posts || []).find((p) => p.slug === String(slug)) || null;
const avaliacoes = (limite = 3) => (atual().avaliacoes || []).slice(0, limite);
/* Quando o site mudou pela última vez — a data que vai no `lastmod` do
   sitemap. É a da PUBLICAÇÃO e não a da edição: o que o buscador vê mudar é o
   que foi publicado, e datar pela edição faria o sitemap anunciar mudança em
   páginas que continuam iguais no ar. */
const faq = () => atual().faq || [];
const quando = () => {
  const l = Q.um("SELECT criado FROM publicacao ORDER BY id DESC LIMIT 1");
  if (l && l.criado) return l.criado;
  /* NUNCA PUBLICOU — e mesmo assim o site esta no ar, porque sem publicacao o
     rascunho vale como publicado. A data de ultima mudanca e a do conteudo
     mais novo que existe; devolver vazio aqui deixaria o sitemap inteiro sem
     `lastmod` numa instalacao nova, que e justamente quando o buscador esta
     descobrindo o site e mais precisa saber o que ler. */
  const m = Q.um(`SELECT MAX(d) d FROM (
      SELECT MAX(criado) d FROM faq
      UNION ALL SELECT MAX(criado) FROM avaliacoes
      UNION ALL SELECT MAX(criado) FROM posts)`);
  return (m && m.d) || "";
};
/* A nota do selo: a do Google quando ele está ligado, senão a digitada no
   painel. Devolvida junto com `doGoogle` para a página poder dizer de onde
   veio — o selo do Google só é honesto quando os dados são do Google. */
const selo = () => {
  const g = atual().google || {};
  const t = atual().textos || {};
  return {
    nota: g.nota || t["google.nota"] || "",
    total: g.total || t["google.total"] || "",
    link: g.link || t["google.link"] || "",
    doGoogle: !!g.doGoogle,
  };
};
const marcaPorSlug = (slug) =>
  (atual().marcas || []).find((m) => m.slug === String(slug)) || null;
const modeloPorSlug = (slug) =>
  (atual().modelos || []).find((m) => m.slug === String(slug)) || null;
const servicoPorSlug = (slug) =>
  (atual().servicos || []).find((s) => s.slug === String(slug)) || null;
const precoMinimo = (servicoId) => {
  const p = (atual().precos || []).find((x) => Number(x.servico_id) === Number(servicoId));
  return p ? p.minimo : 0;
};

module.exports = {
  montar, publicar, ultima, haMudancas, atual,
  comoRascunho, lendoRascunho,
  textos, servicos, marcas, modelos, populares, posts, postPorSlug, avaliacoes, selo, quando, faq,
  marcaPorSlug, modeloPorSlug, servicoPorSlug, precoMinimo,
};
