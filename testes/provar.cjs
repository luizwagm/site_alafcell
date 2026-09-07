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

/* TODAS as conexoes abertas por esta suite. Ela recarrega `../src/db` mais de
   uma vez (o bloco das avaliacoes de exemplo precisa de um banco proprio), e
   cada recarga abre uma conexao nova enquanto a anterior fica sem dono. No
   Linux, apagar arquivo aberto passa; no Windows nao, e o banco de prova fica
   para tras a cada execucao — eram 177 acumulados quando isto apareceu. */
const CONEXOES = [];
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
/* O que esta suíte criou e precisa apagar no fim — por ID, nunca por LIKE. */
const CRIADO = { servicos: [], marcas: [], modelos: [], posts: [], usuarios: [] };
/* Arquivos que as provas de upload gravam de verdade. Apagados no `exit`, e
   não logo depois da asserção: uma prova que falha no meio deixaria o arquivo
   para trás — e foi o que aconteceu, com 3 MB parados na pasta que vai para o
   servidor. */
const IMAGENS_DE_PROVA = [];
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

/* ==========================================================================
   A LANDING (0.4.0)

   O site deixou de ter loja, carrinho, checkout, telas de conserto, coleta,
   acompanhamento e contato. O que estas provas guardam não é o que existe — é
   o que foi RETIRADO, que é justamente o que volta sozinho: alguém reaproveita
   um trecho, copia um cartão de outro site do parque, e o preço reaparece numa
   página que não deveria ter preço nenhum.
   ========================================================================== */
grupo("A landing");

const Pag = require("../src/paginas");
const casa = Pag.home({ headers: {}, url: "/" });

/* --- o que não pode estar lá --- */
ok("nenhum preço na landing", /R\$\s?\d/.test(casa), false);
for (const morta of ["/loja/", "/carrinho/", "/checkout/", "/consertos/",
                     "/busca-e-leva/", "/acompanhar/", "/contato/", "/produto/"]) {
  ok(`sem link para ${morta}`, casa.includes(`href="${morta}`), false);
}
/* Um `tel:` sem número é um link que o dedo acerta e que não liga para
   ninguém — pior do que não ter telefone. */
ok("telefone vazio não vira link", casa.includes('href="tel:"'), false);

/* --- o que precisa estar lá --- */
for (const id of ["orcamento", "consertos", "busca-e-leva", "como-funciona",
                  "garantia", "contato"]) {
  ok(`a seção #${id} existe`, casa.includes(`id="${id}"`), true);
}
/* O menu promete essas âncoras em toda página do site. Âncora prometida que
   não existe rola até o fim sem parar em nada, e parece link quebrado. */
verdade("o formulário de orçamento aponta para a rota do WhatsApp",
  casa.includes('action="/orcamento"'));
verdade("a landing chama o WhatsApp", casa.includes("wa.me/"));

/* --- a seção de consertos é informação, não vitrine --- */
const secao = casa.slice(casa.indexOf('id="consertos"'), casa.indexOf('id="busca-e-leva"'));
verdade("há cartões de conserto na seção", secao.includes('class="cartao serv"'));
/* `<a\s`, com o espaço exigido: sem ele o `<a` casa com o começo de
   "<article" e a prova acusa link onde há um cartão inerte. */
ok("nenhum cartão de conserto é link", /<a\s[^>]*class="[^"]*\bserv\b/.test(secao), false);
ok("nenhuma foto na seção de consertos", secao.includes("<img"), false);
ok("nenhum 'a partir de' na seção", /a partir de/i.test(secao), false);

/* --- o "como funciona" diz as DUAS portas --- */
verdade("o passo 2 diz que a gente busca OU o cliente traz",
  /a gente busca ou voc[eê] traz/i.test(casa));

/* --- o 404 só oferece o que existe --- */
const erro = Pag.erro404({ headers: {}, url: "/nao-existe" });
ok("o 404 não manda para a loja", erro.includes('href="/loja/"'), false);
ok("o 404 não manda para os consertos", erro.includes('href="/consertos/"'), false);
verdade("o 404 oferece o início", erro.includes('href="/"'));

/* ==========================================================================
   O PAINEL (0.5.0)
   ========================================================================== */
grupo("O painel");

const Adm = require("../src/admin");
const Pnl = require("../src/painel");

/* --- slug: é ele que entra na URL --- */
ok("slug tira acento e maiúscula", Adm.slugificar("Troca de Tela"), "troca-de-tela");
ok("slug não deixa símbolo", Adm.slugificar("Água! & Placa?"), "agua-placa");
ok("slug não começa nem termina com traço", Adm.slugificar("  --Bateria--  "), "bateria");

/* --- a lista de campos é a AUTORIZAÇÃO --- */
/* Sem isto, um POST montado à mão trocaria `id` ou qualquer coluna que a tela
   não mostra. A tela é só a parte que se vê da porta. */
for (const t of ["servicos", "marcas", "modelos", "posts"]) {
  ok(`${t}: \`id\` não é gravável`, Adm.CAMPOS[t].includes("id"), false);
}
ok("posts não expõe `criado`", Adm.CAMPOS.posts.includes("criado"), false);

/* --- gravar de verdade, e o que o servidor faz com o que chega --- */
/* `ativo: "true"` e não `"1"`: coluna INTEGER converte "1" em 1 sozinha, então
   "1" não distingue o código certo do errado. Já o TEXTO "true" só vira 1 se
   alguém o traduzir — e guardado como texto ele é verdadeiro em toda
   comparação, o que faz um conserto desativado continuar no site. */
const svId = Adm.gravar("servicos", 0, {
  nome: "ZZ QA Conserto", chamada: "de ensaio", prazo_horas: "48h", ativo: "true",
  id: 999999, criado: "mentira",      /* <- os dois têm de ser ignorados */
}).id;
CRIADO.servicos = [svId];
const sv = Q.um("SELECT * FROM servicos WHERE id = ?", svId);
verdade("cria um conserto", !!sv);
ok("o id do corpo é ignorado", sv.id === 999999, false);
ok("`48h` vira o número 48", sv.prazo_horas, 48);
ok("`\"true\"` vira o número 1, não o texto", sv.ativo, 1);
verdade("e é número mesmo", typeof sv.ativo === "number");
ok("o slug nasce do nome", sv.slug, "zz-qa-conserto");

