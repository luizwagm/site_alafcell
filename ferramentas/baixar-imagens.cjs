#!/usr/bin/env node
/* ==========================================================================
   ALAFCELL — BAIXAR AS FOTOS DE BANCO LIVRE

       node ferramentas/baixar-imagens.cjs
       node ferramentas/baixar-imagens.cjs --conferir

   As fotos ficam NO PROJETO, e não são consumidas por link do fornecedor. Três
   motivos, e o terceiro é o que decide:

     · velocidade — servidas do mesmo domínio, sem uma segunda conexão TLS;
     · privacidade — o visitante não é anunciado ao servidor de terceiro, o que
       também evita ter de declarar mais um destino na política de privacidade;
     · permanência — link de banco de imagem muda de endereço, e o site aparece
       com buraco no lugar da foto sem erro em lugar nenhum.

   TODA IMAGEM É CONFERIDA PELA ASSINATURA depois de baixar. Um HTML de erro
   salvo como `.webp` grava sem reclamar, tem tamanho plausível e só é
   descoberto na tela — e nesse ponto ninguém lembra que veio daqui.
   ========================================================================== */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const DESTINO = path.join(__dirname, "..", "assets", "img", "banco");

/* Unsplash — licença livre, inclusive para uso comercial e sem exigência de
   atribuição (a atribuição é gentileza, e está no CREDITOS.md que este script
   gera).

   O sufixo pede ao CDN a imagem já pronta: `w=1200` porque nenhuma foto do site
   aparece maior que isso, `fm=webp` porque pesa cerca de um terço do JPEG na
   mesma qualidade, e `fit=crop` para o corte vir centralizado em vez de a foto
   chegar deitada e o CSS ter de escondê-la. Sem esses parâmetros viriam 6 MB de
   original para exibir num card de 400 px. */
const CDN = (id, l = 1200) =>
  `https://images.unsplash.com/${id}?w=${l}&q=72&fm=webp&fit=crop`;

/* --------------------------------------------------------------------------
   nome do arquivo | id da foto no Unsplash | para que serve

   O nome é o que o resto do sistema conhece. Trocar a foto é trocar o id desta
   linha e apagar o arquivo — nada mais muda no código.
   -------------------------------------------------------------------------- */
const FOTOS = [
  /* ------------------------------------------------------- seções do site */
  ["oficina",        "photo-1550041473-d296a3a8a18a", "técnico consertando aparelho na bancada"],
  ["bancada",        "photo-1581092921461-eab62e97a780", "aparelho aberto sendo trabalhado"],
  ["diagnostico",    "photo-1676311522524-fa7c0bffd644", "celular com estetoscópio — diagnóstico"],
  ["atendimento",    "photo-1697545806245-9795b6056141", "atendente entregando o celular ao cliente"],
  ["loja",           "photo-1697545806152-dcbf88b3befb", "clientes sendo atendidos na loja"],
  ["entrega",        "photo-1617347454431-f49d7ff5c3b1", "entregador de scooter — busca e leva"],

  /* ------------------------------------------------ capa de cada serviço */
  ["serv-tela",      "photo-1746005718004-1f992c399428", "iPhone desmontado com ferramentas"],
  ["serv-bateria",   "photo-1536692192939-f1547f1cde39", "celular com bateria no fim"],
  ["serv-carga",     "photo-1530545233050-3f0a5d0dd1ac", "celular carregando na tomada"],
  ["serv-camera",    "photo-1569040029205-a03a8b455808", "câmeras traseiras de um iPhone"],
  ["serv-audio",     "photo-1503324010925-71cfe52dad2a", "pessoa falando ao telefone"],
  ["serv-placa",     "photo-1611396000732-f8c9a933424f", "componentes eletrônicos em close"],
  ["serv-software",  "photo-1639776738932-956082f0b704", "técnico de luvas com o aparelho"],
  ["serv-vidro",     "photo-1746005514011-ea00280f3b6e", "peças de iPhone sobre a bancada"],

  /* ------------------------------------------------------------ blog */
  ["post-tela",      "photo-1539331586018-346b53b2aaa4", "conserto de celular em andamento"],
  ["post-bateria",   "photo-1682828511261-1d481875deb6", "iPhone ligado ao carregador"],
  ["post-agua",      "photo-1765220066469-54d4efe41ca5", "smartphone molhado na mão"],

  /* --------------------------------------------------- produtos da loja */
  ["prod-a16",       "photo-1587573578335-9672da4d0292", "Samsung Galaxy com a tela ligada"],
  ["prod-motog",     "photo-1569040029205-a03a8b455808", "smartphone preto na vitrine"],
  ["prod-redmi",     "photo-1512439408685-2e399291a4e6", "smartphone preto sobre a mesa"],
  ["prod-iphone11",  "photo-1548950243-cc758ad97878",    "pessoa segurando um iPhone"],
  ["prod-s21",       "photo-1522585136005-d014f6cf939e", "Galaxy sobre a escrivaninha"],
  ["prod-motog73",   "photo-1695648443061-a14bc74bf29d", "smartphone na mão"],
  ["prod-pelicula",  "photo-1557139129-b124bffe6f56", "tela de celular limpa e ligada"],
  ["prod-capa",      "photo-1535157412991-2ef801c1748b", "capas coloridas de celular"],
  ["prod-carregador","photo-1520287636485-66d0e25add79", "carregador de parede branco"],
  ["prod-fone",      "photo-1606220588913-b3aacb4d2f46", "fones bluetooth com estojo"],
  ["prod-caixa",     "photo-1612795146974-84dbe538f4a4", "caixa de som portátil"],
  ["prod-relogio",   "photo-1617043786394-f977fa12eddf", "smartwatch com pulseira"],
];

