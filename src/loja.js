"use strict";
/* ==========================================================================
   LOJA — vitrine, carrinho e checkout

   Nenhum dos três concorrentes de Caruaru vende online. É a lacuna mais barata
   de ocupar, e a que transforma o site de cartão de visita em ponto de venda.

   Três decisões que atravessam o arquivo:

   1. O PREÇO É CALCULADO NO SERVIDOR, sempre, a partir do id do produto. O
      carrinho no cookie guarda só `{id, q}` — nunca o preço. Preço que viaja
      no navegador é preço que o cliente edita antes de enviar.

   2. O SEMINOVO MOSTRA SAÚDE DA BATERIA E ESTADO na vitrine, não escondidos na
      descrição. É o que decide a compra de um usado, e é justamente o que a
      maioria das lojas omite.

   3. SEM FOTO, O CARTÃO NÃO FICA QUEBRADO. Entra um desenho da categoria, em
      SVG. Retângulo cinza com "sem imagem" faz a loja parecer abandonada.
   ========================================================================== */
const { Q, txt, reais, centavos, codigoLivre } = require("./db");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");
const Pix = require("./pix");
const QR = require("./qr");

const CATEGORIAS = {
  smartphone: { nome: "Smartphones", plural: "smartphones",
    resumo: "Novos lacrados e seminovos revisados na nossa bancada." },
  acessorio: { nome: "Acessórios", plural: "acessórios",
    resumo: "Película, capa, carregador e fone — o que protege e o que substitui." },
  periferico: { nome: "Periféricos", plural: "periféricos",
    resumo: "Caixa de som, relógio e o que se conecta ao seu aparelho." },
};

/* ==========================================================================
   A IMAGEM DO PRODUTO

   Foto quando existe; desenho da categoria quando não. O desenho é feito para
   parecer INTENCIONAL: silhueta em traço fino sobre a face de metal, no mesmo
   sistema do resto do site. Ninguém precisa ler "imagem indisponível".
   ========================================================================== */
const SILHUETAS = {
  smartphone: '<rect x="26" y="8" width="48" height="84" rx="9"/><path d="M42 15h16"/><path d="M40 84h20"/>',
  acessorio: '<path d="M22 46a28 28 0 0 1 56 0"/><rect x="14" y="46" width="16" height="30" rx="7"/><rect x="70" y="46" width="16" height="30" rx="7"/>',
  periferico: '<rect x="16" y="30" width="68" height="40" rx="8"/><circle cx="38" cy="50" r="10"/><circle cx="66" cy="50" r="5"/>',
};

function imagem(p, tamanho = "") {
  const foto = Q.um(
    "SELECT arquivo, alt FROM produto_fotos WHERE produto_id = ? ORDER BY ordem LIMIT 1", p.id);
  if (foto) {
    /* `width`/`height` declarados não mudam o tamanho na tela (quem manda é o
       CSS): eles dizem a PROPORÇÃO ao navegador, para ele reservar o espaço
       antes de a foto chegar. Sem isso a grade de quatro colunas pula quando
       cada imagem carrega — e pular é o que faz uma loja parecer mal feita. */
    return `<img class="prod__img ${tamanho}" src="${esc(foto.arquivo)}"
      alt="${esc(foto.alt || p.nome)}" width="1200" height="800"
      loading="lazy" decoding="async">`;
  }
  return `<span class="prod__img prod__img--vazia ${tamanho}" aria-hidden="true">
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"
         stroke-linecap="round" stroke-linejoin="round">${SILHUETAS[p.categoria] || SILHUETAS.acessorio}</svg>
  </span>`;
}

/* Selo de condição. O seminovo carrega a saúde da bateria porque é o número
   que decide a compra — e porque publicá-lo é o que separa esta loja do
   anúncio de rede social. */
function selo(p) {
  if (p.condicao === "novo") return '<span class="selo selo--novo">Novo lacrado</span>';
  return `<span class="selo selo--semi">Seminovo${p.bateria ? ` · bateria ${p.bateria}%` : ""}</span>`;
}

/* ==========================================================================
   CARTÃO DA VITRINE
   ========================================================================== */