/* Dois registros com o mesmo nome não podem dividir o endereço: o segundo
   responderia o primeiro e ninguém entenderia por que o novo não abre. */
const svId2 = Adm.gravar("servicos", 0, { nome: "ZZ QA Conserto", ativo: "0" }).id;
CRIADO.servicos.push(svId2);
ok("slug repetido ganha sufixo", Q.um("SELECT slug FROM servicos WHERE id = ?", svId2).slug,
   "zz-qa-conserto-2");

/* --- apagar marca com modelo dentro --- */
const mcId = Adm.gravar("marcas", 0, { nome: "ZZ QA Marca", ativo: "0" }).id;
CRIADO.marcas = [mcId];
const mdId = Adm.gravar("modelos", 0, { nome: "ZZ QA Modelo", marca_id: String(mcId) }).id;
CRIADO.modelos = [mdId];
const tentou = Adm.apagar("marcas", mcId);
verdade("marca com modelo dentro NÃO é apagada", !!tentou.erro);
verdade("e a recusa diz o que fazer", /modelo/i.test(tentou.erro || ""));
verdade("a marca continua lá", !!Q.um("SELECT id FROM marcas WHERE id = ?", mcId));
Adm.apagar("modelos", mdId);
verdade("sem modelos, a marca é apagada", !!Adm.apagar("marcas", mcId).ok);

/* --- textos --- */
const textos = Adm.textos();
verdade("os textos vêm agrupados", textos.length > 0 && Array.isArray(textos[0].campos));
verdade("cada grupo tem um rótulo legível", textos.every((g) => !!g.rotulo));
Adm.gravarTextos({ "chave.que.nao.existe": "x" });
ok("chave inexistente não é criada",
   !!Q.um("SELECT chave FROM config WHERE chave = ?", "chave.que.nao.existe"), false);

/* --- imagem: os BYTES decidem, não a extensão --- */
/* Extensão e Content-Type são texto que o cliente escolhe. Confiar neles é a
   diferença entre uma pasta de imagens e uma pasta de executáveis com nome
   bonito. */
const php = Buffer.from("<?php system($_GET[0]); ?>");
verdade("arquivo de script é recusado", !!Adm.gravarImagem(php).erro);
const svg = Buffer.from('<svg onload="alert(1)"></svg>');
verdade("SVG é recusado (ele executa script no navegador)", !!Adm.gravarImagem(svg).erro);
/* PNG VÁLIDO e grande. Um buffer de zeros seria recusado por não ser imagem, e
   a prova falaria do tipo em vez de falar do tamanho. */
const gigante = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.alloc(Adm.TETO_IMAGEM + 1),
]);
const recusa = Adm.gravarImagem(gigante);
if (recusa.caminho) IMAGENS_DE_PROVA.push(recusa.caminho);   /* se o teto falhar, gravou */
verdade("imagem acima do teto é recusada", !!recusa.erro);
verdade("e a recusa fala do TAMANHO, não do tipo", /MB|limite/i.test(recusa.erro || ""));
/* Um PNG mínimo de verdade: os oito bytes de assinatura. */
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(64)]);
const guardou = Adm.gravarImagem(png);
if (guardou.caminho) IMAGENS_DE_PROVA.push(guardou.caminho);
verdade("PNG de verdade é aceito", !!guardou.ok);
verdade("e o nome é sorteado, não o que o cliente mandou",
  /^\/assets\/img\/uploads\/[0-9a-f]{16}\.png$/.test(guardou.caminho || ""), true);

/* --- entrar --- */
const senhaQA = "zz-qa-" + Date.now();
Q.roda("INSERT INTO usuarios (usuario, nome, senha, papel, ativo) VALUES (?,?,?,?,1)",
  "zz_qa_prova", "ZZ QA Prova", Pnl.cifrar(senhaQA), "dono");
CRIADO.usuarios = [Q.um("SELECT id FROM usuarios WHERE usuario = ?", "zz_qa_prova").id];
verdade("entra com a senha certa", !!Adm.entrar("zz_qa_prova", senhaQA));
ok("não entra com a senha errada", Adm.entrar("zz_qa_prova", senhaQA + "x"), null);
ok("não entra com usuário inexistente", Adm.entrar("nao_existe", senhaQA), null);
/* Conta desativada é conta que não entra — senão desativar não desativa nada. */
Q.roda("UPDATE usuarios SET ativo = 0 WHERE usuario = ?", "zz_qa_prova");
ok("conta desativada não entra", Adm.entrar("zz_qa_prova", senhaQA), null);

/* --- acessos --- */
const ac = Adm.acessos();
for (const c of ["total", "hoje", "semana", "mes", "visitantes", "porDia", "topRotas"]) {
  verdade(`acessos traz \`${c}\``, ac[c] !== undefined);
}
verdade("os números são números", typeof ac.total === "number" && typeof ac.hoje === "number");

/* --- a faxina desta seção --- */
for (const id of CRIADO.servicos) Q.roda("DELETE FROM servicos WHERE id = ?", id);
for (const id of CRIADO.usuarios) Q.roda("DELETE FROM usuarios WHERE id = ?", id);
ok("a seção não deixou conserto para trás",
   Q.um("SELECT COUNT(*) c FROM servicos WHERE nome LIKE ?", "ZZ QA%").c, 0);
ok("nem usuário", Q.um("SELECT COUNT(*) c FROM usuarios WHERE usuario LIKE ?", "zz_qa%").c, 0);

/* ==========================================================================
   AS SEÇÕES DE CONTEÚDO (0.6.0)
   ========================================================================== */
grupo("Seções de conteúdo");

const { ajuste } = require("../src/db");

/* --- o que estava preso no código agora vem do banco --- */
/* A prova é indireta de propósito: em vez de conferir que o texto padrão
   aparece, ela MUDA o valor e exige que a página mude junto. Conferir o padrão
   passaria mesmo se a seção continuasse com o literal antigo dentro. */
