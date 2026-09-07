"use strict";
/* ==========================================================================
   LAYOUT — o esqueleto de toda página

   Cabeçalho, rodapé e o <head> ficam AQUI, num lugar só. Uma mudança no menu
   ou no rodapé chega a todas as páginas sem ninguém precisar lembrar de cada
   arquivo — que é como um site ganha um rodapé diferente na página de contato.
   ========================================================================== */
const { Q, txt } = require("./db");
const Medicao = require("./medicao");
const Pub = require("./publicado");
const { SITE, CABECALHO_ROBOS } = require("./endereco");
const { emLinhas } = require("./html-seguro");

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* ==========================================================================
   LINHAS — dado de várias linhas, impresso com segurança

   Endereço e horário são DADO, e o campo deles virou editor de texto na 0.8.0:
   o que está gravado no banco do cliente tem `<p>` dentro. A seção de contato
   imprimia isso com `esc()` e o visitante lia
   `<p>Rua Benjamin Constant, 31, Casa A</p>` na tela; o rodapé interpretava. O
   mesmo dado saindo de dois jeitos na mesma página.

   Aqui: limpa a marcação PRESERVANDO as quebras (endereço tem linhas que
   importam), escapa o que sobrou — é texto do cliente indo para o HTML — e
   devolve as quebras como `<br>`.

   Limpar na LEITURA, e não só na gravação, é o que conserta o que já está no
   banco. Corrigir só a gravação deixaria o defeito na tela até alguém reabrir
   e salvar cada campo, um por um.
   ========================================================================== */
const linhas = (v) => emLinhas(v).split("\n").map(esc).join("<br>");

/* ==========================================================================
   A ENGRENAGEM

   O logotipo é cromado, com degradê e sombra — redesenhá-lo em SVG seria
   traí-lo, então ele entra como imagem, onde ele é bom (topo, rodapé,
   compartilhamento).

   O que vira SVG é só a SILHUETA da engrenagem: doze dentes, o mesmo perfil
   do emblema. Ela não é o logotipo, é o MOTIVO da interface — o elemento que
   gira na rolagem, marca o progresso do conserto e assina os títulos. Em SVG
   ela herda `currentColor`, escala sem borrar e pesa menos de 1 KB; como
   imagem ela seria uma requisição por uso e não mudaria de cor.
   ========================================================================== */
const DENTES = "M 99.5 43.2 L 99.5 56.8 L 89.0 56.4 L 87.0 64.0 L 96.3 68.9 L 89.5 80.6 "
  + "L 80.6 75.0 L 75.0 80.6 L 80.6 89.5 L 68.9 96.3 L 64.0 87.0 L 56.4 89.0 L 56.8 99.5 "
  + "L 43.2 99.5 L 43.6 89.0 L 36.0 87.0 L 31.1 96.3 L 19.4 89.5 L 25.0 80.6 L 19.4 75.0 "
  + "L 10.5 80.6 L 3.7 68.9 L 13.0 64.0 L 11.0 56.4 L 0.5 56.8 L 0.5 43.2 L 11.0 43.6 "
  + "L 13.0 36.0 L 3.7 31.1 L 10.5 19.4 L 19.4 25.0 L 25.0 19.4 L 19.4 10.5 L 31.1 3.7 "
  + "L 36.0 13.0 L 43.6 11.0 L 43.2 0.5 L 56.8 0.5 L 56.4 11.0 L 64.0 13.0 L 68.9 3.7 "
  + "L 80.6 10.5 L 75.0 19.4 L 80.6 25.0 L 89.5 19.4 L 96.3 31.1 L 87.0 36.0 L 89.0 43.6 Z "
  + "M 31.0 50 A 19 19 0 1 0 69.0 50 A 19 19 0 1 0 31.0 50 Z";

function engrenagem(classe = "", tamanho = 32) {
  return `<svg class="eng ${classe}" viewBox="0 0 100 100" width="${tamanho}" height="${tamanho}"
     aria-hidden="true" focusable="false"><path d="${DENTES}" fill="currentColor" fill-rule="evenodd"/></svg>`;
}

/* ==========================================================================
   O LOGOTIPO

   Duas peças, e não uma: no topo cabe a assinatura inteira em telas grandes,
   mas no celular o letreiro de duas linhas encolheria até virar borrão. Ali
   entra só o emblema. A alternativa — uma imagem só, espremida — é o que faz
   logotipo de assistência técnica virar mancha vermelha em metade dos
   celulares.
   ========================================================================== */