function cartao(p, i) {
  const esgotado = p.estoque <= 0;
  return `
<a class="cartao cartao--acende prod${esgotado ? " prod--fora" : ""}" href="/produto/${esc(p.slug)}/"
   data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
  ${imagem(p)}
  ${selo(p)}
  <h3 class="cartao__titulo">${esc(p.nome)}</h3>
  <p class="cartao__texto">${esc(p.chamada)}</p>
  <span class="prod__pe">
    ${p.preco_de > p.preco ? `<span class="preco__de">${esc(reais(p.preco_de))}</span>` : ""}
    <span class="preco">${esc(reais(p.preco))}</span>
  </span>
  ${esgotado ? '<span class="prod__fora">Sem estoque no momento</span>' : ""}
</a>`;
}

/* ==========================================================================
   /loja/  e  /loja/:categoria/

   `seminovos` é uma categoria de VITRINE que não existe no banco: ela é um
   recorte por condição. Ela ganhou endereço próprio porque "celular seminovo
   em Caruaru" é uma busca com volume próprio, e mandar essa pessoa para a
   lista geral de smartphones dilui o que ela procurava.
   ========================================================================== */
function lista(req, categoria = "", q = {}) {
  const ordem = q.ordem === "caro" ? "p.preco DESC"
    : q.ordem === "barato" ? "p.preco ASC" : "p.destaque DESC, p.criado DESC";

  let onde = "p.ativo = 1", args = [], titulo, resumo, rotulo, canonical;

  if (categoria === "seminovos") {
    onde += " AND p.condicao <> 'novo'";
    rotulo = "Seminovos"; titulo = "Seminovos com <em>garantia</em>";
    resumo = "Cada aparelho passa pela nossa bancada antes de ir para a vitrine: bateria medida, "
      + "câmeras, alto-falantes e conector testados um a um. Você vê a saúde da bateria antes de comprar.";
    canonical = "/loja/seminovos/";
  } else if (CATEGORIAS[categoria]) {
    onde += " AND p.categoria = ?"; args.push(categoria);
    rotulo = CATEGORIAS[categoria].nome;
    titulo = CATEGORIAS[categoria].nome.replace(/^(\S+)/, "<em>$1</em>");
    resumo = CATEGORIAS[categoria].resumo;
    canonical = `/loja/${categoria}/`;
  } else if (categoria) {
    return null;
  } else {
    rotulo = "Loja"; titulo = "Aparelhos, acessórios e <em>periféricos</em>";
    /* A descrição da loja vira o texto do Google. A primeira versão tinha 53
       caracteres — curta demais, e o Google completa o espaço com trecho
       aleatório da página quando ela não preenche a linha. */
    resumo = "Smartphones novos e seminovos revisados, acessórios e periféricos em "
      + txt("loja.cidade", "Caruaru") + ". Compre pelo site, retire na loja ou receba em casa — "
      + "com garantia e assistência técnica no mesmo lugar.";
    canonical = "/loja/";
  }

  const produtos = Q.todos(
    `SELECT p.* FROM produtos p WHERE ${onde} ORDER BY ${ordem}`, ...args);

  const abas = [
    ["", "Tudo"], ["smartphone", "Smartphones"], ["seminovos", "Seminovos"],
    ["acessorio", "Acessórios"], ["periferico", "Periféricos"],
  ].map(([c, r]) =>
    `<a class="aba${c === categoria ? " aba--atual" : ""}" href="/loja/${c ? c + "/" : ""}">${r}</a>`).join("");

  return L.pagina({
    req, atual: "loja", canonical,
    titulo: rotulo === "Loja" ? "Loja" : rotulo,
    descricao: resumo,
    jsonld: jsonldLista(produtos, rotulo),
    corpo: `
<section class="secao capa">
  <div class="env">
    <p class="rotulo">${engrenagem("", 12)}${esc(rotulo)}</p>
    <h1 class="titulo capa__t">${titulo}</h1>
    <p class="sub">${esc(resumo)}</p>
  </div>
</section>

<section class="secao" style="padding-top:0">
  <div class="env">
    <div class="loja-barra">
      <nav class="abas" aria-label="Categorias da loja">${abas}</nav>
      <form class="loja-ordem" method="get">
        <label class="campo">
          <span class="sr">Ordenar por</span>
          <select class="campo__ent campo__ent--sm" name="ordem" onchange="this.form.submit()">
            <option value=""${!q.ordem ? " selected" : ""}>Mais relevantes</option>
            <option value="barato"${q.ordem === "barato" ? " selected" : ""}>Menor preço</option>
            <option value="caro"${q.ordem === "caro" ? " selected" : ""}>Maior preço</option>
          </select>
        </label>
        <noscript><button class="btn btn--linha btn--sm" type="submit">Ordenar</button></noscript>
      </form>
    </div>

    ${produtos.length
      ? `<div class="grade grade--4">${produtos.map(cartao).join("")}</div>`
      : `<p class="tabela__nota">Nenhum produto nesta categoria por enquanto.
         <a href="${zap("Olá! Procuro um produto que não achei no site.")}"
            target="_blank" rel="noopener">Pergunte no WhatsApp</a> — muita coisa chega antes
         de entrar no site.</p>`}
  </div>
</section>

${faixaGarantia()}`,
  });
}