for (const [chave, marca] of [
  ["etapas.1_titulo", "ZZ QA passo um"],
  ["confianca.1_titulo", "ZZ QA motivo um"],
  ["confianca.titulo", "ZZ QA confiar"],
  ["blog.titulo", "ZZ QA blog"],
  ["etapas.titulo", "ZZ QA etapas"],
]) {
  const antes = Q.um("SELECT valor FROM config WHERE chave = ?", chave).valor;
  ajuste(chave, marca);
  ok(`\`${chave}\` chega na página`, Pag.home({ headers: {}, url: "/" }).includes(marca), true);
  ajuste(chave, antes);
}

/* O prazo da garantia vive num lugar só e é colado no primeiro motivo. Dois
   números para a mesma promessa é um deles mentindo depois da primeira
   mudança de política. */
const prazoAntes = Q.um("SELECT valor FROM config WHERE chave = ?", "legal.garantia").valor;
ajuste("legal.garantia", "ZZ QA 180 dias");
/* DENTRO da seção, e não na página: o prazo também aparece na frase de apoio
   dos consertos, e procurá-lo no HTML inteiro faria a prova passar mesmo com
   o motivo 1 sem ele. */
const casaPrazo = Pag.home({ headers: {}, url: "/" });
const secConfiar = casaPrazo.slice(casaPrazo.indexOf('id="garantia"'),
                                   casaPrazo.indexOf('id="blog"'));
verdade("o prazo da garantia entra no motivo 1", secConfiar.includes("ZZ QA 180 dias"));
ajuste("legal.garantia", prazoAntes);

/* --- a foto da seção "por que confiar" --- */
const fotoAntes = Q.um("SELECT valor FROM config WHERE chave = ?", "confianca.foto").valor;
ajuste("confianca.foto", "/assets/img/banco/zz-qa.webp");
verdade("a foto de 'por que confiar' vem do banco",
  Pag.home({ headers: {}, url: "/" }).includes("/assets/img/banco/zz-qa.webp"));
/* Sem foto a seção continua de pé, só sem a figura: um `<img src="">` pede o
   endereço da própria página de volta ao servidor e mostra ícone de quebrado. */
ajuste("confianca.foto", "");
const semFoto = Pag.home({ headers: {}, url: "/" });
const blocoConfiar = semFoto.slice(semFoto.indexOf('id="garantia"'), semFoto.indexOf('id="blog"'));
ok("sem foto, não sobra <img> vazio", /<img[^>]+src=""/.test(blocoConfiar), false);
ajuste("confianca.foto", fotoAntes);

/* ==========================================================================
   RECOMENDAÇÕES DO GOOGLE

   As duas regras do cliente — no máximo TRÊS, e só as de CINCO ESTRELAS —
   vivem na consulta, não na tela nem na disciplina de quem cadastra.
   ========================================================================== */
grupo("Recomendações do Google");

/* Tabela zerada antes de começar: o conteúdo inicial semeia três avaliações de
   exemplo, e as afirmações abaixo ("sem avaliação, a seção não existe", "as
   três primeiras da ordem entram") só valem partindo do vazio. Banco temporário
   da suíte — o do cliente nunca é tocado aqui. */
Q.roda("DELETE FROM avaliacoes");
/* Sem publicar: neste ponto da suite ninguem publicou ainda, e o site cai no
   rascunho — que le o banco vivo a cada chamada. Publicar aqui ligaria o cache
   do instantaneo e congelaria a pagina para todo o resto do grupo. */

const casaSem = Pag.home({ headers: {}, url: "/" });
ok("sem avaliação, a seção não existe na página", casaSem.includes('id="google"'), false);

const criadas = [];
const porAvaliacao = (autor, texto, estrelas, ordem, ativo = 1) => {
  Q.roda(`INSERT INTO avaliacoes (autor, texto, estrelas, ordem, ativo)
          VALUES (?,?,?,?,?)`, autor, texto, estrelas, ordem, ativo);
  criadas.push(Q.um("SELECT MAX(id) id FROM avaliacoes").id);
};

porAvaliacao("ZZ Ana", "ZZ QA texto um", 5, 1);
verdade("com uma avaliação de 5, a seção aparece",
  Pag.home({ headers: {}, url: "/" }).includes('id="google"'));

porAvaliacao("ZZ Bruno", "ZZ QA texto dois", 5, 2);
porAvaliacao("ZZ Carla", "ZZ QA texto tres", 5, 3);
porAvaliacao("ZZ Diego", "ZZ QA texto quatro", 5, 4);
/* Uma de quatro estrelas, ATIVA: ela é o caso que a regra precisa barrar. Se
   a filtragem estivesse na tela do painel, esta linha apareceria no site. */
porAvaliacao("ZZ Elza", "ZZ QA texto de quatro estrelas", 4, 0);

const casaCom = Pag.home({ headers: {}, url: "/" });
const quantos = (casaCom.match(/class="cartao avaliacao"/g) || []).length;
ok("no máximo TRÊS aparecem", quantos, 3);
verdade("as três primeiras da ordem entram",
  casaCom.includes("ZZ QA texto um") && casaCom.includes("ZZ QA texto dois")
  && casaCom.includes("ZZ QA texto tres"));
ok("a quarta de 5 estrelas fica de fora", casaCom.includes("ZZ QA texto quatro"), false);
ok("a de 4 estrelas NÃO entra, mesmo ativa e em primeiro na ordem",
   casaCom.includes("ZZ QA texto de quatro estrelas"), false);

/* Desativada não aparece — senão o botão de esconder não esconde nada. */
Q.roda("UPDATE avaliacoes SET ativo = 0 WHERE texto = ?", "ZZ QA texto um");
const casaDesativada = Pag.home({ headers: {}, url: "/" });
ok("desativada sai da página", casaDesativada.includes("ZZ QA texto um"), false);
verdade("e a quarta entra no lugar dela", casaDesativada.includes("ZZ QA texto quatro"));

/* --- o selo da nota --- */
ok("sem nota preenchida, não há selo", casaCom.includes("selo-google"), false);
ajuste("google.nota", "5,0");
ajuste("google.total", "42");
const comNota = Pag.home({ headers: {}, url: "/" });
verdade("com nota, o selo aparece", comNota.includes("selo-google"));
verdade("com o total junto", comNota.includes("42 avaliações no Google"));
/* Sem link o selo é <span>: um <a href=""> recarrega a própria página, o que
   parece defeito para quem clica esperando ir ao Google. */
