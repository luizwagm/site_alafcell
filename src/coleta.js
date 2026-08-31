"use strict";
/* ==========================================================================
   BUSCA E LEVA

   O diferencial da loja contra as três franquias de Caruaru — e a página
   existe porque ele precisa de um lugar onde caiba a explicação inteira, não
   só um bullet na home.

   O formulário pede o mínimo para o motoboy sair: nome, WhatsApp, endereço,
   bairro e a janela de horário. Aparelho e problema são opcionais de propósito
   — quem não sabe o que houve com o celular é justamente quem mais precisa do
   serviço, e transformar isso em campo obrigatório perderia o pedido.
   ========================================================================== */
const { Q, txt } = require("./db");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");

const PASSOS = [
  ["Você agenda", "Preenche o formulário ou chama no WhatsApp. Leva menos de um minuto."],
  ["A gente confirma", "Respondemos com o horário e o nome de quem vai buscar."],
  ["Buscamos o aparelho", "No endereço que você marcou, com comprovante de retirada na hora."],
  ["Orçamento pelo WhatsApp", "Diagnóstico feito, valor fechado. Só abrimos com o seu ok."],
  ["Devolvemos consertado", "Testado, com a garantia por escrito. E o pagamento na entrega."],
];

/* ==========================================================================
   A PÁGINA

   `estado` carrega o que aconteceu no envio anterior: "ok" com o código do
   pedido, "falta" quando o formulário voltou incompleto. Vem pela URL e não
   por sessão — assim um F5 não reenvia o pedido, e o link da tela de sucesso
   pode ser mandado para alguém.
   ========================================================================== */