/* ==========================================================================
   /produto/:slug/
   ========================================================================== */
function produto(req, slug) {
  const p = Q.um("SELECT * FROM produtos WHERE slug = ? AND ativo = 1", slug);
  if (!p) return null;

  const marca = p.marca_id ? Q.um("SELECT nome FROM marcas WHERE id = ?", p.marca_id) : null;
  const parcela = p.parcelas > 1 ? Math.ceil(p.preco / p.parcelas) : 0;
  const esgotado = p.estoque <= 0;

  /* A ficha muda com a condição: no novo, o que importa é o que vem na caixa;
     no seminovo, é o estado real do que já foi usado. Mostrar os mesmos campos
     nos dois casos deixaria metade vazia — e ficha vazia tira confiança. */
  const ficha = [];
  if (marca) ficha.push(["Marca", marca.nome]);
  if (p.armazenamento) ficha.push(["Armazenamento", p.armazenamento]);
  if (p.cor) ficha.push(["Cor", p.cor]);
  if (p.condicao !== "novo") {
    if (p.bateria) ficha.push(["Saúde da bateria", p.bateria + "%"]);
    if (p.estado) ficha.push(["Estado", { A: "A — sem marca de uso", B: "B — marcas leves",
      C: "C — marcas visíveis" }[p.estado] || p.estado]);
  }
  ficha.push(["Garantia", `${p.garantia_meses} ${p.garantia_meses === 1 ? "mês" : "meses"}`]);
  if (p.sku) ficha.push(["Código", p.sku]);

  const relacionados = Q.todos(
    `SELECT * FROM produtos WHERE ativo = 1 AND categoria = ? AND id <> ?
     ORDER BY destaque DESC, criado DESC LIMIT 4`, p.categoria, p.id);

  return L.pagina({
    req, atual: "loja", canonical: `/produto/${p.slug}/`,
    titulo: p.nome,
    descricao: p.chamada,
    jsonld: jsonldProduto(p, marca),
    corpo: `
<section class="secao prod-topo">
  <div class="env">
    <nav class="migalha" aria-label="Você está em">
      <a href="/">Início</a> <span>/</span> <a href="/loja/">Loja</a>
      <span>/</span> <a href="/loja/${esc(p.categoria)}/">${esc((CATEGORIAS[p.categoria] || {}).nome || p.categoria)}</a>
      <span>/</span> <strong>${esc(p.nome)}</strong>
    </nav>

    <div class="prod-detalhe">
      <div class="prod-detalhe__foto cartao">${imagem(p, "prod__img--g")}</div>

      <div class="prod-detalhe__info">
        ${selo(p)}
        <h1 class="titulo prod-detalhe__t">${esc(p.nome)}</h1>
        <p class="sub">${esc(p.chamada)}</p>

        <div class="preco-bloco">
          ${p.preco_de > p.preco ? `<span class="preco__de">${esc(reais(p.preco_de))}</span>` : ""}
          <span class="preco preco--g">${esc(reais(p.preco))}</span>
          ${parcela ? `<span class="preco__parcela">ou até ${p.parcelas}x de ${esc(reais(parcela))} no cartão</span>` : ""}
          <span class="preco__pix">${esc(reais(p.preco))} no Pix ou dinheiro</span>
        </div>

        ${esgotado ? `
        <p class="aviso aviso--erro">Sem estoque no momento.
          <a href="${zap(`Olá! Quero saber quando chega o ${p.nome}.`)}" target="_blank" rel="noopener">
            Avise-me pelo WhatsApp</a>.</p>`
        : `
        <form class="prod-comprar" action="/carrinho/adicionar" method="post">
          <input type="hidden" name="produto" value="${p.id}">
          <label class="campo campo--qtd">
            <span class="campo__rot">Qtd.</span>
            <input class="campo__ent" type="number" name="quantidade" value="1" min="1"
                   max="${p.estoque}" inputmode="numeric">
          </label>
          <button class="btn btn--acao btn--lg" type="submit">Adicionar ao carrinho</button>
        </form>
        <p class="prod-estoque dado">${p.estoque === 1 ? "Última unidade" : `${p.estoque} em estoque`}</p>`}

        <dl class="ficha-tec">
          ${ficha.map(([r, v]) => `<div><dt>${esc(r)}</dt><dd class="dado">${esc(v)}</dd></div>`).join("")}
        </dl>
      </div>
    </div>
  </div>
</section>

${p.descricao && p.descricao !== p.chamada ? `
<section class="secao secao--tinta">
  <div class="env env--fino">
    <h2 class="titulo">Sobre este ${p.condicao === "novo" ? "produto" : "aparelho"}</h2>
    <div class="cartao__texto" style="margin-top:1.2rem">${esc(p.descricao)}</div>
  </div>
</section>` : ""}

${faixaGarantia()}

${relacionados.length ? `
<section class="secao">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Veja também</p>
      <h2 class="titulo">Outros <em>${esc((CATEGORIAS[p.categoria] || {}).plural || "produtos")}</em></h2>
    </header>
    <div class="grade grade--4">${relacionados.map(cartao).join("")}</div>
  </div>
</section>` : ""}`,
  });
}