ok("sem link, o selo não é <a>", /<a class="selo-google"/.test(comNota), false);
ajuste("google.link", "https://exemplo.zz/qa");
verdade("com link, o selo vira <a>",
  /<a class="selo-google"/.test(Pag.home({ headers: {}, url: "/" })));

for (const c of ["google.nota", "google.total", "google.link"]) ajuste(c, "");
for (const id of criadas) Q.roda("DELETE FROM avaliacoes WHERE id = ?", id);
ok("a seção não deixou avaliação para trás",
   Q.um("SELECT COUNT(*) c FROM avaliacoes").c, 0);

/* ==========================================================================
   RASCUNHO E PUBLICAÇÃO (0.7.0)
   ========================================================================== */
grupo("Rascunho e publicação");

const Pub = require("../src/publicado");
const Blog = require("../src/blog");

/* Estado de partida: publica tudo o que existe, para as provas medirem a
   DIFERENÇA e não o acúmulo do que veio antes. */
Pub.publicar("ZZ QA");
ok("depois de publicar, não há pendência", Pub.haMudancas(), false);

/* --- o texto --- */
ajuste("marca.slogan", "ZZ QA slogan novo");
verdade("editar cria pendência", Pub.haMudancas());
ok("o site NÃO mostra o rascunho",
   Pag.home({ headers: {}, url: "/" }).includes("ZZ QA slogan novo"), false);
/* A pré-visualização é o mesmo render, lendo o rascunho. Se ela não mostrasse,
   o dono publicaria às cegas. */
verdade("a pré-visualização mostra o rascunho",
  Pub.comoRascunho(() => Pag.home({ headers: {}, url: "/" })).includes("ZZ QA slogan novo"));
Pub.publicar("ZZ QA");
verdade("depois de publicar, o site mostra",
  Pag.home({ headers: {}, url: "/" }).includes("ZZ QA slogan novo"));
ok("e a pendência acaba", Pub.haMudancas(), false);

/* A flag do modo rascunho não pode ficar ligada depois — se ficasse, o próximo
   visitante veria o rascunho, e ninguém ligaria uma coisa à outra. */
ok("o modo rascunho desliga sozinho", Pub.lendoRascunho(), false);
try { Pub.comoRascunho(() => { throw new Error("erro de propósito"); }); } catch { /* esperado */ }
ok("desliga até quando a renderização estoura", Pub.lendoRascunho(), false);

/* --- um conserto novo não aparece antes de publicar --- */
const svRasc = Adm.gravar("servicos", 0,
  { nome: "ZZ QA Conserto Rascunho", chamada: "não devia aparecer", ativo: "1", ordem: "1" }).id;
ok("conserto novo não entra no site antes de publicar",
   Pag.home({ headers: {}, url: "/" }).includes("ZZ QA Conserto Rascunho"), false);
Pub.publicar("ZZ QA");
verdade("depois de publicar, entra",
  Pag.home({ headers: {}, url: "/" }).includes("ZZ QA Conserto Rascunho"));

/* Apagar também espera: o site continua mostrando até a publicação seguinte —
   senão "sair do ar" seria imediato e "entrar no ar" não, o que confunde. */
Adm.apagar("servicos", svRasc);
verdade("apagado continua no site até publicar",
  Pag.home({ headers: {}, url: "/" }).includes("ZZ QA Conserto Rascunho"));
Pub.publicar("ZZ QA");
ok("e some depois de publicar",
   Pag.home({ headers: {}, url: "/" }).includes("ZZ QA Conserto Rascunho"), false);

/* --- a matéria do blog pelo endereço direto --- */
/* A porta lateral mais fácil de esquecer: a lista lê o instantâneo, mas a
   matéria por slug lia a tabela — e o rascunho abria para quem tivesse o link. */
const pRasc = Adm.gravar("posts", 0, {
  titulo: "ZZ QA Materia Rascunho", resumo: "x", corpo: "y",
  publicado: "1", data: "2099-01-01",
}).id;
const slugRasc = Q.um("SELECT slug FROM posts WHERE id = ?", pRasc).slug;
ok("matéria não publicada não abre pelo endereço direto",
   Blog.materia({ headers: {}, url: "/blog/" + slugRasc + "/" }, slugRasc), null);
ok("nem aparece no índice do blog",
   Blog.indice({ headers: {}, url: "/blog/" }).includes("ZZ QA Materia Rascunho"), false);
Pub.publicar("ZZ QA");
verdade("depois de publicar, a matéria abre",
  !!Blog.materia({ headers: {}, url: "/blog/" + slugRasc + "/" }, slugRasc));
Q.roda("DELETE FROM posts WHERE id = ?", pRasc);
Pub.publicar("ZZ QA");

/* --- o histórico --- */
const ult = Pub.ultima();
verdade("a publicação fica registrada com autor e data", !!(ult && ult.criado && ult.quem));
/* Sem teto, o histórico cresceria para sempre num banco que ninguém olha. */
for (let i = 0; i < 25; i++) Pub.publicar("ZZ QA laço");
const quantas = Q.um("SELECT COUNT(*) c FROM publicacao").c;
ok("o histórico para de crescer em 20", quantas <= 20, true);

/* --- instalação nova --- */
/* Sem nenhuma publicação, o site mostraria o vazio — e pareceria quebrado, não
   "falta publicar". O rascunho vale como publicado até a primeira vez. */
Q.roda("DELETE FROM publicacao");
const nomeDaLoja = Q.um("SELECT valor FROM config WHERE chave = ?", "marca.nome").valor;
verdade("sem nunca ter publicado, o site ainda mostra conteúdo",
  Pag.home({ headers: {}, url: "/" }).includes(nomeDaLoja));
verdade("e o painel avisa que há o que publicar", Pub.haMudancas());
Pub.publicar("ZZ QA");

