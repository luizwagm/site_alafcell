"use strict";
/* ==========================================================================
   ORÇAMENTO — a ferramenta, a página dela e a mensagem que ela monta

   ---------------------------------------------------------------------------
   TRÊS ENDEREÇOS, TRÊS PAPÉIS (0.13.0)

     /orcamento/            A PÁGINA. Indexada, no sitemap, com endereço que se
                            manda por WhatsApp. É ela que responde a busca
                            "orçamento conserto de celular caruaru".
     /orcamento/whatsapp    O DESVIO. Não desenha nada: lê a escolha, escreve a
                            mensagem e responde com o `wa.me`. Fora do índice.
     /orcamento?…           O ENDEREÇO ANTIGO do desvio (0.4.0 a 0.12.0). Com
                            escolha na query, continua levando ao WhatsApp —
                            página em cache e link colado num grupo não quebram.
                            Sem nada, é alguém digitando: vai para a página.

   A PÁGINA E O DESVIO NÃO PODIAM DIVIDIR O ENDEREÇO. Separar os dois só pela
   barra final ("/orcamento" desvia, "/orcamento/" mostra) seria confiar num
   caractere que o redirecionamento canônico, o nginx e quem digita tratam
   cada um de um jeito — e esse tropeço já aconteceu aqui uma vez (ver a lista
   OPERACAO no server.js). E o robots.txt proíbe por PREFIXO: `Disallow:
   /orcamento` tiraria a página nova do Google junto com o desvio.

   ---------------------------------------------------------------------------
   O FORMULÁRIO É UM SÓ

   A mesma função desenha a ferramenta na landing, nesta página e em cada
   página de conserto. Três cópias do mesmo formulário é como um deles fica
   com a lista de serviços velha — que já era o caso: o da landing oferecia
   só os 6 primeiros consertos, e o painel prometia que "o resto continua
   valendo no orçamento".
   ========================================================================== */
const { txt } = require("./db");
const Pub = require("./publicado");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");
const { semHtml } = require("./html-seguro");

const DESVIO = "/orcamento/whatsapp";

/* ==========================================================================
   O QUE A PESSOA ESCOLHEU

   Só vale o que existe NO INSTANTÂNEO. Um slug inventado na barra de endereço
   não pré-seleciona nada, e um modelo em rascunho não aparece — a pessoa o
   escolheria e a mensagem sairia sem ele.

   Modelo sem marca é o caso dos atalhos "Mais consertados": o link traz só o
   modelo, e a marca é deduzida dele. Marca e modelo que não combinam (um
   iPhone com a marca Samsung, colado à mão) ficam só com a marca.
   ========================================================================== */
function escolha(q = {}) {
  let marca = Pub.marcaPorSlug(q.marca);
  const modelo = Pub.modeloPorSlug(q.modelo);
  if (!marca && modelo) marca = Pub.marcaPorSlug(modelo.marca_slug);
  const modeloOk = modelo && marca && modelo.marca_slug === marca.slug ? modelo : null;
  const servico = q.servico === "outro" ? { slug: "outro", nome: "Outro problema" }
    : Pub.servicoPorSlug(q.servico);
  return { marca, modelo: modeloOk, servico };
}

/* ==========================================================================
   A MENSAGEM DO WHATSAPP

   OS NOMES SAEM DO BANCO, e não da query. O que chega na URL é um slug, e
   mandar o slug cru ("galaxy-a54") entregaria ao atendente um texto de
   máquina. É também o que impede forjar mensagem: só entra no texto o que
   existe cadastrado, ativo e publicado.
   ========================================================================== */
function mensagem(q = {}) {
  const e = escolha(q);
  /* Modelo que não combina com a marca some da tela, mas não da mensagem:
     aqui a pessoa já apertou enviar, e o nome do aparelho que ela escolheu
     ajuda mais o atendente do que atrapalha. */
  const modelo = e.modelo || Pub.modeloPorSlug(q.modelo);
  const aparelho = [e.marca && e.marca.nome, modelo && modelo.nome].filter(Boolean)
    .map((n) => semHtml(n)).join(" ");
  const servico = e.servico ? semHtml(e.servico.nome) : "";

  const msg = ["Olá! Vim pelo site e queria um orçamento."];
  if (aparelho) msg.push("Aparelho: " + aparelho + ".");
  if (servico) msg.push("Serviço: " + servico + ".");
  /* Sem nada escolhido a mensagem ainda vale: melhor a conversa começar vazia
     do que não começar. Quem não soube dizer o modelo no site diz no
     WhatsApp, com o aparelho na mão. */
  if (!aparelho && !servico) msg.push("Pode me ajudar?");
  return msg.join(" ");
}

