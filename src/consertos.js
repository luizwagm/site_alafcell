"use strict";
/* ==========================================================================
   CONSERTOS — a lista e a página de cada serviço (0.13.0)

   ---------------------------------------------------------------------------
   POR QUE AS PÁGINAS VOLTARAM

   Na 0.4.0 o site virou landing e os serviços perderam a página própria. A
   landing responde bem a quem já conhece a loja; para quem busca, ela é UMA
   página disputando com franquias que têm uma por serviço. Quem digita "troca
   de tela caruaru" ou "celular não carrega" encontra a página da franquia que
   fala só daquilo, e não a landing que fala de tudo.

   Cada serviço volta a ter endereço (/consertos/troca-de-tela/), título,
   descrição e dados estruturados próprios, e entra no sitemap.

   ---------------------------------------------------------------------------
   O QUE NÃO VOLTOU: O PREÇO

   Até a 0.3 este arquivo desenhava tabela de preço por aparelho, página por
   marca e página por modelo. O cliente tirou preço de conserto do site
   inteiro na 0.4.0, e essa decisão continua valendo — ela está no CHANGELOG e
   nas provas. Aqui não há `precos`, `reais` nem "a partir de"; o que ocupa o
   lugar da tabela é a ferramenta de orçamento, já com o serviço escolhido.

   As páginas por marca e por modelo também não voltaram. Sem preço, elas
   seriam a mesma página com o nome do aparelho trocado — o que o buscador
   chama de "doorway page", e pune.

   ---------------------------------------------------------------------------
   TUDO SAI DO INSTANTÂNEO PUBLICADO

   `Pub.servicos()` e `Pub.servicoPorSlug()`, nunca a tabela. Um serviço
   escrito e não publicado continuaria abrindo pelo endereço direto — o
   rascunho no ar por uma porta lateral, que é o tropeço que o blog já teve.
   ========================================================================== */
const { txt } = require("./db");
const Pub = require("./publicado");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");
const { semHtml, emLinhas, comoHtml, linhaUnica } = require("./html-seguro");
const { prazoTexto, icone, cartaoServico, cidadesAtendidas } = require("./paginas");
const Orc = require("./orcamento");

const cidade = () => semHtml(txt("loja.cidade", "Caruaru"));

/* A garantia do serviço, e a da loja quando o serviço não tem uma própria.
   Software tem 30 dias e tela tem 90 — dizer "90 dias" para os dois seria
   prometer na página o que o comprovante não cobre. */
const garantia = (s) => (Number(s.garantia_dias) > 0
  ? `${Number(s.garantia_dias)} dias` : semHtml(txt("legal.garantia", "90 dias")));

/* Frase terminada. A chamada vem do painel com ou sem ponto final, e a
   descrição da página emenda outra frase depois dela. */
const frase = (t) => {
  const s = String(t || "").trim();
  return !s || /[.!?…]$/.test(s) ? s : s + ".";
};

/* ==========================================================================
   /consertos/ — a lista
   ========================================================================== */
function lista(req) {
  const servicos = Pub.servicos();
  const marcas = Pub.marcas();
  const onde = cidade();

  return L.pagina({
    req, atual: "consertos", canonical: "/consertos/",
    titulo: `Conserto de celular em ${onde}`,
    descricao: `Troca de tela, bateria, conector de carga, câmera, placa e software em ${onde}. `
      + `Cada conserto com o prazo real de bancada e ${semHtml(txt("legal.garantia", "90 dias"))} `
      + "de garantia na peça e no serviço. Orçamento pelo WhatsApp.",
    jsonld: jsonldLista(servicos),
    corpo: `
<section class="secao capa">
  <div class="env">
    <nav class="migalha" aria-label="Você está em">
      <a href="/">Início</a> <span>/</span> <strong>Consertos</strong>
    </nav>
    <p class="rotulo">${engrenagem("", 12)}O que a gente conserta</p>
    <h1 class="titulo capa__t">Conserto de celular em <em>${esc(onde)}</em></h1>
    <p class="sub">Cada conserto com o prazo real de bancada e
      ${esc(semHtml(txt("legal.garantia", "90 dias")))} de garantia por escrito — na peça e no
      serviço. O valor sai depois de olhar o aparelho: em celular, orçamento por tabela é chute.</p>
    <div class="hero__acoes">
      <a class="btn btn--acao" href="/orcamento/">Pedir orçamento</a>
    </div>
  </div>
</section>

<section class="secao" style="padding-top:0">
  <div class="env">
    ${servicos.length
      ? `<div class="grade grade--3">${servicos.map((s, i) =>
          cartaoServico(s, i, { foto: true, nivel: 2 })).join("")}</div>`
      : `<p class="tabela__nota">A lista de consertos está sendo atualizada.</p>`}
    <p class="tabela__nota">Não achou o seu problema? A lista traz os consertos que mais chegam à
      bancada, não tudo o que a gente faz —
      <a href="${zap("Olá! Meu problema não está na lista do site. Pode me ajudar?")}"
         target="_blank" rel="noopener">conte no WhatsApp</a>.</p>
  </div>
</section>

${marcas.length ? `
<section class="secao secao--tinta">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Por marca</p>
      <h2 class="titulo">Atendemos <em>todas as marcas</em></h2>
      <p class="sub">Inclusive as que não estão na lista. Escolha a sua e o orçamento já abre com ela.</p>
    </header>
    <div class="marcas">
      ${marcas.map((m) =>
        `<a class="marcas__i" href="/orcamento/?marca=${esc(m.slug)}#ferramenta">${esc(m.nome)}</a>`).join("")}
    </div>
  </div>
</section>` : ""}

${faixaColeta()}`,
  });
}