/* --- as avaliações de exemplo do conteúdo inicial --- */
/* Elas existem para a seção nascer visível. O que não pode é passarem por
   depoimento real: um elogio inventado no ar é propaganda enganosa, e sem
   marca no texto ninguém percebe que precisa apagar. */
{
  const bancoNovo = require("node:path").join(
    require("node:os").tmpdir(), `alaf-exemplos-${process.pid}.db`);
  const antes = process.env.ALAFCELL_DB;
  /* Um banco só para esta conferência: o da suíte já teve as avaliações
     apagadas e recriadas pelos grupos acima. */
  delete require.cache[require.resolve("../src/db")];
  process.env.ALAFCELL_DB = bancoNovo;
  const dbNovo = require("../src/db");
  CONEXOES.push(dbNovo.Q.db);
  delete require.cache[require.resolve("../src/conteudo-inicial")];
  require("../src/conteudo-inicial").semear();
  const ex = dbNovo.Q.todos("SELECT autor, texto, estrelas FROM avaliacoes ORDER BY ordem");
  ok("o conteúdo inicial traz três avaliações", ex.length, 3);
  ok("todas de cinco estrelas", ex.every((a) => a.estrelas === 5), true);
  ok("e todas dizem no texto que são exemplo",
     ex.every((a) => /EXEMPLO/i.test(a.texto)), true);
  /* `semear()` roda A CADA SUBIDA do servidor. Sem guarda, cada reinício
     empilha mais três avaliações iguais no site do cliente — e as que ele
     apagar voltam sozinhas no próximo reinício. Aconteceu de verdade: nove
     avaliações e "Exemplo 1" duas vezes na página. */
  require("../src/conteudo-inicial").semear();
  require("../src/conteudo-inicial").semear();
  ok("semear de novo não duplica nada",
     dbNovo.Q.um("SELECT COUNT(*) c FROM avaliacoes").c, 3);
  dbNovo.Q.db.close();
  try { require("node:fs").unlinkSync(bancoNovo); } catch {}
  /* Devolver o módulo do banco ao estado da suíte, senão tudo abaixo escreve
     no banco errado. */
  delete require.cache[require.resolve("../src/db")];
  process.env.ALAFCELL_DB = antes;
  CONEXOES.push(require("../src/db").Q.db);
}

/* ==========================================================================
   TEXTO FORMATADO (0.8.0)

   O painel passou a editar com editor de texto, e o site a interpretar HTML.
   O que dói aqui é o filtro: sem ele, qualquer coisa gravada num campo vira
   código executado na página de todos os visitantes.
   ========================================================================== */
grupo("Texto formatado");

const HS = require("../src/html-seguro");

/* --- o filtro --- */
ok("<script> não sobrevive", HS.sanitizarHtml("<p>oi</p><script>alert(1)</script>"), "<p>oi</p>");
ok("onerror é removido do <img>", /onerror/i.test(HS.sanitizarHtml('<img src=x onerror=alert(1)>')), false);
ok("javascript: em link é recusado",
   /javascript/i.test(HS.sanitizarHtml('<a href="javascript:alert(1)">x</a>')), false);
/* `java\nscript:` é aceito por navegadores como `javascript:` — o filtro que só
   olha o texto cru passa batido nele. */
ok("javascript: com quebra no meio também",
   /javascript/i.test(HS.sanitizarHtml('<a href="java\nscript:alert(1)">x</a>')), false);
ok("<iframe> some com o miolo junto",
   /iframe|malicioso/i.test(HS.sanitizarHtml("<iframe src=x>malicioso</iframe>")), false);
ok("style não passa (dá para cobrir a tela e sequestrar o clique)",
   /style=/i.test(HS.sanitizarHtml('<p style="position:fixed;inset:0">x</p>')), false);
verdade("a formatação de verdade passa",
  HS.sanitizarHtml("<p><strong>a</strong> <em>b</em> <u>c</u></p>").includes("<strong>a</strong>"));
verdade("lista passa", HS.sanitizarHtml("<ul><li>um</li></ul>").includes("<li>um</li>"));
/* Idempotência: o texto passa pelo filtro a cada salvamento. Sem isso, "&"
   viraria "&amp;amp;" na segunda edição e o site mostraria isso literalmente —
   um defeito que só aparece dias depois, quando alguém mexe de novo. */
ok("o filtro é idempotente", HS.sanitizarHtml(HS.sanitizarHtml("Compra & venda")),
   HS.sanitizarHtml("Compra & venda"));

/* --- o destino decide o filtro --- */
const svHtml = Adm.gravar("servicos", 0, {
  nome: "<b>ZZ QA</b> Nome", chamada: "<p>oi <b>forte</b></p><script>x</script>", ativo: "0",
}).id;
const svLido = Q.um("SELECT nome, chamada FROM servicos WHERE id = ?", svHtml);
/* O nome vai para o <option> do seletor e para a mensagem do WhatsApp: lá
   marcação aparece literalmente. */
ok("o NOME é limpo de marcação", svLido.nome, "ZZ QA Nome");
verdade("a CHAMADA guarda a formatação", svLido.chamada.includes("<b>forte</b>"));
ok("e mesmo assim sem script", /script/i.test(svLido.chamada), false);
Q.roda("DELETE FROM servicos WHERE id = ?", svHtml);

Adm.gravarTextos({ "marca.nome": "<b>ZZ QA Loja</b>", "home.texto": "<p>Um <b>texto</b></p>" });
ok("`marca.nome` (vira <title>) é limpo",
   Q.um("SELECT valor FROM config WHERE chave = ?", "marca.nome").valor, "ZZ QA Loja");
verdade("`home.texto` guarda a formatação",
  Q.um("SELECT valor FROM config WHERE chave = ?", "home.texto").valor.includes("<b>texto</b>"));

/* --- o site INTERPRETA --- */
Adm.gravarTextos({ "home.texto": "<p>ZZ QA com <b>negrito</b></p>" });
Pub.publicar("ZZ QA");
const casaRica = Pag.home({ headers: {}, url: "/" });
verdade("o site imprime o negrito, não a tag escrita",
  casaRica.includes("<b>negrito</b>"));
ok("e não aparece escapado", casaRica.includes("&lt;b&gt;negrito"), false);

/* --- mas dentro de atributo, nunca --- */
/* Uma aspa dentro de `alt=` fecha o atributo, e o resto do texto vira marcação
   da página — o filtro de gravação não salva daqui. */
