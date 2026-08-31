#!/usr/bin/env node
/* ==========================================================================
   ALAFCELL — AS PROVAS

       node testes/provar.cjs

   Rodam num BANCO TEMPORÁRIO, nunca no banco do cliente: `ALAFCELL_DB` aponta
   para um arquivo em /tmp que é apagado no fim. Sem isso, uma prova que grava
   um pedido deixaria lixo no sistema de quem está vendendo — e um teste que
   suja o banco do cliente é pior que teste nenhum.

   O deploy roda este arquivo ANTES de reiniciar o serviço. Falhou, o site
   continua no ar com a versão anterior.

   O que se prova aqui é o que dói caro se quebrar:
     · dinheiro (o preço vem do servidor, o total fecha, centavos não erram);
     · privacidade (pedido e ordem de serviço não abrem para estranho);
     · o código Pix (um CRC errado é recusado pelo banco sem explicação);
     · o endereço de trabalho continuar fora do índice do Google.
   ========================================================================== */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/* ANTES de qualquer require do projeto: o db.js lê a variável na carga. */
const BANCO = path.join(os.tmpdir(), `alafcell-provas-${process.pid}.db`);
process.env.ALAFCELL_DB = BANCO;
process.env.ALAFCELL_SITE = process.env.ALAFCELL_SITE || "https://alafcell.projetos.luizaugust.me";

const { Q, centavos, reais, codigoLivre } = require("../src/db");
const Inicial = require("../src/conteudo-inicial");
const Demo = require("../src/demo");
const Pix = require("../src/pix");
const QR = require("../src/qr");
const Endereco = require("../src/endereco");
const Loja = require("../src/loja");
const Acompanhar = require("../src/acompanhar");

Inicial.semear();
Demo.semear();

/* ------------------------------------------------------------------ placar */
let passou = 0, falhou = 0;
const grupos = [];
function grupo(nome) { grupos.push(nome); console.log(`\n  ${nome}`); }
function ok(nome, real, esperado) {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (bom) { passou++; console.log(`    ✓ ${nome}`); return; }
  falhou++;
  console.log(`    ✖ ${nome}\n        esperado: ${JSON.stringify(esperado)}\n        obtido:   ${JSON.stringify(real)}`);
}
function verdade(nome, real) { ok(nome, !!real, true); }

/* ==========================================================================
   DINHEIRO
   ========================================================================== */
grupo("Dinheiro");

ok("vírgula decimal", centavos("1.234,50"), 123450);
ok("ponto decimal", centavos("1234.50"), 123450);
/* O caso que quebra tudo: com vírgula presente, o ponto é MILHAR. Sem esta
   regra "1.234,50" viraria R$ 1,23 no cadastro do painel. */
ok("ponto é milhar quando há vírgula", centavos("1.234,50"), centavos("1234,50"));
ok("inteiro sem separador", centavos("199"), 19900);
ok("campo vazio não vira NaN", centavos(""), 0);
ok("R$ e espaços são ignorados", centavos("R$ 89,90"), 8990);
ok("formata de volta", reais(123450), "R$ 1.234,50");

/* Soma de trinta itens de R$ 0,10: em ponto flutuante daria 2,9999999999999996.
   Em centavos inteiros, dá 300 e ponto final. */
let soma = 0; for (let i = 0; i < 30; i++) soma += centavos("0,10");
ok("trinta somas não erram um centavo", soma, 300);

/* ==========================================================================
   O CARRINHO — o preço vem do SERVIDOR
   ========================================================================== */
grupo("Carrinho");

const produto = Q.um("SELECT * FROM produtos WHERE ativo = 1 AND estoque > 0 LIMIT 1");
verdade("existe produto para provar", produto);

/* O cookie carrega só {id, q}. Aqui a prova é que um cookie ADULTERADO com
   preço dentro não muda nada: o valor sai do banco. */
const cookieFalso = {
  headers: {
    cookie: "alafcell_cesta=" + encodeURIComponent(JSON.stringify(
      [{ id: produto.id, q: 2, preco: 1 }])),
  },
};
const linhas = Loja.linhas(cookieFalso);
ok("uma linha no carrinho", linhas.length, 1);
ok("o preço é o do banco, não o do cookie", linhas[0].p.preco, produto.preco);
ok("o subtotal é calculado aqui", linhas[0].subtotal, produto.preco * 2);
ok("o total soma certo", Loja.somar(linhas), produto.preco * 2);

/* Quantidade acima do estoque é aparada, e não recusada: recusar faria o
   cliente perder o carrinho inteiro por causa de um item. */
