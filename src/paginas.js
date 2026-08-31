"use strict";
/* ==========================================================================
   PÁGINAS DO SITE — a home

   A ordem das seções não é estética, é a ordem das perguntas de quem chega
   com o celular quebrado, na sequência em que ele as faz:

     1. "consertam o meu?"        → busca por aparelho, antes de qualquer coisa
     2. "quanto custa?"           → os consertos com preço a partir de
     3. "preciso ir até lá?"      → busca e leva, o que as franquias não fazem
     4. "quanto tempo demora?"    → as quatro etapas, com prazo
     5. "e se der errado?"        → garantia por escrito
     6. "vocês vendem também?"    → a loja
     7. "posso confiar?"          → blog e contato

   Colocar a loja antes do conserto seria vender para quem veio arrumar — o
   erro clássico de assistência que quer virar varejo.
   ========================================================================== */
const { Q, txt, reais } = require("./db");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");

/* ==========================================================================
   ÍCONES DOS SERVIÇOS

   Desenhados em traço, herdando `currentColor`. Cada um mostra a PEÇA, não
   uma metáfora: quem tem a tela trincada reconhece a tela trincada, e não uma
   chave de boca genérica que serviria para qualquer serviço.
   ========================================================================== */
const ICONES = {
  tela: '<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="m8 8 4 4-2 3 5-2 2 3"/>',
  bateria: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><path d="m11 9-2 3h3l-2 3"/>',
  carga: '<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M9 18h6"/><path d="M12 7v5"/><path d="m9.5 9.5 2.5-2.5 2.5 2.5"/>',
  camera: '<rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6l1.5-2h5L16 6"/>',
  audio: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>',
  placa: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  software: '<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="m10 11 2 2 4-4"/>',
};
const icone = (chave) => `<svg class="serv__icone" viewBox="0 0 24 24" width="30" height="30"
  fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">${ICONES[chave] || ICONES.tela}</svg>`;

/* ==========================================================================
   PRAZO EM PALAVRA

   O banco guarda horas porque hora ordena e compara. A tela mostra a palavra
   que o cliente usa: ninguém pergunta "quantas horas", pergunta "sai hoje?".
   ========================================================================== */
function prazoTexto(horas) {
  const h = Number(horas) || 0;
  if (h <= 4) return "Em algumas horas";
  if (h <= 12) return "No mesmo dia";
  if (h <= 24) return "Em até 24 horas";
  if (h <= 48) return "Em até 2 dias";
  return `Em até ${Math.ceil(h / 24)} dias`;
}

/* O menor preço cadastrado para o serviço, entre todos os aparelhos. É o
   "a partir de" — e quando não existe preço nenhum, a resposta NÃO é R$ 0,00:
   é dizer que o orçamento sai na hora. Preço zero na tela de uma assistência
   é a promessa que o balcão vai ter de desmentir. */
function apartirDe(servicoId) {
  const r = Q.um(
    `SELECT MIN(preco) m FROM precos WHERE servico_id = ? AND ativo = 1 AND preco > 0`,
    servicoId);
  return r && r.m ? r.m : 0;
}

/* ==========================================================================
   HOME
   ========================================================================== */