Adm.gravarTextos({ "confianca.foto_alt": 'aspas " e <b>tag</b>' });
Pub.publicar("ZZ QA");
const casaAtr = Pag.home({ headers: {}, url: "/" });
ok("o `alt` não recebe tag", /alt="[^"]*<b>/.test(casaAtr), false);
verdade("e a aspa dentro dele está escapada", casaAtr.includes("&quot;"));

/* ==========================================================================
   AVALIAÇÕES DO GOOGLE — a busca na API
   ========================================================================== */
grupo("Busca no Google");

const G = require("../src/google");

ok("sem Place ID e chave, o painel sabe que não está configurado", G.configurado(), false);

/* Cada status do Google vira uma frase que diz O QUE FAZER. "REQUEST_DENIED"
   sozinho manda a pessoa pesquisar na internet. */
for (const [status, pedaco] of [
  ["REQUEST_DENIED", /Places API|chave/i],
  ["INVALID_REQUEST", /Place ID/i],
  ["OVER_QUERY_LIMIT", /cota/i],
  ["ZERO_RESULTS", /avalia/i],
]) {
  verdade(`o recado de ${status} diz o que fazer`, pedaco.test(G.recadoDoStatus(status)));
}

/* --- o que guardamos de cada avaliação --- */
const limpa = G.limparAvaliacao({
  author_name: "Maria Silva dos Santos",
  text: "Ótimo <b>atendimento</b><script>x</script>",
  rating: 5,
  relative_time_description: "há 2 meses",
});
/* Nome completo de quem avaliou é dado pessoal de um cliente que avaliou a
   LOJA, não o site — e ninguém pediu autorização para publicá-lo. */
ok("só o primeiro nome é guardado", limpa.autor, "Maria");
ok("o texto vem do Google e entra sem marcação", /[<>]/.test(limpa.texto), false);
verdade("mas o texto em si fica", limpa.texto.includes("atendimento"));
ok("as estrelas vêm como número", limpa.estrelas, 5);

/* --- a regra do cliente: 3, e só as de 5 estrelas --- */
/* Uma resposta como a que o Google manda: cinco avaliações, notas misturadas,
   e mais de três com nota cheia. */
const respostaDoGoogle = [
  { author_name: "Ana Paula", text: "otima", rating: 5, relative_time_description: "há 1 mês" },
  { author_name: "Bruno",     text: "ruim",  rating: 2, relative_time_description: "há 2 meses" },
  { author_name: "Carla",     text: "boa",   rating: 5, relative_time_description: "há 3 meses" },
  { author_name: "Davi",      text: "ok",    rating: 4, relative_time_description: "há 4 meses" },
  { author_name: "Elza",      text: "top",   rating: 5, relative_time_description: "há 5 meses" },
  { author_name: "Fábio",     text: "show",  rating: 5, relative_time_description: "há 6 meses" },
];
const escolhidas = G.escolher(respostaDoGoogle);
ok("nunca mais de três", escolhidas.length, 3);
ok("e nenhuma abaixo de cinco estrelas", escolhidas.every((a) => a.estrelas === 5), true);
ok("as de nota baixa nem entram", escolhidas.some((a) => a.autor === "Bruno"), false);
ok("nem as de quatro", escolhidas.some((a) => a.autor === "Davi"), false);
/* Se a loja não tiver três de nota cheia entre as cinco que o Google manda, a
   seção mostra menos — e isso é o certo: inventar a terceira seria mentir. */
ok("com só uma de cinco, sai uma", G.escolher(respostaDoGoogle.slice(0, 2)).length, 1);
ok("sem nenhuma, sai vazio", G.escolher([{ author_name: "X", text: "y", rating: 3 }]).length, 0);
ok("lista ausente não quebra a página", G.escolher(undefined).length, 0);

/* --- a fonte é uma só --- */
/* Somadas, ninguém saberia de onde veio cada cartão — e uma avaliação digitada
   ao lado de uma do Google, com o mesmo selo, faria passar por verificado o
   que não é. */
const idAv = [];
/* A TERCEIRA COLUNA E A ORIGEM. Uma copiada da ficha do Google e uma que
   chegou por outro caminho — as duas verdadeiras, e so uma pode se creditar
   ao Google. */
for (const [a, t, o, doG] of [
  ["ZZ Ana", "ZZ QA manual um", 1, 1],
  ["ZZ Bia", "ZZ QA manual dois", 2, 0],
]) {
  Q.roda("INSERT INTO avaliacoes (autor, texto, estrelas, ordem, ativo, do_google) VALUES (?,?,5,?,1,?)",
    a, t, o, doG);
  idAv.push(Q.um("SELECT MAX(id) id FROM avaliacoes").id);
}
Pub.publicar("ZZ QA");
const casaManual = Pag.home({ headers: {}, url: "/" });
verdade("sem a busca ligada, valem as avaliações digitadas", casaManual.includes("ZZ QA manual um"));

/* O CRÉDITO É POR AVALIAÇÃO, e não da seção inteira. As duas estão na mesma
   página: uma copiada da ficha do Google, outra que chegou por outro caminho.

   Dar o selo do Google à segunda é o site afirmando ao visitante que aquele
   elogio está numa ficha pública e verificável — quem for conferir não acha, e
   leva junto a credibilidade do resto da página. */
verdade("as duas aparecem", casaManual.includes("ZZ QA manual um") && casaManual.includes("ZZ QA manual dois"));
verdade("uma se credita ao Google", casaManual.includes("Avaliação no Google"));
verdade("e a outra, não", casaManual.includes("Cliente da Alafcell"));
/* O que prova que o crédito é POR CARTÃO e não da seção: os dois textos
   aparecem, cada um com o seu. */
{
  const trecho = (nome) => {
    const i = casaManual.indexOf(nome);
    return casaManual.slice(i, i + 900);
  };
  verdade("a do Google diz Google no cartão dela",
    /Avaliação no Google/.test(trecho("ZZ QA manual um")));
  verdade("e a outra diz Cliente no cartão dela",
    /Cliente da Alafcell/.test(trecho("ZZ QA manual dois")));
}

