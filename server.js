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
/* O montador de link do WhatsApp mora no layout — mesma função que os botões
   da página usam. Duas versões do mesmo link é o caminho para uma delas ficar
   com o número velho no dia em que o cliente trocar de aparelho. */
const { zap } = require("./src/layout");
const Admin = require("./src/admin");
const Pub = require("./src/publicado");
const Google = require("./src/google");
const Blog = require("./src/blog");
const Inst = require("./src/institucional");
/* ==========================================================================
   DESLIGADOS NA 0.4.0 — os arquivos continuam em src/, sem rota nenhuma:

     src/consertos.js    telas por serviço e por modelo, com tabela de preços
     src/coleta.js       formulário de agendamento da busca e leva
     src/loja.js         vitrine, carrinho, checkout e pedido
     src/acompanhar.js   consulta da ordem por código + telefone

   NÃO CONFUNDIR com `src/medicao.js`, que CONTINUA EM USO: ele é o GA4 e o
   Meta Pixel com o consentimento de cookies, chamado pelo `layout.js` em toda
   página. O preço por modelo mora na tabela `precos`, lida por `apartirDe()`.

   Não são `require` porque nada os chama: carregá-los a cada subida e mantê-los
   na lista faria parecer que ainda servem a alguma coisa. Para religar qualquer
   um, o caminho é o `require` mais a rota — o CHANGELOG da 0.4.0 diz quais
   rotas eram.
   ========================================================================== */
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
   O CORPO EM BYTES — para a imagem do painel

   `lerCorpo` monta um formulário a partir de texto; imagem não é texto, e
   passá-la por ali a corromperia em silêncio (o byte 0x80 vira U+FFFD e o
   arquivo gravado não abre mais).

   O teto é conferido ENQUANTO chega, e não no fim: esperar o upload inteiro
   para depois recusar é deixar qualquer um encher a memória do servidor com um
   POST de 900 MB.
   ========================================================================== */
function lerBinario(req, teto) {
  return new Promise((ok) => {
    const partes = [];
    let tamanho = 0;
    req.on("data", (p) => {
      tamanho += p.length;
      if (tamanho > teto) { req.destroy(); return ok(null); }
      partes.push(p);
    });
    req.on("end", () => ok(Buffer.concat(partes)));
    req.on("error", () => ok(null));
  });
}

/* A conexão chegou por https? Atrás do nginx o socket é http puro, e quem sabe
   do certificado é o cabeçalho que o proxy acrescenta. Isso decide o `Secure`
   do cookie de sessão: marcá-lo em http faria o navegador DESCARTAR o cookie,
   e o login "não funcionaria" no desenvolvimento sem nenhuma mensagem. */
