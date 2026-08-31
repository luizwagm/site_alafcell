"use strict";
/* ==========================================================================
   CONSERTOS — a página que os concorrentes não têm

   As três franquias que disputam "assistência técnica em Caruaru" param no
   "faça um orçamento". O visitante sai da página sem a resposta que foi buscar,
   e vai perguntar no WhatsApp de outra loja.

   Aqui a tabela de preços fica na tela. Três consequências de projeto:

   1. O PREÇO É "A PARTIR DE", e isso vai escrito. Tela tem peça original e
      paralela; prometer valor fechado sem ver o aparelho é prometer o que não
      se pode cumprir — e o balcão desmentiria o site na frente do cliente.

   2. SEM PREÇO CADASTRADO A LINHA NÃO SOME, ela diz "orçamento na hora".
      Sumir faria o cliente concluir que a loja não faz aquele serviço.

   3. CADA CRUZAMENTO TEM ENDEREÇO PRÓPRIO (?modelo=iphone-11). É o que
      responde a busca de cauda longa — "quanto custa trocar a tela do iPhone 11
      em Caruaru" — que é onde uma loja local ainda ganha de uma franquia.
   ========================================================================== */
const { Q, txt, reais } = require("./db");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");
const { prazoTexto, apartirDe, icone } = require("./paginas");

/* Preço + prazo de um serviço para um aparelho. O prazo cai para o do serviço
   quando a linha não tem prazo próprio — a exceção é por aparelho, não a regra. */
function precoDe(modeloId, servico) {
  const p = Q.um(
    "SELECT preco, prazo_horas, observacao FROM precos WHERE modelo_id = ? AND servico_id = ? AND ativo = 1",
    modeloId, servico.id);
  return {
    preco: p && p.preco > 0 ? p.preco : 0,
    horas: (p && p.prazo_horas) || servico.prazo_horas,
    observacao: p ? p.observacao : "",
  };
}

/* ==========================================================================
   O FORMULÁRIO DE APARELHO

   Repetido em todas as telas de conserto, sempre com o que já foi escolhido
   marcado. Sem isso, refazer a busca do zero a cada clique — e é aí que a
   pessoa desiste e vai para o WhatsApp de outra loja.
   ========================================================================== */
function seletor(marcaSlug = "", modeloSlug = "") {
  const marcas = Q.todos("SELECT slug, nome FROM marcas WHERE ativo = 1 ORDER BY ordem");
  const modelos = marcaSlug
    ? Q.todos(`SELECT m.slug, m.nome FROM modelos m JOIN marcas ma ON ma.id = m.marca_id
               WHERE ma.slug = ? AND m.ativo = 1 ORDER BY m.ordem, m.nome`, marcaSlug)
    : [];

  return `
<form class="busca__form" action="/consertos/" method="get">
  <label class="campo">
    <span class="campo__rot">Marca</span>
    <select name="marca" class="campo__ent" data-busca-marca>
      <option value="">Escolha…</option>
      ${marcas.map((m) => `<option value="${esc(m.slug)}"${m.slug === marcaSlug ? " selected" : ""}>${esc(m.nome)}</option>`).join("")}
    </select>
  </label>
  <label class="campo">
    <span class="campo__rot">Modelo</span>
    <select name="modelo" class="campo__ent" data-busca-modelo>
      <option value="">Todos os modelos</option>
      ${modelos.map((m) => `<option value="${esc(m.slug)}"${m.slug === modeloSlug ? " selected" : ""}>${esc(m.nome)}</option>`).join("")}
    </select>
  </label>
  <button class="btn btn--acao" type="submit">Ver preços</button>
</form>`;
}

/* Aviso honesto, no pé de toda tabela. Ele não é letra miúda de propósito: o
   cliente que lê isso antes de vir não se decepciona no balcão, e o que se
   decepciona no balcão não volta. */
const NOTA = `
<p class="tabela__nota">
  Valores <strong>a partir de</strong>, para peça de primeira linha, e válidos com o
  aparelho sem outros danos. Aparelho que caiu na água ou já foi aberto antes é
  orçado depois do diagnóstico — sem custo, e a gente só abre com o seu ok.
</p>`;

/* ==========================================================================
   /consertos/  —  sem filtro: os serviços
                   ?marca=  : os modelos daquela marca
                   ?modelo= : a tabela daquele aparelho
   ========================================================================== */
