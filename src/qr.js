"use strict";
/* ==========================================================================
   QR EM SVG, MONTADO NO SERVIDOR

   A biblioteca `qrcode` traz um gerador de SVG pronto, mas ele é assíncrono e
   devolve um arquivo com fundo branco e cor fixa. Aqui a página é montada de
   uma vez, e o site é escuro.

   Então usamos só a parte que interessa: `create()` é SÍNCRONO e devolve a
   matriz de módulos. O desenho é nosso — um caminho único com um quadradinho
   por módulo aceso, herdando a cor do contexto.

   Um caminho só, e não um <rect> por módulo: um QR de 33×33 tem mais de mil
   módulos, e mil elementos no DOM pesam de verdade numa página que já tem
   carrinho e formulário.

   Vem do servidor porque o cliente precisa ver o código mesmo com o
   JavaScript bloqueado — e porque um QR que aparece depois faz a página pular
   justamente na hora de pagar.
   ========================================================================== */
const QRCode = require("qrcode");

/* `M` corrige cerca de 15% de área danificada. É o nível que o Banco Central
   recomenda para Pix: acima disso o código fica mais denso sem ganho real numa
   tela, e abaixo ele falha em foto tremida. */
function svg(texto, { tamanho = 220, margem = 2, nivel = "M" } = {}) {
  let q;
  try { q = QRCode.create(String(texto), { errorCorrectionLevel: nivel }); }
  catch { return ""; }               /* texto grande demais: melhor nada que quebrado */

  const n = q.modules.size;
  const d = q.modules.data;
  const lado = n + margem * 2;

  let caminho = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!d[y * n + x]) continue;
      caminho += `M${x + margem} ${y + margem}h1v1h-1z`;
    }
  }

  /* `shape-rendering: crispEdges` evita que o navegador suavize a borda dos
     módulos: QR borrado é QR que a câmera não lê. */
  return `<svg class="qr" viewBox="0 0 ${lado} ${lado}" width="${tamanho}" height="${tamanho}"
   role="img" aria-label="QR Code para pagamento" shape-rendering="crispEdges">
  <rect width="${lado}" height="${lado}" fill="#FFFFFF"/>
  <path d="${caminho}" fill="#000000"/>
</svg>`;
}

module.exports = { svg };
