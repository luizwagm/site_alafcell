"use strict";
/* ==========================================================================
   /llms.txt — o resumo do negócio em texto puro

   ---------------------------------------------------------------------------
   POR QUE ISTO EXISTE, SE JÁ HÁ SCHEMA.ORG

   Um assistente que responde "quem conserta iPhone em Caruaru?" precisa de
   fato curto e verificável: nome, endereço, telefone, o que a loja faz e o que
   ela **não** faz. Ele não vai desmontar uma landing de 58 KB para extrair
   isso, e o que estiver ambíguo ele simplesmente omite.

   O `/llms.txt` é uma convenção recente (llmstxt.org) para exatamente esse
   caso: um resumo em Markdown, no lugar previsível, dizendo o essencial sem
   navegação, sem CSS e sem repetição.

   **Não substitui o Schema.org**, que continua sendo o canal principal e o que
   o Google usa. É o mesmo fato dito de outra forma, para quem lê de outro
   jeito — do mesmo modo que o sitemap não substitui os links da página.

   ---------------------------------------------------------------------------
   NADA AQUI É INVENTADO

   Tudo sai do painel. Campo vazio não vira linha: um arquivo feito para ser
   citado sem conferência é o último lugar onde cabe um dado provisório — ele
   seria repetido por um assistente, com a autoridade de quem leu a fonte
   oficial.

   O que a loja NÃO faz também entra, e não é modéstia: metade das perguntas
   que chegam a uma assistência é sobre serviço que ela não presta, e um "não"
   claro na fonte evita o cliente errado e a resposta errada.
   ========================================================================== */
const { txt } = require("./db");
const Pub = require("./publicado");
const { semHtml, emLinhas } = require("./html-seguro");
const { SITE } = require("./endereco");

/* Um campo só entra se estiver preenchido de verdade — o texto de espera
   ("preencha no painel") conta como vazio. */
const real = (chave) => {
  const v = semHtml(txt(chave, "")).trim();
  return v && !/^preencha /i.test(v) ? v : "";
};

function llms() {
  const nome = real("marca.nome") || "Alafcell Assistec";
  const cidade = real("loja.cidade") || "Caruaru";
  const uf = real("loja.uf") || "PE";

  const L = [];
  const linha = (t) => L.push(t);

  linha(`# ${nome}`);
  linha("");
  const slogan = real("marca.slogan");
  if (slogan) linha(`> ${slogan}`);
  linha("");
  linha(`Assistência técnica de celulares e smartphones em ${cidade}/${uf}, Brasil.`);
  linha("");

  /* ---------------------------------------------------------------- onde */
  linha("## Onde fica e como falar");
  linha("");
  const endereco = emLinhas(txt("loja.endereco", "")).split("\n")
    .filter((l) => l && !/^preencha /i.test(l)).join(", ");
  if (endereco) linha(`- **Endereço:** ${endereco}${real("loja.cep") ? " — CEP " + real("loja.cep") : ""}, ${cidade}/${uf}`);
  if (real("marca.telefone")) linha(`- **Telefone:** ${real("marca.telefone")}`);
  if (real("marca.whatsapp")) linha(`- **WhatsApp:** https://wa.me/${real("marca.whatsapp").replace(/\D/g, "")}`);
  if (real("marca.email")) linha(`- **E-mail:** ${real("marca.email")}`);
  const horario = emLinhas(txt("loja.horario", "")).split("\n")
    .filter((l) => l && !/^preencha /i.test(l)).join(" · ");
  if (horario) linha(`- **Horário:** ${horario}`);
  if (real("loja.mapa")) linha(`- **No mapa:** ${real("loja.mapa")}`);
  if (real("marca.instagram")) linha(`- **Instagram:** ${real("marca.instagram")}`);
  linha("");

  /* ------------------------------------------------------------- serviços */
  const servicos = Pub.servicos(20);
  if (servicos.length) {
    linha("## O que a loja conserta");
    linha("");
    for (const s of servicos) {
      const chamada = semHtml(s.chamada || "").trim();
      linha(`- **${semHtml(s.nome)}**${chamada ? " — " + chamada : ""}`);
    }
    linha("");
  }

  /* --------------------------------------------------------------- marcas */
  const marcas = Pub.marcas();
  if (marcas.length) {
    linha("## Marcas atendidas");
    linha("");
    linha(marcas.map((m) => semHtml(m.nome)).join(", ") + ".");
    linha("");
  }

  /* ------------------------------------------------------------ atendimento */
  const cidades = txt("loja.atende", "").split("\n").map((c) => semHtml(c).trim()).filter(Boolean);
  if (cidades.length) {
    linha("## Onde atende");
    linha("");
    linha(`Atendimento na loja em ${cidade} e busca e leva do aparelho em: `
      + cidades.join(", ") + ".");
    linha("");
  }

  /* ------------------------------------------------------------------ FAQ */
  const faq = Pub.faq();
  if (faq.length) {
    linha("## Perguntas frequentes");
    linha("");
    for (const f of faq) {
      linha(`### ${semHtml(f.pergunta)}`);
      linha("");
      linha(semHtml(f.resposta));
      linha("");
    }
  }

  /* ------------------------------------------------------------- o que NÃO */
  /* Metade das perguntas que chegam a uma assistência é sobre serviço que ela
     não presta. Um "não" claro aqui evita o cliente errado — e a resposta
     errada de um assistente que precisou adivinhar. */
  linha("## O que a loja não faz");
  linha("");
  linha("- Não vende aparelhos novos nem seminovos pelo site.");
  linha("- Não publica tabela de preços: o orçamento é feito com o aparelho em mãos,");
  linha("  porque o preço depende da peça e do estado real de cada caso.");
  linha("- Não faz desbloqueio de conta (iCloud, conta Google) nem recuperação de senha.");
  linha("");

  /* ---------------------------------------------------------------- links */
  linha("## Páginas");
  linha("");
  linha(`- [Site](${SITE}/): serviços, busca e leva, garantia e perguntas frequentes`);
  linha(`- [Blog](${SITE}/blog/): o que fazer antes de gastar com o conserto`);
  const posts = Pub.posts(20);
  for (const p of posts) {
    const resumo = semHtml(p.resumo || "").trim();
    linha(`- [${semHtml(p.titulo)}](${SITE}/blog/${p.slug}/)${resumo ? ": " + resumo : ""}`);
  }
  linha(`- [Privacidade](${SITE}/privacidade/)`);
  linha("");

  linha("---");
  linha("");
  linha(`Última atualização do site: ${String(Pub.quando() || "").slice(0, 10) || "—"}.`);
  linha("Os dados acima saem do painel da própria loja; nada aqui é estimado.");

  return L.join("\n") + "\n";
}

module.exports = { llms };