function lista(req, q) {
  const marcaSlug = String(q.marca || "").trim();
  const modeloSlug = String(q.modelo || "").trim();
  const servicos = Q.todos("SELECT * FROM servicos WHERE ativo = 1 ORDER BY ordem, nome");

  /* ------------------------------------------------- um aparelho escolhido */
  if (modeloSlug) {
    const modelo = Q.um(
      `SELECT m.*, ma.nome marca, ma.slug marca_slug FROM modelos m
       JOIN marcas ma ON ma.id = m.marca_id WHERE m.slug = ? AND m.ativo = 1`, modeloSlug);
    if (modelo) return doAparelho(req, modelo, servicos);
  }

  /* ------------------------------------------------------ uma marca só */
  if (marcaSlug) {
    const marca = Q.um("SELECT * FROM marcas WHERE slug = ? AND ativo = 1", marcaSlug);
    if (marca) return daMarca(req, marca, servicos);
  }

  /* -------------------------------------------------------- todos os serviços */
  const cartoes = servicos.map((s, i) => {
    const p = apartirDe(s.id);
    return `
    <a class="cartao cartao--acende serv${s.foto ? " serv--foto" : ""}" href="/consertos/${esc(s.slug)}/" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
      ${s.foto ? `<span class="serv__capa"><img src="${esc(s.foto)}" alt="" loading="lazy"
        decoding="async" width="1200" height="800"></span>` : ""}
      <span class="serv__ico">${icone(s.icone)}</span>
      <h2 class="cartao__titulo">${esc(s.nome)}</h2>
      <p class="cartao__texto">${esc(s.chamada)}</p>
      <span class="serv__pe">
        ${p ? `<span class="preco"><span class="preco__apartir">A partir de</span>${esc(reais(p))}</span>`
            : `<span class="preco"><span class="preco__apartir">Orçamento</span>Na hora</span>`}
        <span class="serv__prazo dado">${esc(prazoTexto(s.prazo_horas))}</span>
      </span>
    </a>`;
  }).join("");

  const marcas = Q.todos("SELECT slug, nome FROM marcas WHERE ativo = 1 ORDER BY ordem");

  return L.pagina({
    req, atual: "consertos", canonical: "/consertos/",
    titulo: "Consertos e preços",
    descricao: `Preço e prazo de troca de tela, bateria, conector de carga e câmera em `
      + `${txt("loja.cidade", "Caruaru")}. Escolha o seu aparelho e veja quanto custa, `
      + `com ${txt("legal.garantia", "90 dias")} de garantia.`,
    jsonld: jsonldServicos(servicos),
    corpo: `
${cabecaConserto("Consertos", "Preço e prazo <em>na tela</em>",
  "Escolha o seu aparelho e veja quanto custa cada conserto. Sem cadastro e sem esperar alguém responder.",
  seletor(marcaSlug, modeloSlug))}

<section class="secao">
  <div class="env">
    <div class="grade grade--3">${cartoes}</div>
    ${NOTA}
  </div>
</section>

<section class="secao secao--tinta">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Por marca</p>
      <h2 class="titulo">Atendemos <em>todas as marcas</em></h2>
      <p class="sub">Inclusive as que não estão na lista — o catálogo tem os aparelhos que mais
        chegam à bancada, não tudo o que a gente conserta.</p>
    </header>
    <div class="marcas">
      ${marcas.map((m) => `<a class="marcas__i" href="/consertos/?marca=${esc(m.slug)}">${esc(m.nome)}</a>`).join("")}
    </div>
  </div>
</section>

${faixaColeta()}`,
  });
}