/* ==========================================================================
   O DOWNLOAD
   ========================================================================== */
const baixar = (url, saltos = 0) => new Promise((ok, falha) => {
  if (saltos > 5) return falha(new Error("redirecionou demais"));
  https.get(url, { headers: { "User-Agent": "Alafcell/1.0 (site institucional)" } }, (r) => {
    /* O CDN redireciona. Sem seguir o 302, o que se grava é a página de
       redirecionamento — que tem tamanho plausível e não é imagem nenhuma. */
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
      r.resume();
      return baixar(r.headers.location, saltos + 1).then(ok, falha);
    }
    if (r.statusCode !== 200) { r.resume(); return falha(new Error("HTTP " + r.statusCode)); }
    const pedacos = [];
    r.on("data", (p) => pedacos.push(p));
    r.on("end", () => ok(Buffer.concat(pedacos)));
  }).on("error", falha);
});

/* A assinatura do WEBP: "RIFF" nos primeiros quatro bytes e "WEBP" a partir do
   oitavo. É a única prova de que veio imagem, e não uma página de erro. */
const ehWebp = (b) =>
  b.length > 16 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";

async function principal() {
  const soConferir = process.argv.includes("--conferir");
  const refazer = process.argv.includes("--refazer");
  fs.mkdirSync(DESTINO, { recursive: true });

  let faltando = 0, baixadas = 0, total = 0;

  for (const [nome, id, uso] of FOTOS) {
    const alvo = path.join(DESTINO, nome + ".webp");

    if (fs.existsSync(alvo) && !refazer) {
      const kb = Math.round(fs.statSync(alvo).size / 1024);
      total += fs.statSync(alvo).size;
      console.log(`  · ${nome.padEnd(16)} já está aqui (${kb} KB)`);
      continue;
    }
    if (soConferir) { console.log(`  ✖ ${nome.padEnd(16)} FALTA — ${uso}`); faltando++; continue; }

    try {
      const dados = await baixar(CDN(id));
      if (!ehWebp(dados)) throw new Error(`não é WEBP (vieram ${dados.length} bytes)`);
      fs.writeFileSync(alvo, dados);
      baixadas++; total += dados.length;
      console.log(`  ✓ ${nome.padEnd(16)} ${Math.round(dados.length / 1024)} KB — ${uso}`);
    } catch (e) {
      console.log(`  ✖ ${nome.padEnd(16)} ${e.message}`);
      faltando++;
    }
  }

  /* ------------------------------------------------------ folha de contato
     Responde à única pergunta que nenhum teste automático responde: a foto que
     veio é do ASSUNTO que a página precisa? Nome de arquivo certo com foto
     errada passa em qualquer verificação de bytes. */
  fs.writeFileSync(path.join(DESTINO, "conferir.html"),
`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Conferir as fotos — Alafcell</title>
<style>
 body{font:15px/1.55 system-ui,sans-serif;margin:24px;background:#0B0C0E;color:#E8EAEC}
 h1{font-size:20px;margin-bottom:4px} p{color:#868C95;margin-bottom:20px}
 .g{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
 figure{margin:0;background:#15171B;border:1px solid #2A2E35;border-radius:12px;overflow:hidden}
 img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#1E2126}
 figcaption{padding:10px 12px;font-size:13px;color:#A8ADB4}
 b{display:block;font-family:ui-monospace,monospace;color:#FF4D4D;margin-bottom:2px}
</style></head><body>
<h1>Confira se cada foto é do assunto certo</h1>
<p>Nome de arquivo certo com foto errada passa em qualquer teste automático — só o olho pega.</p>
<div class="g">${FOTOS.map(([n, , uso]) =>
  `<figure><img src="${n}.webp" alt=""><figcaption><b>${n}.webp</b>${uso}</figcaption></figure>`).join("")}</div>
</body></html>`);

  fs.writeFileSync(path.join(DESTINO, "CREDITOS.md"),
    "# Fotos do site\n\nBanco: **Unsplash** — licença livre, inclusive para uso comercial,\n"
    + "sem exigência de atribuição. A lista abaixo é gentileza e rastreabilidade.\n\n"
    + FOTOS.map(([n, id, uso]) => `- \`${n}.webp\` — ${uso} · \`unsplash.com/photos/${id.replace("photo-", "")}\``).join("\n")
    + "\n\n> Estas são fotos de **banco de imagem**, para o site poder ser apresentado.\n"
    + "> Substitua pelas fotos reais da loja e dos produtos antes de divulgar o endereço.\n");

  console.log(`\n  ${baixadas ? baixadas + " baixada(s) · " : ""}${Math.round(total / 1024)} KB no total`);
  console.log(`  Folha de contato: assets/img/banco/conferir.html`);
  if (faltando) { console.log(`  ⚠ ${faltando} imagem(ns) faltando.\n`); process.exitCode = 1; }
  else console.log("  Todas no lugar.\n");
}

principal();
