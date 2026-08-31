"use strict";
/* ==========================================================================
   ALAFCELL ASSISTEC — servidor

   Node puro, sem framework. O site tem cerca de vinte rotas; um framework aqui
   traria mais superfície de atualização de segurança do que economia de
   código — e este servidor precisa ficar de pé por anos sem manutenção.

   AS PÁGINAS SÃO GERADAS A CADA PEDIDO, a partir do banco. Não existe arquivo
   HTML com conteúdo dentro para o painel reescrever, e por isso "editou no
   admin, apareceu no site" é consequência da arquitetura — não de um passo de
   publicação que alguém pode esquecer de rodar.
   ========================================================================== */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const { Q, txt } = require("./src/db");
const Endereco = require("./src/endereco");
const Inicial = require("./src/conteudo-inicial");
const Painel = require("./src/painel");
const Paginas = require("./src/paginas");
const Demo = require("./src/demo");
const Consertos = require("./src/consertos");
const Coleta = require("./src/coleta");
const Loja = require("./src/loja");
const Blog = require("./src/blog");
const Inst = require("./src/institucional");
const Acompanhar = require("./src/acompanhar");
const VERSAO = require("./package.json").version;

const PORTA = Number(process.env.PORT) || 5202;
const HOST = process.env.HOST || "127.0.0.1";
const RAIZ = __dirname;

/* O site nasce cheio: textos, serviços e catálogo de aparelhos. Nada
   sobrescreve o que já existe — ver src/conteudo-inicial.js. */
Inicial.semear();
/* Material de apresentação: preços de referência, produtos, blog e uma ordem de
   exemplo. Só entra com as tabelas vazias, e sai inteiro com ALAFCELL_DEMO=nao.
   Ver src/demo.js — nada ali é preço real da loja. */
Demo.semear();
Painel.limparSessoes();

/* ------------------------------------------------------------ tipos MIME */
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function responder(res, codigo, corpo, tipo = "text/html; charset=utf-8", extra = {}) {
  res.writeHead(codigo, Object.assign({
    "Content-Type": tipo,
    /* Cabeçalhos que não custam nada e fecham três portas conhecidas: tipo
       adivinhado, enquadramento em iframe alheio e vazamento do endereço
       completo no Referer para outro site. */
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    /* No endereço de trabalho, TODA resposta sai marcada como fora do índice —
       inclusive imagem e CSS. O robots.txt evita a visita; este cabeçalho
       evita a indexação de quem chegou por um link, e link de aprovação
       circula no WhatsApp o tempo todo. */
    ...(Endereco.CABECALHO_ROBOS ? { "X-Robots-Tag": Endereco.CABECALHO_ROBOS } : {}),
  }, extra));
  res.end(corpo);
}

/* ==========================================================================
   ARQUIVOS ESTÁTICOS

   Autorizados por LUGAR, e não por extensão. A diferença já custou caro em
   outro projeto do parque: uma lista de extensões permitidas deixava
   `GET /server.js` responder 200, porque `.js` estava na lista.

   Aqui só saem arquivos de dentro de `/assets`, e o caminho é resolvido e
   conferido antes de abrir — `../` não escapa.
   ========================================================================== */