/* ------------------------------------------------------- a tabela do aparelho */
function doAparelho(req, modelo, servicos) {
  const linhas = servicos.map((s) => {
    const p = precoDe(modelo.id, s);
    return `
    <tr>
      <th scope="row" class="tab__serv">
        <a href="/consertos/${esc(s.slug)}/">${esc(s.nome)}</a>
        ${p.observacao ? `<span class="tab__obs">${esc(p.observacao)}</span>` : ""}
      </th>
      <td class="tab__preco">${p.preco
        ? `<span class="preco"><span class="preco__apartir">A partir de</span>${esc(reais(p.preco))}</span>`
        : `<span class="tab__sem">Orçamento na hora</span>`}</td>
      <td class="tab__prazo dado">${esc(prazoTexto(p.horas))}</td>
      <td class="tab__acao">
        <a class="btn btn--linha btn--sm" href="${zap(
          `Olá! Quero um orçamento de ${s.nome.toLowerCase()} para ${modelo.marca} ${modelo.nome}.`)}"
          target="_blank" rel="noopener">Quero este</a>
      </td>
    </tr>`;
  }).join("");

  const comPreco = servicos.filter((s) => precoDe(modelo.id, s).preco > 0).length;

  return L.pagina({
    req, atual: "consertos", canonical: `/consertos/?modelo=${modelo.slug}`,
    titulo: `Conserto de ${modelo.marca} ${modelo.nome}`,
    descricao: `Quanto custa consertar ${modelo.marca} ${modelo.nome} em `
      + `${txt("loja.cidade", "Caruaru")}: tela, bateria, conector de carga e câmera, com preço, `
      + `prazo e ${txt("legal.garantia", "90 dias")} de garantia.`,
    corpo: `
${cabecaConserto(`${modelo.marca} ${modelo.nome}`,
  `Consertos do <em>${esc(modelo.nome)}</em>`,
  comPreco
    ? `Estes são os valores de partida para este aparelho, com o prazo real de bancada.`
    : `Ainda não temos a tabela deste aparelho publicada — mande uma mensagem que a gente responde na hora.`,
  seletor(modelo.marca_slug, modelo.slug))}

<section class="secao">
  <div class="env">
    <div class="tabela-caixa cartao" data-revela>
      <table class="tabela">
        <caption class="sr">Preços de conserto para ${esc(modelo.marca)} ${esc(modelo.nome)}</caption>
        <thead>
          <tr><th scope="col">Conserto</th><th scope="col">Preço</th>
              <th scope="col">Prazo</th><th scope="col"><span class="sr">Ação</span></th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    ${NOTA}
  </div>
</section>

${faixaColeta()}`,
  });
}

/* --------------------------------------------------------- os modelos da marca */
function daMarca(req, marca, servicos) {
  const modelos = Q.todos(
    "SELECT * FROM modelos WHERE marca_id = ? AND ativo = 1 ORDER BY ordem, nome", marca.id);

  const cartoes = modelos.map((m, i) => {
    /* O menor preço entre os serviços deste aparelho: é o "a partir de" da
       linha, e o que permite comparar dois modelos de relance. */
    const r = Q.um("SELECT MIN(preco) m FROM precos WHERE modelo_id = ? AND ativo = 1 AND preco > 0", m.id);
    const p = r && r.m ? r.m : 0;
    return `
    <a class="cartao cartao--acende mod" href="/consertos/?modelo=${esc(m.slug)}" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
      <h2 class="cartao__titulo">${esc(m.nome)}</h2>
      <p class="cartao__texto">${m.ano ? `Lançado em ${m.ano}` : "&nbsp;"}</p>
      <span class="serv__pe">
        ${p ? `<span class="preco"><span class="preco__apartir">Consertos a partir de</span>${esc(reais(p))}</span>`
            : `<span class="preco"><span class="preco__apartir">Orçamento</span>Na hora</span>`}
      </span>
    </a>`;
  }).join("");

  return L.pagina({
    req, atual: "consertos", canonical: `/consertos/?marca=${marca.slug}`,
    titulo: `Assistência técnica ${marca.nome}`,
    descricao: `Conserto de celular ${marca.nome} em ${txt("loja.cidade", "Caruaru")}: `
      + `tela, bateria e conector com preço na tela e ${txt("legal.garantia", "90 dias")} de garantia.`,
    corpo: `
${cabecaConserto(`Assistência ${marca.nome}`, `Consertamos <em>${esc(marca.nome)}</em>`,
  "Escolha o modelo para ver a tabela completa de preços e prazos.",
  seletor(marca.slug, ""))}

<section class="secao">
  <div class="env">
    <div class="grade grade--4">${cartoes}</div>
    <p class="tabela__nota">Não achou o seu ${esc(marca.nome)}? A lista traz os que mais chegam à bancada —
      <a href="${zap(`Olá! Tenho um ${marca.nome} que não está na lista do site.`)}"
         target="_blank" rel="noopener">chame no WhatsApp</a>.</p>
  </div>
</section>

${faixaColeta()}`,
  });
}

/* ==========================================================================
   /consertos/:slug/  — a página de um serviço
   ========================================================================== */