function ehHttps(req) {
  return String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
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
  /* "/orcamento" entra aqui porque NÃO é página: é um desvio para o WhatsApp.
     Sem isto, o redirecionamento canônico o mandava para "/orcamento/" antes
     de a rota existir — e a query ia junto, então a mensagem parecia montada
     e o navegador parava num 404. */
  const OPERACAO = ["/saude", "/robots.txt", "/sitemap.xml", "/llms.txt", "/manifest.webmanifest", "/orcamento",
    /* A previa do painel tambem nao e pagina do site: sem isto o
       redirecionamento canonico a mandaria para "/admin/previa/", que nao
       existe — o mesmo tropeco que o /orcamento deu. */
    "/admin/previa"];
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
    /* ====================================================================
       O PAINEL DO DONO DA LOJA

       Tudo aqui exige sessão, MENOS a tela em si e o `entrar`. A tela pode ser
       servida a qualquer um porque ela não traz conteúdo nenhum: é casca vazia
       que busca os dados por API depois de autenticar. Servir a casca a quem
       não entrou evita um redirecionamento a mais e não entrega nada.

       As respostas de dados levam `Cache-Control: no-store`: conteúdo do
       painel não pode ficar no cache do navegador de uma máquina compartilhada
       — e balcão de assistência técnica é o exemplo do computador que várias
       pessoas usam.
       ==================================================================== */
    /* ====================================================================
       VER COMO VAI FICAR

       A MESMA home do site, montada lendo o rascunho. Não é uma segunda tela
       que imita a primeira: uma cópia divergiria da real no dia seguinte, e a
       pré-visualização que mente é pior que nenhuma.

       Exige sessão. Sem isso, qualquer um leria o rascunho por este endereço —
       e o rascunho é justamente o que ainda não deveria estar no ar.
       ==================================================================== */
    if (p === "/admin/previa") {
      if (!Painel.lerSessao(req)) return redir(res, "/admin/");
      const html = Pub.comoRascunho(() => Paginas.home(req));
      return responder(res, 200, html, TIPOS[".html"], { "Cache-Control": "no-store" });
    }

    if (p === "/admin" || p === "/admin/") {
      const html = fs.readFileSync(path.join(__dirname, "admin", "index.html"), "utf8")
        .replaceAll("{{VERSAO}}", VERSAO);
      return responder(res, 200, html, TIPOS[".html"], { "Cache-Control": "no-store" });
    }

    if (p.startsWith("/api/admin/")) {
      const rota = p.slice("/api/admin/".length);
      const semLoja = { "Cache-Control": "no-store" };
      const jsonAdm = (codigo, obj) => responder(res, codigo,
        JSON.stringify(obj), "application/json; charset=utf-8", semLoja);

      /* ---- entrar: a única sem sessão, e a única com freio ---- */
      if (rota === "entrar" && req.method === "POST") {
        if (!Admin.freioEntrada(ipDe(req))) {
          return jsonAdm(429, { error: "Muitas tentativas. Espere alguns minutos." });
        }
        const d = await lerCorpo(req);
        const u = Admin.entrar(d.usuario, d.senha);
        if (!u) return jsonAdm(401, { error: "Usuário ou senha incorretos." });
        const token = Painel.abrirSessao(u.id);
        res.setHeader("Set-Cookie", Painel.cookieSessao(token, ehHttps(req)));
        return jsonAdm(200, { ok: true, nome: u.nome, usuario: u.usuario, papel: u.papel });
      }

      /* ---- daqui para baixo, sessão obrigatória ---- */
      const sessao = Painel.lerSessao(req);
      if (!sessao) return jsonAdm(401, { error: "Faça login para continuar." });

      if (rota === "eu") return jsonAdm(200, { ok: true, ...sessao, versao: VERSAO });

      if (rota === "sair" && req.method === "POST") {
        Painel.fecharSessao(req);
        res.setHeader("Set-Cookie", "alafcell_sessao=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax");
        return jsonAdm(200, { ok: true });
      }

      /* ---- senha ---- */
      if (rota === "senha" && req.method === "POST") {
        const d = await lerCorpo(req);
        const u = Q.um("SELECT senha FROM usuarios WHERE id = ?", sessao.id);
        if (!Painel.confere(d.atual, u.senha)) {
          return jsonAdm(400, { error: "A senha atual não confere." });
        }
        if (!d.nova || String(d.nova).length < 8) {
          return jsonAdm(400, { error: "A senha nova precisa de pelo menos 8 caracteres." });
        }
        Q.roda("UPDATE usuarios SET senha = ? WHERE id = ?", Painel.cifrar(d.nova), sessao.id);
        /* Trocar a senha derruba as OUTRAS sessões: se alguém tinha um cookie
           roubado, ele para de valer no instante da troca. A daqui fica. */
        Q.roda("DELETE FROM sessoes WHERE usuario_id = ? AND token <> ?", sessao.id,
          (/(?:^|;\s*)alafcell_sessao=([^;]*)/.exec(req.headers.cookie || "") || [])[1] || "");
        return jsonAdm(200, { ok: true });
      }

      /* ====================================================================
         PUBLICAR

         Copia o rascunho para o instantâneo que o site lê. É a única ação do
         painel que muda o que o visitante vê — todo o resto grava e espera.
         ==================================================================== */
      if (rota === "publicar" && req.method === "POST") {
        const feito = Pub.publicar(sessao.nome || sessao.usuario);
        return jsonAdm(200, { ok: true, publicacao: feito });
      }

      /* Estado do site: há alteração esperando? quando foi a última vez? */
      if (rota === "estado") {
        return jsonAdm(200, {
          pendente: Pub.haMudancas(),
          ultima: Pub.ultima(),
        });
      }

      /* ---- buscar as avaliações no Google ---- */
      if (rota === "google" && req.method === "POST") {
        /* `forcar`: o clique no botão é um pedido explícito, e esperar o cache
           de 24h vencer faria o botão parecer quebrado para quem acabou de
           corrigir o Place ID. */
        const r = await Google.atualizar({ forcar: true });
        return jsonAdm(200, r);
      }

      /* ---- acessos ---- */
      if (rota === "acessos") return jsonAdm(200, Admin.acessos());

      /* ---- textos do site ---- */
      if (rota === "textos") {
        if (req.method === "POST") {
          const d = await lerCorpo(req);
          return jsonAdm(200, Admin.gravarTextos(d));
        }
        return jsonAdm(200, { grupos: Admin.textos() });
      }

      /* ---- imagem ---- */
      if (rota === "imagem" && req.method === "POST") {
        const buf = await lerBinario(req, Admin.TETO_IMAGEM);
        if (!buf) return jsonAdm(413, { error: "Imagem grande demais (o limite é 3 MB)." });
        const r = Admin.gravarImagem(buf);
        return jsonAdm(r.erro ? 400 : 200, r);
      }

      /* ---- as tabelas editáveis ---- */
      const mTab = /^(servicos|marcas|modelos|posts|avaliacoes|faq)(?:\/(\d+))?$/.exec(rota);
      if (mTab) {
        const tabela = mTab[1];
        const id = mTab[2] ? Number(mTab[2]) : 0;
        if (req.method === "GET") return jsonAdm(200, { itens: Admin.listar(tabela) });
        if (req.method === "POST") {
          const d = await lerCorpo(req);
          const r = Admin.gravar(tabela, id, d);
          return jsonAdm(r.erro ? 400 : 200, r);
        }
        if (req.method === "DELETE" && id) {
          const r = Admin.apagar(tabela, id);
          return jsonAdm(r.erro ? 409 : 200, r);
        }
      }

      return jsonAdm(404, { error: "rota do painel não encontrada" });
    }

    if (req.method === "POST") {
      /* O acompanhamento fica FORA deste balde, e isso é conserto de um defeito
         que apareceu no teste: ele tem trava própria, mais apertada, e não grava
         nada. Somando os dois, quem consultasse a ordem algumas vezes ficava sem
         conseguir agendar a coleta depois — a trava de spam de formulário
         punindo justamente o cliente ansioso, que é quem mais consulta. */
      if (p !== "/acompanhar/" && !freio(req))
        return responder(res, 429, Paginas.erro404(req));
      const d = await lerCorpo(req);

      /* ====================================================================
         NÃO HÁ MAIS POST NENHUM NO SITE (0.4.0)

         Saíram, nesta ordem: contato, agendamento da coleta, carrinho
         (adicionar e atualizar), checkout e a consulta de acompanhamento.
         Todos viraram conversa no WhatsApp, que é onde esta assistência
         atende de verdade.

         O bloco fica aqui, vazio, porque a alternativa seria o
         `if (req.method === "POST")` sumir e o servidor responder 404 de
         qualquer jeito — só que sem dizer a ninguém que isso foi decisão.
         ==================================================================== */
      return responder(res, 404, Paginas.erro404(req));
    }

    /* ------------------------------------------------------------ home */
    if (p === "/" || p === "/index.html") {
      registrar(req, "/");
      return responder(res, 200, Paginas.home(req));
    }

    const partes = p.split("/").filter(Boolean);

    /* ====================================================================
       O ORÇAMENTO VIRA A PRIMEIRA MENSAGEM DO WHATSAPP

       Esta rota não desenha nada: lê o que a pessoa escolheu na landing,
       escreve a mensagem e responde um 302 para o `wa.me`. É o que permite o
       formulário continuar sendo um form GET de verdade, sem depender de
       JavaScript para montar o link — numa assistência técnica, quem chega
       com o aparelho ruim e a rede pior é o público, não a exceção.

       OS NOMES SAEM DO BANCO, e não da query. O que chega na URL é um slug, e
       mandar o slug cru ("galaxy-a54") entregaria ao atendente um texto de
       máquina. É também o que impede forjar mensagem: só entra no texto o que
       existe cadastrado e ativo.
       ==================================================================== */
    if (p === "/orcamento") {
      registrar(req, "/orcamento");
      /* DO INSTANTÂNEO: um modelo que o dono desativou e ainda não publicou
         não pode entrar na mensagem que chega no WhatsApp da loja. */
      const marcaNome = (Pub.marcaPorSlug(q.marca) || {}).nome || "";
      const modeloNome = (Pub.modeloPorSlug(q.modelo) || {}).nome || "";
      const servicoNome = q.servico === "outro"
        ? "Outro problema"
        : (Pub.servicoPorSlug(q.servico) || {}).nome || "";

      const msg = ["Olá! Vim pelo site e queria um orçamento."];
      const aparelho = [marcaNome, modeloNome].filter(Boolean).join(" ");
      if (aparelho) msg.push("Aparelho: " + aparelho + ".");
      if (servicoNome) msg.push("Serviço: " + servicoNome + ".");
      /* Sem nada escolhido a mensagem ainda vale: melhor a conversa começar
         vazia do que não começar. Quem não soube dizer o modelo no site diz no
         WhatsApp, com o aparelho na mão. */
      if (!aparelho && !servicoNome) msg.push("Pode me ajudar?");

      return redir(res, zap(msg.join(" ")));
    }

    /* ====================================================================
       LOJA, CARRINHO, CHECKOUT E PEDIDO SAÍRAM (0.4.0)

       Não há loja virtual por enquanto. As rotas foram REMOVIDAS, e não
       escondidas atrás de uma bandeira: rota que existe e não deveria é rota
       que alguém acha pelo sitemap velho, pelo histórico do navegador ou por
       um link que ficou num WhatsApp de três meses atrás.

       `src/loja.js` continua no repositório, sem `require` e sem rota, para o
       dia em que a loja voltar. O CHANGELOG lista o que precisa ser religado.
       ==================================================================== */

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
    /* ====================================================================
       ACOMPANHAR E CONTATO SAÍRAM (0.4.0)

       O acompanhamento por código foi embora com a landing: quem está com o
       aparelho na assistência pergunta na conversa de WhatsApp que já existe.
       Contato virou a seção "#contato" da própria página.

       A PRIVACIDADE FICA, e fora do menu. O site recebe nome e telefone pelo
       WhatsApp e mede acesso; sem a página, o rodapé apontaria para o vazio e
       a LGPD não teria onde ser respondida.
       ==================================================================== */
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
      /* Do instantâneo, como o resto do site: o seletor não pode oferecer um
         modelo que ainda está em rascunho — a pessoa o escolheria e o
         `/orcamento` não saberia o nome dele. */
      const modelos = Pub.modelos()
        .filter((m) => !q.marca || m.marca_slug === q.marca)
        .map((m) => ({ slug: m.slug, nome: m.nome }));
      return responder(res, 200, JSON.stringify({ modelos }),
        "application/json; charset=utf-8");
    }

    /* ====================================================================
       SAUDE — a pergunta "o site subiu?"

       Nao e enfeite de monitoramento: o `deploy.sh` pede isto com `curl -fsS`
       depois de reiniciar o servico, e `-f` FALHA em 404. Sem a rota, toda
       entrega esgotava as 20 tentativas e reportava que o site nao subiu — com
       o site no ar e funcionando.

       Esta rota tambem foi apagada na 0.4.0, na mesma limpeza que levou o
       robots. DEPOIS DE REMOVER UM BLOCO DE ROTAS, PEDIR CADA CAMINHO QUE
       SOBROU — o que some junto nao avisa.

       Os tres avisos (demo, chave Pix de demonstracao, conteudo) sao lidos
       daqui pelo deploy: e o unico lugar onde alguem olha a cada entrega, e
       por isso o lugar certo para lembrar do que ainda e provisorio.

       NAO devolve nada que sirva a um atacante: sem caminho de arquivo, sem
       versao de dependencia, sem contagem que revele movimento da loja.
       ==================================================================== */
    if (p === "/saude") {
      const pix = txt("pagamento.pix_chave", "");
      return responder(res, 200, JSON.stringify({
        ok: true,
        versao: VERSAO,
        site: Endereco.SITE,
        indexavel: Endereco.INDEXAVEL,
        demo: Demo.LIGADO,
        pixDemo: !pix || pix === Demo.CHAVE_DEMO,
      }), TIPOS[".json"]);
    }

    /* ====================================================================
       LLMS.TXT — o resumo do negocio em texto puro

       Convencao recente (llmstxt.org) para assistentes que respondem
       perguntas lendo a web. Nao substitui o Schema.org — e o mesmo fato dito
       de outra forma, para quem le de outro jeito.

       Fica FORA do endereco de trabalho, como o sitemap: publicar o resumo do
       negocio num endereco que pede para nao ser indexado e dizer as duas
       coisas ao mesmo tempo.
       ==================================================================== */
    if (p === "/llms.txt") {
      if (!Endereco.INDEXAVEL) return responder(res, 404, Paginas.erro404(req));
      return responder(res, 200, require("./src/llms").llms(), TIPOS[".txt"]);
    }

    /* ====================================================================
       ROBOTS.TXT

       A funcao que monta o arquivo mora em `src/endereco.js` desde o comeco, e
       a ROTA tambem existia — ate a 0.4.0 apaga-la junto com as rotas da loja
       (vitrine, carrinho, checkout, acompanhar), com as quais ela nao tinha
       relacao nenhuma. De 0.4.0 a 0.8.0, `/robots.txt` respondeu 404.

       O caminho continuou na lista OPERACAO (que so o poupa do redirecionamento
       canonico), e foi isso que fez tudo parecer resolvido: a mencao
       sobrevivente num lugar faz supor que o resto continua la.

       O que isso custava: no dominio real, nenhuma regra e nenhuma linha
       `Sitemap:` — o buscador descobre o sitemap por ali. No endereco de
       trabalho, uma das duas defesas contra indexacao nao existia (o
       cabecalho `X-Robots-Tag` segurava sozinho).
       ==================================================================== */
    if (p === "/robots.txt") {
      return responder(res, 200, Endereco.robots(), TIPOS[".txt"]);
    }

    if (p === "/sitemap.xml") {
      /* No endereço de trabalho o sitemap sai VAZIO, e não com as URLs de
         trabalho dentro. Sitemap preenchido é convite explícito para indexar —
         contradizendo o robots.txt que acabou de pedir o contrário. */
      const urls = [];
      if (Endereco.INDEXAVEL) {
        /* ================================================================
           O SITEMAP ENCOLHEU COM O SITE (0.4.0)

           Ele oferecia ao Google quase setenta endereços: um por serviço, um
           por marca, um por modelo popular, um por produto. Todos dão 404
           agora. Sitemap que aponta para 404 não é só inútil — é o sinal que
           o buscador usa para desconfiar do resto, e as páginas mortas ficam
           meses no índice atrapalhando quem procura a loja.

           Sobraram as três que existem de verdade: a landing, o blog e cada
           matéria. O `/orcamento` NÃO entra: ele não é página, é um desvio
           para o WhatsApp, e indexá-lo colocaria a conversa da assistência
           no resultado de busca.
           ================================================================ */
        /* `lastmod` DIZ AO BUSCADOR O QUE MUDOU.

           Sem ele, todas as páginas parecem igualmente antigas e o buscador
           revisita na mesma cadência — matéria publicada hoje pode levar
           semanas para aparecer. A data da landing é a da última publicação,
           porque publicar é o que muda o site; a de cada matéria é a dela.

           Data ausente é omitida em vez de virar "hoje": `lastmod` mentindo
           gasta rastreamento à toa e o buscador aprende a ignorá-lo. */
        const doSite = Pub.quando();
        urls.push(["/", doSite], ["/blog/", doSite], ["/privacidade/", doSite]);
        /* Matéria não publicada não entra no sitemap: o Google iria buscá-la
           e receberia 404. */
        for (const b of Pub.posts()) urls.push([`/blog/${b.slug}/`, b.data || doSite]);
      }
      const dia = (v) => {
        const d = new Date(v);
        return v && !isNaN(d) ? d.toISOString().slice(0, 10) : "";
      };
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, q]) => {
  const m = dia(q);
  return `  <url><loc>${Endereco.SITE}${u}</loc>${m ? `<lastmod>${m}</lastmod>` : ""}</url>`;
}).join("\n")}
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