/* ==========================================================================
   /consertos/<slug>/ — a página de um serviço
   ========================================================================== */
function servico(req, slug) {
  const s = Pub.servicoPorSlug(slug);
  if (!s) return null;

  const onde = cidade();
  const nome = semHtml(s.nome);
  /* Um sintoma por linha — ou por parágrafo, ou por item de lista: o campo
     virou editor na 0.8.0 e o que está gravado pode ser qualquer um dos três. */
  const sintomas = emLinhas(s.sintomas).split("\n").filter(Boolean);
  const descricao = comoHtml(s.descricao);
  const outros = Pub.servicos().filter((o) => o.id !== s.id).slice(0, 3);
  const pedir = zap(Orc.mensagem({ servico: s.slug }));

  return L.pagina({
    req, atual: "consertos", canonical: `/consertos/${s.slug}/`,
    titulo: `${nome} em ${onde}`,
    descricao: `${nome} em ${onde}. ${frase(semHtml(s.chamada))} `
      + `${prazoTexto(s.prazo_horas)}, com ${garantia(s)} de garantia na peça e no serviço. `
      + "Orçamento pelo WhatsApp.",
    imagem: s.foto || null,
    jsonld: jsonldServico(s),
    corpo: `
<section class="secao capa-serv">
  <div class="env">
    <nav class="migalha" aria-label="Você está em">
      <a href="/">Início</a> <span>/</span> <a href="/consertos/">Consertos</a>
      <span>/</span> <strong>${esc(nome)}</strong>
    </nav>
    <div class="capa-serv__in">
      <div>
        <p class="rotulo">${engrenagem("", 12)}Conserto de celular em ${esc(onde)}</p>
        <h1 class="titulo capa-serv__t">${esc(nome)}</h1>
        <p class="sub">${linhaUnica(s.chamada)}</p>
        <!-- As fichas dizem só o que o cadastro sabe. "Orçamento grátis" ficou
             de fora: é promessa comercial, e quem a faz é o dono, no texto das
             etapas — não este molde. -->
        <dl class="fichas">
          <div class="ficha"><dt class="ficha__r">Prazo de bancada</dt><dd class="ficha__v dado">${esc(prazoTexto(s.prazo_horas))}</dd></div>
          <div class="ficha"><dt class="ficha__r">Garantia</dt><dd class="ficha__v dado">${esc(garantia(s))}</dd></div>
          <div class="ficha"><dt class="ficha__r">Orçamento</dt><dd class="ficha__v dado">Pelo WhatsApp</dd></div>
        </dl>
        <div class="hero__acoes">
          <a class="btn btn--acao" href="#orcamento">Pedir orçamento</a>
          <a class="btn btn--linha" href="/#busca-e-leva">Buscar meu aparelho</a>
        </div>
      </div>
      ${s.foto
        ? `<figure class="capa-serv__foto">
             <img src="${esc(s.foto)}" width="1200" height="800" fetchpriority="high"
                  decoding="async" alt="${esc(nome)} na bancada da ${esc(semHtml(txt("marca.nome", "Alafcell")))}">
           </figure>`
        : `<span class="capa-serv__ico">${icone(s.icone)}</span>`}
    </div>
  </div>
</section>

<section class="secao secao--tinta">
  <div class="env">
    <div class="serv-corpo">
      <div class="serv-corpo__texto" data-revela>
        <h2 class="titulo">Como a gente faz</h2>
        <!-- A descrição vem do editor do painel, gravada já limpa pelo
             sanitizarHtml. Entra como marcação: escapá-la mostraria as tags. -->
        <div class="artigo__corpo">${descricao}</div>
      </div>
      ${sintomas.length ? `
      <aside class="cartao" data-revela data-revela-atraso="1">
        <h2 class="cartao__titulo">É o seu caso?</h2>
        <ul class="sintomas">
          ${sintomas.map((x) => `<li>${esc(x)}</li>`).join("")}
        </ul>
        <p class="cartao__texto" style="margin-top:1rem">Se algum desses é o seu problema,
          este é o conserto. Na dúvida, conte no WhatsApp o que está acontecendo.</p>
      </aside>` : ""}
    </div>
  </div>
</section>

<!-- A FERRAMENTA DE ORÇAMENTO, com o serviço já escolhido. É o que ocupa o
     lugar da tabela de preços que esta página tinha até a 0.3: quem leu até
     aqui decidiu, e só falta dizer o aparelho. -->
<section class="secao busca" id="orcamento">
  <div class="env">
    <div class="busca__caixa cartao" data-revela>
      <div class="busca__cabeca">
        <p class="rotulo">${engrenagem("", 12)}Orçamento de ${esc(nome.toLowerCase())}</p>
        <h2 class="titulo">Qual é o <em>seu aparelho</em>?</h2>
        <p class="sub">A conversa abre no WhatsApp já dizendo o aparelho e que é
          ${esc(nome.toLowerCase())} — você só aperta enviar.</p>
      </div>
      ${Orc.formulario({ servicoFixo: s })}
      <p class="busca__nota">Não sabe o modelo? Pode enviar assim mesmo —
        <a href="${pedir}" target="_blank" rel="noopener">ou chame direto no WhatsApp</a>.
        <a href="/orcamento/">Por que não tem preço na tela?</a></p>
    </div>
  </div>
</section>

${faixaColeta()}

${outros.length ? `
<section class="secao secao--tinta">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Também consertamos</p>
      <h2 class="titulo">Outros <em>consertos</em></h2>
    </header>
    <div class="grade grade--3">
      ${outros.map((o, i) => cartaoServico(o, i, { foto: true })).join("")}
    </div>
    <p class="secao__mais"><a class="btn btn--linha" href="/consertos/">Ver todos os consertos</a></p>
  </div>
</section>` : ""}`,
  });
}

