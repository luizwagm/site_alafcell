"use strict";
/* ==========================================================================
   PROVAS DE ROTA — o servidor de verdade, respondendo de verdade

   ---------------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE

   `provar.cjs` chama as funções direto. Isso cobre quase tudo e é rápido — mas
   é cego para uma família inteira de defeito: **a função existe, é exportada,
   está provada… e ninguém a ligou numa rota.**

   Foi exatamente o que aconteceu com o `robots.txt` e com o `/saude`. As duas
   rotas existiam no primeiro commit e foram APAGADAS na 0.4.0, junto com as
   rotas da loja — com as quais não tinham relação. A partir dali, a prova de
   `Endereco.robots()` continuou passando e o caminho `/robots.txt` respondia
   404. As duas coisas eram verdade ao mesmo tempo, e nenhum teste podia notar,
   porque nenhum teste passava pelo servidor.

   Aqui o servidor sobe de verdade, numa porta própria, e se responde ao que o
   buscador vai pedir.

   ---------------------------------------------------------------------------
   A PORTA

   5293 — bem longe da faixa dos sites do parque (5180-5210). Já derrubei site
   de cliente ocupando porta de teste na faixa errada.

   O banco é temporário, como no `provar.cjs`: nunca o do cliente.
   ========================================================================== */
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

const PORTA = 5293;
const RAIZ = path.join(__dirname, "..");
const BANCO = path.join(os.tmpdir(), `alafcell-rotas-${process.pid}.db`);

let passou = 0, falhou = 0;
const ok = (o, obtido, esperado) => {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(`    ${bom ? "✓" : "✗"} ${o}`);
  if (!bom) { console.log(`        esperado: ${esperado}\n        obtido:   ${obtido}`); falhou++; }
  else passou++;
};
const verdade = (o, v) => ok(o, !!v, true);

function pedir(caminho) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port: PORTA, path: caminho }, (res) => {
      let corpo = "";
      res.setEncoding("utf8");
      res.on("data", (p) => { corpo += p; });
      res.on("end", () => resolve({ codigo: res.statusCode, cabecalhos: res.headers, corpo }));
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("tempo esgotado")); });
  });
}

/* O servidor abre a porta antes de terminar de subir; bater cedo demais dá
   ECONNREFUSED e o teste acusaria defeito onde há só pressa. Tenta até
   responder, com teto — sem teto, um servidor que morreu na subida prenderia a
   suíte para sempre. */