function servico(req, slug) {
  const s = Q.um("SELECT * FROM servicos WHERE slug = ? AND ativo = 1", slug);
  if (!s) return null;

  /* Os aparelhos com preço para ESTE serviço, do mais barato ao mais caro.
     Ordenar por preço, e não por nome, é o que transforma a tabela numa
     ferramenta de decisão: o cliente encontra a faixa dele de relance. */
  const linhas = Q.todos(
    `SELECT p.preco, p.prazo_horas, p.observacao, m.slug, m.nome, ma.nome marca
     FROM precos p
     JOIN modelos m ON m.id = p.modelo_id
     JOIN marcas ma ON ma.id = m.marca_id
     WHERE p.servico_id = ? AND p.ativo = 1 AND p.preco > 0 AND m.ativo = 1
     ORDER BY p.preco`, s.id);

  const sintomas = String(s.sintomas || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const outros = Q.todos(
    "SELECT slug, nome, chamada, icone, foto FROM servicos WHERE ativo = 1 AND id <> ? ORDER BY destaque DESC, ordem LIMIT 3", s.id);

  const tabela = linhas.length ? `
    <div class="tabela-caixa cartao" data-revela>
      <table class="tabela">
        <caption class="sr">Preço de ${esc(s.nome)} por aparelho</caption>
        <thead>
          <tr><th scope="col">Aparelho</th><th scope="col">Preço</th>
              <th scope="col">Prazo</th><th scope="col"><span class="sr">Ação</span></th></tr>
        </thead>
        <tbody>
          ${linhas.map((l) => `
          <tr>
            <th scope="row" class="tab__serv">
              <a href="/consertos/?modelo=${esc(l.slug)}">${esc(l.marca)} ${esc(l.nome)}</a>
              ${l.observacao ? `<span class="tab__obs">${esc(l.observacao)}</span>` : ""}
            </th>
            <td class="tab__preco"><span class="preco"><span class="preco__apartir">A partir de</span>${esc(reais(l.preco))}</span></td>
            <td class="tab__prazo dado">${esc(prazoTexto(l.prazo_horas || s.prazo_horas))}</td>
            <td class="tab__acao">
              <a class="btn btn--linha btn--sm" href="${zap(
                `Olá! Quero um orçamento de ${s.nome.toLowerCase()} para ${l.marca} ${l.nome}.`)}"
                target="_blank" rel="noopener">Quero este</a>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${NOTA}`
    : `<p class="tabela__nota">A tabela deste serviço ainda não está publicada.
       <a href="${zap(`Olá! Queria um orçamento de ${s.nome.toLowerCase()}.`)}"
          target="_blank" rel="noopener">Mande o modelo do seu aparelho no WhatsApp</a>
       que a gente responde com o valor.</p>`;

  return L.pagina({
    req, atual: "consertos", canonical: `/consertos/${s.slug}/`,
    titulo: s.nome,
    descricao: `${s.nome} em ${txt("loja.cidade", "Caruaru")}: ${s.chamada} `
      + `${prazoTexto(s.prazo_horas)}, com ${s.garantia_dias} dias de garantia na peça e no serviço.`,
    jsonld: jsonldServico(s),
    corpo: `
<section class="secao capa-serv">
  <div class="env">
    <nav class="migalha" aria-label="Você está em">
      <a href="/">Início</a> <span>/</span> <a href="/consertos/">Consertos</a>
      <span>/</span> <strong>${esc(s.nome)}</strong>
    </nav>
    <div class="capa-serv__in">
      <div>
        <p class="rotulo">${engrenagem("", 12)}${esc(s.categoria)}</p>
        <h1 class="titulo capa-serv__t">${esc(s.nome)}</h1>
        <p class="sub">${esc(s.chamada)}</p>
        <div class="fichas">
          <div class="ficha"><span class="ficha__r">Prazo</span><span class="ficha__v dado">${esc(prazoTexto(s.prazo_horas))}</span></div>
          <div class="ficha"><span class="ficha__r">Garantia</span><span class="ficha__v dado">${s.garantia_dias} dias</span></div>
          <div class="ficha"><span class="ficha__r">Orçamento</span><span class="ficha__v dado">Grátis</span></div>
        </div>
        <div class="hero__acoes">
          <a class="btn btn--acao" href="${zap(`Olá! Queria um orçamento de ${s.nome.toLowerCase()}.`)}"
             target="_blank" rel="noopener">Pedir orçamento</a>
          <a class="btn btn--linha" href="/busca-e-leva/">Buscar meu aparelho</a>
        </div>
      </div>
      ${s.foto
        ? `<figure class="capa-serv__foto">
             <img src="${esc(s.foto)}" width="1200" height="800" fetchpriority="high"
                  decoding="async" alt="${esc(s.nome)} na bancada da Alafcell">
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
        <p class="sub">${esc(s.descricao)}</p>
      </div>
      ${sintomas.length ? `
      <aside class="cartao" data-revela data-revela-atraso="1">
        <h2 class="cartao__titulo">É o seu caso?</h2>
        <ul class="sintomas">
          ${sintomas.map((x) => `<li>${esc(x)}</li>`).join("")}
        </ul>
        <p class="cartao__texto" style="margin-top:1rem">Se algum desses é o seu problema,
          este é o serviço. Na dúvida, o diagnóstico é de graça.</p>
      </aside>` : ""}
    </div>
  </div>
</section>

<section class="secao">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Tabela</p>
      <h2 class="titulo">Quanto custa <em>${esc(s.nome.toLowerCase())}</em></h2>
    </header>
    ${tabela}
  </div>
</section>

${faixaColeta()}

<section class="secao secao--tinta">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Também consertamos</p>
      <h2 class="titulo">Outros <em>serviços</em></h2>
    </header>
    <div class="grade grade--3">
      ${outros.map((o, i) => `
      <a class="cartao cartao--acende serv${o.foto ? " serv--foto" : ""}" href="/consertos/${esc(o.slug)}/" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        ${o.foto ? `<span class="serv__capa"><img src="${esc(o.foto)}" alt="" loading="lazy"
          decoding="async" width="1200" height="800"></span>` : ""}
        <span class="serv__ico">${icone(o.icone)}</span>
        <h3 class="cartao__titulo">${esc(o.nome)}</h3>
        <p class="cartao__texto">${esc(o.chamada)}</p>
      </a>`).join("")}
    </div>
  </div>
</section>`,
  });
}

