"use strict";
/* ==========================================================================
   QUEM CONSERTA — a seção do dono na home e a página /sobre/ (0.14.0)

   Numa assistência de bairro, o argumento que nenhuma franquia copia é a
   pessoa. "Alafcell" é o nome do dono, e a página existe para mostrar que
   quem responde pelo aparelho tem rosto, nome completo e formação conferível.

   A seção da home e a página saem DAQUI as duas, dos mesmos textos do painel
   (grupo "dono"). Duas cópias do mesmo parágrafo em arquivos diferentes é
   como uma delas fica velha.

   A FORMAÇÃO NÃO É DIGITADA EM LUGAR NENHUM: é a lista de matérias com a
   etiqueta "Capacitação". O dono faz um curso, publica a matéria (que é o que
   traz busca) e a página dele ganha a linha sozinha. Um campo "formação"
   separado ficaria desatualizado na primeira vez que ele esquecesse dele.
   ========================================================================== */
const { txt } = require("./db");
const Pub = require("./publicado");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");
const { semHtml } = require("./html-seguro");
const { dataBR } = require("./blog");

const CAPACITACAO = /^capacita/i;
const formacoes = () => Pub.posts().filter((p) => CAPACITACAO.test(String(p.etiqueta || "")));

const apelido = () => txt("dono.apelido", "Alaf");

/* A foto em pé. `figcaption` com o nome e o cargo em monoespaçada: é a
   "etiqueta de identificação" da bancada, a mesma linguagem dos números do
   topo — dado, não adjetivo. */
function foto(prioridade = false) {
  const src = txt("dono.foto", "");
  if (!src) return "";
  return `
<figure class="dono__foto"${prioridade ? "" : " data-revela"}>
  <img src="${esc(src)}" width="880" height="1100" decoding="async"
       ${prioridade ? 'fetchpriority="high"' : 'loading="lazy"'} alt="${esc(txt("dono.foto_alt", ""))}">
  <figcaption class="dono__cracha">
    <span class="dono__nome">${esc(apelido())}</span>
    <span class="dado">${esc(txt("dono.cargo", ""))}</span>
  </figcaption>
</figure>`;
}

/* Mês e ano, sem o dia: a data da matéria é a da PUBLICAÇÃO, que costuma vir
   dias depois do curso. "27 out 2026" diria que o curso foi no dia 27; "out
   2026" é verdade para os dois. */
const mesAno = (iso) => dataBR(iso).replace(/^\d+\s+/, "");

function listaFormacao(titulo) {
  const f = formacoes();
  if (!f.length) return "";
  return `
<div class="formacao">
  ${titulo}
  <ul class="formacao__lista">
    ${f.map((p) => `
    <li><a href="/blog/${esc(p.slug)}/">
      <span class="formacao__data dado">${esc(mesAno(p.data))}</span>
      <span class="formacao__t">${esc(p.titulo)}</span>
    </a></li>`).join("")}
  </ul>
</div>`;
}

/* ==========================================================================
   A SEÇÃO DA HOME

   Fica entre "Como funciona" e "Por que confiar": depois de saber COMO o
   conserto acontece, a pergunta seguinte é QUEM vai mexer no aparelho — e a
   garantia, que vem logo abaixo, passa a ser a palavra de alguém com rosto.
   ========================================================================== */
function secao() {
  if (!txt("dono.foto", "") && !txt("dono.resumo", "")) return "";
  return `
<section class="secao dono" id="quem-conserta">
  <div class="env dono__in">
    ${foto()}
    <div class="dono__texto" data-revela data-revela-atraso="1">
      <p class="rotulo">${engrenagem("", 12)}${txt("dono.rotulo", "Quem conserta")}</p>
      <h2 class="titulo">${txt("dono.titulo", "")}</h2>
      <div class="dono__resumo">${txt("dono.resumo", "")}</div>
      ${listaFormacao('<p class="formacao__rot dado">Formação recente</p>')}
      <div class="hero__acoes">
        <a class="btn btn--linha" href="/sobre/">Conhecer o ${esc(apelido())}</a>
      </div>
    </div>
  </div>
</section>`;
}

/* ==========================================================================
   /sobre/
   ========================================================================== */
function pagina(req) {
  const nome = txt("dono.nome", "") || apelido();
  const marca = txt("marca.nome", "Alafcell Assistec");
  const cidade = txt("loja.cidade", "Caruaru");
  const resumo = semHtml(txt("dono.resumo", "")).replace(/\s+/g, " ").trim();
  /* A descrição corta na palavra, perto dos 155 caracteres que o buscador
     mostra — cortada no meio de uma palavra, ela parece erro. */
  const descricao = resumo.length > 158 ? resumo.slice(0, 155).replace(/\s+\S*$/, "") + "…" : resumo;
  const foto_ = txt("dono.foto", "");

  const pessoa = {
    "@type": "Person",
    "@id": `${SITE}/sobre/#dono`,
    name: nome,
    alternateName: apelido(),
    jobTitle: txt("dono.cargo", ""),
    worksFor: { "@id": `${SITE}/#loja` },
    url: `${SITE}/sobre/`,
    knowsAbout: ["Conserto de celular", "Manutenção de smartphones Android",
      "Reparo em placa de celular", "Troca de tela e bateria"],
  };
  if (foto_) pessoa.image = SITE + foto_;

  return L.pagina({
    req, atual: "sobre", canonical: "/sobre/",
    titulo: `${apelido()}, técnico em conserto de celular em ${cidade}`,
    descricao,
    imagem: foto_ || null,
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "AboutPage",
          "@id": `${SITE}/sobre/`,
          url: `${SITE}/sobre/`,
          name: `Quem conserta na ${marca}`,
          about: { "@id": `${SITE}/sobre/#dono` },
          isPartOf: { "@id": `${SITE}/#loja` },
        },
        pessoa,
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
            { "@type": "ListItem", position: 2, name: "Quem conserta", item: `${SITE}/sobre/` },
          ],
        },
      ],
    },
    corpo: `
<section class="secao sobre">
  <div class="env">
    <nav class="migalha" aria-label="Você está em">
      <a href="/">Início</a> <span>/</span> <strong>Quem conserta</strong>
    </nav>
    <div class="dono__in sobre__in">
      ${foto(true)}
      <div class="dono__texto">
        <p class="rotulo">${engrenagem("", 12)}${txt("dono.rotulo", "Quem conserta")}</p>
        <h1 class="titulo">${esc(apelido())}, o técnico por trás da <em>${esc(marca)}</em></h1>
        <p class="sub">${esc(nome)} · ${esc(txt("dono.cargo", ""))} · ${esc(cidade)}/${esc(txt("loja.uf", "PE"))}</p>
        <div class="artigo__corpo">${txt("dono.historia", "")}</div>
        ${listaFormacao('<h2 class="formacao__h">Formação</h2>')}
        <div class="hero__acoes">
          <a class="btn btn--acao" href="${zap(`Olá, ${apelido()}! Vim pelo site e queria um orçamento.`)}"
             target="_blank" rel="noopener">Falar com o ${esc(apelido())} no WhatsApp</a>
          <a class="btn btn--linha" href="/consertos/">Ver os consertos</a>
        </div>
      </div>
    </div>
  </div>
</section>`,
  });
}

module.exports = { secao, pagina, formacoes };
