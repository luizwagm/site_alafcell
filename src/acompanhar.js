"use strict";
/* ==========================================================================
   ACOMPANHAR O CONSERTO

   A tela que nenhum concorrente de Caruaru tem, e a que responde a ansiedade
   real: quem deixou o celular está sem o banco, sem o trabalho e sem as fotos.
   Perguntar "e aí?" no WhatsApp três vezes por dia é o comportamento que esta
   página substitui — e cada uma dessas perguntas custa atendimento à loja.

   ---------------------------------------------------------------------------
   POR QUE O CÓDIGO SOZINHO NÃO ABRE

   A ordem tem nome, telefone, aparelho e defeito. Um código de seis caracteres
   sorteados é bom contra o vizinho curioso e ruim contra um robô: 32^6 parece
   muito, mas quem varre não tem pressa.

   Por isso a consulta exige código MAIS os quatro últimos dígitos do telefone
   cadastrado. Para quem é dono do aparelho, é o número que ele sabe de cor;
   para quem varre, multiplica o trabalho por dez mil.

   E o freio: cinco tentativas por IP a cada dez minutos. Não é defesa contra
   ataque grande — é o que torna a varredura lenta demais para valer a pena.

   A resposta de erro é SEMPRE a mesma, com ou sem código existente. Dizer
   "código certo, telefone errado" entregaria de graça a metade mais difícil.
   ========================================================================== */
const { Q, txt, reais } = require("./db");
const L = require("./layout");
const { esc, engrenagem, zap } = L;

/* As etapas na ordem em que acontecem. É esta lista que desenha a trilha —
   inclusive as que ainda não aconteceram, em cinza. Mostrar só o que já
   aconteceu esconderia justamente a informação que o cliente quer: quanto
   falta. */
const TRILHA = [
  ["recebido", "Recebido", "O aparelho chegou à loja."],
  ["diagnostico", "Diagnóstico", "Testando para descobrir o que é."],
  ["orcamento", "Orçamento", "Valor fechado, esperando o seu ok."],
  ["aprovado", "Aprovado", "Você autorizou; entrou na fila da bancada."],
  ["reparo", "Em reparo", "Na bancada, sendo consertado."],
  ["teste", "Em teste", "Consertado, conferindo tudo antes de devolver."],
  ["pronto", "Pronto", "Pode buscar, ou combinar a entrega."],
  ["entregue", "Entregue", "De volta com você."],
];
/* "Recusado" fica fora da trilha de propósito: ele não é uma etapa a caminho
   do fim, é uma saída. Aparece como estado próprio, não como bolinha cinza que
   sugere que ainda vai acontecer. */

const baldes = new Map();
function freio(ip, limite = 5, janelaMs = 10 * 60 * 1000) {
  const agora = Date.now();
  const b = baldes.get(ip) || { n: 0, ate: agora + janelaMs };
  if (agora > b.ate) { b.n = 0; b.ate = agora + janelaMs; }
  b.n += 1;
  baldes.set(ip, b);
  if (baldes.size > 5000) baldes.clear();
  return b.n <= limite;
}

/* Só os dígitos, e só os quatro últimos. O cliente digita "0000", "9000-0000"
   ou o número inteiro — os três precisam funcionar, senão a trava vira
   obstáculo para o dono e não para o robô. */
const fim4 = (t) => String(t || "").replace(/\D/g, "").slice(-4);

function buscar(codigo, telefone, ip) {
  if (!freio(ip)) return { erro: "muitas" };
  const c = String(codigo || "").trim().toUpperCase();
  const t = fim4(telefone);
  if (!c || t.length < 4) return { erro: "falta" };

  const o = Q.um("SELECT * FROM ordens WHERE UPPER(codigo) = ?", c);
  /* Mesma resposta nos dois casos: código inexistente e telefone errado são
     indistinguíveis de fora. */
  if (!o || fim4(o.telefone) !== t) return { erro: "nao" };
  return { ordem: o };
}

/* ==========================================================================
   A PÁGINA
   ========================================================================== */
function pagina(req, { ordem = null, erro = "", codigo = "" } = {}) {
  const corpo = ordem ? resultado(ordem) : formulario(erro, codigo);

  return L.pagina({
    req, atual: "", canonical: "/acompanhar/",
    titulo: "Acompanhar meu conserto",
    descricao: `Digite o código da sua ordem de serviço e veja em que etapa está o seu `
      + `aparelho, sem precisar ligar para a loja.`,
    corpo: `
<section class="secao capa">
  <div class="env">
    <p class="rotulo">${engrenagem("", 12)}Ordem de serviço</p>
    <h1 class="titulo capa__t">Onde está o <em>meu aparelho</em>?</h1>
    <p class="sub">Digite o código do seu comprovante e veja a etapa em que o conserto está,
      a qualquer hora, sem esperar ninguém responder.</p>
  </div>
</section>

<section class="secao" style="padding-top:0">
  <div class="env env--fino">${corpo}</div>
</section>`,
  });
}