/* `do_google` é SIM/NÃO no banco. Sem entrar na lista de booleanos do painel,
   a tela manda "false" e o SQLite guarda o TEXTO — que é verdadeiro em toda
   comparação, e a avaliação se creditaria ao Google mesmo desmarcada. É a
   mesma armadilha de type affinity que já fez item desativado continuar no
   site. */
{
  const id = Adm.gravar("avaliacoes", 0, {
    autor: "ZZ Zed", texto: "ZZ QA origem falsa", estrelas: "5",
    ativo: "0", do_google: "false",
  }).id;
  ok("`do_google: \"false\"` vira 0, e não o texto",
     Q.um("SELECT do_google FROM avaliacoes WHERE id = ?", id).do_google, 0);
  Q.roda("DELETE FROM avaliacoes WHERE id = ?", id);
}

/* Com o Google configurado E com resposta guardada, as manuais saem de cena. */
ajuste("google.place_id", "ChIJzz_qa");
ajuste("google.chave_api", "zz-qa-chave");
Q.roda(`INSERT INTO google_cache (id, dados, criado) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, criado = excluded.criado`,
  JSON.stringify({
    nota: "4,9", total: "77", link: "https://maps.google/zz",
    avaliacoes: [{ autor: "ZZ Gugu", texto: "ZZ QA veio do Google", quando: "há 1 mês" }],
  }), new Date().toISOString());
Pub.publicar("ZZ QA");
const casaG = Pag.home({ headers: {}, url: "/" });
verdade("com o Google ligado, aparece o que veio dele", casaG.includes("ZZ QA veio do Google"));
verdade("e aí sim o crédito ao Google é verdadeiro", casaG.includes("Avaliação no Google"));
ok("e as digitadas somem", casaG.includes("ZZ QA manual um"), false);
verdade("a nota do selo é a do Google", casaG.includes("4,9"));
verdade("com o total dele", casaG.includes("77 avaliações no Google"));

/* A CHAMADA HTTP EM SI NÃO É COBERTA: não há chave de API aqui, e uma prova
   que fala com o Google de verdade falha quando o servidor está sem rede e
   gasta cota alheia. O que se prova é o que é nosso — e a parte que mais
   importa numa falha: o site continua de pé com o que estava guardado.

   `guardadas()` é o caminho que o site usa; se ele parar de devolver o cache,
   a página fica sem avaliação nenhuma no primeiro soluço de rede. */
verdade("o cache é o que o site lê", !!(G.guardadas() || {}).avaliacoes);
verdade("e ele sobrevive a uma configuração trocada",
  (() => { ajuste("google.chave_api", "zz-qa-outra");
           return !!(G.guardadas() || {}).avaliacoes; })());

/* --- o selo aparece com o LINK, mesmo sem nota --- */
/* PARTIR DO ZERO. O grupo acima deixa o cache do Google com nota "4,9" e o
   `place_id` preenchido; sem limpar, `selo()` devolve a nota de la e a prova
   de "sem nota" falharia apontando defeito no código, que está certo. */
Q.roda("DELETE FROM google_cache");
for (const c of ["google.place_id", "google.chave_api"]) ajuste(c, "");
/* Nota é número, e número inventado numa página é o tipo de coisa que ninguém
   confere e todo mundo repete. Sem ela, o selo vira o convite para olhar a
   fonte — que é mais honesto e igualmente útil. */
Adm.gravarTextos({ "google.nota": "", "google.total": "", "google.link": "https://maps.google.com/?cid=1" });
Pub.publicar("ZZ QA");
const semNota = Pag.home({ headers: {}, url: "/" });
verdade("com link e sem nota, o selo aparece", /<a class="selo-google"/.test(semNota));
verdade("dizendo só para conferir na fonte", semNota.includes("Ver as avaliações no Google"));
ok("e sem inventar número", /<b><\/b>/.test(semNota), false);

/* Sem link E sem nota não há o que mostrar: um selo do Google que não leva ao
   Google é enfeite. */
Adm.gravarTextos({ "google.link": "" });
Pub.publicar("ZZ QA");
ok("sem link e sem nota, não há selo",
   /class="selo-google"/.test(Pag.home({ headers: {}, url: "/" })), false);

/* Faxina */
Q.roda("DELETE FROM google_cache");
for (const c of ["google.place_id", "google.chave_api"]) ajuste(c, "");
for (const id of idAv) Q.roda("DELETE FROM avaliacoes WHERE id = ?", id);
Pub.publicar("ZZ QA");

/* ==========================================================================
   SEO (0.9.0)

   O que se prova aqui é o que roda em memória. O robots, o sitemap e os dados
   estruturados servidos de verdade estão em `testes/rotas.cjs` — separados de
   propósito, porque este arquivo chama as funções direto e é cego para "a
   função existe e ninguém a ligou numa rota", que foi o defeito do robots.txt.
   ========================================================================== */
grupo("SEO");

/* --- as perguntas frequentes --- */
Q.roda("DELETE FROM faq");
const porPergunta = (p, r, ordem, ativo = 1) => {
  Q.roda("INSERT INTO faq (pergunta, resposta, ordem, ativo) VALUES (?,?,?,?)", p, r, ordem, ativo);
  return Q.um("SELECT MAX(id) id FROM faq").id;
};
porPergunta("ZZ QA pergunta um?", "<p>ZZ QA resposta um</p>", 1);
porPergunta("ZZ QA pergunta dois?", "<p>ZZ QA resposta dois</p>", 2);
const faqOff = porPergunta("ZZ QA desativada?", "<p>não deveria aparecer</p>", 3, 0);
/* Registro pela metade: nasce vazio ao clicar em "+ Nova pergunta", e ficaria
   como um item em branco na página enquanto o dono ainda escreve. */
porPergunta("", "", 4);
porPergunta("ZZ QA sem resposta?", "", 5);
Pub.publicar("ZZ QA");

ok("só as completas e ativas entram", Pub.faq().length, 2);
const casaFaq = Pag.home({ headers: {}, url: "/" });
verdade("a seção aparece na página", casaFaq.includes('id="perguntas"'));
verdade("com a pergunta", casaFaq.includes("ZZ QA pergunta um?"));
verdade("e a resposta interpretada", casaFaq.includes("<p>ZZ QA resposta um</p>"));
ok("a desativada não aparece", casaFaq.includes("ZZ QA desativada"), false);
/* `<details>` NATIVO: o texto está no HTML mesmo com o item fechado, então o
   buscador lê tudo. Acordeão que só monta o conteúdo ao clicar esconde do
   buscador justamente o texto que se quer indexar. */