/* ==========================================================================
   O CARRINHO NO COOKIE

   Guarda `{id, q}` e nada mais. O preço vem do banco a cada leitura — sempre.
   Um carrinho que carrega o preço é um carrinho em que o cliente decide quanto
   vai pagar, e ninguém percebe até fechar o mês.

   Cookie e não sessão de servidor: o carrinho sobrevive ao restart do serviço,
   e a loja não precisa de armazenamento por visitante anônimo — que, pela
   LGPD, seria dado a mais para justificar.
   ========================================================================== */
const CESTA = "alafcell_cesta";

function ler(req) {
  try {
    const g = new RegExp("(?:^|;\\s*)" + CESTA + "=([^;]*)").exec(req.headers.cookie || "");
    if (!g) return [];
    const itens = JSON.parse(decodeURIComponent(g[1]));
    if (!Array.isArray(itens)) return [];
    return itens
      .map((i) => ({ id: Number(i.id) || 0, q: Math.max(1, Math.min(99, Number(i.q) || 0)) }))
      .filter((i) => i.id > 0);
  } catch { return []; }
}

function gravar(res, itens) {
  const v = encodeURIComponent(JSON.stringify(itens));
  res.setHeader("Set-Cookie",
    `${CESTA}=${v}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax`);
}

/* As linhas do carrinho com o preço de agora. Produto que sumiu ou saiu de
   linha simplesmente não volta — e o cliente vê o carrinho menor, o que é
   melhor que ver um item que a loja não pode vender. */
function linhas(req) {
  const itens = ler(req);
  const out = [];
  for (const i of itens) {
    const p = Q.um("SELECT * FROM produtos WHERE id = ? AND ativo = 1", i.id);
    if (!p) continue;
    /* Nunca vender mais do que existe: a quantidade cai para o estoque. */
    const q = Math.min(i.q, Math.max(0, p.estoque));
    if (q <= 0) continue;
    out.push({ p, q, subtotal: p.preco * q });
  }
  return out;
}

const somar = (ls) => ls.reduce((s, l) => s + l.subtotal, 0);

/* ==========================================================================
   /carrinho/
   ========================================================================== */
