"use strict";
/* ==========================================================================
   config.cjs — ler e gravar um texto do site PELO TERMINAL

       node ferramentas/config.cjs                      lista tudo
       node ferramentas/config.cjs marca.whatsapp       mostra um
       node ferramentas/config.cjs marca.whatsapp 5581988887777    grava

   ISTO EXISTE PORQUE O /admin AINDA NÃO EXISTE.

   O conteúdo do site foi montado para ser preenchido no painel — endereço,
   telefone, horário, CNPJ e a chave Pix nascem com texto de espera. Enquanto o
   painel não chega, sem uma ferramenta assim não há como testar de verdade
   nada que dependa desses campos: o botão de WhatsApp, por exemplo, cai no
   número de exemplo e a conversa abre com um desconhecido.

   Quando o /admin existir, este arquivo continua útil para o caso em que o
   painel não serve: recuperar o site de um valor que quebrou a própria tela de
   edição.

   NÃO É PARA O DIA A DIA. Quem edita conteúdo é o dono da loja, no painel.
   ========================================================================== */
const { Q, txt, ajuste } = require("../src/db");

const [chave, ...resto] = process.argv.slice(2);
const valor = resto.join(" ");

/* ------------------------------------------------------------ listar tudo */
if (!chave) {
  const linhas = Q.todos(
    "SELECT chave, grupo, rotulo, valor FROM config ORDER BY grupo, ordem, chave");
  let grupo = "";
  for (const l of linhas) {
    if (l.grupo !== grupo) { grupo = l.grupo; console.log(`\n  [${grupo}]`); }
    /* O valor sai cortado: `home.texto` tem parágrafos inteiros e transformaria
       a listagem numa parede de texto onde não se acha mais nada. */
    const v = String(l.valor || "");
    const curto = v.length > 60 ? v.slice(0, 57) + "…" : v;
    console.log(`    ${l.chave.padEnd(24)} ${curto || "(vazio)"}`);
  }
  console.log("\n  Para gravar:  node ferramentas/config.cjs <chave> <valor>\n");
  process.exit(0);
}

/* --------------------------------------------------------------- mostrar */
if (!valor) {
  const l = Q.um("SELECT chave, rotulo, valor FROM config WHERE chave = ?", chave);
  if (!l) {
    console.error(`\n  ✖ não existe a chave "${chave}".`);
    console.error("    Rode sem argumento nenhum para ver a lista.\n");
    process.exit(1);
  }
  console.log(`\n  ${l.chave}`);
  console.log(`  ${l.rotulo || ""}`);
  console.log(`  valor: ${l.valor === "" ? "(vazio)" : l.valor}\n`);
  process.exit(0);
}

/* ---------------------------------------------------------------- gravar */
/* Só grava chave que JÁ EXISTE. Criar chave nova por aqui encheria o painel
   futuro de campos órfãos que ninguém sabe de onde vieram — e o lugar de
   declarar um campo é `src/conteudo-inicial.js`, onde ele nasce com grupo,
   rótulo e ajuda. */
const antes = Q.um("SELECT chave FROM config WHERE chave = ?", chave);
if (!antes) {
  console.error(`\n  ✖ não existe a chave "${chave}" — e esta ferramenta não cria chave nova.`);
  console.error("    Campo novo se declara em src/conteudo-inicial.js.\n");
  process.exit(1);
}

const anterior = txt(chave, "");
ajuste(chave, valor);
console.log(`\n  ${chave}`);
console.log(`  de:    ${anterior === "" ? "(vazio)" : anterior}`);
console.log(`  para:  ${valor}`);
console.log("\n  Recarregue a página — as telas são geradas a cada pedido.\n");
