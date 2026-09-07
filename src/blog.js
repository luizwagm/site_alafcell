"use strict";
/* ==========================================================================
   BLOG

   Um blog de assistência técnica só traz visita se resolver a dúvida que
   ANTECEDE o conserto — e essa dúvida quase sempre é "vale a pena?". Por isso
   as matérias respondem perguntas de busca, e não "novidades da loja", que
   ninguém procura.

   Cada matéria puxa para o serviço correspondente no fim: o texto informa, e
   quem termina de ler já está decidindo. Mandar essa pessoa de volta para a
   home seria desperdiçar o único momento em que ela está pronta.
   ========================================================================== */
const { Q, txt } = require("./db");
const Pub = require("./publicado");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");

/* Data por extenso, curta. "31 de agosto de 2026" ocupa a linha inteira num
   cartão de 260px; "31 ago 2026" cabe e diz a mesma coisa. */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dataBR(iso) {
  const [a, m, d] = String(iso || "").split("-");
  if (!a || !m || !d) return "";
  return `${Number(d)} ${MESES[Number(m) - 1] || ""} ${a}`;
}

/* O tempo de leitura. Não é enfeite: ele reduz a desistência antes do primeiro
   parágrafo, porque a pessoa decide se cabe no tempo dela agora. 200 palavras
   por minuto é a média de leitura em tela. */
function minutos(corpo) {
  const palavras = String(corpo || "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

function cartao(p, i) {
  return `
<a class="cartao cartao--acende post${p.capa ? " post--foto" : ""}" href="/blog/${esc(p.slug)}/"
   data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
  ${p.capa ? `<span class="post__capa"><img src="${esc(p.capa)}" alt="" loading="lazy"
    decoding="async" width="1200" height="800"></span>` : ""}
  ${p.etiqueta ? `<span class="selo selo--semi">${esc(p.etiqueta)}</span>` : ""}
  <h2 class="cartao__titulo">${esc(p.titulo)}</h2>
  <p class="cartao__texto">${p.resumo}</p>
  <span class="post__pe dado">${esc(dataBR(p.data))} · ${minutos(p.corpo)} min de leitura</span>
</a>`;
}

/* ==========================================================================
   /blog/
   ========================================================================== */
function indice(req) {
  const posts = Pub.posts();

  return L.pagina({
    req, atual: "blog", canonical: "/blog/",
    titulo: "Blog",
    descricao: "Antes de gastar com o conserto, leia: quando vale a pena trocar a tela, "
      + "o que estraga a bateria e o que fazer quando o celular cai na água.",
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [{
        "@type": "Blog", name: "Blog da Alafcell", url: `${SITE}/blog/`,
        publisher: { "@id": `${SITE}/#loja` },
        blogPost: posts.slice(0, 20).map((p) => ({
          "@type": "BlogPosting", headline: p.titulo, datePublished: p.data,
          url: `${SITE}/blog/${p.slug}/`,
        })),
      }],
    },
    corpo: `
<section class="secao capa">
  <div class="env">
    <p class="rotulo">${engrenagem("", 12)}Blog</p>
    <h1 class="titulo capa__t">Antes de gastar, <em>leia</em></h1>
    <p class="sub">O que a gente explica no balcão todo dia, escrito para você decidir
      com calma — inclusive quando a resposta honesta é "não conserta, troca".</p>
  </div>
</section>

<section class="secao" style="padding-top:0">
  <div class="env">
    ${posts.length
      ? `<div class="grade grade--3">${posts.map(cartao).join("")}</div>`
      : `<p class="tabela__nota">Ainda não há matérias publicadas.</p>`}
  </div>
</section>`,
  });
}

/* ==========================================================================
   /blog/:slug/
   ========================================================================== */
function materia(req, slug) {
  /* Do INSTANTÂNEO, e não da tabela: uma matéria escrita e não publicada
     continuaria abrindo pelo endereço direto, e o rascunho estaria no ar por
     uma porta lateral. */
  const p = Pub.postPorSlug(slug);
  if (!p) return null;

  const outros = Pub.posts().filter((x) => x.id !== p.id).slice(0, 2);

  return L.pagina({
    req, atual: "blog", canonical: `/blog/${p.slug}/`,
    titulo: p.titulo, descricao: p.resumo,
    imagem: p.capa || null,
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          headline: p.titulo,
          description: p.resumo,
          datePublished: p.data,
          dateModified: p.data,
          author: { "@type": "Organization", name: p.autor || txt("marca.nome", "Alafcell") },
          publisher: { "@id": `${SITE}/#loja` },
          mainEntityOfPage: `${SITE}/blog/${p.slug}/`,
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
            { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog/` },
            { "@type": "ListItem", position: 3, name: p.titulo, item: `${SITE}/blog/${p.slug}/` },
          ],
        },
      ],
    },
    corpo: `
<article class="secao artigo">
  <div class="env env--fino">
    <nav class="migalha" aria-label="Você está em">
      <a href="/">Início</a> <span>/</span> <a href="/blog/">Blog</a>
      <span>/</span> <strong>${esc(p.titulo)}</strong>
    </nav>

    <header class="artigo__topo">
      ${p.etiqueta ? `<p class="rotulo">${engrenagem("", 12)}${esc(p.etiqueta)}</p>` : ""}
      <h1 class="titulo">${esc(p.titulo)}</h1>
      <p class="sub">${p.resumo}</p>
      <p class="artigo__meta dado">${esc(dataBR(p.data))} · ${minutos(p.corpo)} min de leitura
        ${p.autor ? ` · ${esc(p.autor)}` : ""}</p>
    </header>

    ${p.capa ? `<figure class="artigo__capa">
      <img src="${esc(p.capa)}" width="1200" height="800" fetchpriority="high"
           decoding="async" alt="${esc(p.titulo)}">
    </figure>` : ""}

    <!-- O corpo vem do painel, onde ele é escrito num editor e gravado como
         HTML já limpo. Aqui ele entra como marcação, e não escapado: escapar
         mostraria as tags na tela do cliente. -->
    <div class="artigo__corpo">${p.corpo}</div>

    <aside class="artigo__cta cartao">
      <h2 class="cartao__titulo">Ficou com dúvida no seu caso?</h2>
      <p class="cartao__texto">Manda uma mensagem contando o que houve com o seu aparelho.
        O diagnóstico é de graça, e a gente diz na sua frente se vale ou não consertar.</p>
      <div class="hero__acoes">
        <a class="btn btn--acao" href="${zap("Olá! Li uma matéria no site e queria tirar uma dúvida.")}"
           target="_blank" rel="noopener">Perguntar no WhatsApp</a>
        <a class="btn btn--linha" href="/consertos/">Ver os preços</a>
      </div>
    </aside>
  </div>
</article>

${outros.length ? `
<section class="secao secao--tinta">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Continue lendo</p>
      <h2 class="titulo">Outras <em>matérias</em></h2>
    </header>
    <div class="grade grade--2">${outros.map(cartao).join("")}</div>
  </div>
</section>` : ""}`,
  });
}

module.exports = { indice, materia, dataBR, minutos };