function carrinho(req, q = {}) {
  const ls = linhas(req);
  const total = somar(ls);

  const corpo = ls.length ? `
<form class="carrinho" action="/carrinho/atualizar" method="post">
  <div class="carrinho__itens">
    ${ls.map((l) => `
    <div class="citem cartao">
      <a class="citem__foto" href="/produto/${esc(l.p.slug)}/">${imagem(l.p, "prod__img--p")}</a>
      <div class="citem__info">
        <a class="citem__nome" href="/produto/${esc(l.p.slug)}/">${esc(l.p.nome)}</a>
        <span class="citem__meta">${esc(l.p.condicao === "novo" ? "Novo lacrado" : "Seminovo")}
          ${l.p.armazenamento ? " · " + esc(l.p.armazenamento) : ""}</span>
        <span class="citem__unit dado">${esc(reais(l.p.preco))} cada</span>
      </div>
      <label class="campo campo--qtd">
        <span class="sr">Quantidade de ${esc(l.p.nome)}</span>
        <input class="campo__ent" type="number" name="q_${l.p.id}" value="${l.q}"
               min="0" max="${l.p.estoque}" inputmode="numeric">
      </label>
      <span class="citem__sub preco">${esc(reais(l.subtotal))}</span>
      <button class="citem__x" type="submit" name="remover" value="${l.p.id}"
              aria-label="Remover ${esc(l.p.nome)}">&times;</button>
    </div>`).join("")}
    <p class="carrinho__nota">Mudou a quantidade? <button class="btn btn--linha btn--sm" type="submit">Atualizar</button></p>
  </div>

  <aside class="resumo cartao">
    <h2 class="cartao__titulo">Resumo</h2>
    <dl class="resumo__l">
      <div><dt>Produtos</dt><dd class="dado">${esc(reais(total))}</dd></div>
      <div><dt>Frete</dt><dd class="dado">a combinar</dd></div>
    </dl>
    <div class="resumo__total">
      <span>Total</span><span class="preco preco--g">${esc(reais(total))}</span>
    </div>
    <a class="btn btn--acao btn--lg btn--largo" href="/checkout/">Fechar pedido</a>
    <p class="resumo__nota">Retirada aqui na loja sem custo. Entrega em
      ${esc(txt("loja.cidade", "Caruaru"))} combinada no WhatsApp depois do pedido.</p>
  </aside>
</form>`
  : `
<div class="vazio cartao" data-revela>
  ${engrenagem("", 56)}
  <h2 class="titulo">Seu carrinho está vazio</h2>
  <p class="sub">Que tal começar pelos seminovos? São os que passam pela nossa bancada
    antes de ir para a vitrine.</p>
  <div class="hero__acoes">
    <a class="btn btn--acao" href="/loja/seminovos/">Ver os seminovos</a>
    <a class="btn btn--linha" href="/loja/">Ver a loja toda</a>
  </div>
</div>`;

  return L.pagina({
    req, atual: "loja", canonical: "/carrinho/",
    titulo: "Carrinho", descricao: "Os produtos que você escolheu na loja da Alafcell.",
    corpo: `
<section class="secao capa">
  <div class="env">
    <p class="rotulo">${engrenagem("", 12)}Carrinho</p>
    <h1 class="titulo capa__t">Seu <em>pedido</em></h1>
    ${q.removido ? '<p class="aviso">Item removido do carrinho.</p>' : ""}
  </div>
</section>
<section class="secao" style="padding-top:0"><div class="env">${corpo}</div></section>`,
  });
}

/* ==========================================================================
   /checkout/
   ========================================================================== */