function marca(contexto = "topo") {
  const nome = esc(txt("marca.nome", "Alafcell Assistec"));
  if (contexto === "emblema") {
    return `<img class="marca marca--emblema" src="/assets/img/emblema.webp"
      alt="${nome}" width="120" height="132" decoding="async">`;
  }
  /* NO RODAPE, ADIAR. As duas imagens da marca são as mesmas do topo, mas lá
     embaixo ninguém as vê antes de rolar — e baixá-las de imediato faz com que
     disputem banda com a foto que a pessoa está esperando ver. Num celular
     velho com rede ruim, que é o público desta assistência, isso é a diferença
     entre esperar e voltar. */
  const adiar = contexto === "rodape" ? ' loading="lazy"' : "";
  return `<span class="marca">
    <img class="marca__emblema" src="/assets/img/emblema.webp" alt="" aria-hidden="true"
         width="120" height="132" decoding="async"${adiar}>
    <img class="marca__texto" src="/assets/img/logotipo-texto.webp" alt="${nome}"
         width="1400" height="504" decoding="async"${adiar}>
  </span>`;
}

/* --------------------------------------------------------------- WhatsApp */
function zap(mensagem = "") {
  const n = txt("marca.whatsapp", "5581999999999").replace(/\D/g, "");
  return `https://wa.me/${n}${mensagem ? "?text=" + encodeURIComponent(mensagem) : ""}`;
}


/* ==========================================================================
   CABEÇALHO

   Cinco itens, e a ordem não é alfabética nem administrativa: é a ordem de
   quem chega. Primeiro CONSERTOS, que é o que traz a pessoa; depois BUSCA E
   LEVA, o diferencial contra as três franquias de Caruaru; depois a LOJA, que
   é a segunda venda.

   O botão do topo é "Acompanhar", e não "Orçamento". Quem já deixou o aparelho
   volta ao site ansioso — e é o único público que vai ao site com uma pergunta
   que o site responde sozinho, sem ninguém do outro lado. Orçamento tem o
   WhatsApp flutuante e um botão em cada seção.
   ========================================================================== */
function cabecalho(atual = "", req = null) {
  const item = (href, rot, chave) =>
    `<a href="${href}" class="nav__i${atual === chave ? " nav__i--atual" : ""}"${
      atual === chave ? ' aria-current="page"' : ""}>${rot}</a>`;


  return `
<a href="#conteudo" class="pular">Ir para o conteúdo</a>
<header class="topo" id="topo">
  <div class="env topo__in">
    <a href="/" class="topo__marca" aria-label="${esc(txt("marca.nome", "Alafcell Assistec"))} — página inicial">${marca()}</a>

    <!-- ====================================================================
         O MENU APONTA PARA DENTRO DA PRÓPRIA PÁGINA

         O site virou uma landing: consertos, busca e leva e contato são SEÇÕES
         de "/", não telas. Só o blog continua sendo página de verdade, porque
         cada matéria precisa de endereço próprio para ser compartilhada.

         As âncoras levam a barra ("/#consertos" e não "#consertos") de
         propósito: assim o mesmo menu funciona quando alguém está lendo uma
         matéria do blog — sem a barra, o link procuraria a seção dentro da
         matéria e não sairia do lugar.
         ==================================================================== -->
    <nav class="nav" aria-label="Principal">
      ${item("/#consertos", "Consertos", "consertos")}
      ${item("/#busca-e-leva", "Busca e leva", "coleta")}
      ${item("/blog/", "Blog", "blog")}
      ${item("/#contato", "Contato", "contato")}
    </nav>

    <!-- Saíram daqui o carrinho (não há loja) e o "Acompanhar". No lugar, o
         que esta assistência faz o dia inteiro: conversa no WhatsApp. -->
    <div class="topo__acoes">
      <a class="btn btn--acao btn--sm topo__zap" href="${zap("Olá! Vim pelo site e queria um orçamento.")}"
         target="_blank" rel="noopener">Falar no WhatsApp</a>
      <button class="topo__menu" type="button" aria-expanded="false"
              aria-controls="nav-movel" aria-label="Abrir o menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>

  <!-- Menu do celular: os mesmos itens. Duplicar a lista em dois lugares é
       como um site ganha um link a mais no desktop que não existe no celular. -->
  <nav class="nav-movel" id="nav-movel" hidden aria-label="Principal (celular)">
    <a href="/#consertos">Consertos</a>
    <a href="/#busca-e-leva">Busca e leva</a>
    <a href="/#como-funciona">Como funciona</a>
    <a href="/blog/">Blog</a>
    <a href="/#contato">Contato</a>
    <a class="btn btn--acao btn--largo" href="${zap("Olá! Vim pelo site e queria um orçamento.")}"
       target="_blank" rel="noopener">Orçamento no WhatsApp</a>
  </nav>
</header>`;
}

