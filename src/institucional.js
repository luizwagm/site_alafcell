"use strict";
/* ==========================================================================
   CONTATO E PRIVACIDADE
   ========================================================================== */
const { Q, txt } = require("./db");
const L = require("./layout");
const { esc, engrenagem, zap } = L;
const { SITE } = require("./endereco");

/* ==========================================================================
   /contato/

   O formulário existe, mas ele NÃO é o caminho principal — o WhatsApp é. Numa
   assistência técnica, quem escreve quer resposta hoje, e um formulário
   promete uma resposta que só chega quando alguém abrir o painel.

   Por isso a ordem na tela: canais diretos primeiro, formulário depois, para
   quem prefere escrever com calma ou está no computador do trabalho.
   ========================================================================== */
function contato(req, q = {}) {
  const enviado = q.ok === "1";
  const falta = q.falta === "1";
  const zapNumero = txt("marca.whatsapp", "");
  const tel = txt("marca.telefone", "");
  const email = txt("marca.email", "");
  const mapa = txt("loja.mapa", "");

  const canais = [
    zapNumero ? ["WhatsApp", "É por aqui que a gente responde mais rápido, no horário da loja.",
      zap("Olá! Vim pelo site."), "Chamar no WhatsApp", true] : null,
    tel ? ["Telefone", esc(tel), "tel:" + tel.replace(/\D/g, ""), "Ligar agora", false] : null,
    email ? ["E-mail", esc(email), "mailto:" + email, "Escrever", false] : null,
  ].filter(Boolean);

  return L.pagina({
    req, atual: "contato", canonical: "/contato/",
    titulo: "Contato",
    descricao: `Fale com a Alafcell Assistec em ${txt("loja.cidade", "Caruaru")}: WhatsApp, `
      + `telefone, endereço e horário de funcionamento.`,
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [{ "@type": "ContactPage", url: `${SITE}/contato/`,
                   about: { "@id": `${SITE}/#loja` } }],
    },
    corpo: `
<section class="secao capa">
  <div class="env">
    <p class="rotulo">${engrenagem("", 12)}Contato</p>
    <h1 class="titulo capa__t">Fale com a <em>gente</em></h1>
    <p class="sub">Conta o que houve com o seu aparelho. O diagnóstico é de graça e a gente
      responde com o valor antes de você sair de casa.</p>
  </div>
</section>

<section class="secao" style="padding-top:0">
  <div class="env">
    <div class="grade grade--3">
      ${canais.map(([t, d, href, rot, principal], i) => `
      <div class="cartao${principal ? " cartao--acende" : ""}" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <span class="serv__ico">${engrenagem("", 26)}</span>
        <h2 class="cartao__titulo">${esc(t)}</h2>
        <p class="cartao__texto">${d}</p>
        <p style="margin-top:1.1rem">
          <a class="btn ${principal ? "btn--acao" : "btn--linha"} btn--sm" href="${esc(href)}"
             ${principal ? 'target="_blank" rel="noopener"' : ""}>${esc(rot)}</a>
        </p>
      </div>`).join("")}
    </div>
  </div>
</section>

<section class="secao secao--tinta">
  <div class="env">
    <div class="contato-grade">
      <div data-revela>
        <figure class="contato-foto">
          <img src="/assets/img/banco/atendimento.webp" width="1200" height="800"
               loading="lazy" decoding="async"
               alt="Atendimento no balcão da Alafcell Assistec">
        </figure>
        <p class="rotulo" style="margin-top:1.6rem">${engrenagem("", 12)}A loja</p>
        <h2 class="titulo">Onde a gente <em>fica</em></h2>
        <address class="contato-end">
          ${esc(txt("loja.endereco", "Endereço a preencher no painel"))}<br>
          <span>${esc(txt("loja.horario", "Horário a preencher no painel"))}</span>
        </address>
        ${mapa ? `<p style="margin-top:1.2rem">
          <a class="btn btn--linha" href="${esc(mapa)}" target="_blank" rel="noopener">Abrir no mapa</a></p>` : ""}
        <p class="cartao__texto" style="margin-top:1.6rem">Não quer vir?
          <a href="/busca-e-leva/" style="color:var(--vermelho-alto)">A gente busca o seu aparelho</a>
          em ${esc(txt("loja.cidade", "Caruaru"))}.</p>
      </div>

      <div class="cartao" data-revela data-revela-atraso="1">
        <h2 class="cartao__titulo">${enviado ? "Mensagem recebida" : "Prefere escrever?"}</h2>
        ${enviado ? `
        <p class="cartao__texto">A gente responde no horário da loja. Se for urgente,
          o WhatsApp é mais rápido.</p>
        <p style="margin-top:1.2rem">
          <a class="btn btn--acao btn--sm" href="${zap("Olá! Mandei uma mensagem pelo site.")}"
             target="_blank" rel="noopener">Chamar no WhatsApp</a></p>`
        : `
        <form class="form-contato" action="/contato/" method="post">
          ${falta ? `<p class="aviso aviso--erro" role="alert">Faltou o nome, o WhatsApp ou a mensagem.</p>` : ""}
          <div class="form-linha">
            <label class="campo"><span class="campo__rot">Nome *</span>
              <input class="campo__ent" type="text" name="nome" required maxlength="120" autocomplete="name"></label>
            <label class="campo"><span class="campo__rot">WhatsApp *</span>
              <input class="campo__ent" type="tel" name="telefone" required maxlength="20" autocomplete="tel"></label>
          </div>
          <label class="campo"><span class="campo__rot">E-mail</span>
            <input class="campo__ent" type="email" name="email" maxlength="160" autocomplete="email"></label>
          <label class="campo"><span class="campo__rot">Assunto</span>
            <input class="campo__ent" type="text" name="assunto" maxlength="120"
                   placeholder="Orçamento, garantia, um produto da loja…"></label>
          <label class="campo"><span class="campo__rot">Mensagem *</span>
            <textarea class="campo__ent" name="mensagem" required maxlength="1500"
                      placeholder="Qual aparelho e o que aconteceu com ele?"></textarea></label>
          <p class="isca" aria-hidden="true">
            <label>Não preencha<input type="text" name="site" tabindex="-1" autocomplete="off"></label>
          </p>
          <button class="btn btn--acao btn--largo" type="submit">Enviar mensagem</button>
          <p class="form-nota">Seus dados servem só para responder você. Veja a
            <a href="/privacidade/">política de privacidade</a>.</p>
        </form>`}
      </div>
    </div>
  </div>
</section>`,
  });
}