function checkout(req, q = {}) {
  const ls = linhas(req);
  if (!ls.length) return null;                 /* carrinho vazio: volta para ele */
  const total = somar(ls);

  return L.pagina({
    req, atual: "loja", canonical: "/checkout/",
    titulo: "Fechar pedido", descricao: "Finalize a sua compra na loja da Alafcell.",
    corpo: `
<section class="secao capa">
  <div class="env">
    <p class="rotulo">${engrenagem("", 12)}Passo 2 de 2</p>
    <h1 class="titulo capa__t">Fechar o <em>pedido</em></h1>
    <p class="sub">Faltam os dados de contato e como você prefere receber e pagar.
      Nada de cadastro: é uma tela só.</p>
  </div>
</section>

<section class="secao" style="padding-top:0">
  <div class="env">
    <form class="checkout" action="/checkout/enviar" method="post">
      <div class="checkout__campos">
        ${q.falta ? `<p class="aviso aviso--erro" role="alert">Faltou o nome ou o WhatsApp —
          são os dois que a gente usa para confirmar o pedido.</p>` : ""}

        <div class="cartao">
          <h2 class="cartao__titulo">Seus dados</h2>
          <div class="form-linha">
            <label class="campo"><span class="campo__rot">Nome completo *</span>
              <input class="campo__ent" type="text" name="nome" required maxlength="120" autocomplete="name"></label>
            <label class="campo"><span class="campo__rot">WhatsApp *</span>
              <input class="campo__ent" type="tel" name="telefone" required maxlength="20"
                     placeholder="(81) 90000-0000" autocomplete="tel"></label>
          </div>
          <div class="form-linha">
            <label class="campo"><span class="campo__rot">CPF</span>
              <input class="campo__ent" type="text" name="documento" maxlength="18"
                     inputmode="numeric" autocomplete="off"></label>
            <label class="campo"><span class="campo__rot">E-mail</span>
              <input class="campo__ent" type="email" name="email" maxlength="160" autocomplete="email"></label>
          </div>
        </div>

        <div class="cartao">
          <h2 class="cartao__titulo">Como você quer receber</h2>
          <div class="escolhas">
            <label class="escolha">
              <input type="radio" name="entrega" value="retirada" checked>
              <span class="escolha__c">
                <strong>Retirar na loja</strong>
                <span>${esc(txt("loja.endereco", "Endereço no rodapé"))} — sem custo.</span>
              </span>
            </label>
            <label class="escolha">
              <input type="radio" name="entrega" value="entrega">
              <span class="escolha__c">
                <strong>Entrega em ${esc(txt("loja.cidade", "Caruaru"))}</strong>
                <span>Combinamos o valor e o horário pelo WhatsApp antes de sair.</span>
              </span>
            </label>
          </div>
          <div class="form-linha" style="margin-top:1.1rem">
            <label class="campo"><span class="campo__rot">Endereço (se for entrega)</span>
              <input class="campo__ent" type="text" name="endereco" maxlength="180"
                     autocomplete="street-address"></label>
            <label class="campo"><span class="campo__rot">Bairro</span>
              <input class="campo__ent" type="text" name="bairro" maxlength="80"></label>
          </div>
        </div>

        <div class="cartao">
          <h2 class="cartao__titulo">Pagamento</h2>
          <div class="escolhas">
            <label class="escolha">
              <input type="radio" name="pagamento" value="pix" checked>
              <span class="escolha__c">
                <strong>Pix</strong>
                <span>O código aparece na próxima tela, já com o valor do pedido.</span>
              </span>
            </label>
            <label class="escolha">
              <input type="radio" name="pagamento" value="balcao">
              <span class="escolha__c">
                <strong>Cartão ou dinheiro na entrega</strong>
                <span>Máquina na loja e na entrega. Parcelamos no cartão.</span>
              </span>
            </label>
          </div>
          <label class="campo" style="margin-top:1.1rem">
            <span class="campo__rot">Alguma observação?</span>
            <textarea class="campo__ent" name="observacao" maxlength="500"
                      placeholder="Cor preferida, horário melhor para entrega…"></textarea>
          </label>
        </div>

        <p class="isca" aria-hidden="true">
          <label>Não preencha<input type="text" name="site" tabindex="-1" autocomplete="off"></label>
        </p>
      </div>

      <aside class="resumo cartao">
        <h2 class="cartao__titulo">Seu pedido</h2>
        <ul class="resumo__itens">
          ${ls.map((l) => `<li><span>${l.q}× ${esc(l.p.nome)}</span>
            <span class="dado">${esc(reais(l.subtotal))}</span></li>`).join("")}
        </ul>
        <div class="resumo__total">
          <span>Total</span><span class="preco preco--g">${esc(reais(total))}</span>
        </div>
        <button class="btn btn--acao btn--lg btn--largo" type="submit">Confirmar pedido</button>
        <p class="resumo__nota">Ao confirmar, o pedido chega ao nosso atendimento e a gente
          responde no WhatsApp. <a href="/carrinho/">Voltar ao carrinho</a></p>
      </aside>
    </form>
  </div>
</section>`,
  });
}