/* ==========================================================================
   PEÇAS COMPARTILHADAS
   ========================================================================== */
function cabecaConserto(rotulo, titulo, sub, form) {
  return `
<section class="secao capa">
  <div class="env">
    <p class="rotulo">${engrenagem("", 12)}${esc(rotulo)}</p>
    <h1 class="titulo capa__t">${titulo}</h1>
    <p class="sub">${esc(sub)}</p>
    <div class="capa__form cartao">${form}</div>
  </div>
</section>`;
}

/* A faixa de busca e leva se repete em toda tela de conserto. É o argumento
   que só esta loja tem, e ele precisa aparecer no momento em que a pessoa
   acabou de ver o preço — que é quando ela pensa "vou ter de ir lá". */
function faixaColeta() {
  return `
<section class="faixa">
  <img class="faixa__fundo" src="/assets/img/banco/entrega.webp" alt="" aria-hidden="true"
       loading="lazy" decoding="async" width="1200" height="800">
  <div class="env faixa__in">
    ${engrenagem("eng--gira faixa__eng", 120)}
    <div>
      <h2 class="faixa__t">Não quer sair de casa?</h2>
      <p class="faixa__d">${esc(txt("coleta.aviso", "A gente busca o aparelho e devolve consertado."))}</p>
    </div>
    <a class="btn btn--acao btn--lg" href="/busca-e-leva/">Agendar a coleta</a>
  </div>
</section>`;
}

/* ==========================================================================
   SCHEMA.ORG

   `Service` com `offers` só quando existe preço — declarar oferta sem valor é
   o tipo de marcação que o Google ignora e que, pior, pode render aviso no
   Search Console.
   ========================================================================== */
function jsonldServico(s) {
  const min = apartirDe(s.id);
  const ficha = {
    "@type": "Service",
    name: s.nome,
    description: s.chamada,
    serviceType: s.nome,
    provider: { "@id": `${SITE}/#loja` },
    areaServed: { "@type": "City", name: txt("loja.cidade", "Caruaru") },
    url: `${SITE}/consertos/${s.slug}/`,
  };
  if (min) {
    ficha.offers = {
      "@type": "Offer", priceCurrency: "BRL", price: (min / 100).toFixed(2),
      availability: "https://schema.org/InStock",
      url: `${SITE}/consertos/${s.slug}/`,
    };
  }
  return { "@context": "https://schema.org", "@graph": [ficha, migalha(s)] };
}

function migalha(s) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Consertos", item: `${SITE}/consertos/` },
      { "@type": "ListItem", position: 3, name: s.nome, item: `${SITE}/consertos/${s.slug}/` },
    ],
  };
}

function jsonldServicos(servicos) {
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "ItemList",
      name: "Consertos de celular",
      itemListElement: servicos.map((s, i) => ({
        "@type": "ListItem", position: i + 1, name: s.nome,
        url: `${SITE}/consertos/${s.slug}/`,
      })),
    }],
  };
}

module.exports = { lista, servico, seletor, faixaColeta, cabecaConserto, NOTA };