/* ==========================================================================
   O FORMULÁRIO

   CONTINUA SENDO UM FORM GET DE VERDADE, apontando para uma rota do servidor
   que redireciona. Poderia ser JavaScript montando o link, e aí ficaria de
   fora justamente quem esta assistência atende: o celular velho com a rede
   ruim. O servidor monta a mensagem — funciona em qualquer navegador, com ou
   sem script.

   OS CAMPOS SÃO OPCIONAIS DE PROPÓSITO. Quem não souber dizer o modelo ainda
   assim chega ao WhatsApp; o que faltar, o atendente pergunta. Barrar o envio
   por um campo em branco seria perder o contato para proteger a completude de
   um texto. Por isso o modelo vazio se chama "Não sei o modelo" — e não
   "Escolha…", que soa como obrigação.

   `servicoFixo`: na página de um conserto o serviço já está decidido, e
   perguntar de novo seria fazer a pessoa repetir o que acabou de ler. Ele vai
   num campo oculto.

   OS MODELOS DA MARCA ESCOLHIDA SAEM IMPRESSOS. Sem isso, quem chega por um
   link com `?marca=samsung` e está sem JavaScript veria a marca marcada e o
   modelo vazio sem ter como preencher.
   ========================================================================== */
function formulario({ q = {}, servicoFixo = null, botao = "Pedir orçamento no WhatsApp" } = {}) {
  const e = escolha(q);
  const marcaSlug = e.marca ? e.marca.slug : "";
  const modeloSlug = e.modelo ? e.modelo.slug : "";
  const servicoSlug = e.servico ? e.servico.slug : "";
  const modelos = marcaSlug ? Pub.modelos().filter((m) => m.marca_slug === marcaSlug) : [];
  const marcado = (a, b) => (a && a === b ? " selected" : "");

  return `
<form class="busca__form" action="${DESVIO}" method="get">
  <label class="campo">
    <span class="campo__rot">Marca</span>
    <select name="marca" class="campo__ent" data-busca-marca>
      <option value="">Escolha…</option>
      ${Pub.marcas().map((m) =>
        `<option value="${esc(m.slug)}"${marcado(m.slug, marcaSlug)}>${esc(m.nome)}</option>`).join("")}
    </select>
  </label>
  <label class="campo">
    <span class="campo__rot">Modelo</span>
    <select name="modelo" class="campo__ent" data-busca-modelo>
      <option value="">Não sei o modelo</option>
      ${modelos.map((m) =>
        `<option value="${esc(m.slug)}"${marcado(m.slug, modeloSlug)}>${esc(m.nome)}</option>`).join("")}
    </select>
  </label>
  ${servicoFixo ? `<input type="hidden" name="servico" value="${esc(servicoFixo.slug)}">` : `
  <label class="campo">
    <span class="campo__rot">O que houve</span>
    <select name="servico" class="campo__ent">
      <option value="">Escolha…</option>
      ${Pub.servicos().map((s) =>
        `<option value="${esc(s.slug)}"${marcado(s.slug, servicoSlug)}>${esc(s.nome)}</option>`).join("")}
      <option value="outro"${marcado("outro", servicoSlug)}>Outro problema</option>
    </select>
  </label>`}
  <button class="btn btn--acao" type="submit">${esc(botao)}</button>
</form>`;
}

/* Os atalhos "Mais consertados": um toque e a conversa abre com o modelo. Vão
   direto ao desvio, e não à página, porque quem toca num modelo já disse tudo
   o que o formulário perguntaria. */
function atalhos() {
  const populares = Pub.populares(6);
  if (!populares.length) return "";
  return `
<div class="busca__rapidos">
  <span class="busca__rot">Mais consertados:</span>
  ${populares.map((m) =>
    `<a class="etiqueta" href="${DESVIO}?modelo=${esc(m.slug)}" rel="nofollow">${esc(m.nome)}</a>`).join("")}
</div>`;
}

const naoAchou = () => `
<p class="busca__nota">Não achou o seu? A lista tem os mais comuns —
  <a href="${zap("Olá! Meu aparelho não está na lista do site. Pode me ajudar?")}"
     target="_blank" rel="noopener">chame no WhatsApp</a> que a gente responde na hora.</p>`;

/* ==========================================================================
   /orcamento/ — A PÁGINA

   Não é um formulário solto numa página em branco: página só com formulário
   é o que o buscador chama de conteúdo raso, e ela não ranquearia para nada.
   Ela responde as três perguntas de quem pede orçamento — "como funciona?",
   "por que não tem preço?" e "vocês consertam o meu problema?" — e cada
   resposta sai de onde o resto do site já tira a mesma informação:

     · as etapas são as MESMAS da landing (`etapas.*` no painel). A promessa
       "só abrimos depois do seu ok" vive num lugar só; escrevê-la de novo
       aqui criaria duas versões dela, e uma ficaria velha;
     · os consertos são os cadastrados, com link para a página de cada um.

   `?marca=`, `?modelo=` e `?servico=` só pré-selecionam. O canonical aponta
   para "/orcamento/" limpo: dez variações da mesma página no índice seriam
   dez páginas competindo entre si.
   ========================================================================== */
