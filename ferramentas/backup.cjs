#!/usr/bin/env node
/* ==========================================================================
   ALAFCELL — CÓPIA DE SEGURANÇA DO BANCO

       node ferramentas/backup.cjs

   ---------------------------------------------------------------------------
   POR QUE NÃO É `cp banco.db copia.db`

   O banco roda em WAL: parte do que já foi gravado ainda está no arquivo
   `-wal`, e não no `.db`. Copiar só o `.db` com o site no ar produz um arquivo
   que ABRE sem erro e está desatualizado — o pior tipo de backup, porque
   ninguém descobre até precisar dele.

   O `VACUUM INTO` do SQLite resolve: ele grava uma cópia consistente, já
   compactada, sem parar o site. É a única forma correta de copiar um banco em
   uso.
   ========================================================================== */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { db, CAMINHO } = require("../src/db");

const RAIZ = path.join(__dirname, "..");
const PASTA = process.env.ALAFCELL_BACKUPS || path.join(RAIZ, "backups");

/* Quantas cópias ficam. Duas semanas é o prazo em que um erro de cadastro
   ainda é lembrado por quem o cometeu — depois disso ninguém sabe mais qual
   era o valor certo, e a cópia velha não ajuda. */
const MANTER = Number(process.env.ALAFCELL_BACKUPS_MANTER || 14);

function agora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

fs.mkdirSync(PASTA, { recursive: true });
const alvo = path.join(PASTA, `alafcell.${agora()}.db`);

/* O caminho vai como literal SQL entre aspas simples. A aspa dentro do caminho
   é escapada dobrando — improvável numa pasta de servidor, e barato de cobrir. */
db.exec(`VACUUM INTO '${alvo.replace(/'/g, "''")}'`);

const kb = Math.round(fs.statSync(alvo).size / 1024);
console.log(`cópia: ${path.basename(alvo)} (${kb} KB) — de ${path.basename(CAMINHO)}`);

/* ------------------------------------------------------------- faxina
   Só apaga o que passa do teto, e sempre as MAIS ANTIGAS. Nunca apaga a
   última: um script de limpeza que zera a pasta é a forma mais rápida de ficar
   sem backup nenhum. */
const copias = fs.readdirSync(PASTA)
  .filter((f) => /^alafcell\..*\.db$/.test(f))
  .sort();

const sobrando = copias.length - MANTER;
if (sobrando > 0) {
  for (const f of copias.slice(0, sobrando)) {
    fs.unlinkSync(path.join(PASTA, f));
    console.log(`apagada: ${f}`);
  }
}
console.log(`${Math.min(copias.length, MANTER)} cópia(s) guardada(s) em ${PASTA}`);
