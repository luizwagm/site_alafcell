#!/usr/bin/env node
/* ==========================================================================
   ALAFCELL — CONTEÚDO INICIAL, SEM SUBIR O SITE

       node ferramentas/semear.cjs

   O servidor já semeia na subida. Este atalho existe para o deploy: ele
   acrescenta o que faltar ANTES de reiniciar o serviço, para que a primeira
   resposta depois da entrega já venha com o conteúdo novo — em vez de a
   primeira visita pagar o custo.

   É idempotente: acrescenta o que falta e não toca no que a loja cadastrou.
   ========================================================================== */
"use strict";

const { Q } = require("../src/db");
const Inicial = require("../src/conteudo-inicial");
const Demo = require("../src/demo");

Inicial.semear();
Demo.semear();

const n = (sql) => Q.um(sql).c;
console.log(`textos    ${n("SELECT COUNT(*) c FROM config")}`);
console.log(`serviços  ${n("SELECT COUNT(*) c FROM servicos")}`);
console.log(`marcas    ${n("SELECT COUNT(*) c FROM marcas")}`);
console.log(`modelos   ${n("SELECT COUNT(*) c FROM modelos")}`);
console.log(`preços    ${n("SELECT COUNT(*) c FROM precos")}`);
console.log(`produtos  ${n("SELECT COUNT(*) c FROM produtos")}`);
console.log(`blog      ${n("SELECT COUNT(*) c FROM posts")}`);
if (Demo.LIGADO) {
  console.log("⚠ conteúdo de DEMONSTRAÇÃO ativo — nenhum preço ali é real (ALAFCELL_DEMO=nao desliga)");
}