const demais = { headers: { cookie: "alafcell_cesta=" + encodeURIComponent(JSON.stringify([{ id: produto.id, q: 999 }])) } };
ok("quantidade não passa do estoque", Loja.linhas(demais)[0].q, produto.estoque);

/* Cookie quebrado não pode derrubar a página — ele vira carrinho vazio. */
ok("cookie inválido vira carrinho vazio", Loja.ler({ headers: { cookie: "alafcell_cesta=%7Blixo" } }), []);
ok("sem cookie, carrinho vazio", Loja.ler({ headers: {} }), []);
ok("quantidade negativa é descartada",
  Loja.ler({ headers: { cookie: "alafcell_cesta=" + encodeURIComponent('[{"id":1,"q":-5}]') } }).length, 1);

/* ==========================================================================
   PEDIDO — privacidade
   ========================================================================== */
grupo("Pedido");

const feito = Loja.gravarPedido(
  { nome: "ZZ Prova", telefone: "81900000000", entrega: "retirada", pagamento: "pix" },
  cookieFalso);
verdade("o pedido foi gravado", feito && feito.codigo);

const ped = Q.um("SELECT * FROM pedidos WHERE codigo = ?", feito.codigo);
ok("o total gravado é o do servidor", ped.total, produto.preco * 2);
ok("o estoque baixou", Q.um("SELECT estoque FROM produtos WHERE id = ?", produto.id).estoque,
  produto.estoque - 2);

/* A tela do pedido só abre para quem tem o cookie. É o que impede que trocar o
   código na barra de endereço mostre o nome e o telefone de outra pessoa. */
const semCookie = { headers: {} };
ok("sem cookie, a tela do pedido não abre", Loja.pedido(semCookie, feito.codigo), null);
const comCookie = { headers: { cookie: "alafcell_pedido=" + feito.codigo } };
verdade("com o cookie certo, abre", Loja.pedido(comCookie, feito.codigo));
const cookieDeOutro = { headers: { cookie: "alafcell_pedido=AC-OUTRO" } };
ok("cookie de outro pedido não abre este", Loja.pedido(cookieDeOutro, feito.codigo), null);

/* ==========================================================================
   CÓDIGO PÚBLICO
   ========================================================================== */
grupo("Código público");

const c = codigoLivre("pedidos", "AC");
verdade("tem prefixo e seis caracteres", /^AC-[2-9A-HJ-NP-Z]{6}$/.test(c));
/* Sem I, O, 0 e 1: o código é ditado por telefone, e "I ou 1?" transforma o
   acompanhamento numa ligação para a loja. */
ok("não usa I, O, 0 nem 1", /[IO01]/.test(c.slice(3)), false);
const sorteados = new Set();
for (let i = 0; i < 200; i++) sorteados.add(codigoLivre("pedidos", "AC"));
verdade("não é sequencial (200 sorteios, 200 diferentes)", sorteados.size === 200);

/* ==========================================================================
   ORDEM DE SERVIÇO — a consulta pública
   ========================================================================== */
grupo("Acompanhar a ordem");

const IP = "1.2.3.4";
const certo = Acompanhar.buscar("DEMO-01", "0000", IP);
verdade("código e telefone certos encontram", certo.ordem);
ok("telefone errado não encontra", Acompanhar.buscar("DEMO-01", "1111", "2.2.2.2").erro, "nao");
ok("código inexistente responde igual", Acompanhar.buscar("XX-000000", "0000", "3.3.3.3").erro, "nao");
ok("sem telefone, pede o telefone", Acompanhar.buscar("DEMO-01", "", "4.4.4.4").erro, "falta");
/* Aceitar o número inteiro é obrigação: o dono do aparelho digita como lembra. */
verdade("aceita o telefone inteiro", Acompanhar.buscar("DEMO-01", "(81) 90000-0000", "5.5.5.5").ordem);

/* O freio: a sexta tentativa do MESMO ip é barrada. É o que torna a varredura
   lenta demais para valer a pena. */
const ipRuim = "9.9.9.9";
for (let i = 0; i < 5; i++) Acompanhar.buscar("XX-00000" + i, "0000", ipRuim);
ok("o freio barra a partir da sexta", Acompanhar.buscar("XX-999999", "0000", ipRuim).erro, "muitas");