function pagina(req, q = {}) {
  const cidade = semHtml(txt("loja.cidade", "Caruaru"));
  const etapas = [1, 2, 3, 4].map((n) => [
    txt(`etapas.${n}_titulo`, ""), txt(`etapas.${n}_texto`, ""),
  ]).filter(([t]) => t);
  const servicos = Pub.servicos();

  return L.pagina({
    req, atual: "orcamento", canonical: "/orcamento/",
    titulo: `Orçamento de conserto de celular em ${cidade}`,
    descricao: `Peça o orçamento do conserto do seu celular em ${cidade}: diga o aparelho e o `
      + "que houve, e a conversa abre no WhatsApp já com essas informações. "
      + `${semHtml(txt("legal.garantia", "90 dias"))} de garantia na peça e no serviço.`,
    jsonld: jsonld(),
    corpo: `
<section class="secao capa">
  <div class="env">
    <nav class="migalha" aria-label="Você está em">
      <a href="/">Início</a> <span>/</span> <strong>Orçamento</strong>
    </nav>
    <p class="rotulo">${engrenagem("", 12)}Orçamento pelo WhatsApp</p>
    <h1 class="titulo capa__t">Orçamento de conserto de celular em <em>${esc(cidade)}</em></h1>
    <p class="sub">Diga o aparelho e o que houve. A gente abre a conversa no WhatsApp já com
      essas informações — você só aperta enviar.</p>
    <div class="capa__form cartao" id="ferramenta">
      ${formulario({ q })}
      ${atalhos()}
      ${naoAchou()}
    </div>
  </div>
</section>

${etapas.length ? `
<section class="secao secao--tinta">
  <div class="env">
    <header class="secao__cabeca secao__cabeca--centro">
      <p class="rotulo">${engrenagem("", 12)}Depois que você envia</p>
      <h2 class="titulo">${txt("etapas.titulo", "Quatro passos, <em>nenhuma surpresa</em>")}</h2>
    </header>
    <ol class="etapas">
      ${etapas.map(([t, d], i) => `
      <li class="etapa" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <span class="etapa__n dado">${i + 1}</span>
        <h3 class="etapa__t">${t}</h3>
        <p class="etapa__d">${d}</p>
      </li>`).join("")}
    </ol>
  </div>
</section>` : ""}

<section class="secao">
  <div class="env env--fino">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Por que não tem preço aqui</p>
      <h2 class="titulo">Em celular, preço de tabela <em>é chute</em></h2>
    </header>
    <div class="artigo__corpo">
      <p>A mesma tela trincada pode ser só o vidro ou o display inteiro. Peça original e
        paralela de primeira linha têm preço e garantia diferentes. E aparelho que caiu na
        água só se orça depois de abrir.</p>
      <p>Por isso o valor sai depois de olhar o seu aparelho — e você escolhe sabendo a
        diferença, antes de a gente mexer em qualquer coisa.</p>
    </div>
  </div>
</section>

${servicos.length ? `
<section class="secao secao--tinta">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Antes de pedir</p>
      <h2 class="titulo">Leia sobre o <em>seu problema</em></h2>
      <p class="sub">Cada conserto tem o prazo de bancada, a garantia e os sintomas que
        indicam que é ele.</p>
    </header>
    <div class="marcas">
      ${servicos.map((s) =>
        `<a class="marcas__i" href="/consertos/${esc(s.slug)}/">${esc(s.nome)}</a>`).join("")}
    </div>
    <p class="secao__mais"><a class="btn btn--linha" href="/consertos/">Ver todos os consertos</a></p>
  </div>
</section>` : ""}`,
  });
}

/* ==========================================================================
   SCHEMA.ORG

   A página e o caminho até ela. Sem `Offer`: "orçamento grátis" com
   `price: 0` seria o site afirmando ao buscador um preço — e o cliente tirou
   preço de conserto do site inteiro.
   ========================================================================== */
function jsonld() {
  const nome = semHtml(txt("marca.nome", "Alafcell Assistec"));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE}/orcamento/#pagina`,
        url: `${SITE}/orcamento/`,
        name: `Orçamento de conserto de celular — ${nome}`,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE}/#site` },
        about: { "@id": `${SITE}/#loja` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Orçamento", item: `${SITE}/orcamento/` },
        ],
      },
    ],
  };
}

module.exports = { pagina, formulario, atalhos, naoAchou, mensagem, escolha, DESVIO };