/* ==========================================================================
   A FAIXA DA BUSCA E LEVA

   O argumento que só esta loja tem, no momento em que a pessoa pensa "vou ter
   de ir lá". Até a 0.3 ela levava a /busca-e-leva/, que virou 404 na 0.4.0;
   agora vai à seção da landing e o botão abre o WhatsApp com a mesma mensagem
   do botão de lá.
   ========================================================================== */
function faixaColeta() {
  const onde = semHtml(txt("loja.cidade", "Caruaru"));
  return `
<section class="faixa">
  <img class="faixa__fundo" src="/assets/img/banco/entrega.webp" alt="" aria-hidden="true"
       loading="lazy" decoding="async" width="1200" height="800">
  <div class="env faixa__in">
    ${engrenagem("eng--gira faixa__eng", 120)}
    <div>
      <h2 class="faixa__t">Não quer sair de casa?</h2>
      <p class="faixa__d">${esc(semHtml(txt("coleta.aviso", "A gente busca o aparelho e devolve consertado.")))}
        <a href="/#busca-e-leva">Como funciona a busca e leva</a>.</p>
    </div>
    <a class="btn btn--acao btn--lg" href="${zap("Olá! Quero agendar a busca do meu aparelho em "
      + onde + ". Meu endereço é:")}" target="_blank" rel="noopener">Agendar a coleta</a>
  </div>
</section>`;
}

/* ==========================================================================
   SCHEMA.ORG

   `Service` SEM `offers`. Na versão com preço, o `Offer` só entrava quando
   havia valor; sem preço no site, não entra nunca — declarar oferta sem valor
   é marcação que o Google ignora e que pode render aviso no Search Console.

   TODO TEXTO PASSA POR `semHtml`: chamada, descrição e sintomas vêm do
   editor, e marcação dentro do dado estruturado é lida como texto — foi
   assim que "<p>Caruaru<br></p>" chegou ao `areaServed` da ficha da loja.

   O `provider` leva o MESMO `@id` da ficha da home (`/#loja`): para o
   buscador, o serviço desta página e a loja de lá são uma entidade só.
   ========================================================================== */
function ondeAtende() {
  const cidades = cidadesAtendidas();
  return (cidades.length ? cidades : [cidade()]).map((c) => ({ "@type": "City", name: c }));
}

function jsonldServico(s) {
  const url = `${SITE}/consertos/${s.slug}/`;
  const nome = semHtml(s.nome);
  const texto = semHtml(s.descricao) || semHtml(s.chamada);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#servico`,
        url,
        name: nome,
        serviceType: nome,
        category: "Conserto de celular",
        ...(texto ? { description: texto.slice(0, 500) } : {}),
        ...(s.foto ? { image: s.foto.startsWith("http") ? s.foto : SITE + s.foto } : {}),
        provider: {
          "@type": ["LocalBusiness", "MobilePhoneStore"],
          "@id": `${SITE}/#loja`,
          name: semHtml(txt("marca.nome", "Alafcell Assistec")),
          url: `${SITE}/`,
        },
        areaServed: ondeAtende(),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Consertos", item: `${SITE}/consertos/` },
          { "@type": "ListItem", position: 3, name: nome, item: url },
        ],
      },
    ],
  };
}

function jsonldLista(servicos) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/consertos/#pagina`,
        url: `${SITE}/consertos/`,
        name: `Conserto de celular em ${cidade()}`,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE}/#site` },
        about: { "@id": `${SITE}/#loja` },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: servicos.map((s, i) => ({
            "@type": "ListItem", position: i + 1, name: semHtml(s.nome),
            url: `${SITE}/consertos/${s.slug}/`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Consertos", item: `${SITE}/consertos/` },
        ],
      },
    ],
  };
}

module.exports = { lista, servico, faixaColeta, jsonldServico };