verdade("o conteúdo está no HTML, não montado por script",
  casaFaq.includes("<details") && casaFaq.includes("ZZ QA resposta dois"));

/* --- o dado estruturado só promete o que a página mostra --- */
/* REGRA DURA DO GOOGLE: marcar pergunta que o visitante não encontra na página
   é dado estruturado enganoso, e tira o site inteiro do recurso. */
const grafoFaq = JSON.parse(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(casaFaq)[1])["@graph"];
const paginaFaq = grafoFaq.find((n) => n["@type"] === "FAQPage");
verdade("a marcação FAQPage existe", !!paginaFaq);
ok("com as mesmas duas perguntas", paginaFaq.mainEntity.length, 2);
ok("nenhuma delas fora da página",
   paginaFaq.mainEntity.filter((q) => !casaFaq.includes(q.name)).length, 0);

/* Sem pergunta nenhuma, a seção some E a marcação some junto. Um FAQPage vazio
   é promessa quebrada; uma seção "perguntas frequentes" sem perguntas é pior
   que seção nenhuma. */
Q.roda("DELETE FROM faq");
Pub.publicar("ZZ QA");
const semFaq = Pag.home({ headers: {}, url: "/" });
ok("sem perguntas, a seção não existe", semFaq.includes('id="perguntas"'), false);
ok("e a marcação também não", semFaq.includes("FAQPage"), false);

/* --- o destino do campo, também aqui --- */
const idRico = Adm.gravar("faq", 0, {
  pergunta: "<b>ZZ QA</b> com marcação?", resposta: "<p>ok <b>forte</b></p><script>x</script>", ativo: "0",
}).id;
const lidoFaq = Q.um("SELECT pergunta, resposta FROM faq WHERE id = ?", idRico);
/* A pergunta é o texto que aparece NO RESULTADO DA BUSCA, onde marcação sai
   literal — "<b>" apareceria assim para quem está procurando. */
ok("a PERGUNTA é limpa de marcação", lidoFaq.pergunta, "ZZ QA com marcação?");
verdade("a RESPOSTA guarda a formatação", lidoFaq.resposta.includes("<b>forte</b>"));
ok("e mesmo assim sem script", /script/i.test(lidoFaq.resposta), false);
Q.roda("DELETE FROM faq WHERE id = ?", idRico);

/* --- o texto que sai no Google --- */
/* Era literal no código e prometia "preço na tela" e "loja de aparelhos novos e
   seminovos", os dois removidos do site na 0.4.0. Promessa que a página não
   cumpre faz a pessoa voltar, e voltar derruba a posição. */
Adm.gravarTextos({ "seo.descricao": "ZZ QA descrição de busca" });
Pub.publicar("ZZ QA");
const casaDesc = Pag.home({ headers: {}, url: "/" });
verdade("a descrição do Google vem do painel",
  casaDesc.includes('name="description" content="ZZ QA descrição de busca"'));
ok("e nada promete preço de conserto", /preço na tela/i.test(casaDesc.split("</head>")[0]), false);

/* --- onde a loja atende --- */
Adm.gravarTextos({ "loja.atende": "ZZ Caruaru\nZZ Toritama\nZZ Bezerros" });
Pub.publicar("ZZ QA");
const grafoLoja = JSON.parse(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
    Pag.home({ headers: {}, url: "/" }))[1])["@graph"];
const fichaLoja = grafoLoja.find((n) => JSON.stringify(n["@type"]).includes("LocalBusiness"));
ok("as cidades atendidas entram na ficha", (fichaLoja.areaServed || []).length, 3);
/* `|| []` nao e paranoia: sem ele, o campo ausente estoura um TypeError e
   derruba a suite INTEIRA — escondendo todas as provas abaixo desta. Prova tem
   de falhar, nao explodir. */
verdade("com o nome de cada uma",
  (fichaLoja.areaServed || []).map((c) => c.name).includes("ZZ Toritama"));
/* Sem esta lista, quem procura "conserto de celular em Toritama" não encontra
   uma loja que só diz Caruaru. */
verdade("o catálogo de consertos entra",
  ((fichaLoja.hasOfferCatalog || {}).itemListElement || []).length > 0);
verdade("a organização está no grafo", grafoLoja.some((n) => n["@type"] === "Organization"));

/* DECISÃO CONSCIENTE, e por isso provada: avaliação do próprio negócio na
   própria página é "self-serving review" — o Google não exibe estrela para isso
   em LocalBusiness desde 2019. Marcar daria trabalho e nenhuma estrela, e
   apresentaria como conteúdo do site o que é da ficha do Google. */
ok("nenhuma nota agregada é declarada",
   JSON.stringify(grafoLoja).includes("aggregateRating"), false);

/* --- a data que o sitemap usa --- */
verdade("o site sabe dizer quando mudou", !!Pub.quando());

/* Faxina */
Q.roda("DELETE FROM faq");
Adm.gravarTextos({ "loja.atende": "" });
Pub.publicar("ZZ QA");

/* ========================================================================== */
console.log(`\n  ${falhou ? "✖" : "✔"} ${passou} passaram, ${falhou} falharam · ${grupos.length} grupos\n`);

/* A faxina roda mesmo se algo estourar acima: banco de prova esquecido em
   /tmp vira ruído no servidor. */
process.on("exit", () => {
  /* FECHAR ANTES DE APAGAR. No Linux dá para apagar arquivo aberto e o
     `unlink` passa; no WINDOWS ele falha, o `catch` engole em silêncio e cada
     execução deixa um banco para trás — eram 177 na pasta temporária desta
     máquina quando isto foi descoberto. O servidor é Linux, então o defeito
     nunca apareceu onde alguém olhava. */
  for (const conexao of [Q.db, ...CONEXOES]) {
    try { conexao.close(); } catch { /* já fechada */ }
  }
  for (const sufixo of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(BANCO + sufixo); } catch { /* não existia ou está preso */ }
  }
  for (const caminho of IMAGENS_DE_PROVA) {
    try { fs.unlinkSync(require("node:path").join(__dirname, "..", caminho)); } catch { /* já foi */ }
  }
});
process.exitCode = falhou ? 1 : 0;