function gravarContato(d) {
  if (String(d.site || "").trim()) return true;             /* robô: engole e ignora */
  if (!d.nome || !d.telefone || !d.mensagem) return false;
  Q.roda(
    `INSERT INTO contatos (nome, telefone, email, assunto, mensagem) VALUES (?,?,?,?,?)`,
    String(d.nome).slice(0, 120), String(d.telefone).slice(0, 20),
    String(d.email || "").slice(0, 160), String(d.assunto || "").slice(0, 120),
    String(d.mensagem).slice(0, 1500));
  return true;
}

/* ==========================================================================
   /privacidade/

   Escrita para ser entendida, e não para se defender. O texto lista o que é
   coletado em cada formulário do site, por quanto tempo fica e como pedir a
   exclusão — que é o que a LGPD pede e o que quase nenhuma política de site
   pequeno responde.
   ========================================================================== */
function privacidade(req) {
  const encarregado = txt("legal.privacidade_email", txt("marca.email", ""));
  const hoje = new Date();
  const dataBR = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;

  return L.pagina({
    req, atual: "", canonical: "/privacidade/",
    titulo: "Política de privacidade",
    descricao: "O que a Alafcell coleta, por que, por quanto tempo guarda e como você pede a exclusão.",
    corpo: `
<section class="secao capa">
  <div class="env env--fino">
    <p class="rotulo">${engrenagem("", 12)}LGPD</p>
    <h1 class="titulo capa__t">Política de <em>privacidade</em></h1>
    <p class="sub">Escrita para ser entendida. Aqui está o que a gente coleta, por quê,
      por quanto tempo guarda e como você pede para apagar.</p>
  </div>
</section>

<section class="secao artigo" style="padding-top:0">
  <div class="env env--fino">
    <div class="artigo__corpo">
      <h2>Em resumo</h2>
      <ul>
        <li>A gente coleta só o necessário para atender você: nome, WhatsApp e o que houve com o aparelho.</li>
        <li>Nada é vendido nem compartilhado com terceiros para publicidade.</li>
        <li>Os cookies de medição só ligam depois que você aceita — e o site funciona igual se recusar.</li>
        <li>Você pode pedir para ver, corrigir ou apagar seus dados a qualquer momento.</li>
      </ul>

      <h2>O que a gente coleta, e onde</h2>
      <p><strong>Formulário de busca e leva:</strong> nome, WhatsApp, endereço, bairro, ponto de
        referência, horário preferido e o problema do aparelho. Sem endereço e horário, o motoboy
        não sai — é por isso que eles são pedidos.</p>
      <p><strong>Pedido da loja:</strong> nome, WhatsApp, CPF (opcional), e-mail (opcional) e
        endereço quando você escolhe entrega. O CPF só é pedido porque ele pode ser exigido na
        nota fiscal.</p>
      <p><strong>Formulário de contato:</strong> nome, WhatsApp, e-mail e a mensagem.</p>
      <p><strong>Ordem de serviço:</strong> além dos dados de contato, o modelo do aparelho, o
        defeito relatado e, quando você autoriza, a senha de desbloqueio — que é necessária para
        testar o aparelho depois do conserto e é apagada na entrega.</p>
      <p><strong>Visitas ao site:</strong> a gente conta quantas pessoas acessam cada página sem
        cookie e sem terceiros. O endereço de IP é transformado num código embaralhado que não
        pode ser revertido, então nem nós conseguimos saber de quem era.</p>

      <h2>Cookies</h2>
      <p>Três, e cada um com uma função:</p>
      <ul>
        <li><strong>Carrinho.</strong> Guarda o que você colocou no carrinho, por 30 dias. Sem ele o carrinho esvazia a cada página.</li>
        <li><strong>Pedido.</strong> Guarda o código do seu último pedido por 7 dias, para você poder abrir a tela dele de novo.</li>
        <li><strong>Medição.</strong> Só existe se você aceitar. Guarda a sua resposta por seis meses para não perguntar de novo.</li>
      </ul>

      <h2>Por quanto tempo</h2>
      <p>Mensagens de contato e pedidos de coleta ficam por <strong>12 meses</strong>. Pedidos da
        loja e ordens de serviço ficam por <strong>5 anos</strong>, porque é o prazo em que a
        garantia e as obrigações fiscais podem ser cobradas. A contagem de visitas fica por
        <strong>24 meses</strong>, já embaralhada.</p>

      <h2>Com quem a gente compartilha</h2>
      <p>Com ninguém para fins de publicidade. Os dados ficam no nosso servidor. Se você aceitar
        os cookies de medição, o Google e a Meta recebem informação sobre a sua navegação — e é
        exatamente por isso que a escolha é sua, antes de qualquer coisa carregar.</p>

      <h2>Seus direitos</h2>
      <p>Você pode pedir para <strong>ver, corrigir, apagar ou levar</strong> os seus dados, e
        também retirar o consentimento da medição a qualquer momento. É só pedir
        ${encarregado ? `por <a href="mailto:${esc(encarregado)}">${esc(encarregado)}</a>` : "pelo nosso WhatsApp"}
        — a gente responde em até 15 dias.</p>
      <p>Uma coisa que a gente não pode fazer: apagar a ordem de serviço de um aparelho ainda em
        garantia, porque é ela que prova o seu direito.</p>

      <h2>Segurança</h2>
      <p>O site roda em conexão cifrada, as senhas do painel são guardadas de forma que nem nós
        conseguimos lê-las, e o acesso ao sistema é só de quem trabalha aqui.</p>

      <h2>Quem é o responsável</h2>
      <p>${esc(txt("marca.nome", "Alafcell Assistec"))}, CNPJ ${esc(txt("marca.cnpj", ""))},
        ${esc(txt("loja.endereco", ""))}.
        ${encarregado ? `Contato para assuntos de dados: <a href="mailto:${esc(encarregado)}">${esc(encarregado)}</a>.` : ""}</p>

      <p class="artigo__meta dado">Última atualização: ${dataBR}</p>
    </div>
  </div>
</section>`,
  });
}

module.exports = { contato, gravarContato, privacidade };