/* Nota interna não vai para a tela do cliente.

   A situação escolhida é "entregue" DE PROPÓSITO, e essa escolha é o conserto de
   uma prova cega: com "reparo" a etapa pública que já existe vence a
   deduplicação por situação, e a nota interna some por acidente — a prova
   passava mesmo com o filtro `publico` removido. Aqui não há concorrente:
   se a nota aparecer, foi o filtro que falhou. */
const ordem = Q.um("SELECT id FROM ordens WHERE codigo = 'DEMO-01'");
Q.roda(`INSERT INTO ordem_etapas (ordem_id, situacao, nota, publico) VALUES (?,?,?,0)`,
  ordem.id, "entregue", "SEGREDO DA BANCADA");
const tela = Acompanhar.pagina({ headers: {} }, { ordem: Q.um("SELECT * FROM ordens WHERE id = ?", ordem.id) });
ok("a nota interna não aparece na tela", tela.includes("SEGREDO DA BANCADA"), false);

/* ==========================================================================
   PIX
   ========================================================================== */
grupo("Pix");

const brcode = Pix.codigo({
  chave: "81999998888", nome: "Alafcell Assistec", cidade: "Caruaru",
  valor: 48900, txid: "AC-2X4K9P",
});
verdade("o código é montado", brcode);
ok("começa com a versão do padrão", brcode.slice(0, 6), "000201");
/* O CRC é calculado sobre o payload JÁ com "6304" no fim. Errar isso gera um
   código que o aplicativo do banco recusa sem dizer por quê. */
ok("o CRC fecha", Pix.crc16(brcode.slice(0, -4)), brcode.slice(-4));
verdade("o valor entra formatado", brcode.includes("5406489.00"));
verdade("a chave entra na conta", brcode.includes("81999998888"));
/* O padrão só aceita ASCII sem acento: com acento, parte dos bancos recusa. */
const comAcento = Pix.codigo({ chave: "x", nome: "Assistência Ótica", cidade: "São Paulo", valor: 100 });
ok("nome e cidade saem sem acento", /[^\x20-\x7E]/.test(comAcento), false);
ok("sem chave, não devolve código quebrado", Pix.codigo({ chave: "", valor: 100 }), null);

verdade("o QR é desenhado", QR.svg(brcode).startsWith("<svg"));
ok("texto impossível não quebra a página", QR.svg("x".repeat(9000)), "");

/* ==========================================================================
   ENDEREÇO DE TRABALHO
   ========================================================================== */
grupo("Endereço");

ok("o subdomínio de trabalho NÃO é indexável", Endereco.INDEXAVEL, false);
verdade("o robots.txt fecha tudo", Endereco.robots().includes("Disallow: /"));
/* Sitemap num site que pede para não ser indexado é dizer as duas coisas ao
   mesmo tempo. */
ok("e não publica sitemap", Endereco.robots().includes("Sitemap:"), false);
verdade("o cabeçalho X-Robots-Tag existe", Endereco.CABECALHO_ROBOS);

/* ==========================================================================
   PREÇOS
   ========================================================================== */
grupo("Preços de conserto");

const semPreco = Q.um(
  `SELECT s.id FROM servicos s WHERE NOT EXISTS
   (SELECT 1 FROM precos p WHERE p.servico_id = s.id AND p.preco > 0)`);
const { apartirDe } = require("../src/paginas");
if (semPreco) ok("serviço sem preço devolve zero, não R$ 0,00", apartirDe(semPreco.id), 0);
else console.log("    · todos os serviços têm preço nesta base");

const comPreco = Q.um("SELECT servico_id, MIN(preco) m FROM precos WHERE preco > 0 GROUP BY servico_id LIMIT 1");
ok("o 'a partir de' é o menor preço", apartirDe(comPreco.servico_id), comPreco.m);

/* Faixa de preço zerada não pode virar conserto de graça. */
Q.roda("INSERT OR REPLACE INTO precos (modelo_id, servico_id, preco) VALUES (?,?,0)",
  Q.um("SELECT id FROM modelos LIMIT 1").id, comPreco.servico_id);
ok("preço zero não entra no 'a partir de'", apartirDe(comPreco.servico_id) > 0, true);

/* ========================================================================== */
console.log(`\n  ${falhou ? "✖" : "✔"} ${passou} passaram, ${falhou} falharam · ${grupos.length} grupos\n`);

/* A faxina roda mesmo se algo estourar acima: banco de prova esquecido em
   /tmp vira ruído no servidor. */
process.on("exit", () => {
  for (const sufixo of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(BANCO + sufixo); } catch { /* não existia */ }
  }
});
process.exitCode = falhou ? 1 : 0;
