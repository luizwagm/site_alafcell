"use strict";
/* ==========================================================================
   usuario.cjs — cria ou redefine quem entra no /admin

       node ferramentas/usuario.cjs                    lista quem existe
       node ferramentas/usuario.cjs <usuario> "<Nome>" cria ou troca a senha

   O `package.json` já anunciava `npm run usuario` apontando para este arquivo,
   e ele não existia: o comando quebrava com "Cannot find module". Sem ele não
   há como recuperar o acesso ao painel — que é exatamente a situação em que
   alguém precisaria dele.

   NO DIA A DIA NÃO SE USA ISTO. A senha se troca no próprio painel. Este
   arquivo existe para dois casos em que o painel não serve:

     1. o primeiro acesso, quando a senha sorteada na instalação se perdeu;
     2. ficou todo mundo trancado para fora.

   A SENHA NÃO VEM NA LINHA DE COMANDO, de propósito: argumento de processo
   aparece no `ps` para qualquer usuário da máquina e fica no histórico do
   terminal. Ela é GERADA aqui, mostrada uma vez e nunca mais — o banco guarda
   só o scrypt dela.
   ========================================================================== */
const crypto = require("node:crypto");
const { Q } = require("../src/db");
const Painel = require("../src/painel");

const [usuario, ...resto] = process.argv.slice(2);
const nome = resto.join(" ").trim();

/* ------------------------------------------------------------ só listar */
if (!usuario) {
  const gente = Q.todos(
    "SELECT id, usuario, nome, papel, ativo, entrou FROM usuarios ORDER BY id");
  if (!gente.length) {
    console.log("\n  Ninguém cadastrado. Crie o primeiro:");
    console.log('    node ferramentas/usuario.cjs dono "Alafcell"\n');
    process.exit(0);
  }
  console.log("\n  QUEM ENTRA NO PAINEL\n");
  for (const u of gente) {
    console.log(`    ${String(u.id).padStart(3)}  ${u.usuario.padEnd(16)} ${
      (u.nome || "").padEnd(22)} ${u.papel.padEnd(10)} ${
      u.ativo ? "ativo" : "INATIVO"}${u.entrou ? "  último acesso " + u.entrou : ""}`);
  }
  console.log("\n  Para criar ou trocar a senha de alguém:");
  console.log('    node ferramentas/usuario.cjs <usuario> "<Nome>"\n');
  process.exit(0);
}

/* --------------------------------------------------------- criar/trocar */
/* Sorteada de um alfabeto sem os símbolos que se confundem lidos em voz alta
   ou copiados de um papel: 0/O, 1/l/I. Quem cria a conta costuma ditar a senha
   por telefone para o dono da loja. */
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const senha = Array.from(crypto.randomBytes(14))
  .map((b) => ALFABETO[b % ALFABETO.length]).join("");

const existe = Q.um("SELECT id, nome FROM usuarios WHERE usuario = ?", usuario);

if (existe) {
  Q.roda("UPDATE usuarios SET senha = ?, ativo = 1 WHERE id = ?",
    Painel.cifrar(senha), existe.id);
  /* Trocar a senha derruba as sessões abertas daquela conta: se a troca está
     acontecendo porque alguém perdeu o acesso, o cookie que estiver por aí não
     pode continuar valendo. */
  Q.roda("DELETE FROM sessoes WHERE usuario_id = ?", existe.id);
  console.log(`\n  Senha trocada — ${existe.nome || usuario}`);
} else {
  Q.roda("INSERT INTO usuarios (usuario, nome, senha, papel, ativo) VALUES (?,?,?,?,1)",
    usuario, nome || usuario, Painel.cifrar(senha), "dono");
  console.log(`\n  Conta criada — ${nome || usuario}`);
}

console.log(`  usuário: ${usuario}`);
console.log(`  senha:   ${senha}`);
console.log("\n  Anote agora — ela não é mostrada de novo.");
console.log("  Entre em /admin/ e troque por uma que você lembre.\n");