function estatico(req, res, caminho) {
  const alvo = path.resolve(RAIZ, "." + caminho);
  const permitido = path.join(RAIZ, "assets");
  if (!alvo.startsWith(permitido)) return false;

  let info;
  try { info = fs.statSync(alvo); } catch { return false; }
  if (!info.isFile()) return false;

  const ext = path.extname(alvo).toLowerCase();
  const etag = `W/"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ETag: etag }); res.end(); return true;
  }

  responder(res, 200, fs.readFileSync(alvo), TIPOS[ext] || "application/octet-stream", {
    ETag: etag,
    /* `no-cache` + ETag, e não `max-age`: com max-age o navegador nem
       pergunta, e uma correção de CSS levaria horas para chegar a quem já
       visitou o site. Com ETag, a pergunta custa um 304 vazio.
       A fonte é exceção: ela nunca muda de conteúdo sem mudar de nome. */
    "Cache-Control": ext === ".woff2" ? "public, max-age=31536000, immutable" : "no-cache",
  });
  return true;
}

/* ==========================================================================
   ACESSOS — contagem sem cookie e sem terceiro

   O IP entra como HASH com sal do dia. Dá para contar visitante único e não dá
   para saber de quem era o endereço depois — IP é dado pessoal pela LGPD, e o
   que não se guarda não vaza.

   O sal é sorteado a cada subida do serviço, e não guardado: nem nós
   conseguimos refazer o caminho de volta.
   ========================================================================== */
const SAL = crypto.randomBytes(16).toString("hex");

/* O IP vem do ÚLTIMO item do X-Forwarded-For, não do primeiro. O primeiro é
   texto que o cliente escreve — ler dali já custou caro em outro projeto do
   parque, onde a trava de força bruta era burlada com um cabeçalho falso. O
   último é o que o nosso nginx acrescentou. */
function ipDe(req) {
  return (req.headers["x-forwarded-for"] || "").split(",").pop().trim()
    || req.socket.remoteAddress || "";
}

function registrar(req, rota) {
  try {
    const dia = new Date().toISOString().slice(0, 10);
    const hash = crypto.createHash("sha256").update(SAL + dia + ipDe(req)).digest("hex").slice(0, 16);
    Q.roda("INSERT INTO acessos (dia, rota, ip_hash) VALUES (?,?,?)", dia, rota, hash);
  } catch { /* contagem nunca derruba página */ }
}

/* ==========================================================================
   CORPO DO POST

   Limite de 64 KB. Nenhum formulário do site tem o que passe disso, e sem teto
   um pedido malicioso mantém o processo lendo até a memória acabar —
   derrubando o site sem precisar de nenhuma falha de código.
   ========================================================================== */
function lerCorpo(req) {
  return new Promise((ok, falha) => {
    let bruto = "", tamanho = 0;
    req.on("data", (parte) => {
      tamanho += parte.length;
      if (tamanho > 64 * 1024) { req.destroy(); return falha(new Error("corpo grande demais")); }
      bruto += parte;
    });
    req.on("end", () => {
      const d = {};
      for (const [k, v] of new URLSearchParams(bruto)) d[k] = v;
      ok(d);
    });
    req.on("error", falha);
  });
}

/* ==========================================================================
   FREIO DE ENVIO

   Balde por IP, só nos POSTs públicos. Não é defesa contra ataque grande — é o
   que impede um robô de encher a tabela de contatos com mil linhas em um
   minuto, que é o problema real de formulário aberto na internet.
   ========================================================================== */
const baldes = new Map();
function freio(req, limite = 8, janelaMs = 10 * 60 * 1000) {
  const ip = ipDe(req);
  const agora = Date.now();
  const b = baldes.get(ip) || { n: 0, ate: agora + janelaMs };
  if (agora > b.ate) { b.n = 0; b.ate = agora + janelaMs; }
  b.n += 1;
  baldes.set(ip, b);
  if (baldes.size > 5000) baldes.clear();   /* teto de memória */
  return b.n <= limite;
}

function redir(res, para, extra = {}) {
  res.writeHead(303, Object.assign({ Location: para }, extra));
  res.end();
}

const json = (res, codigo, obj) =>
  responder(res, codigo, JSON.stringify(obj), TIPOS[".json"]);

/* ========================================================================== */
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || Endereco.HOST}`);
  const p = decodeURIComponent(url.pathname);
  const q = Object.fromEntries(url.searchParams);

  /* Metadados de repositório nunca saem pela web. */
  if (/\/\.(git|env)/.test(p)) return responder(res, 404, "não encontrado", TIPOS[".txt"]);

  if (p.startsWith("/assets/") && estatico(req, res, p)) return;

  /* ==========================================================================
     BARRA FINAL CANÔNICA

     /loja e /loja/ são a MESMA página, e o Google trata as duas como
     duplicadas se as duas responderem 200. Uma redireciona para a outra.

     AS ROTAS DE OPERAÇÃO FICAM DE FORA, e isso não é detalhe: mandar /saude
     para /saude/ faria o monitoramento e o verificador do deploy receberem 303
     seguido de 404 — reportando o site como fora do ar com o site no ar.
     ========================================================================== */
  const OPERACAO = ["/saude", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest"];
  /* GET e HEAD, não só GET: o Google e o monitoramento pedem HEAD, e um HEAD
     que cai no 404 enquanto o GET redireciona certo faz o site ser reportado
     como quebrado sem que ninguém consiga reproduzir no navegador. */
  if (p.length > 1 && !p.endsWith("/") && !path.extname(p)
      && (req.method === "GET" || req.method === "HEAD")
      && !OPERACAO.includes(p)
      && !p.startsWith("/api/")
      && !p.startsWith("/admin") && !p.startsWith("/restrito")) {
    return redir(res, p + "/" + (url.search || ""));
  }

  try {
    /* ======================================================== POSTs do site */
    if (req.method === "POST") {
      /* O acompanhamento fica FORA deste balde, e isso é conserto de um defeito
         que apareceu no teste: ele tem trava própria, mais apertada, e não grava
         nada. Somando os dois, quem consultasse a ordem algumas vezes ficava sem
         conseguir agendar a coleta depois — a trava de spam de formulário
         punindo justamente o cliente ansioso, que é quem mais consulta. */
      if (p !== "/acompanhar/" && !freio(req))
        return responder(res, 429, Paginas.erro404(req));
      const d = await lerCorpo(req);

      /* ------------------------------------------------------- contato */
      if (p === "/contato/") {
        return redir(res, Inst.gravarContato(d) ? "/contato/?ok=1" : "/contato/?falta=1");
      }

      /* -------------------------------------------------- busca e leva */
      if (p === "/busca-e-leva/") {
        return redir(res, Coleta.agendar(d) ? "/busca-e-leva/?ok=1#formulario"
                                            : "/busca-e-leva/?falta=1#formulario");
      }

      /* ------------------------------------------------------ carrinho
         O produto e a quantidade são conferidos AQUI, contra o banco. Um
         `produto=999` ou `quantidade=-3` vindos de um formulário adulterado
         não podem virar linha no carrinho. */
      if (p === "/carrinho/adicionar") {
        const prod = Q.um("SELECT id, estoque FROM produtos WHERE id = ? AND ativo = 1",
          Number(d.produto));
        if (!prod || prod.estoque <= 0) return redir(res, "/loja/");
        const itens = Loja.ler(req);
        const q = Math.max(1, Math.min(prod.estoque, Number(d.quantidade) || 1));
        const achou = itens.find((i) => i.id === prod.id);
        if (achou) achou.q = Math.min(prod.estoque, achou.q + q);
        else itens.push({ id: prod.id, q });
        Loja.gravar(res, itens);
        return redir(res, "/carrinho/");
      }

      if (p === "/carrinho/atualizar") {
        let itens = Loja.ler(req);
        const removeu = d.remover ? true : false;
        if (removeu) itens = itens.filter((i) => i.id !== Number(d.remover));
        itens = itens
          .map((i) => (d["q_" + i.id] === undefined ? i : { id: i.id, q: Number(d["q_" + i.id]) || 0 }))
          .filter((i) => i.q > 0);
        Loja.gravar(res, itens);
        return redir(res, "/carrinho/" + (removeu ? "?removido=1" : ""));
      }

      /* ------------------------------------------------------ checkout */
      if (p === "/checkout/enviar") {
        const r = Loja.gravarPedido(d, req);
        if (!r) return redir(res, "/carrinho/");
        if (r.spam) return redir(res, "/loja/");            /* isca: engole e ignora */
        if (r.falta) return redir(res, "/checkout/?falta=1");
        /* Dois cookies numa resposta só: o carrinho é esvaziado JUNTO com o
           desvio, senão um F5 na tela do pedido repetiria a compra. E o cookie
           do pedido é o que autoriza a ver aquela tela — sem ele, trocar o
           código na barra de endereço mostraria o pedido de outra pessoa. */
        res.setHeader("Set-Cookie", [
          "alafcell_cesta=" + encodeURIComponent("[]") + "; Path=/; Max-Age=0; SameSite=Lax",
          "alafcell_pedido=" + r.codigo + "; Path=/; Max-Age=" + (7 * 86400) + "; SameSite=Lax",
        ]);
        return redir(res, "/pedido/" + r.codigo + "/");
      }

      /* -------------------------------------------- acompanhar a ordem
         Consulta por POST, e não por GET: o código e o telefone não podem
         ficar no histórico do navegador nem no log do servidor — e um endereço
         com os dois dentro circula em conversa de WhatsApp. */
      if (p === "/acompanhar/") {
        const r = Acompanhar.buscar(d.codigo, d.telefone, ipDe(req));
        registrar(req, "/acompanhar/");
        return responder(res, r.ordem ? 200 : 404, Acompanhar.pagina(req, {
          ordem: r.ordem || null, erro: r.erro || "", codigo: String(d.codigo || ""),
        }));
      }

      return responder(res, 404, Paginas.erro404(req));
    }

    /* ------------------------------------------------------------ home */
    if (p === "/" || p === "/index.html") {
      registrar(req, "/");
      return responder(res, 200, Paginas.home(req));
    }

    const partes = p.split("/").filter(Boolean);

    /* -------------------------------------------------------- consertos */
    if (partes[0] === "consertos") {
      registrar(req, "/consertos/");
      if (partes.length === 1) return responder(res, 200, Consertos.lista(req, q));
      if (partes.length === 2) {
        const html = Consertos.servico(req, partes[1]);
        return html ? responder(res, 200, html) : responder(res, 404, Paginas.erro404(req));
      }
    }

    /* ----------------------------------------------------- busca e leva */
    if (p === "/busca-e-leva/") {
      registrar(req, "/busca-e-leva/");
      return responder(res, 200, Coleta.pagina(req, q));
    }

    /* -------------------------------------------------------------- loja */
    if (partes[0] === "loja") {
      registrar(req, "/loja/");
      const html = Loja.lista(req, partes[1] || "", q);
      return html ? responder(res, 200, html) : responder(res, 404, Paginas.erro404(req));
    }

    if (partes[0] === "produto" && partes.length === 2) {
      registrar(req, "/produto/");
      const html = Loja.produto(req, partes[1]);
      return html ? responder(res, 200, html) : responder(res, 404, Paginas.erro404(req));
    }

    if (p === "/carrinho/") return responder(res, 200, Loja.carrinho(req, q));

    if (p === "/checkout/") {
      const html = Loja.checkout(req, q);
      return html ? responder(res, 200, html) : redir(res, "/carrinho/");
    }

    if (partes[0] === "pedido" && partes.length === 2) {
      const html = Loja.pedido(req, partes[1]);
      return html ? responder(res, 200, html) : responder(res, 404, Paginas.erro404(req));
    }

    /* -------------------------------------------------------------- blog */
    if (partes[0] === "blog") {
      registrar(req, "/blog/");
      if (partes.length === 1) return responder(res, 200, Blog.indice(req));
      if (partes.length === 2) {
        const html = Blog.materia(req, partes[1]);
        return html ? responder(res, 200, html) : responder(res, 404, Paginas.erro404(req));
      }
    }

    /* ------------------------------------------------------ acompanhar */
    if (p === "/acompanhar/") {
      registrar(req, "/acompanhar/");
      return responder(res, 200, Acompanhar.pagina(req));
    }

    /* ----------------------------------------------------- institucional */
    if (p === "/contato/") {
      registrar(req, "/contato/");
      return responder(res, 200, Inst.contato(req, q));
    }
    if (p === "/privacidade/") return responder(res, 200, Inst.privacidade(req));

    /* ==========================================================================
       MODELOS DE UMA MARCA

       A única rota de dados do site público. Existe porque despejar os mais de
       quarenta modelos no HTML de toda página custaria peso em toda visita para
       servir a uma minoria que usa o filtro.

       Devolve só slug e nome — nada de id, que é detalhe interno do banco e não
       tem por que circular.
       ========================================================================== */
    if (p === "/api/modelos") {
      const modelos = Q.todos(
        `SELECT m.slug, m.nome FROM modelos m JOIN marcas ma ON ma.id = m.marca_id
         WHERE ma.slug = ? AND m.ativo = 1 AND ma.ativo = 1 ORDER BY m.ordem, m.nome`,
        String(q.marca || ""));
      return json(res, 200, { modelos });
    }

    /* --------------------------------------------------------- operação */
    if (p === "/saude") {
      return json(res, 200, {
        ok: true, versao: VERSAO,
        servicos: Q.um("SELECT COUNT(*) c FROM servicos WHERE ativo=1").c,
        produtos: Q.um("SELECT COUNT(*) c FROM produtos WHERE ativo=1").c,
        ordens: Q.um("SELECT COUNT(*) c FROM ordens").c,
        /* Os dois avisos que precisam viajar para FORA do processo. O log da
           subida só é lido por quem está no terminal naquele minuto; aqui o
           deploy e o monitoramento enxergam que o site ainda está com preço de
           demonstração e com uma chave Pix que não recebe dinheiro. */
        demo: Demo.LIGADO,
        pixDemo: txt("pagamento.pix_chave", "") === Demo.CHAVE_DEMO,
      });
    }

    if (p === "/robots.txt") return responder(res, 200, Endereco.robots(), TIPOS[".txt"]);

    if (p === "/manifest.webmanifest") {
      return responder(res, 200, JSON.stringify({
        name: txt("marca.nome", "Alafcell Assistec"),
        short_name: "Alafcell",
        start_url: "/",
        display: "standalone",
        background_color: "#0B0C0E",
        theme_color: "#0B0C0E",
        icons: [
          { src: "/assets/img/icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "/assets/img/icone-512.png", sizes: "512x512", type: "image/png" },
        ],
      }), TIPOS[".webmanifest"]);
    }

    if (p === "/sitemap.xml") {
      /* No endereço de trabalho o sitemap sai VAZIO, e não com as URLs de
         trabalho dentro. Sitemap preenchido é convite explícito para indexar —
         contradizendo o robots.txt que acabou de pedir o contrário. */
      const urls = [];
      if (Endereco.INDEXAVEL) {
        urls.push("/", "/consertos/", "/busca-e-leva/", "/loja/", "/loja/smartphone/",
          "/loja/seminovos/", "/loja/acessorio/", "/loja/periferico/", "/blog/",
          "/contato/", "/privacidade/");
        for (const m of Q.todos("SELECT slug FROM marcas WHERE ativo=1"))
          urls.push(`/consertos/?marca=${m.slug}`);
        for (const m of Q.todos("SELECT slug FROM modelos WHERE ativo=1 AND popular=1"))
          urls.push(`/consertos/?modelo=${m.slug}`);
        for (const s of Q.todos("SELECT slug FROM servicos WHERE ativo=1"))
          urls.push(`/consertos/${s.slug}/`);
        for (const pr of Q.todos("SELECT slug FROM produtos WHERE ativo=1"))
          urls.push(`/produto/${pr.slug}/`);
        for (const b of Q.todos("SELECT slug FROM posts WHERE publicado=1"))
          urls.push(`/blog/${b.slug}/`);
      }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${Endereco.SITE}${u}</loc></url>`).join("\n")}
</urlset>`;
      return responder(res, 200, xml, TIPOS[".xml"]);
    }

    return responder(res, 404, Paginas.erro404(req));
  } catch (e) {
    console.error("  ✖", p, "—", e.message);
    return responder(res, 500, "Erro interno", TIPOS[".txt"]);
  }
});