/* ==========================================================================
   GRAVAR O PEDIDO

   O total é somado AQUI, do banco, e não vem do formulário. O estoque cai na
   mesma transação: dois pedidos simultâneos da última unidade não podem sair
   os dois.
   ========================================================================== */
function gravarPedido(d, req) {
  if (String(d.site || "").trim()) return { spam: true };
  const ls = linhas(req);
  if (!ls.length) return null;
  if (!d.nome || !d.telefone) return { falta: true };

  const total = somar(ls);
  const codigo = codigoLivre("pedidos", "AC");

  const gravar = Q.db.transaction(() => {
    const r = Q.roda(
      `INSERT INTO pedidos (codigo, nome, documento, telefone, email, endereco, bairro,
                            cidade, entrega, observacao, total, pagamento)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      codigo, String(d.nome).slice(0, 120), String(d.documento || "").slice(0, 18),
      String(d.telefone).slice(0, 20), String(d.email || "").slice(0, 160),
      String(d.endereco || "").slice(0, 180), String(d.bairro || "").slice(0, 80),
      txt("loja.cidade", "Caruaru"),
      d.entrega === "entrega" ? "entrega" : "retirada",
      String(d.observacao || "").slice(0, 500), total,
      d.pagamento === "balcao" ? "balcao" : "pix");

    const item = Q.db.prepare(
      `INSERT INTO pedido_itens (pedido_id, produto_id, descricao, quantidade, preco, subtotal)
       VALUES (?,?,?,?,?,?)`);
    const baixa = Q.db.prepare(
      "UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?");

    for (const l of ls) {
      item.run(r.lastInsertRowid, l.p.id, l.p.nome, l.q, l.p.preco, l.subtotal);
      baixa.run(l.q, l.p.id, l.q);
    }
    return codigo;
  });

  return { codigo: gravar() };
}

/* ==========================================================================
   /pedido/:codigo/

   A tela do pedido fechado. Ela mostra nome, telefone e o que foi comprado, e
   por isso NÃO é pública: só abre para o navegador que fez o pedido, que
   recebeu um cookie na confirmação.

   Sem essa trava, trocar o código na barra de endereço mostraria o pedido de
   outra pessoa — e o código, mesmo sorteado, circula em conversa de WhatsApp.
   ========================================================================== */
function pedido(req, codigo) {
  const g = /(?:^|;\s*)alafcell_pedido=([^;]*)/.exec(req.headers.cookie || "");
  if (!g || g[1] !== codigo) return null;

  const p = Q.um("SELECT * FROM pedidos WHERE codigo = ?", codigo);
  if (!p) return null;
  const itens = Q.todos("SELECT * FROM pedido_itens WHERE pedido_id = ?", p.id);

  /* O Pix só é montado quando a loja cadastrou a chave. Sem chave, a tela
     mostra o combinado pelo WhatsApp — nunca um código quebrado, que parece
     funcionar e o banco recusa. */
  const chave = txt("pagamento.pix_chave", "");
  const brcode = p.pagamento === "pix" ? Pix.codigo({
    chave, nome: txt("pagamento.pix_nome", txt("marca.nome", "Alafcell")),
    cidade: txt("loja.cidade", "Caruaru"), valor: p.total, txid: p.codigo,
  }) : null;

  return L.pagina({
    req, atual: "loja", canonical: `/pedido/${codigo}/`,
    titulo: `Pedido ${codigo}`, descricao: "Pedido registrado na loja da Alafcell.",
    corpo: `
<section class="secao">
  <div class="env env--fino">
    <div class="cartao sucesso" data-revela>
      <span class="sucesso__ico">${engrenagem("eng--gira", 56)}</span>
      <p class="rotulo" style="justify-content:center">Pedido ${esc(codigo)}</p>
      <h1 class="titulo">Pedido <em>registrado</em></h1>
      <p class="sub">A gente confirma tudo pelo WhatsApp em seguida — inclusive o frete,
        se você escolheu entrega. Guarde o código acima.</p>
    </div>

    <div class="cartao" style="margin-top:1.2rem">
      <h2 class="cartao__titulo">O que você pediu</h2>
      <ul class="resumo__itens">
        ${itens.map((i) => `<li><span>${i.quantidade}× ${esc(i.descricao)}</span>
          <span class="dado">${esc(reais(i.subtotal))}</span></li>`).join("")}
      </ul>
      <div class="resumo__total">
        <span>Total</span><span class="preco preco--g">${esc(reais(p.total))}</span>
      </div>
      <p class="resumo__nota">${p.entrega === "entrega"
        ? "Entrega em " + esc(txt("loja.cidade", "Caruaru")) + " — o valor do frete é combinado no WhatsApp."
        : "Retirada na loja: " + esc(txt("loja.endereco", "endereço no rodapé"))}</p>
    </div>

    ${brcode ? `
    <div class="cartao pix" style="margin-top:1.2rem" data-revela>
      <h2 class="cartao__titulo">Pague com Pix</h2>
      <p class="cartao__texto">Aponte a câmera do seu banco para o código, ou use o copia e cola.
        O valor já vai preenchido.</p>
      <div class="pix__in">
        <div class="pix__qr">${QR.svg(brcode, { tamanho: 210 })}</div>
        <div class="pix__lado">
          <label class="campo">
            <span class="campo__rot">Pix copia e cola</span>
            <textarea class="campo__ent pix__codigo" id="pix-codigo" readonly rows="4">${esc(brcode)}</textarea>
          </label>
          <button class="btn btn--acao" type="button" data-copiar="#pix-codigo">Copiar código</button>
          <p class="cartao__texto" style="margin-top:.8rem">Depois de pagar, mande o comprovante
            no WhatsApp que a gente separa na hora.</p>
        </div>
      </div>
    </div>`
    : p.pagamento === "pix" ? `
    <p class="aviso" style="margin-top:1.2rem">A chave Pix ainda não foi cadastrada no painel.
      Combine o pagamento pelo WhatsApp.</p>` : ""}

    <div class="hero__acoes" style="margin-top:1.6rem">
      <a class="btn btn--acao" href="${zap(`Olá! Fiz o pedido ${codigo} pelo site.`)}"
         target="_blank" rel="noopener">Falar no WhatsApp</a>
      <a class="btn btn--linha" href="/loja/">Continuar comprando</a>
    </div>
  </div>
</section>`,
  });
}

/* ==========================================================================
   PEÇAS COMPARTILHADAS
   ========================================================================== */
function faixaGarantia() {
  return `
<section class="secao secao--tinta">
  <div class="env">
    <div class="grade grade--3">
      ${[
        ["Testado antes de vender", "Todo seminovo passa pela bancada: bateria medida, câmeras, alto-falantes e conector conferidos um a um."],
        ["Garantia da loja", "Aparelho novo com garantia do fabricante; seminovo com garantia nossa, por escrito."],
        ["Assistência no mesmo lugar", "Deu problema? Você volta aqui — não precisa mandar para outro estado."],
      ].map(([t, d], i) => `
      <div class="cartao" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <span class="serv__ico">${engrenagem("", 26)}</span>
        <h3 class="cartao__titulo">${esc(t)}</h3>
        <p class="cartao__texto">${esc(d)}</p>
      </div>`).join("")}
    </div>
  </div>
</section>`;
}

/* ==========================================================================
   SCHEMA.ORG
   ========================================================================== */
function jsonldProduto(p, marca) {
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "Product",
      name: p.nome,
      description: p.chamada,
      sku: p.sku || undefined,
      brand: marca ? { "@type": "Brand", name: marca.nome } : undefined,
      itemCondition: p.condicao === "novo"
        ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      offers: {
        "@type": "Offer",
        priceCurrency: "BRL",
        price: (p.preco / 100).toFixed(2),
        availability: p.estoque > 0
          ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: `${SITE}/produto/${p.slug}/`,
        seller: { "@id": `${SITE}/#loja` },
      },
    }],
  };
}

function jsonldLista(produtos, nome) {
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "ItemList", name: nome,
      itemListElement: produtos.slice(0, 30).map((p, i) => ({
        "@type": "ListItem", position: i + 1, name: p.nome,
        url: `${SITE}/produto/${p.slug}/`,
      })),
    }],
  };
}

module.exports = {
  lista, produto, carrinho, checkout, pedido, gravarPedido,
  ler, gravar, linhas, somar, CATEGORIAS,
};