function home(req) {
  const servicos = Q.todos(
    "SELECT * FROM servicos WHERE ativo = 1 ORDER BY destaque DESC, ordem LIMIT 6");
  const marcas = Q.todos("SELECT * FROM marcas WHERE ativo = 1 ORDER BY ordem");
  const populares = Q.todos(
    `SELECT m.slug, m.nome, ma.nome marca FROM modelos m
     JOIN marcas ma ON ma.id = m.marca_id
     WHERE m.ativo = 1 AND m.popular = 1 ORDER BY ma.ordem, m.ordem LIMIT 6`);
  const destaques = Q.todos(
    `SELECT * FROM produtos WHERE ativo = 1 AND destaque = 1 ORDER BY criado DESC LIMIT 4`);
  const posts = Q.todos(
    "SELECT slug, titulo, resumo, capa, data FROM posts WHERE publicado = 1 ORDER BY data DESC LIMIT 3");

  /* ------------------------------------------------------------------ topo */
  const hero = `
<section class="hero">
  <!-- As engrenagens giram DEVAGAR e ficam atrás de tudo. Elas dizem que a
       oficina está trabalhando; se corressem, virariam enfeite de página de
       carregamento. aria-hidden porque não há nada aqui para ser lido. -->
  <div class="hero__maquina" aria-hidden="true">
    ${engrenagem("eng--gira hero__eng hero__eng--g", 420)}
    ${engrenagem("eng--gira-r hero__eng hero__eng--p", 230)}
  </div>

  <div class="env hero__in">
    <div class="hero__texto">
      <p class="rotulo">${engrenagem("", 12)}${esc(txt("home.rotulo", ""))}</p>
      <h1 class="hero__titulo">${txt("home.titulo", "Seu celular de volta<br><em>no mesmo dia</em>")}</h1>
      <p class="hero__sub">${esc(txt("home.texto", ""))}</p>
      <div class="hero__acoes">
        <a class="btn btn--acao btn--lg" href="/consertos/">${esc(txt("home.btn1", "Ver preços dos consertos"))}</a>
        <a class="btn btn--linha btn--lg" href="/busca-e-leva/">${esc(txt("home.btn2", "Buscar meu aparelho"))}</a>
      </div>

      <dl class="numeros">
        ${[1, 2, 3].map((i) => `
        <div class="numero">
          <dd class="numero__v dado">${esc(txt(`home.n${i}_valor`, ""))}</dd>
          <dt class="numero__r">${esc(txt(`home.n${i}_rotulo`, ""))}</dt>
        </div>`).join("")}
      </dl>
    </div>

    <!-- ==========================================================
         O APARELHO QUE ACENDE

         É o conceito da marca em uma peça: a tela está apagada e a luz
         atravessa. Desenhado em CSS, não em imagem — imagem de celular
         genérico é o que faz um site de assistência parecer template, e
         ainda custaria uma requisição de 200 KB no topo da página.
         ========================================================== -->
    <div class="hero__aparelho" aria-hidden="true">
      <div class="fone">
        <div class="fone__tela">
          <!-- A foto da bancada DENTRO da tela é o conceito em uma peça: o
               aparelho acende e o que ele mostra é a oficina trabalhando. A
               varredura de luz passa por cima dela, e não no lugar dela.
               "fetchpriority=high" porque esta é a maior imagem visível na
               primeira dobra — é ela que o navegador precisa buscar primeiro. -->
          <img class="fone__foto" src="/assets/img/banco/oficina.webp" alt=""
               width="1200" height="800" fetchpriority="high" decoding="async">
          <span class="fone__luz"></span>
        </div>
        <span class="fone__alto"></span>
      </div>
    </div>
  </div>
</section>`;

  /* ------------------------------------------------- busca por aparelho
     Formulário de verdade, com GET: funciona sem JavaScript, a resposta tem
     endereço próprio e o cliente pode mandar o link para alguém. Um seletor
     que só funciona com script deixaria de fora justamente o celular velho
     e a rede ruim — que é metade do público de uma assistência técnica. */
  const busca = `
<section class="secao busca" id="orcamento">
  <div class="env">
    <div class="busca__caixa cartao" data-revela>
      <div class="busca__cabeca">
        <p class="rotulo">${engrenagem("", 12)}Orçamento em dois cliques</p>
        <h2 class="titulo">Qual é o <em>seu aparelho</em>?</h2>
        <p class="sub">Escolha a marca e o modelo para ver o preço e o prazo de cada conserto.
          Sem cadastro, sem esperar alguém responder.</p>
      </div>

      <form class="busca__form" action="/consertos/" method="get">
        <label class="campo">
          <span class="campo__rot">Marca</span>
          <select name="marca" class="campo__ent" data-busca-marca>
            <option value="">Escolha…</option>
            ${marcas.map((m) => `<option value="${esc(m.slug)}">${esc(m.nome)}</option>`).join("")}
          </select>
        </label>
        <label class="campo">
          <span class="campo__rot">Modelo</span>
          <select name="modelo" class="campo__ent" data-busca-modelo>
            <option value="">Todos os modelos</option>
          </select>
        </label>
        <button class="btn btn--acao" type="submit">Ver preços</button>
      </form>

      ${populares.length ? `
      <div class="busca__rapidos">
        <span class="busca__rot">Mais consertados:</span>
        ${populares.map((m) =>
          `<a class="etiqueta" href="/consertos/?modelo=${esc(m.slug)}">${esc(m.nome)}</a>`).join("")}
      </div>` : ""}

      <p class="busca__nota">Não achou o seu? A lista tem os mais comuns —
        <a href="${zap("Olá! Meu aparelho não está na lista do site. Pode me ajudar?")}"
           target="_blank" rel="noopener">chame no WhatsApp</a> que a gente responde na hora.</p>
    </div>
  </div>
</section>`;

  /* -------------------------------------------------------------- serviços */
  const cartaoServico = (s, i) => {
    const p = apartirDe(s.id);
    return `
    <a class="cartao cartao--acende serv${s.foto ? " serv--foto" : ""}" href="/consertos/${esc(s.slug)}/" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
      ${s.foto ? `<span class="serv__capa"><img src="${esc(s.foto)}" alt="" loading="lazy"
        decoding="async" width="1200" height="800"></span>` : ""}
      <span class="serv__ico">${icone(s.icone)}</span>
      <h3 class="cartao__titulo">${esc(s.nome)}</h3>
      <p class="cartao__texto">${esc(s.chamada)}</p>
      <span class="serv__pe">
        ${p ? `<span class="preco"><span class="preco__apartir">A partir de</span>${esc(reais(p))}</span>`
            : `<span class="preco"><span class="preco__apartir">Orçamento</span>Na hora</span>`}
        <span class="serv__prazo dado">${esc(prazoTexto(s.prazo_horas))}</span>
      </span>
    </a>`;
  };

  const secServicos = `
<section class="secao secao--tinta" id="consertos">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}O que a gente conserta</p>
      <h2 class="titulo">Preço e prazo <em>antes</em> de você sair de casa</h2>
      <p class="sub">Cada conserto com o valor de partida, o tempo real de bancada e
        ${esc(txt("legal.garantia", "90 dias"))} de garantia por escrito — na peça e no serviço.</p>
    </header>
    <div class="grade grade--3">
      ${servicos.map(cartaoServico).join("")}
    </div>
    <p class="secao__mais"><a class="btn btn--linha" href="/consertos/">Ver todos os consertos e os preços</a></p>
  </div>
</section>`;

  /* ---------------------------------------------------------- busca e leva */
  const secColeta = `
<section class="secao coleta" id="busca-e-leva">
  <div class="env coleta__in">
    <div class="coleta__texto" data-revela>
      <p class="rotulo">${engrenagem("", 12)}O que ninguém mais faz em Caruaru</p>
      <h2 class="titulo">${esc(txt("coleta.titulo", "A gente vai até você"))}</h2>
      <p class="sub">${esc(txt("coleta.texto", ""))}</p>

      <!-- A comparação é o argumento inteiro desta seção: as redes nacionais
           também dizem "busca e leva", mas a delas é transportadora. Deixar a
           diferença implícita seria desperdiçar o único ponto em que a loja
           local ganha das franquias. -->
      <ul class="contraste">
        <li class="contraste__i contraste__i--nao">
          <strong>Nas redes nacionais</strong>
          <span>Você embala, posta e espera o aparelho ir e voltar de transportadora.</span>
        </li>
        <li class="contraste__i contraste__i--sim">
          <strong>Na Alafcell</strong>
          <span>A gente busca na sua casa ou no seu trabalho, no horário que você marcar, aqui em ${esc(txt("loja.cidade", "Caruaru"))}.</span>
        </li>
      </ul>
      <p class="coleta__aviso">${esc(txt("coleta.aviso", ""))}</p>
      <a class="btn btn--acao btn--lg" href="/busca-e-leva/">Agendar a coleta</a>
    </div>

    <div class="coleta__mapa" aria-hidden="true">
      <!-- A foto é o fato (alguém sai daqui com o aparelho); o pulso por cima é a
           metáfora (o sinal alcançando a cidade). Sozinha, a animação era
           abstrata demais para uma seção que vende um serviço concreto. -->
      <div class="coleta__foto">
        <img src="/assets/img/banco/entrega.webp" alt="" loading="lazy"
             decoding="async" width="1200" height="800">
        <div class="pulso"><span></span><span></span><span></span>${engrenagem("", 44)}</div>
      </div>
    </div>
  </div>
</section>`;

  /* ------------------------------------------------------------- as etapas
     Aqui a animação ganha razão de existir: a barra que enche e a engrenagem
     que gira na etapa ativa são o MESMO desenho da página de acompanhamento.
     Quem vê isso na home reconhece a tela depois, quando estiver ansioso. */
  const ETAPAS = [
    ["Você chama", "WhatsApp, formulário ou o balcão. Diz o aparelho e o que houve."],
    ["A gente busca", "Coleta gratuita em Caruaru, no horário que você marcar."],
    ["Diagnóstico e preço", "Testamos, mandamos o orçamento fechado e só abrimos depois do seu ok."],
    ["Conserto e devolução", "Consertado, testado e de volta na sua mão — com a garantia por escrito."],
  ];
  const secEtapas = `
<section class="secao secao--tinta" id="como-funciona">
  <div class="env">
    <header class="secao__cabeca secao__cabeca--centro">
      <p class="rotulo">${engrenagem("", 12)}Como funciona</p>
      <h2 class="titulo">Quatro passos, <em>nenhuma surpresa</em></h2>
    </header>
    <ol class="etapas">
      ${ETAPAS.map(([t, d], i) => `
      <li class="etapa" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <span class="etapa__n dado">${i + 1}</span>
        <h3 class="etapa__t">${esc(t)}</h3>
        <p class="etapa__d">${esc(d)}</p>
      </li>`).join("")}
    </ol>
  </div>
</section>`;

  /* ------------------------------------------------------------------ loja */
  const cartaoProduto = (p, i) => `
    <a class="cartao cartao--acende prod" href="/produto/${esc(p.slug)}/" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
      ${p.condicao !== "novo" ? `<span class="selo selo--semi">Seminovo${p.bateria ? ` · bateria ${p.bateria}%` : ""}</span>` : ""}
      <h3 class="cartao__titulo">${esc(p.nome)}</h3>
      <p class="cartao__texto">${esc(p.chamada)}</p>
      <span class="prod__pe">
        ${p.preco_de > p.preco ? `<span class="preco__de">${esc(reais(p.preco_de))}</span>` : ""}
        <span class="preco">${esc(reais(p.preco))}</span>
      </span>
    </a>`;

  const secLoja = destaques.length ? `
<section class="secao" id="loja">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Loja</p>
      <h2 class="titulo">Aparelhos, acessórios e <em>periféricos</em></h2>
      <p class="sub">Novos e seminovos com garantia da loja. Você compra pelo site e retira
        aqui, ou a gente entrega em Caruaru.</p>
    </header>
    <div class="grade grade--4">${destaques.map(cartaoProduto).join("")}</div>
    <p class="secao__mais"><a class="btn btn--linha" href="/loja/">Ver a loja completa</a></p>
  </div>
</section>` : "";

  /* --------------------------------------------------------------- garantia */
  const secGarantia = `
<section class="secao secao--tinta" id="garantia">
  <div class="env">
    <div class="garantia">
      <figure class="garantia__foto" data-revela>
        <img src="/assets/img/banco/bancada.webp" width="1200" height="800" loading="lazy"
             decoding="async" alt="Técnico da Alafcell trabalhando em um aparelho aberto na bancada">
      </figure>
      <div>
        <p class="rotulo">${engrenagem("", 12)}Por que confiar</p>
        <h2 class="titulo">Do jeito que a gente <em>gostaria</em> de ser atendido</h2>
        <p class="sub">Sem promessa que o balcão desmente depois.</p>
      </div>
    </div>
    <div class="grade grade--3" style="margin-top:2.2rem">
      ${[
        ["Garantia por escrito", `${txt("legal.garantia", "90 dias")} na peça e no serviço, no comprovante — não no "confia".`],
        ["Você aprova antes", "O aparelho só é aberto depois do orçamento fechado. Sem custo se você desistir."],
        ["Peça com procedência", "Você escolhe entre original e paralela de primeira linha sabendo a diferença de preço e de garantia."],
      ].map(([t, d], i) => `
      <div class="cartao" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <span class="serv__ico">${engrenagem("", 26)}</span>
        <h3 class="cartao__titulo">${esc(t)}</h3>
        <p class="cartao__texto">${esc(d)}</p>
      </div>`).join("")}
    </div>
  </div>
</section>`;

  /* ------------------------------------------------------------------ blog */
  const secBlog = posts.length ? `
<section class="secao" id="blog">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Blog</p>
      <h2 class="titulo">Antes de gastar, <em>leia</em></h2>
    </header>
    <div class="grade grade--3">
      ${posts.map((p, i) => `
      <a class="cartao cartao--acende post${p.capa ? " post--foto" : ""}" href="/blog/${esc(p.slug)}/" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        ${p.capa ? `<span class="post__capa"><img src="${esc(p.capa)}" alt="" loading="lazy"
          decoding="async" width="1200" height="800"></span>` : ""}
        <h3 class="cartao__titulo">${esc(p.titulo)}</h3>
        <p class="cartao__texto">${esc(p.resumo)}</p>
      </a>`).join("")}
    </div>
  </div>
</section>` : "";

  /* ------------------------------------------------------------ chamada final */
  const secFim = `
<section class="secao fim">
  <div class="env env--fino fim__in" data-revela>
    <h2 class="titulo">Conta o que houve com o seu aparelho</h2>
    <p class="sub">Responder é de graça e costuma levar poucos minutos no horário da loja.</p>
    <div class="hero__acoes">
      <a class="btn btn--acao btn--lg" href="${zap("Olá! Vim pelo site e queria um orçamento.")}"
         target="_blank" rel="noopener">Falar no WhatsApp</a>
      <a class="btn btn--linha btn--lg" href="/acompanhar/">Acompanhar um conserto</a>
    </div>
  </div>
</section>`;

  return L.pagina({
    req,
    atual: "",
    canonical: "/",
    titulo: "",
    descricao: `Assistência técnica de celular em ${txt("loja.cidade", "Caruaru")}: troca de tela, `
      + `bateria e conector com preço na tela, ${txt("legal.garantia", "90 dias")} de garantia `
      + `e busca e leva gratuita. Loja de aparelhos novos e seminovos.`,
    jsonld: jsonldLoja(),
    corpo: hero + busca + secServicos + secColeta + secEtapas + secLoja + secGarantia + secBlog + secFim,
  });
}

