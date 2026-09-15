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

/* ==========================================================================
   O .ENV DO SERVIÇO VALE AQUI TAMBÉM (0.13.1)

   O serviço lê o `.env` pelo `EnvironmentFile` do systemd; este atalho é
   chamado pelo `deploy.sh` num shell comum, e até a 0.13.0 NÃO o lia. Com
   `ALAFCELL_DEMO=nao` no `.env`, o site subia com a demonstração desligada e a
   entrega seguinte a via ligada — e semeava de novo tudo o que a limpeza tinha
   tirado. As duas metades brigando a cada deploy, sem erro nenhum.

   Tem de vir ANTES dos `require`: `db.js` e `demo.js` leem as variáveis na
   carga. O que já está no ambiente ganha do arquivo, como no systemd com
   `Environment=`.
   ========================================================================== */
const fs = require("node:fs");
const path = require("node:path");
try {
  /* `ALAFCELL_ENV` aponta outro arquivo — é por onde a prova passa um `.env`
     de mentira sem tocar no de verdade. */
  const env = fs.readFileSync(process.env.ALAFCELL_ENV || path.join(__dirname, "..", ".env"), "utf8");
  for (const linha of env.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(linha);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
} catch { /* sem .env (máquina local): vale o ambiente */ }

const { Q } = require("../src/db");
const Inicial = require("../src/conteudo-inicial");
const Demo = require("../src/demo");

Inicial.semear();
const tirado = Demo.semear();
if (tirado) {
  const partes = [
    tirado.materias && `${tirado.materias} matéria(s)`,
    tirado.precos && `${tirado.precos} preço(s)`,
    tirado.produtos && `${tirado.produtos} produto(s)`,
    tirado.ordem && "a ordem DEMO-01",
    tirado.pix && "a chave Pix de demonstração",
  ].filter(Boolean);
  console.log(partes.length
    ? `demonstração retirada: ${partes.join(", ")}${tirado.publicou ? " (e tirada do ar)" : ""}`
    : "demonstração desligada — nada dela no banco");
}

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
