"use strict";
/* ==========================================================================
   PIX — o código copia e cola, montado aqui

   ---------------------------------------------------------------------------
   POR QUE NÃO UM GATEWAY

   Uma assistência técnica de bairro recebe em Pix. Um intermediário de
   pagamento cobraria taxa por venda, exigiria cadastro, homologação e chave de
   produção, e traria uma dependência externa que, no dia em que cair, derruba
   a loja inteira.

   O Pix estático não precisa de nada disso: o código é montado a partir da
   CHAVE da loja, que ela mesma cadastra no painel. O dinheiro cai direto na
   conta dela, sem passar por ninguém.

   O que se perde: o site não FICA SABENDO que o pagamento caiu. A loja
   confirma no aplicativo do banco e marca o pedido como pago no painel. Para o
   volume de uma assistência, isso é honesto — e é como a loja já trabalha hoje
   no balcão.

   ---------------------------------------------------------------------------
   O FORMATO

   É o padrão EMV do Banco Central: campos "ID + tamanho em 2 dígitos + valor",
   um atrás do outro, e um CRC16 no fim. Nada de biblioteca — são quarenta
   linhas e a especificação é pública e estável desde 2020.

   O detalhe que quebra na prática: o CRC é calculado SOBRE O PAYLOAD JÁ COM
   "6304" no fim. Quem calcula antes de acrescentar o identificador gera um
   código que o aplicativo do banco recusa sem dizer por quê.
   ========================================================================== */

/* Campo no formato do padrão. O tamanho vai com dois dígitos — mais de 99
   caracteres num campo simples não acontece aqui, e o padrão não permite. */
const campo = (id, valor) =>
  `${id}${String(valor.length).padStart(2, "0")}${valor}`;

/* O padrão só aceita ASCII sem acento. "São Paulo" com til vira um código que
   alguns aplicativos leem e outros recusam — e "alguns recusam" num checkout é
   pior que não ter Pix, porque o cliente conclui que a loja está quebrada. */
function limpo(s, max) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .,\-]/g, "")
    .trim().slice(0, max).toUpperCase();
}

/* CRC16/CCITT-FALSE, o do padrão: polinômio 0x1021, valor inicial 0xFFFF,
   sem reflexão e sem XOR final. */
function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/* ==========================================================================
   O CÓDIGO

   `valor` em centavos, porque é assim que ele viaja no resto do sistema; a
   conversão para "123.45" acontece aqui, no único lugar em que o formato de
   fora manda.

   Sem chave cadastrada devolve null — e quem chamou mostra outra forma de
   pagamento em vez de um código quebrado. Código Pix inválido na tela é a
   pior falha possível de um checkout: parece que funciona.
   ========================================================================== */
function codigo({ chave, nome, cidade, valor, txid }) {
  const k = String(chave || "").trim();
  if (!k) return null;

  const conta = campo("00", "br.gov.bcb.pix") + campo("01", k);

  let p = "";
  p += campo("00", "01");                                    // versão do padrão
  p += campo("26", conta);                                   // conta do recebedor
  p += campo("52", "0000");                                  // categoria do lojista
  p += campo("53", "986");                                   // moeda: BRL
  if (valor > 0) p += campo("54", (valor / 100).toFixed(2)); // valor
  p += campo("58", "BR");                                    // país
  p += campo("59", limpo(nome, 25) || "LOJA");               // nome do recebedor
  p += campo("60", limpo(cidade, 15) || "CARUARU");          // cidade
  /* O txid identifica a cobrança no extrato. "***" é o coringa do padrão para
     quando não há um — e é o que evita recusa quando o código do pedido tem
     caractere que o padrão não aceita. */
  p += campo("62", campo("05", limpo(txid, 25) || "***"));

  p += "6304";                                               // o CRC entra depois
  return p + crc16(p);
}

module.exports = { codigo, crc16 };