function formulario(erro, codigo) {
  const MSG = {
    nao: "Não encontramos essa ordem. Confira o código do comprovante e o telefone cadastrado no atendimento.",
    falta: "Preencha o código e os quatro últimos dígitos do telefone.",
    muitas: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo — ou chame no WhatsApp.",
  };

  return `
<div class="cartao" data-revela>
  ${erro ? `<p class="aviso aviso--erro" role="alert">${esc(MSG[erro] || MSG.nao)}</p>` : ""}
  <form class="form-os" action="/acompanhar/" method="post">
    <div class="form-linha">
      <label class="campo">
        <span class="campo__rot">Código da ordem *</span>
        <input class="campo__ent campo__ent--codigo" type="text" name="codigo" required
               maxlength="12" value="${esc(codigo)}" placeholder="AC-3F7K2P"
               autocomplete="off" spellcheck="false">
      </label>
      <label class="campo">
        <span class="campo__rot">4 últimos do telefone *</span>
        <input class="campo__ent campo__ent--codigo" type="text" name="telefone" required
               maxlength="4" inputmode="numeric" placeholder="0000" autocomplete="off">
      </label>
    </div>
    <button class="btn btn--acao btn--lg btn--largo" type="submit">Ver meu conserto</button>
  </form>
  <p class="form-nota">O código está no comprovante que a gente entrega quando recebe o
    aparelho. Perdeu? <a href="${zap("Olá! Perdi o código da minha ordem de serviço.")}"
    target="_blank" rel="noopener">Chame no WhatsApp</a> — a gente localiza pelo seu nome.</p>
</div>`;
}

/* ==========================================================================
   O RESULTADO

   A trilha inteira, com a etapa atual acesa e a engrenagem girando nela. É o
   mesmo desenho das quatro etapas da home — quem viu lá reconhece aqui, e
   reconhecer, para quem está ansioso, vale mais que uma ilustração nova.

   As notas internas não aparecem: `ordem_etapas.publico = 0` é anotação de
   bancada ("peça veio torta, cobrar fornecedor") e não é assunto do cliente.
   ========================================================================== */
function resultado(o) {
  const etapas = Q.todos(
    `SELECT * FROM ordem_etapas WHERE ordem_id = ? AND publico = 1 ORDER BY criado, id`, o.id);
  const feitas = new Map();
  for (const e of etapas) if (!feitas.has(e.situacao)) feitas.set(e.situacao, e);

  const atual = etapas.length ? etapas[etapas.length - 1].situacao : o.situacao;
  const iAtual = TRILHA.findIndex(([k]) => k === atual);
  const recusado = atual === "recusado";

  const linha = TRILHA.map(([chave, nome, ajuda], i) => {
    const e = feitas.get(chave);
    const estado = recusado ? (e ? "feita" : "futura")
      : i < iAtual ? "feita" : i === iAtual ? "agora" : "futura";
    return `
    <li class="passo passo--${estado}">
      <span class="passo__bolha">${estado === "agora" ? engrenagem("eng--gira", 18)
        : estado === "feita" ? "&check;" : ""}</span>
      <div class="passo__c">
        <h3 class="passo__t">${esc(nome)}</h3>
        <p class="passo__d">${esc(e && e.nota ? e.nota : ajuda)}</p>
        ${e ? `<span class="passo__q dado">${esc(quando(e.criado))}</span>` : ""}
      </div>
    </li>`;
  }).join("");

  const nomeEtapa = (TRILHA.find(([k]) => k === atual) || [null, "Em andamento"])[1];

  return `
<div class="cartao os-topo" data-revela>
  <div class="os-topo__in">
    <div>
      <p class="rotulo">${engrenagem("", 12)}Ordem ${esc(o.codigo)}</p>
      <h2 class="titulo">${esc(o.aparelho || "Seu aparelho")}</h2>
      <p class="sub">${esc(o.defeito || "")}</p>
    </div>
    <span class="os-estado os-estado--${recusado ? "nao" : "sim"}">${esc(recusado ? "Não autorizado" : nomeEtapa)}</span>
  </div>

  <dl class="fichas">
    ${o.orcamento ? `<div class="ficha"><span class="ficha__r">Orçamento</span>
      <span class="ficha__v dado">${esc(reais(o.orcamento))}</span></div>` : ""}
    ${o.prazo ? `<div class="ficha"><span class="ficha__r">Previsão</span>
      <span class="ficha__v dado">${esc(dataCurta(o.prazo))}</span></div>` : ""}
    ${o.coleta ? `<div class="ficha"><span class="ficha__r">Entrada</span>
      <span class="ficha__v dado">Busca e leva</span></div>` : ""}
    ${o.acessorios ? `<div class="ficha"><span class="ficha__r">Veio junto</span>
      <span class="ficha__v">${esc(o.acessorios)}</span></div>` : ""}
  </dl>
</div>

<ol class="trilha" data-revela data-revela-atraso="1">${linha}</ol>

<div class="cartao" style="margin-top:1.2rem">
  <h2 class="cartao__titulo">Precisa falar com a gente?</h2>
  <p class="cartao__texto">Sobre esta ordem, é só chamar — o código já vai na mensagem.</p>
  <div class="hero__acoes">
    <a class="btn btn--acao" href="${zap(`Olá! É sobre a ordem ${o.codigo}.`)}"
       target="_blank" rel="noopener">Falar no WhatsApp</a>
    <a class="btn btn--linha" href="/acompanhar/">Consultar outra ordem</a>
  </div>
</div>`;
}

/* "há 2 horas" diz mais que "31/08 09:14" para quem quer saber se algo andou
   agora. Acima de dois dias a data volta a ser mais útil que a contagem. */
function quando(iso) {
  const t = Date.parse(String(iso).replace(" ", "T") + "Z");
  if (!t) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d <= 2) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return dataCurta(iso);
}

function dataCurta(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
}

module.exports = { pagina, buscar, TRILHA };