/* ==========================================================================
   PRIMEIRO ACESSO

   Sem nenhum usuário, os painéis ficariam trancados por fora. A saída NÃO é
   senha padrão ("admin/admin"): essa é a primeira coisa que um robô testa, e
   ninguém troca depois.

   Aqui o primeiro usuário nasce com senha SORTEADA, escrita uma única vez no
   log da subida. Quem tem acesso ao servidor lê e troca; quem não tem, não
   descobre — e não existe senha conhecida esperando para ser adivinhada.
   ========================================================================== */
function primeiroUsuario() {
  if (Q.um("SELECT COUNT(*) c FROM usuarios").c) return null;
  const senha = crypto.randomBytes(9).toString("base64url");
  Q.roda("INSERT INTO usuarios (usuario, nome, senha, papel) VALUES (?,?,?,?)",
    "dono", "Alafcell", Painel.cifrar(senha), "dono");
  return senha;
}

/* Escuta no loopback: quem publica é o nginx. O serviço nunca fica exposto
   direto na internet, e por isso não precisa de TLS aqui dentro. */
servidor.listen(PORTA, HOST, () => {
  const senha = primeiroUsuario();
  console.log(`
  Alafcell Assistec — v${VERSAO}
  ─────────────────────────────────────────────
  Escutando http://${HOST}:${PORTA}/
  Endereço  ${Endereco.SITE}${Endereco.INDEXAVEL
    ? "   (indexável)"
    : "\n            ⚠ endereço de TRABALHO — fora do índice do Google"}
  Banco     ${require("./src/db").CAMINHO}
  Serviços ${Q.um("SELECT COUNT(*) c FROM servicos").c} · Modelos ${Q.um("SELECT COUNT(*) c FROM modelos").c} · Produtos ${Q.um("SELECT COUNT(*) c FROM produtos").c}
`);
  /* Aviso alto, a cada subida, enquanto a chave Pix ainda for a de
     demonstração. Ela não recebe dinheiro nenhum — e um checkout que parece
     pronto e não cobra é pior que um checkout desligado. */
  if (txt("pagamento.pix_chave", "") === Demo.CHAVE_DEMO) console.log(
`  ⚠  A chave Pix ainda é a de DEMONSTRAÇÃO (${Demo.CHAVE_DEMO}).
     Ela não recebe pagamento. Cadastre a chave real em /admin antes de divulgar o site.
`);
  if (Demo.LIGADO) console.log(
`  ⚠  Conteúdo de DEMONSTRAÇÃO ativo: preços, produtos, blog e a ordem DEMO-01.
     Nenhum preço ali é real. Suba com ALAFCELL_DEMO=nao para o site começar limpo.
`);
  if (senha) console.log(
`  ┌──────────────────────────────────────────────────────┐
  │  PRIMEIRO ACESSO — anote agora, aparece uma vez só   │
  │                                                      │
  │    usuário:  dono                                    │
  │    senha:    ${senha.padEnd(40)}│
  │                                                      │
  │  Troque em /admin assim que entrar.                  │
  └──────────────────────────────────────────────────────┘
`);
});