/* ==========================================================================
   RODAPÉ

   Mapa do site de verdade, não três links soltos: é onde o visitante que rolou
   a página inteira decide o próximo passo, e é de onde o Google entende a
   estrutura.

   Os serviços listados saem do banco, não de uma lista escrita à mão: no dia
   em que a loja cadastrar "troca de vidro traseiro", ele aparece aqui sem
   ninguém mexer no código — e sem o rodapé passar a mentir.
   ========================================================================== */
function rodape() {
  const servicos = Pub.servicos(6);
  const ano = new Date().getFullYear();
  const insta = txt("marca.instagram", "https://www.instagram.com/alafcell_assistec/");

  return `
<footer class="rodape">
  <div class="env">
    <div class="rodape__topo">
      <div class="rodape__marca">
        ${marca("rodape")}
        <p class="rodape__frase">${txt("marca.slogan",
          "Assistência técnica especializada em Caruaru. A gente busca, conserta e devolve.")}</p>
        <div class="rodape__social">
          <a class="rodape__zap" href="${zap("Olá! Vim pelo site da Alafcell.")}"
             target="_blank" rel="noopener">Falar no WhatsApp</a>
          ${insta ? `<a class="rodape__insta" href="${esc(insta)}" target="_blank" rel="noopener">Instagram</a>` : ""}
        </div>
      </div>

      <!-- Os consertos NÃO têm mais link para tela própria: a lista aqui é
           informação, e o destino de todos é a seção da landing. Manter um
           link por serviço apontando para o mesmo lugar seria prometer sete
           páginas que não existem. -->
      <nav class="rodape__col" aria-labelledby="rf-serv">
        <h2 class="rodape__tit" id="rf-serv">O que a gente conserta</h2>
        <ul>${servicos.map((s) =>
          `<li>${esc(s.nome)}</li>`).join("")}
          <li><a href="/#consertos">Ver a lista completa</a></li>
        </ul>
      </nav>

      <nav class="rodape__col" aria-labelledby="rf-emp">
        <h2 class="rodape__tit" id="rf-emp">A Alafcell</h2>
        <ul>
          <li><a href="/#busca-e-leva">Busca e leva</a></li>
          <li><a href="/#como-funciona">Como funciona</a></li>
          <li><a href="/#garantia">Garantia</a></li>
          <li><a href="/blog/">Blog</a></li>
          <li><a href="/#contato">Contato</a></li>
          <li><a href="/privacidade/">Privacidade</a></li>
        </ul>
      </nav>

      <!-- "Onde estamos" logo ao lado de "A Alafcell", como pedido: as duas
           respondem à mesma pergunta ("quem são e onde ficam") e ficavam
           separadas pela coluna da Loja, que saiu. -->
      <div class="rodape__col">
        <h2 class="rodape__tit">Onde estamos</h2>
        <address class="rodape__loja">
          ${linhas(txt("loja.endereco", "Endereço a preencher no painel"))}<br>
          <span>${linhas(txt("loja.horario", "Horário a preencher no painel"))}</span>
          ${(() => {
            /* O telefone só vira link quando EXISTE. Vazio, ele saía como
               `<a href="tel:">(00) 0000-0000</a>` — um link que o dedo acerta
               e que não liga para ninguém. Enquanto o campo estiver em branco,
               o WhatsApp logo acima é o caminho, e ele funciona. */
            const t = txt("marca.telefone", "");
            const so = t.replace(/\D/g, "");
            return so ? `<br><a href="tel:${esc(so)}">${esc(t)}</a>` : "";
          })()}
        </address>
      </div>
    </div>

    <div class="rodape__base">
      <p class="rodape__legal">
        © ${ano} ${esc(txt("marca.nome", "Alafcell Assistec"))} ·
        CNPJ ${esc(txt("marca.cnpj", "00.000.000/0001-00"))}
      </p>

      <!-- ============================================================
           ASSINATURA — obrigatória em todo site do parque.
           O emblema herda 'currentColor' e acende no vermelho da Alafcell no
           hover, para a assinatura pertencer a este site em vez de parecer um
           selo colado por cima.
           ============================================================ -->
      <a class="dev-credit" href="https://luizaugust.me" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M4 20V8l4-4 4 4v12M12 20V10l4-4 4 4v10" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        Desenvolvido por <strong>LA Software House</strong>
      </a>
    </div>
  </div>
</footer>

<!-- ============================================================
     WHATSAPP FLUTUANTE

     Fica FORA do rodapé porque acompanha a rolagem: quem está lendo o preço da
     troca de tela na metade da página não deveria ter de descer até o fim para
     perguntar. Some na hora de digitar num formulário — botão flutuante em
     cima do teclado do celular é a causa clássica de formulário abandonado.
     ============================================================ -->
<a class="zap-flut" href="${zap("Olá! Vim pelo site e queria um orçamento.")}"
   target="_blank" rel="noopener" aria-label="Falar no WhatsApp">
  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.41a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.03 0 1.2.87 2.35.99 2.51.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z"/>
  </svg>
</a>`;
}

