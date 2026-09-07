"use strict";
/* ==========================================================================
   ENDEREÇO — em que domínio este site está rodando

   ---------------------------------------------------------------------------
   POR QUE O DOMÍNIO NÃO PODE ESTAR ESCRITO NO CÓDIGO

   O site vive em dois endereços ao longo da vida:

     alafcell.projetos.luizaugust.me   enquanto o cliente aprova
     alafcell.com.br                   quando entrar no ar de verdade

   Com o domínio escrito dentro do código, a virada vira uma caçada por
   canonical, JSON-LD, sitemap e robots — e o que sempre sobra é o canonical,
   que é justamente o que manda o Google indexar o endereço ERRADO.

   Aqui é uma variável de ambiente só. Trocar de domínio é editar o `.env` e
   reiniciar.

   ---------------------------------------------------------------------------
   O SUBDOMÍNIO DE TRABALHO NASCE INVISÍVEL PARA O GOOGLE

   Um site em aprovação indexado vira uma CÓPIA do site real na busca: os dois
   competem pela mesma consulta, o Google escolhe um sozinho e às vezes escolhe
   o de teste — com preço velho e texto provisório. Tirar do índice depois leva
   semanas.

   A regra é automática de propósito: qualquer endereço em
   `.projetos.luizaugust.me` é trabalho, e trabalho não é publicado. Ninguém
   precisa lembrar de marcar caixinha nenhuma antes de subir.
   ========================================================================== */

/* Sem barra no fim: o resto do código monta `SITE + "/loja/"`, e duas barras
   num canonical fazem o Google tratar como outra página. */
const SITE = String(process.env.ALAFCELL_SITE || "https://alafcell.projetos.luizaugust.me")
  .trim().replace(/\/+$/, "");

const HOST = SITE.replace(/^https?:\/\//, "");

/* A conferência é pelo SUFIXO — um domínio que apenas contenha o texto no meio
   (um `projetos.luizaugust.me.br` de outra pessoa) não deve passar por nosso
   subdomínio. */
const DE_TRABALHO = /(^|\.)projetos\.luizaugust\.me$/i.test(HOST)
  || HOST.startsWith("localhost")
  || HOST.startsWith("127.0.0.1");

/* Escape de válvula: dá para forçar nos dois sentidos sem mexer no código.
   Serve para o dia da virada — e para provar o comportamento no teste. */
const forcado = String(process.env.ALAFCELL_INDEXAVEL || "").toLowerCase();
const INDEXAVEL = forcado === "sim" ? true
  : forcado === "nao" ? false
  : !DE_TRABALHO;

/* ==========================================================================
   O robots.txt de cada caso

   No endereço de trabalho é `Disallow: /` e SEM linha de Sitemap. Publicar o
   sitemap num site que pede para não ser indexado é dizer as duas coisas ao
   mesmo tempo, e o Google resolve a contradição do jeito dele.

   No endereço real ficam de fora os painéis e o `/orcamento`.

   O `/orcamento` não é página: é um desvio para o WhatsApp. Indexá-lo poria a
   conversa da assistência no resultado de busca e gastaria rastreamento numa
   URL que nunca devolve conteúdo.

   Carrinho, checkout e acompanhamento saíram desta lista na 0.4.0 junto com as
   rotas: pedir ao robô que não visite o que responde 404 é instrução morta, e
   instrução morta num robots.txt é a pista falsa que o próximo a ler vai
   seguir procurando uma loja que não existe mais.
   ========================================================================== */
function robots() {
  if (!INDEXAVEL) {
    return `# Endereço de trabalho — este site não é para ser indexado.
# O endereço público é outro. Ver src/endereco.js.
User-agent: *
Disallow: /
`;
  }
  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /restrito/
Disallow: /orcamento

Sitemap: ${SITE}/sitemap.xml
`;
}

/* O cabeçalho vai em TODA resposta do endereço de trabalho, não só no HTML.
   O robots.txt evita a VISITA; o `X-Robots-Tag` evita a INDEXAÇÃO de quem
   chegou por um link — e link de aprovação circula no WhatsApp o tempo todo. */
const CABECALHO_ROBOS = INDEXAVEL ? null : "noindex, nofollow, noarchive";

module.exports = { SITE, HOST, INDEXAVEL, DE_TRABALHO, robots, CABECALHO_ROBOS };
