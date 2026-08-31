"use strict";
/* ==========================================================================
   PAINEL — quem entra, e como a senha é guardada

   Este arquivo é só a base de autenticação: cifrar, conferir e a sessão. As
   telas do /admin e do /restrito ficam nos módulos deles.

   ---------------------------------------------------------------------------
   POR QUE scrypt, E NÃO sha256

   Hash rápido é bom para arquivo e péssimo para senha: uma GPU testa bilhões
   de sha256 por segundo, e a senha que o dono da loja escolhe cabe numa lista
   de mil palavras. O scrypt é lento DE PROPÓSITO e come memória, o que tira a
   vantagem da placa de vídeo.

   O sal é por usuário. Sem ele, duas pessoas com a mesma senha teriam o mesmo
   hash — e uma tabela pronta quebraria as duas de uma vez.

   A comparação é em tempo constante. Comparar com `===` vaza, pelo tempo de
   resposta, quantos caracteres iniciais estavam certos.
   ========================================================================== */
const crypto = require("node:crypto");
const { Q } = require("./db");

const CUSTO = { N: 16384, r: 8, p: 1 };   /* ~100ms por tentativa nesta máquina */

function cifrar(senha) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(senha), sal, 64, CUSTO);
  return sal.toString("hex") + ":" + h.toString("hex");
}

function confere(senha, guardado) {
  try {
    const [salHex, hHex] = String(guardado || "").split(":");
    if (!salHex || !hHex) return false;
    const h = crypto.scryptSync(String(senha), Buffer.from(salHex, "hex"), 64, CUSTO);
    const alvo = Buffer.from(hHex, "hex");
    /* `timingSafeEqual` exige o mesmo tamanho, e ele explode se diferirem —
       daí a conferência antes, que não vaza nada além do comprimento. */
    return alvo.length === h.length && crypto.timingSafeEqual(alvo, h);
  } catch { return false; }
}

/* ==========================================================================
   SESSÃO

   Token sorteado, guardado no banco e entregue em cookie HttpOnly. HttpOnly
   porque script nenhum da página precisa ler o token — e se um dia entrar um
   script de terceiro no site, ele não leva a sessão junto.
   ========================================================================== */
const DIAS = 7;

function abrirSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DIAS * 864e5).toISOString();
  Q.roda("INSERT INTO sessoes (token, usuario_id, expira) VALUES (?,?,?)", token, usuarioId, expira);
  Q.roda("UPDATE usuarios SET entrou = datetime('now') WHERE id = ?", usuarioId);
  return token;
}

function lerSessao(req) {
  const g = /(?:^|;\s*)alafcell_sessao=([^;]*)/.exec(req.headers.cookie || "");
  if (!g) return null;
  const s = Q.um(
    `SELECT u.id, u.usuario, u.nome, u.papel FROM sessoes s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token = ? AND s.expira > datetime('now') AND u.ativo = 1`, g[1]);
  return s || null;
}

function fecharSessao(req) {
  const g = /(?:^|;\s*)alafcell_sessao=([^;]*)/.exec(req.headers.cookie || "");
  if (g) Q.roda("DELETE FROM sessoes WHERE token = ?", g[1]);
}

/* `Secure` só quando a conexão é https. Marcar Secure em http faz o navegador
   DESCARTAR o cookie — e o login passaria a "não funcionar" no ambiente de
   desenvolvimento sem nenhuma mensagem de erro. */
function cookieSessao(token, seguro) {
  return `alafcell_sessao=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DIAS * 86400}`
    + (seguro ? "; Secure" : "");
}

/* Faxina do que já venceu. Roda na subida: sessão vencida no banco não é risco
   (a consulta já a ignora), é lixo que cresce para sempre. */
function limparSessoes() {
  Q.roda("DELETE FROM sessoes WHERE expira <= datetime('now')");
}

module.exports = { cifrar, confere, abrirSessao, lerSessao, fecharSessao, cookieSessao, limparSessoes };