async function esperarSubir(tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    /* SO 200 CONTA. Na primeira versao isto aceitava qualquer resposta, e por
       isso nao viu que `/saude` respondia 404 — a rota nunca tinha sido
       escrita. Um 404 e uma resposta valida do ponto de vista da conexao, e e
       exatamente esse tipo de "sucesso" que esconde defeito. */
    try {
      const r = await pedir("/saude");
      if (r.codigo === 200) return true;
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

(async () => {
  console.log("\n  Rotas (servidor de verdade)\n");

  /* ALAFCELL_INDEXAVEL=sim: o que interessa provar é o comportamento no
     DOMÍNIO REAL — é lá que robots e sitemap fazem diferença, e é lá que
     ninguém percebe o erro até o site já estar no ar. */
  const filho = spawn(process.execPath, ["server.js"], {
    cwd: RAIZ,
    env: {
      ...process.env,
      PORT: String(PORTA),
      ALAFCELL_DB: BANCO,
      ALAFCELL_SITE: "https://alafcell.com.br",
      ALAFCELL_INDEXAVEL: "sim",
      ALAFCELL_DEMO: "nao",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let saidaDoServidor = "";
  filho.stdout.on("data", (d) => { saidaDoServidor += d; });
  filho.stderr.on("data", (d) => { saidaDoServidor += d; });

  /* MATAR E APAGAR NA MESMA LINHA NAO FUNCIONA NO WINDOWS. `kill()` so PEDE
     para o processo sair; ele ainda esta com o banco aberto quando o
     `unlinkSync` roda, e no Windows arquivo aberto nao se apaga — o `catch`
     engole o erro e o banco de prova fica para tras a cada execucao. No Linux
     passa, entao o defeito nao aparece no servidor: so vai acumulando aqui.

     Esperar o evento `exit` do filho e o que garante que o arquivo esta livre;
     o teto de tempo evita prender a suite se ele nao morrer. */
  const encerrar = async () => {
    if (filho.exitCode === null && !filho.killed) {
      const morreu = new Promise((r) => filho.once("exit", r));
      try { filho.kill(); } catch {}
      await Promise.race([morreu, new Promise((r) => setTimeout(r, 5000))]);
    }
    for (const f of [BANCO, BANCO + "-wal", BANCO + "-shm"]) {
      try { fs.unlinkSync(f); } catch { /* ja foi, ou continua preso */ }
    }
  };

  try {
    if (!await esperarSubir()) {
      console.log("    ✗ o servidor não subiu\n" + saidaDoServidor.slice(0, 1200));
      falhou++;
      throw new Error("servidor não subiu");
    }

    /* ----------------------------------------------------------------- saude */
    /* O `deploy.sh` pede isto com `curl -fsS` depois de reiniciar o servico, e
       `-f` falha em 404: sem a rota, toda entrega reportava que o site nao
       subiu — com o site no ar. */
    const saude = await pedir("/saude");
    ok("/saude responde 200", saude.codigo, 200);
    const j = (() => { try { return JSON.parse(saude.corpo); } catch { return null; } })();
    verdade("com JSON legivel", !!j);
    ok("dizendo que esta de pe", (j || {}).ok, true);
    verdade("e a versao", !!(j || {}).versao);
    /* O deploy le estes dois para avisar o que ainda e de demonstracao. */
    verdade("o deploy consegue ler o aviso de demo", "demo" in (j || {}));
    verdade("e o da chave Pix", "pixDemo" in (j || {}));

    /* ---------------------------------------------------------------- robots */
    const robots = await pedir("/robots.txt");
    /* ESTE É O DEFEITO QUE ESTE ARQUIVO NASCEU PARA PEGAR: a função existia e
       estava provada; a rota não existia e respondia a página de 404. */
    ok("/robots.txt responde 200", robots.codigo, 200);
    verdade("e como texto puro, não HTML",
      /text\/plain/.test(robots.cabecalhos["content-type"] || ""));
    verdade("com a linha do sitemap", robots.corpo.includes("Sitemap: https://alafcell.com.br/sitemap.xml"));
    verdade("fechando o painel", robots.corpo.includes("Disallow: /admin/"));
    ok("e sem fechar o site inteiro", /^Disallow: \/$/m.test(robots.corpo), false);

    /* --------------------------------------------------------------- sitemap */
    const mapa = await pedir("/sitemap.xml");
    ok("/sitemap.xml responde 200", mapa.codigo, 200);
    verdade("com a landing dentro", mapa.corpo.includes("<loc>https://alafcell.com.br/</loc>"));
    /* Sem `lastmod` o buscador revisita tudo na mesma cadência e matéria nova
       demora a aparecer. */
    verdade("e com lastmod", /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(mapa.corpo));
    /* O `/orcamento` não é página: é um desvio para o WhatsApp. */
    ok("o /orcamento fica de fora", mapa.corpo.includes("/orcamento"), false);
    ok("e o painel também", mapa.corpo.includes("/admin"), false);

    /* Toda página anunciada tem de existir. Sitemap que aponta para 404 é o
       sinal que o buscador usa para desconfiar do resto do site. */
    const anunciadas = [...mapa.corpo.matchAll(/<loc>https:\/\/alafcell\.com\.br([^<]*)<\/loc>/g)]
      .map((m) => m[1]);
    verdade("o sitemap anuncia alguma coisa", anunciadas.length > 0);
    let mortas = [];
    for (const u of anunciadas) {
      const r = await pedir(u);
      if (r.codigo !== 200) mortas.push(`${u} → ${r.codigo}`);
    }
    ok("nenhuma página do sitemap responde erro", mortas, []);

    /* ------------------------------------------- os robôs de IA e o llms.txt */
    /* ⚠ ROBOTS.TXT NÃO HERDA: um robô obedece a UM grupo — o mais específico
       que casa com o nome dele — e ignora o `User-agent: *` inteiro. Dar grupo
       próprio ao GPTBot com só um `Allow: /` LIBERA o painel para ele, porque
       o `Disallow: /admin/` mora no outro grupo. Aconteceu aqui. */
    {
      const grupos = robots.corpo.split(/\n\s*\n/).filter((g) => /User-agent:/.test(g));
      verdade("há um grupo para os robôs de IA e outro para o resto", grupos.length >= 2);
      const semProibicao = grupos.filter((g) => !/Disallow: \/admin\//.test(g));
      ok("TODO grupo proíbe o painel — nenhum herda do outro", semProibicao.length, 0);
      verdade("os robôs de IA são nomeados", /User-agent: GPTBot/.test(robots.corpo));
      verdade("e o Claude também", /User-agent: ClaudeBot/.test(robots.corpo));
      verdade("o robots aponta para o llms.txt", robots.corpo.includes("/llms.txt"));
    }

    const llms = await pedir("/llms.txt");
    ok("/llms.txt responde 200", llms.codigo, 200);
    verdade("como texto puro", /text\/plain/.test(llms.cabecalhos["content-type"] || ""));
    verdade("com o nome do negócio", llms.corpo.includes("Alafcell"));
    verdade("o que a loja conserta", /## O que a loja conserta/.test(llms.corpo));
    /* Metade das perguntas que chegam a uma assistência é sobre serviço que ela
       não presta. Um "não" claro evita o cliente errado — e a resposta errada
       de um assistente que precisou adivinhar. */
    verdade("e o que ela NÃO faz", /## O que a loja não faz/.test(llms.corpo));
    /* Um arquivo feito para ser citado sem conferência é o último lugar onde
       cabe texto de espera: ele seria repetido com a autoridade da fonte. */
    ok("nenhum texto de espera vazou para ele", /preencha/i.test(llms.corpo), false);
    ok("nem marcação", /<[a-z]/i.test(llms.corpo), false);

    /* ------------------------------------------------------- o que o robô lê */
    const casa = await pedir("/");
    ok("a home responde 200", casa.codigo, 200);
    /* No domínio real NÃO pode sair marca de "não indexe" — nem no cabeçalho
       nem na página. Um `noindex` esquecido apaga o site da busca inteira, e é
       invisível para quem só olha a tela. */
    ok("sem X-Robots-Tag de noindex no domínio real",
      casa.cabecalhos["x-robots-tag"] || "", "");
    ok("e sem meta robots de noindex", /noindex/i.test(casa.corpo), false);
    verdade("o canonical aponta para o domínio real",
      casa.corpo.includes('<link rel="canonical" href="https://alafcell.com.br/">'));

    /* --------------------------------------------------- os dados do buscador */
    const bloco = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(casa.corpo);
    verdade("a home traz dados estruturados", !!bloco);
    const grafo = bloco ? JSON.parse(bloco[1])["@graph"] : [];
    const tipo = (t) => grafo.find((n) => JSON.stringify(n["@type"]).includes(t));

    verdade("com a ficha da loja", !!tipo("LocalBusiness"));
    verdade("a organização", !!tipo("Organization"));
    verdade("e o site", !!tipo("WebSite"));

    const loja = tipo("LocalBusiness");
    verdade("a loja diz onde atende", (loja.areaServed || []).length > 1);
    verdade("Caruaru entre as cidades",
      (loja.areaServed || []).some((c) => c.name === "Caruaru"));
    verdade("e o catálogo lista os consertos",
      ((loja.hasOfferCatalog || {}).itemListElement || []).length > 0);

    /* Decisão consciente, e por isso provada: avaliação do próprio negócio na
       própria página é "self-serving review" — o Google não exibe estrela para
       isso em LocalBusiness desde 2019. Marcar daria trabalho, nenhuma estrela,
       e apresentaria como conteúdo do site o que é da ficha do Google. */
    ok("nenhuma nota agregada é declarada", /aggregateRating/.test(casa.corpo), false);

    /* ------------------------------------------------------------------ FAQ */
    const faq = tipo("FAQPage");
    verdade("as perguntas frequentes estão marcadas", !!faq);
    const marcadas = ((faq || {}).mainEntity || []).map((q) => q.name);
    verdade("com mais de uma pergunta", marcadas.length > 1);
    /* REGRA DURA DO GOOGLE: só pode marcar pergunta que o visitante ENCONTRA na
       página. Marcar o que não está na tela é dado estruturado enganoso, e tira
       o site inteiro do recurso. */
    const foraDaTela = marcadas.filter((p) => !casa.corpo.includes(p));
    ok("e toda pergunta marcada está visível na página", foraDaTela, []);
    ok("a pergunta vai sem marcação (é texto no resultado da busca)",
      marcadas.some((p) => /[<>]/.test(p)), false);

    /* --------------------------------- o llms fica fora do endereço de trabalho */
    /* Publicar o resumo do negócio num endereço que pede para não ser indexado
       é dizer as duas coisas ao mesmo tempo — o mesmo motivo pelo qual o
       sitemap sai vazio lá. */
    {
      const { spawnSync } = require("node:child_process");
      const r = spawnSync(process.execPath, ["-e", `
        process.env.ALAFCELL_SITE = "https://alafcell.projetos.luizaugust.me";
        delete process.env.ALAFCELL_INDEXAVEL;
        const E = require(${JSON.stringify(path.join(RAIZ, "src", "endereco.js"))});
        console.log(E.INDEXAVEL ? "INDEXAVEL" : "TRABALHO");
      `], { cwd: RAIZ, encoding: "utf8" });
      ok("no endereço de trabalho o site não é indexável",
         (r.stdout || "").trim(), "TRABALHO");
    }

    /* ----------------------------------------------------------------- 404 */
    const perdida = await pedir("/pagina-que-nunca-existiu/");
    ok("caminho inexistente responde 404 de verdade", perdida.codigo, 404);
    /* 404 que responde 200 ("soft 404") faz o buscador indexar páginas de erro
       como se fossem conteúdo. */
    verdade("e a página de erro oferece saída", perdida.corpo.includes('href="/"'));

  } catch (e) {
    console.log("    ✗ " + e.message);
    falhou++;
  } finally {
    await encerrar();
  }

  console.log(`\n  ${falhou ? "✖" : "✔"} ${passou} passaram, ${falhou} falharam\n`);
  process.exit(falhou ? 1 : 0);
})();