function pagina(req, q = {}) {
  const enviado = q.ok === "1";
  const falta = q.falta === "1";
  const bairros = String(txt("coleta.bairros", "")).split(",").map((b) => b.trim()).filter(Boolean);

  const formulario = `
<form class="form-coleta" action="/busca-e-leva/" method="post" id="agendar">
  ${falta ? `<p class="aviso aviso--erro" role="alert">Faltou preencher o nome, o WhatsApp ou o endereço.
    São os três que o motoboy precisa para sair.</p>` : ""}

  <div class="form-linha">
    <label class="campo">
      <span class="campo__rot">Seu nome *</span>
      <input class="campo__ent" type="text" name="nome" required maxlength="120" autocomplete="name">
    </label>
    <label class="campo">
      <span class="campo__rot">WhatsApp *</span>
      <input class="campo__ent" type="tel" name="telefone" required maxlength="20"
             placeholder="(81) 90000-0000" autocomplete="tel">
    </label>
  </div>

  <label class="campo">
    <span class="campo__rot">Endereço *</span>
    <input class="campo__ent" type="text" name="endereco" required maxlength="180"
           placeholder="Rua, número" autocomplete="street-address">
  </label>

  <div class="form-linha">
    <label class="campo">
      <span class="campo__rot">Bairro</span>
      ${bairros.length ? `
      <select class="campo__ent" name="bairro">
        <option value="">Escolha…</option>
        ${bairros.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join("")}
        <option value="Outro">Outro bairro</option>
      </select>`
      : `<input class="campo__ent" type="text" name="bairro" maxlength="80">`}
    </label>
    <label class="campo">
      <span class="campo__rot">Ponto de referência</span>
      <input class="campo__ent" type="text" name="referencia" maxlength="180"
             placeholder="Perto de quê?">
    </label>
  </div>

  <div class="form-linha">
    <label class="campo">
      <span class="campo__rot">Melhor dia</span>
      <input class="campo__ent" type="date" name="quando">
    </label>
    <fieldset class="campo campo--radio">
      <legend class="campo__rot">Período</legend>
      <div class="radios">
        <label class="radio"><input type="radio" name="periodo" value="manha" checked><span>Manhã</span></label>
        <label class="radio"><input type="radio" name="periodo" value="tarde"><span>Tarde</span></label>
      </div>
    </fieldset>
  </div>

  <div class="form-linha">
    <label class="campo">
      <span class="campo__rot">Qual aparelho</span>
      <input class="campo__ent" type="text" name="aparelho" maxlength="120"
             placeholder="Marca e modelo, se souber">
    </label>
    <label class="campo">
      <span class="campo__rot">O que houve</span>
      <input class="campo__ent" type="text" name="problema" maxlength="200"
             placeholder="Caiu, molhou, não liga…">
    </label>
  </div>

  <!-- Campo isca: invisível para gente, irresistível para robô de formulário.
       Custa uma linha e derruba o preenchimento automático que enche a tabela
       de lixo. Quem usa leitor de tela também não é levado até ele, porque
       está fora da ordem de tabulação e marcado como escondido. -->
  <p class="isca" aria-hidden="true">
    <label>Não preencha este campo
      <input type="text" name="site" tabindex="-1" autocomplete="off"></label>
  </p>

  <button class="btn btn--acao btn--lg btn--largo" type="submit">Agendar a coleta</button>
  <p class="form-nota">Ao enviar, seus dados vão para o nosso atendimento e servem só para
    combinar a coleta. Nada é compartilhado — veja a <a href="/privacidade/">política de privacidade</a>.</p>
</form>`;

  const sucesso = `
<div class="cartao sucesso" data-revela>
  <span class="sucesso__ico">${engrenagem("eng--gira", 56)}</span>
  <h2 class="titulo">Pedido recebido</h2>
  <p class="sub">A gente confirma o horário pelo WhatsApp, com o nome de quem vai buscar
    o seu aparelho. Se preferir adiantar, chame por lá agora mesmo.</p>
  <div class="hero__acoes">
    <a class="btn btn--acao" href="${zap("Olá! Acabei de pedir a coleta pelo site.")}"
       target="_blank" rel="noopener">Falar no WhatsApp</a>
    <a class="btn btn--linha" href="/consertos/">Ver os preços enquanto isso</a>
  </div>
</div>`;

  return L.pagina({
    req, atual: "coleta", canonical: "/busca-e-leva/",
    titulo: "Busca e leva",
    descricao: `A Alafcell busca o seu celular em ${txt("loja.cidade", "Caruaru")}, conserta e `
      + `devolve na sua mão. Coleta gratuita, orçamento pelo WhatsApp e pagamento na entrega.`,
    jsonld: jsonld(),
    corpo: `
<section class="secao capa">
  <div class="env">
    <p class="rotulo">${engrenagem("", 12)}${esc(txt("coleta.area", "Caruaru e região"))}</p>
    <h1 class="titulo capa__t">${esc(txt("coleta.titulo", "A gente vai até você"))}</h1>
    <p class="sub">${esc(txt("coleta.texto", ""))}</p>

    <figure class="capa__foto" data-revela>
      <img src="/assets/img/banco/entrega.webp" width="1200" height="800" fetchpriority="high"
           decoding="async" alt="Entregador da Alafcell saindo para buscar um aparelho">
    </figure>

    <ul class="contraste" style="max-width:44rem">
      <li class="contraste__i contraste__i--nao">
        <strong>Nas redes nacionais</strong>
        <span>Você embala, posta e espera o aparelho ir e voltar de transportadora.</span>
      </li>
      <li class="contraste__i contraste__i--sim">
        <strong>Na Alafcell</strong>
        <span>A gente busca na sua casa ou no seu trabalho, no horário que você marcar,
          aqui em ${esc(txt("loja.cidade", "Caruaru"))}.</span>
      </li>
    </ul>
  </div>
</section>

<section class="secao secao--tinta">
  <div class="env">
    <header class="secao__cabeca secao__cabeca--centro">
      <p class="rotulo">${engrenagem("", 12)}Como funciona</p>
      <h2 class="titulo">Cinco passos, <em>zero deslocamento</em></h2>
    </header>
    <ol class="etapas etapas--5">
      ${PASSOS.map(([t, d], i) => `
      <li class="etapa" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <span class="etapa__n dado">${i + 1}</span>
        <h3 class="etapa__t">${esc(t)}</h3>
        <p class="etapa__d">${esc(d)}</p>
      </li>`).join("")}
    </ol>
  </div>
</section>

<section class="secao" id="formulario">
  <div class="env env--fino">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}Agendamento</p>
      <h2 class="titulo">${enviado ? "Tudo certo" : "Marque a <em>coleta</em>"}</h2>
      ${enviado ? "" : `<p class="sub">${esc(txt("coleta.aviso", ""))}</p>`}
    </header>
    ${enviado ? sucesso : `<div class="cartao">${formulario}</div>`}
  </div>
</section>`,
  });
}

/* ==========================================================================
   O ENVIO

   Devolve `false` quando falta o essencial — quem decide o que responder é o
   servidor, que já sabe montar a página com o aviso.

   O campo isca é conferido aqui: preenchido, o pedido é ACEITO em silêncio e
   descartado. Devolver erro ensinaria o robô a contornar; o silêncio faz ele
   achar que funcionou e ir embora.
   ========================================================================== */
function agendar(d) {
  if (String(d.site || "").trim()) return true;          /* robô: engole e ignora */
  if (!d.nome || !d.telefone || !d.endereco) return false;

  Q.roda(
    `INSERT INTO coletas (nome, telefone, endereco, bairro, referencia,
                          aparelho, problema, periodo, quando)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    String(d.nome).slice(0, 120), String(d.telefone).slice(0, 20),
    String(d.endereco).slice(0, 180), String(d.bairro || "").slice(0, 80),
    String(d.referencia || "").slice(0, 180), String(d.aparelho || "").slice(0, 120),
    String(d.problema || "").slice(0, 200),
    d.periodo === "tarde" ? "tarde" : "manha", String(d.quando || "").slice(0, 10));
  return true;
}

function jsonld() {
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "Service",
      name: "Busca e leva de celular",
      description: txt("coleta.texto", ""),
      provider: { "@id": `${SITE}/#loja` },
      areaServed: { "@type": "City", name: txt("loja.cidade", "Caruaru") },
      url: `${SITE}/busca-e-leva/`,
    }],
  };
}

module.exports = { pagina, agendar };