/* ==========================================================================
   A PÁGINA INTEIRA

   'jsonld' entra como parâmetro e não é montado aqui: cada página sabe o que
   ela é (loja, produto, serviço, artigo), e um Schema.org genérico no layout
   diria a mesma coisa para todas — que é o mesmo que não dizer nada.
   ========================================================================== */
function pagina({ titulo, descricao, corpo, atual = "", canonical = "/",
                  jsonld = null, css = "", js = "", req = null, imagem = null }) {
  const nome = txt("marca.nome", "Alafcell Assistec");
  const tit = titulo ? `${titulo} — ${nome}` : `${nome} — Assistência técnica de celular em Caruaru`;
  const og = imagem ? (imagem.startsWith("http") ? imagem : SITE + imagem) : SITE + "/assets/img/og.png";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<!-- ============================================================
     A CLASSE "js" ENTRA ANTES DE QUALQUER CSS RODAR.

     É ela que autoriza o CSS a esconder os blocos que serão revelados na
     rolagem. Se este trecho não executar — script bloqueado, erro de rede — a
     classe não entra e o site aparece INTEIRO e parado, que é o comportamento
     certo. Enfeite que falha não pode apagar a loja.

     Fica aqui, embutido e antes das folhas de estilo, e não no site.js com
     defer: um pouco depois já seria tarde, e os blocos apareceriam para sumir
     em seguida — o pisca que todo site com "reveal" mal feito tem.
     ============================================================ -->
<script>document.documentElement.className += " js";</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(tit)}</title>
<meta name="description" content="${esc(descricao || "")}">
<link rel="canonical" href="${SITE}${canonical}">
${CABECALHO_ROBOS ? `<!-- Endereço de TRABALHO: fora do índice. A etiqueta acompanha o cabeçalho
     X-Robots-Tag, porque link de aprovação circula no WhatsApp e nem todo robô
     lê o robots.txt antes de seguir um link. -->
<meta name="robots" content="${CABECALHO_ROBOS}">` : ""}
<meta name="theme-color" content="#0B0C0E">
<meta name="color-scheme" content="dark">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(nome)}">
<meta property="og:title" content="${esc(tit)}">
<meta property="og:description" content="${esc(descricao || "")}">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:image" content="${esc(og)}">
<!-- As dimensões evitam que o WhatsApp e o Facebook mostrem um espaço em
     branco enquanto baixam a imagem para descobrir o tamanho — e é no
     WhatsApp que este link mais circula. O "alt" e lido em voz alta por quem
     recebe o link com leitor de tela. -->
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(nome)} — assistência técnica de celular em ${esc(txt("loja.cidade", "Caruaru"))}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="/assets/img/favicon.ico" sizes="any">
<link rel="icon" href="/assets/img/icone-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/img/icone-180.png">
<link rel="manifest" href="/manifest.webmanifest">

<!-- As fontes vêm com preconnect porque elas são o primeiro bloqueio de
     renderização da página; sem isto o navegador só descobre o segundo
     domínio depois de baixar o CSS. "display=swap" garante que o texto
     apareça na fonte do sistema enquanto a definitiva não chega — página
     em branco esperando fonte é a pior troca possível. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira:wght@600;800&family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap">
<link rel="stylesheet" href="/assets/css/estilo.css">
${css}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
${Medicao.cabeca()}
</head>
<body>
${cabecalho(atual, req)}
<main id="conteudo">
${corpo}
</main>
${rodape()}
${Medicao.aviso()}
<script src="/assets/js/site.js" defer></script>
${js}
</body>
</html>`;
}

module.exports = { pagina, cabecalho, rodape, marca, engrenagem, zap, esc, linhas, SITE };