/* ==========================================================================
   SCHEMA.ORG — a ficha do Google

   `LocalBusiness` de verdade, com endereço e horário vindos do painel. É
   justamente o que as páginas de franquia dos concorrentes NÃO têm: a delas
   descreve a rede, não a loja de Caruaru.

   Campo vazio não entra. Um `address` com "preencha no painel" dentro é pior
   que nenhum: o Google lê, mostra e ninguém percebe.
   ========================================================================== */
function jsonldLoja() {
  const nome = txt("marca.nome", "Alafcell Assistec");
  const rua = txt("loja.endereco", "");
  const preenchido = rua && !/preencha/i.test(rua);

  const ficha = {
    "@type": ["LocalBusiness", "MobilePhoneStore"],
    "@id": `${SITE}/#loja`,
    name: nome,
    url: SITE + "/",
    image: SITE + "/assets/img/og.png",
    description: txt("marca.slogan", ""),
    priceRange: "$$",
  };
  const tel = txt("marca.telefone", "");
  if (tel) ficha.telephone = tel;
  if (preenchido) {
    ficha.address = {
      "@type": "PostalAddress",
      streetAddress: rua,
      addressLocality: txt("loja.cidade", "Caruaru"),
      addressRegion: txt("loja.uf", "PE"),
      postalCode: txt("loja.cep", ""),
      addressCountry: "BR",
    };
  }
  const lat = txt("loja.latitude", ""), lon = txt("loja.longitude", "");
  if (lat && lon) ficha.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lon };

  const horas = txt("loja.horario_dados", "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (horas.length) ficha.openingHours = horas;

  const insta = txt("marca.instagram", "");
  if (insta) ficha.sameAs = [insta];

  return { "@context": "https://schema.org", "@graph": [ficha] };
}

/* ==========================================================================
   404

   Página de verdade, com o menu e caminhos de saída. Um 404 sem saída manda
   o visitante de volta ao Google, e ele não volta.
   ========================================================================== */
function erro404(req) {
  return L.pagina({
    req,
    titulo: "Página não encontrada",
    descricao: "Esta página não existe ou mudou de endereço.",
    canonical: "/",
    corpo: `
<section class="secao">
  <div class="env env--fino" style="text-align:center">
    <p class="rotulo" style="justify-content:center">${engrenagem("", 12)}Erro 404</p>
    <h1 class="titulo">Esta página <em>não existe</em></h1>
    <p class="sub" style="margin-inline:auto">Ou ela mudou de endereço. Estes caminhos funcionam:</p>
    <div class="hero__acoes" style="justify-content:center">
      <a class="btn btn--acao" href="/consertos/">Ver os consertos</a>
      <a class="btn btn--linha" href="/loja/">Ir para a loja</a>
      <a class="btn btn--linha" href="/">Voltar ao início</a>
    </div>
  </div>
</section>`,
  });
}

module.exports = { home, erro404, jsonldLoja, prazoTexto, apartirDe, icone };
