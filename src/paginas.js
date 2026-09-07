"use strict";
/* ==========================================================================
   PÁGINAS DO SITE — a home

   A ordem das seções não é estética, é a ordem das perguntas de quem chega
   com o celular quebrado, na sequência em que ele as faz:

     1. "consertam o meu?"        → busca por aparelho, antes de qualquer coisa
     2. "quanto custa?"           → os consertos com preço a partir de
     3. "preciso ir até lá?"      → busca e leva, o que as franquias não fazem
     4. "quanto tempo demora?"    → as quatro etapas, com prazo
     5. "e se der errado?"        → garantia por escrito
     6. "vocês vendem também?"    → a loja
     7. "posso confiar?"          → blog e contato

   Colocar a loja antes do conserto seria vender para quem veio arrumar — o
   erro clássico de assistência que quer virar varejo.
   ========================================================================== */
const { Q, txt } = require("./db");
const Pub = require("./publicado");
const L = require("./layout");
/* Dado estruturado nao interpreta marcacao: o que for para dentro do JSON-LD
   sai como TEXTO, e um "<b>" gravado num campo do painel apareceria assim no
   resultado da busca. */
const { semHtml } = require("./html-seguro");
const { esc, engrenagem, zap } = L;

/* ==========================================================================
   QUANDO O TEXTO É INTERPRETADO E QUANDO É ESCAPADO

   Desde a 0.8.0 o painel edita com editor de texto formatado, e os campos de
   CONTEÚDO chegam aqui como HTML — negrito, lista, link. Eles são impressos
   como vêm; escapá-los faria a página mostrar `<p>` e `<strong>` na cara do
   visitante, que foi exatamente o defeito que o Instituto Kenósis levou para
   produção.

   `esc()` continua valendo, e é obrigatório, em três lugares:

     · DENTRO DE ATRIBUTO — `alt=`, `href=`, `title=`, `content=`. Ali uma aspa
       fecha o atributo e o resto do texto vira marcação da página.
     · NO JSON-LD — marcação quebra o dado estruturado do Google.
     · EM TEXTO QUE NÃO PASSA PELO EDITOR — nome de marca, modelo, slug.

   O que garante que o HTML impresso é seguro NÃO é este arquivo: é o
   `sanitizarHtml` na gravação (`src/admin.js`). Filtrar na exibição deixaria o
   conteúdo perigoso guardado no banco, esperando outra rota que o leia.
   ========================================================================== */
const { SITE } = require("./endereco");

/* ==========================================================================
   ÍCONES DOS SERVIÇOS

   Desenhados em traço, herdando `currentColor`. Cada um mostra a PEÇA, não
   uma metáfora: quem tem a tela trincada reconhece a tela trincada, e não uma
   chave de boca genérica que serviria para qualquer serviço.
   ========================================================================== */
const ICONES = {
  tela: '<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="m8 8 4 4-2 3 5-2 2 3"/>',
  bateria: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><path d="m11 9-2 3h3l-2 3"/>',
  carga: '<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M9 18h6"/><path d="M12 7v5"/><path d="m9.5 9.5 2.5-2.5 2.5 2.5"/>',
  camera: '<rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6l1.5-2h5L16 6"/>',
  audio: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>',
  placa: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  software: '<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="m10 11 2 2 4-4"/>',
};
const icone = (chave) => `<svg class="serv__icone" viewBox="0 0 24 24" width="30" height="30"
  fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">${ICONES[chave] || ICONES.tela}</svg>`;

/* ==========================================================================
   PRAZO EM PALAVRA

   O banco guarda horas porque hora ordena e compara. A tela mostra a palavra
   que o cliente usa: ninguém pergunta "quantas horas", pergunta "sai hoje?".
   ========================================================================== */
function prazoTexto(horas) {
  const h = Number(horas) || 0;
  if (h <= 4) return "Em algumas horas";
  if (h <= 12) return "No mesmo dia";
  if (h <= 24) return "Em até 24 horas";
  if (h <= 48) return "Em até 2 dias";
  return `Em até ${Math.ceil(h / 24)} dias`;
}

/* O menor preço cadastrado para o serviço, entre todos os aparelhos. É o
   "a partir de" — e quando não existe preço nenhum, a resposta NÃO é R$ 0,00:
   é dizer que o orçamento sai na hora. Preço zero na tela de uma assistência
   é a promessa que o balcão vai ter de desmentir. */
/* Continua existindo e continua testado, mas NÃO alimenta tela nenhuma desde
   a 0.4.0 — o site não mostra preço de conserto. Lê do instantâneo, como todo
   o resto, para não haver um caminho que enxergue o rascunho. */
function apartirDe(servicoId) {
  return Pub.precoMinimo(servicoId);
}

/* ==========================================================================
   HOME
   ========================================================================== */
function home(req) {
  /* TUDO SAI DO INSTANTÂNEO. Ler as tabelas aqui faria a home mostrar o
     rascunho — e o botão de publicar deixaria de significar alguma coisa. */
  const servicos = Pub.servicos(6);
  const marcas = Pub.marcas();
  const populares = Pub.populares(6);
  const posts = Pub.posts(3);

  /* ------------------------------------------------------------------ topo */
  /* OS DOIS BOTÕES DO HERO levam para dentro da própria página (#orcamento e
     #busca-e-leva), porque não há mais para onde sair. O padrão do primeiro
     deixou de falar em preço: não existe preço de conserto no site, e um botão
     que promete tabela e entrega lista de serviços gasta a confiança logo na
     primeira tela.

     ATENÇÃO: este texto é só o PADRÃO. O valor real mora em `config.home.btn1`,
     e quem manda é o banco — trocar aqui não muda um site que já subiu. */
  const hero = `
<section class="hero">
  <!-- As engrenagens giram DEVAGAR e ficam atrás de tudo. Elas dizem que a
       oficina está trabalhando; se corressem, virariam enfeite de página de
       carregamento. aria-hidden porque não há nada aqui para ser lido. -->
  <div class="hero__maquina" aria-hidden="true">
    ${engrenagem("eng--gira hero__eng hero__eng--g", 420)}
    ${engrenagem("eng--gira-r hero__eng hero__eng--p", 230)}
  </div>

  <div class="env hero__in">
    <div class="hero__texto">
      <p class="rotulo">${engrenagem("", 12)}${txt("home.rotulo", "")}</p>
      <h1 class="hero__titulo">${txt("home.titulo", "Seu celular de volta<br><em>no mesmo dia</em>")}</h1>
      <p class="hero__sub">${txt("home.texto", "")}</p>
      <div class="hero__acoes">
        <a class="btn btn--acao btn--lg" href="#orcamento">${txt("home.btn1", "Pedir orçamento")}</a>
        <a class="btn btn--linha btn--lg" href="#busca-e-leva">${txt("home.btn2", "Buscar meu aparelho")}</a>
      </div>

      <dl class="numeros">
        ${[1, 2, 3].map((i) => `
        <div class="numero">
          <dd class="numero__v dado">${txt(`home.n${i}_valor`, "")}</dd>
          <dt class="numero__r">${txt(`home.n${i}_rotulo`, "")}</dt>
        </div>`).join("")}
      </dl>
    </div>

    <!-- ==========================================================
         O APARELHO QUE ACENDE

         É o conceito da marca em uma peça: a tela está apagada e a luz
         atravessa. Desenhado em CSS, não em imagem — imagem de celular
         genérico é o que faz um site de assistência parecer template, e
         ainda custaria uma requisição de 200 KB no topo da página.
         ========================================================== -->
    <div class="hero__aparelho" aria-hidden="true">
      <div class="fone">
        <div class="fone__tela">
          <!-- A foto da bancada DENTRO da tela é o conceito em uma peça: o
               aparelho acende e o que ele mostra é a oficina trabalhando. A
               varredura de luz passa por cima dela, e não no lugar dela.
               "fetchpriority=high" porque esta é a maior imagem visível na
               primeira dobra — é ela que o navegador precisa buscar primeiro. -->
          <img class="fone__foto" src="/assets/img/banco/oficina.webp" alt=""
               width="1200" height="800" fetchpriority="high" decoding="async">
          <span class="fone__luz"></span>
        </div>
        <span class="fone__alto"></span>
      </div>
    </div>
  </div>
</section>`;

  /* ------------------------------------------------- pedir orçamento
     ====================================================================
     O FORMULÁRIO NÃO MOSTRA PREÇO: ELE ABRE A CONVERSA

     Antes ele levava a uma tela de preços por modelo. Agora monta a primeira
     mensagem do WhatsApp já com marca, modelo e serviço — que é como o
     orçamento de assistência realmente começa: alguém olhando o aparelho.

     CONTINUA SENDO UM FORM GET DE VERDADE, apontando para uma rota do
     servidor que redireciona. Poderia ser JavaScript montando o link, e aí
     ficaria de fora justamente quem esta assistência atende: o celular velho
     com a rede ruim. O servidor monta a mensagem e responde um 302 — funciona
     em qualquer navegador, com ou sem script.

     Os três campos são opcionais de propósito. Quem não souber dizer o modelo
     ainda assim chega ao WhatsApp; o que faltar, o atendente pergunta. Barrar
     o envio por causa de um campo em branco seria perder o contato para
     proteger a completude de um texto.
     ==================================================================== */
  const busca = `
<section class="secao busca" id="orcamento">
  <div class="env">
    <div class="busca__caixa cartao" data-revela>
      <div class="busca__cabeca">
        <p class="rotulo">${engrenagem("", 12)}Orçamento pelo WhatsApp</p>
        <h2 class="titulo">Qual é o <em>seu aparelho</em>?</h2>
        <p class="sub">Diga o aparelho e o que houve. A gente abre a conversa no WhatsApp
          já com essas informações — você só aperta enviar.</p>
      </div>

      <form class="busca__form" action="/orcamento" method="get">
        <label class="campo">
          <span class="campo__rot">Marca</span>
          <select name="marca" class="campo__ent" data-busca-marca>
            <option value="">Escolha…</option>
            ${marcas.map((m) => `<option value="${esc(m.slug)}">${esc(m.nome)}</option>`).join("")}
          </select>
        </label>
        <label class="campo">
          <span class="campo__rot">Modelo</span>
          <select name="modelo" class="campo__ent" data-busca-modelo>
            <option value="">Todos os modelos</option>
          </select>
        </label>
        <label class="campo">
          <span class="campo__rot">O que houve</span>
          <select name="servico" class="campo__ent">
            <option value="">Escolha…</option>
            ${servicos.map((sv) => `<option value="${esc(sv.slug)}">${esc(sv.nome)}</option>`).join("")}
            <option value="outro">Outro problema</option>
          </select>
        </label>
        <button class="btn btn--acao" type="submit">Pedir orçamento no WhatsApp</button>
      </form>

      ${populares.length ? `
      <div class="busca__rapidos">
        <span class="busca__rot">Mais consertados:</span>
        ${populares.map((m) =>
          `<a class="etiqueta" href="/orcamento?modelo=${esc(m.slug)}">${esc(m.nome)}</a>`).join("")}
      </div>` : ""}

      <p class="busca__nota">Não achou o seu? A lista tem os mais comuns —
        <a href="${zap("Olá! Meu aparelho não está na lista do site. Pode me ajudar?")}"
           target="_blank" rel="noopener">chame no WhatsApp</a> que a gente responde na hora.</p>
    </div>
  </div>
</section>`;

  /* -------------------------------------------------------------- serviços */
  /* ====================================================================
     INFORMAÇÃO, E NÃO VITRINE

     Esta seção mostrava preço de partida, foto e um link por serviço para uma
     tela própria. Os três saíram: conserto de celular não tem preço de
     tabela — depende do modelo e do que se encontra ao abrir —, e anunciar um
     "a partir de" cria a conversa que a assistência menos quer ter, a de
     explicar por que o valor final é outro.

     Sem link, o cartão deixa de ser `<a>` e vira `<article>`. Isso importa
     mais do que parece: um `<a>` sem destino útil é uma promessa de página
     que o visitante clica, espera e não recebe.

     O que ficou é o que a pessoa precisa para reconhecer o próprio problema
     na lista: o nome, o que é, e o prazo de bancada.
     ==================================================================== */
  const cartaoServico = (s, i) => `
    <article class="cartao serv" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
      <span class="serv__ico">${icone(s.icone)}</span>
      <h3 class="cartao__titulo">${esc(s.nome)}</h3>
      <p class="cartao__texto">${s.chamada}</p>
      <span class="serv__pe">
        <span class="serv__prazo dado">${esc(prazoTexto(s.prazo_horas))}</span>
      </span>
    </article>`;

  const secServicos = `
<section class="secao secao--tinta" id="consertos">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}O que a gente conserta</p>
      <h2 class="titulo">O prazo de bancada, <em>antes</em> de você sair de casa</h2>
      <p class="sub">Cada conserto com o tempo real de bancada e
        ${txt("legal.garantia", "90 dias")} de garantia por escrito — na peça e no serviço.
        O valor sai depois de olhar o aparelho: em celular, orçamento por tabela é chute.</p>
    </header>
    <div class="grade grade--3">
      ${servicos.map(cartaoServico).join("")}
    </div>
    <p class="secao__mais"><a class="btn btn--acao" href="${zap("Olá! Vim pelo site e queria um orçamento.")}"
       target="_blank" rel="noopener">Pedir orçamento no WhatsApp</a></p>
  </div>
</section>`;

  /* ---------------------------------------------------------- busca e leva */
  const secColeta = `
<section class="secao coleta" id="busca-e-leva">
  <div class="env coleta__in">
    <div class="coleta__texto" data-revela>
      <p class="rotulo">${engrenagem("", 12)}O que ninguém mais faz em Caruaru</p>
      <h2 class="titulo">${txt("coleta.titulo", "A gente vai até você")}</h2>
      <p class="sub">${txt("coleta.texto", "")}</p>

      <!-- A comparação é o argumento inteiro desta seção: as redes nacionais
           também dizem "busca e leva", mas a delas é transportadora. Deixar a
           diferença implícita seria desperdiçar o único ponto em que a loja
           local ganha das franquias. -->
      <ul class="contraste">
        <li class="contraste__i contraste__i--nao">
          <strong>Nas redes nacionais</strong>
          <span>Você embala, posta e espera o aparelho ir e voltar de transportadora.</span>
        </li>
        <li class="contraste__i contraste__i--sim">
          <strong>Na Alafcell</strong>
          <span>A gente busca na sua casa ou no seu trabalho, no horário que você marcar, aqui em ${esc(txt("loja.cidade", "Caruaru"))}.</span>
        </li>
      </ul>
      <p class="coleta__aviso">${txt("coleta.aviso", "")}</p>
      <!-- Agendar É a conversa. O formulário de coleta gravava um pedido que
           alguém precisava ir buscar no painel; a mensagem pronta chega no
           aparelho de quem atende, e o combinado de endereço e horário
           acontece ali mesmo — que é como isso funciona de verdade. -->
      <a class="btn btn--acao btn--lg" href="${zap("Olá! Quero agendar a busca do meu aparelho em "
        + txt("loja.cidade", "Caruaru") + ". Meu endereço é:")}"
         target="_blank" rel="noopener">Agendar a coleta no WhatsApp</a>
    </div>

    <div class="coleta__mapa" aria-hidden="true">
      <!-- A foto é o fato (alguém sai daqui com o aparelho); o pulso por cima é a
           metáfora (o sinal alcançando a cidade). Sozinha, a animação era
           abstrata demais para uma seção que vende um serviço concreto. -->
      <div class="coleta__foto">
        <img src="/assets/img/banco/entrega.webp" alt="" loading="lazy"
             decoding="async" width="1200" height="800">
        <div class="pulso"><span></span><span></span><span></span>${engrenagem("", 44)}</div>
      </div>
    </div>
  </div>
</section>`;

  /* ------------------------------------------------------------- as etapas
     Aqui a animação ganha razão de existir: a barra que enche e a engrenagem
     que gira na etapa ativa são o MESMO desenho da página de acompanhamento.
     Quem vê isso na home reconhece a tela depois, quando estiver ansioso. */
  /* OS QUATRO PASSOS VÊM DO BANCO. Eram literais aqui, e a promessa que a
     loja faz ao cliente não pode depender de mim para mudar — quem responde
     por ela no balcão é o dono.

     A segunda etapa tem DUAS PORTAS, e dizer isso foi pedido do cliente:
     "a gente busca" sozinho escondia metade do movimento da loja, e quem mora
     do lado achava que precisava esperar a coleta para ser atendido. */
  const ETAPAS = [1, 2, 3, 4].map((n) => [
    txt(`etapas.${n}_titulo`, ""),
    txt(`etapas.${n}_texto`, ""),
  ]).filter(([t]) => t);
  const secEtapas = `
<section class="secao secao--tinta" id="como-funciona">
  <div class="env">
    <header class="secao__cabeca secao__cabeca--centro">
      <p class="rotulo">${engrenagem("", 12)}Como funciona</p>
      <h2 class="titulo">${txt("etapas.titulo", "Quatro passos, <em>nenhuma surpresa</em>")}</h2>
    </header>
    <ol class="etapas">
      ${ETAPAS.map(([t, d], i) => `
      <li class="etapa" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <span class="etapa__n dado">${i + 1}</span>
        <h3 class="etapa__t">${t}</h3>
        <p class="etapa__d">${d}</p>
      </li>`).join("")}
    </ol>
  </div>
</section>`;

  /* ------------------------------------------------------------------ loja
     A SEÇÃO DA LOJA SAIU (0.4.0). Não há loja virtual por enquanto — nem
     vitrine, nem carrinho, nem checkout. O módulo `src/loja.js` continua no
     repositório, desligado e sem rota nenhuma, para o dia em que a loja
     voltar; o CHANGELOG diz o que precisa ser religado.
     ------------------------------------------------------------------ */

  /* --------------------------------------------------------------- garantia */
  /* O PRAZO DA GARANTIA VIVE NUM LUGAR SÓ (`legal.garantia`) e é colado no
     começo do primeiro motivo. Escrevê-lo de novo aqui criaria dois números
     para a mesma promessa, e no dia em que a loja mudasse de 90 para 180 dias
     um dos dois ficaria mentindo. */
  const confiar = [1, 2, 3].map((n) => [
    txt(`confianca.${n}_titulo`, ""),
    (n === 1 ? txt("legal.garantia", "90 dias") + " " : "") + txt(`confianca.${n}_texto`, ""),
  ]).filter(([t]) => t);

  const fotoConfianca = txt("confianca.foto", "");

  const secGarantia = `
<section class="secao secao--tinta" id="garantia">
  <div class="env">
    <div class="garantia">
      ${fotoConfianca ? `
      <figure class="garantia__foto" data-revela>
        <img src="${esc(fotoConfianca)}" width="1200" height="800" loading="lazy"
             decoding="async" alt="${esc(txt("confianca.foto_alt", ""))}">
      </figure>` : ""}
      <div>
        <p class="rotulo">${engrenagem("", 12)}${txt("confianca.rotulo", "Por que confiar")}</p>
        <h2 class="titulo">${txt("confianca.titulo", "Do jeito que a gente <em>gostaria</em> de ser atendido")}</h2>
        <p class="sub">${txt("confianca.sub", "")}</p>
      </div>
    </div>
    <div class="grade grade--3" style="margin-top:2.2rem">
      ${confiar.map(([t, d], i) => `
      <div class="cartao" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <span class="serv__ico">${engrenagem("", 26)}</span>
        <h3 class="cartao__titulo">${t}</h3>
        <p class="cartao__texto">${d}</p>
      </div>`).join("")}
    </div>
  </div>
</section>`;

  /* ================================================================
     O QUE DIZEM NO GOOGLE

     SÓ AS DE CINCO ESTRELAS, e no máximo TRÊS — as duas regras são do
     cliente, e as duas vivem na CONSULTA. Deixá-las na tela (ou na
     disciplina de quem cadastra) faria uma avaliação de quatro estrelas
     aparecer no dia em que alguém a cadastrasse sem pensar.

     A seção inteira SOME quando não há avaliação: uma seção vazia com
     título "quem já passou por aqui recomenda" é pior do que seção
     nenhuma. E nada aqui é texto de exemplo — só entra o que o dono
     copiou da ficha real da loja.
     ================================================================ */
  /* As duas regras (só 5 estrelas, no máximo 3) valem no instantâneo: o que
     não é 5 nem chega a ser publicado, e aqui o corte é em 3. */
  const avaliacoes = Pub.avaliacoes(3);

  /* O selo vem do instantâneo, e não de `txt()`: quando a busca no Google está
     ligada, a nota e o total são os DELE — e mostrar um número digitado ao lado
     de cartões vindos do Google seria contradizer a própria fonte. */
  const seloG = Pub.selo();
  const notaGoogle = seloG.nota;
  const totalGoogle = seloG.total;
  const linkGoogle = seloG.link;

  /* DE ONDE VEIO CADA CARTÃO — e por que a página precisa saber.

     Enquanto a busca na Places API não está configurada, estes cartões são o
     que foi digitado no painel. Chamá-los de "Avaliação no Google" é o site
     afirmando ao visitante que aquele elogio está publicado numa ficha pública
     e verificável — e quem for conferir não vai achar. Uma seção de prova
     social que não resiste a uma conferência derruba junto o resto da página.

     Com o Google ligado, o crédito é verdadeiro e fica. Sem ele, o cartão diz
     apenas que é de um cliente — que é o que de fato se sabe. */
  /* O credito e POR AVALIACAO, e nao da secao inteira: uma copiada da ficha do
     Google ao lado de uma que chegou por WhatsApp sao coisas diferentes, e dar
     o mesmo selo as duas e o que faz passar por verificado o que nao e.

     Quem cadastra declara a origem no painel. O site nao adivinha. */
  const credito = (a) => (Number(a.do_google) === 1 ? "Avaliação no Google" : "Cliente da Alafcell");

  /* ================================================================
     PERGUNTAS FREQUENTES

     Esta seção é a superfície de busca do site. Como landing de página única,
     ele tem UMA página para o buscador ranquear, competindo com franquias que
     têm uma por serviço. Cada pergunta aqui responde uma busca de cauda longa
     ("quanto tempo demora para trocar a tela", "vocês buscam em casa") sem
     custar página nova — que é justamente o que o cliente removeu na 0.4.0.

     `<details>` NATIVO, e não acordeão de JavaScript: abre sem script, o
     teclado navega sozinho, o leitor de tela anuncia o estado, e — o que
     decide aqui — o texto das respostas está no HTML mesmo fechado, então o
     buscador lê tudo. Acordeão que só monta o conteúdo ao clicar esconde do
     buscador exatamente o texto que se quer indexar.

     A seção some inteira quando não há pergunta: um "perguntas frequentes"
     vazio é pior que nenhum.
     ================================================================ */
  const perguntas = Pub.faq();
  const secFaq = perguntas.length ? `
<section class="secao" id="perguntas">
  <div class="env env--fino">
    <header class="secao__cabeca secao__cabeca--centro">
      <p class="rotulo" style="justify-content:center">${engrenagem("", 12)}${txt("faq.rotulo", "Perguntas frequentes")}</p>
      <h2 class="titulo">${txt("faq.titulo", "O que a gente mais <em>escuta</em>")}</h2>
    </header>
    <div class="faq">
      ${perguntas.map((f, i) => `
      <details class="faq__i"${i === 0 ? " open" : ""}>
        <summary class="faq__p">${esc(f.pergunta)}</summary>
        <div class="faq__r">${f.resposta}</div>
      </details>`).join("")}
    </div>
    <p class="faq__fim">Não achou a sua? <a href="${zap(txt("faq.zap",
      "Olá! Tenho uma dúvida sobre o conserto do meu celular."))}" target="_blank" rel="noopener">Pergunte no WhatsApp</a>.</p>
  </div>
</section>` : "";

  const secGoogle = avaliacoes.length ? `
<section class="secao" id="google">
  <div class="env">
    <header class="secao__cabeca secao__cabeca--centro">
      <p class="rotulo">${engrenagem("", 12)}${txt("google.rotulo", "O que dizem")}</p>
      <h2 class="titulo">${txt("google.titulo", "Quem já passou por aqui <em>recomenda</em>")}</h2>
      ${(notaGoogle || linkGoogle) ? `
      <${linkGoogle ? `a class="selo-google" href="${esc(linkGoogle)}" target="_blank" rel="noopener"`
                    : "span class=\"selo-google\""}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.2-4.9 3.2-7.9Z"/>
          <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.2 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23Z"/>
          <path fill="#FBBC05" d="M6 14.3a6.6 6.6 0 0 1 0-4.2V7.3H2.3a11 11 0 0 0 0 9.8L6 14.3Z"/>
          <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.3L6 10.1c.9-2.6 3.2-4.7 6-4.7Z"/>
        </svg>
        <span class="selo-google__estrelas" aria-hidden="true">★★★★★</span>
        <span class="selo-google__nota">${
          notaGoogle && totalGoogle ? `<b>${esc(notaGoogle)}</b> · ${esc(totalGoogle)} avaliações no Google`
          : notaGoogle ? `<b>${esc(notaGoogle)}</b> no Google`
          /* Sem nota preenchida o selo NAO inventa numero: vira so o convite
             para conferir na fonte. E o mesmo desenho do Forms Fitness. */
          : "Ver as avaliações no Google"}</span>
      </${linkGoogle ? "a" : "span"}>` : ""}
    </header>
    <div class="grade grade--3">
      ${avaliacoes.map((a, i) => `
      <figure class="cartao avaliacao" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        <div class="avaliacao__estrelas" aria-label="5 de 5 estrelas">★★★★★</div>
        <blockquote class="avaliacao__texto">“${a.texto}”</blockquote>
        <figcaption class="avaliacao__quem">
          <span class="avaliacao__inicial" aria-hidden="true">${esc((a.autor || "G").trim().charAt(0).toUpperCase())}</span>
          <span>
            <span class="avaliacao__nome">${esc(a.autor || "Cliente")}</span><br>
            <span class="avaliacao__fonte">${credito(a)}${a.quando ? ` · ${esc(a.quando)}` : ""}</span>
          </span>
        </figcaption>
      </figure>`).join("")}
    </div>
  </div>
</section>` : "";

  /* ------------------------------------------------------------------ blog */
  const secBlog = posts.length ? `
<section class="secao" id="blog">
  <div class="env">
    <header class="secao__cabeca">
      <p class="rotulo">${engrenagem("", 12)}${txt("blog.rotulo", "Blog")}</p>
      <h2 class="titulo">${txt("blog.titulo", "Antes de gastar, <em>leia</em>")}</h2>
    </header>
    <div class="grade grade--3">
      ${posts.map((p, i) => `
      <a class="cartao cartao--acende post${p.capa ? " post--foto" : ""}" href="/blog/${esc(p.slug)}/" data-revela${i % 3 ? ` data-revela-atraso="${i % 3}"` : ""}>
        ${p.capa ? `<span class="post__capa"><img src="${esc(p.capa)}" alt="" loading="lazy"
          decoding="async" width="1200" height="800"></span>` : ""}
        <h3 class="cartao__titulo">${esc(p.titulo)}</h3>
        <p class="cartao__texto">${p.resumo}</p>
      </a>`).join("")}
    </div>
  </div>
</section>` : "";

  /* --------------------------------------------------- contato / chamada final
     ESTA SEÇÃO VIROU O "CONTATO" DA LANDING, e por isso ganhou o id: o menu
     aponta para "#contato" desde que o site deixou de ter tela de contato, e
     âncora prometida que não existe rola a página até o fim sem parar em nada.

     O segundo botão era "Acompanhar um conserto", que virou 404. No lugar,
     o endereço e o horário — a informação que falta a quem decidiu vir até a
     loja e está com o site aberto no celular. */
  const endereco = txt("loja.endereco", "");
  const horario = txt("loja.horario", "");
  const temEndereco = endereco && !/preencha/i.test(endereco);

  const secFim = `
<section class="secao fim" id="contato">
  <div class="env env--fino fim__in" data-revela>
    <h2 class="titulo">Conta o que houve com o seu aparelho</h2>
    <p class="sub">Responder é de graça e costuma levar poucos minutos no horário da loja.</p>
    <div class="hero__acoes">
      <a class="btn btn--acao btn--lg" href="${zap("Olá! Vim pelo site e queria um orçamento.")}"
         target="_blank" rel="noopener">Falar no WhatsApp</a>
    </div>
    ${temEndereco ? `
    <address class="fim__onde">
      ${esc(endereco)}${horario && !/preencha/i.test(horario) ? `<br><span>${esc(horario)}</span>` : ""}
    </address>` : ""}
  </div>
</section>`;

  return L.pagina({
    req,
    atual: "",
    canonical: "/",
    /* Vazio cai no padrão do layout ("<nome> — <slogan>"). Quem quiser um
       título diferente do que aparece na aba escreve no painel. */
    titulo: txt("seo.titulo", ""),
    /* ANTES esta linha era literal no código e prometia "preço na tela" e
       "loja de aparelhos novos e seminovos" — os dois removidos do site na
       0.4.0. Ficou meses assim porque ninguém lê o próprio código procurando
       promessa velha; quem lê é quem busca no Google, clica e volta. */
    descricao: txt("seo.descricao", ""),
    jsonld: jsonldLoja(perguntas),
    /* O FAQ vem depois da garantia e ANTES das recomendações: quem ainda tem
       dúvida operacional não é convencido por depoimento — primeiro se
       responde a pergunta, depois se mostra quem já passou por aqui. */
    corpo: hero + busca + secServicos + secColeta + secEtapas + secGarantia
      + secFaq + secGoogle + secBlog + secFim,
  });
}

/* ==========================================================================
   SCHEMA.ORG — a ficha do Google

   `LocalBusiness` de verdade, com endereço e horário vindos do painel. É
   justamente o que as páginas de franquia dos concorrentes NÃO têm: a delas
   descreve a rede, não a loja de Caruaru.

   Campo vazio não entra. Um `address` com "preencha no painel" dentro é pior
   que nenhum: o Google lê, mostra e ninguém percebe.
   ========================================================================== */
function jsonldLoja(perguntas = []) {
  const nome = txt("marca.nome", "Alafcell Assistec");
  const rua = txt("loja.endereco", "");
  const preenchido = rua && !/preencha/i.test(rua);

  const ficha = {
    "@type": ["LocalBusiness", "MobilePhoneStore"],
    "@id": `${SITE}/#loja`,
    name: nome,
    url: SITE + "/",
    image: SITE + "/assets/img/og.png",
    description: txt("marca.slogan", ""),
    priceRange: "$$",
  };
  const tel = txt("marca.telefone", "");
  if (tel) ficha.telephone = tel;
  if (preenchido) {
    ficha.address = {
      "@type": "PostalAddress",
      streetAddress: rua,
      addressLocality: txt("loja.cidade", "Caruaru"),
      addressRegion: txt("loja.uf", "PE"),
      postalCode: txt("loja.cep", ""),
      addressCountry: "BR",
    };
  }
  const lat = txt("loja.latitude", ""), lon = txt("loja.longitude", "");
  if (lat && lon) ficha.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lon };

  const horas = txt("loja.horario_dados", "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (horas.length) ficha.openingHours = horas;

  const insta = txt("marca.instagram", "");
  if (insta) ficha.sameAs = [insta];

  /* ------------------------------------------------------------------------
     ONDE A LOJA ATENDE

     A busca local é decidida por proximidade, e o site inteiro só dizia
     "Caruaru". Quem procura "conserto de celular em Toritama" não encontrava
     uma assistência que vai buscar o aparelho lá.

     A lista sai do painel porque é uma promessa operacional: cidade listada é
     cidade onde a busca e leva vai de verdade. Uma cidade a mais aqui é uma
     viagem a mais amanhã, e quem decide isso é a loja.
     ------------------------------------------------------------------------ */
  const cidades = txt("loja.atende", "").split("\n")
    .map((c) => c.trim()).filter(Boolean).slice(0, 20);
  if (cidades.length) {
    ficha.areaServed = cidades.map((c) => ({
      "@type": "City", name: c, address: {
        "@type": "PostalAddress", addressLocality: c,
        addressRegion: txt("loja.uf", "PE"), addressCountry: "BR" },
    }));
  }

  /* ------------------------------------------------------------------------
     O CATÁLOGO DE SERVIÇOS

     Os oito consertos deixaram de ter página própria na 0.4.0, e com isso
     sumiram da leitura do buscador: ele via uma landing genérica onde havia
     oito serviços nomeados. O catálogo devolve essa informação SEM criar
     página nenhuma — que é exatamente a restrição do site atual.

     Sem preço, de propósito: o cliente tirou preço de conserto do site
     inteiro, e um `Offer` com valor aqui reporia pela porta dos fundos o que
     ele mandou tirar da tela.
     ------------------------------------------------------------------------ */
  const servicos = Pub.servicos(20);
  if (servicos.length) {
    ficha.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `Consertos — ${nome}`,
      itemListElement: servicos.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.nome,
          /* `semHtml`: a chamada é campo formatado no painel, e marcação dentro
             de dado estruturado é lida como texto — o cliente veria "<b>" no
             resultado da busca. */
          description: semHtml(s.chamada || ""),
          serviceType: s.nome,
          provider: { "@id": `${SITE}/#loja` },
          ...(cidades.length ? { areaServed: cidades.map((c) => ({ "@type": "City", name: c })) } : {}),
        },
      })),
    };
  }

  /* ------------------------------------------------------------------------
     A ORGANIZAÇÃO E O SITE

     Duas entidades a mais no mesmo grafo, ligadas por `@id`. A `Organization`
     com `logo` é o que alimenta o painel de conhecimento (o quadro à direita
     na busca); o `WebSite` é o que dá nome ao site em vez de o buscador
     deduzir do domínio.

     NÃO ENTRA AQUI `aggregateRating` nem `review`. Avaliação do próprio
     negócio na própria página é "self-serving review": o Google não exibe
     estrela para isso em LocalBusiness desde 2019, então a marcação daria
     trabalho e nenhuma estrela. E republicar como conteúdo do site as
     avaliações que vieram da API deles seria apresentar como nosso o que é da
     ficha do Google. O lugar dessas estrelas é o Google Business Profile.
     ------------------------------------------------------------------------ */
  const logo = SITE + "/assets/img/og.png";
  const organizacao = {
    "@type": "Organization",
    "@id": `${SITE}/#organizacao`,
    name: nome,
    url: SITE + "/",
    logo: { "@type": "ImageObject", url: logo },
    ...(insta ? { sameAs: [insta] } : {}),
    ...(tel ? { telephone: tel } : {}),
  };
  const website = {
    "@type": "WebSite",
    "@id": `${SITE}/#site`,
    url: SITE + "/",
    name: nome,
    inLanguage: "pt-BR",
    publisher: { "@id": `${SITE}/#organizacao` },
  };
  ficha.parentOrganization = { "@id": `${SITE}/#organizacao` };

  const grafo = [ficha, organizacao, website];

  /* ------------------------------------------------------------------------
     FAQPage — o rich result que este site pode ganhar

     Diferente de `aggregateRating`, que o Google não exibe para o próprio
     negócio na própria página, o bloco de perguntas continua sendo mostrado. É
     o retorno de SEO mais alto disponível para uma landing de página única.

     Só entra o que ESTÁ NA TELA: marcar pergunta que o visitante não encontra
     na página é a definição de dado estruturado enganoso, e derruba o site
     inteiro do recurso. Por isso a lista vem da mesma variável que desenhou a
     seção, e não de uma consulta própria que poderia divergir dela.

     A resposta vai com a marcação de formatação: o Google aceita HTML simples
     em `acceptedAnswer` e o texto já passou pela peneira na gravação.
     ------------------------------------------------------------------------ */
  if (perguntas.length) {
    grafo.push({
      "@type": "FAQPage",
      "@id": `${SITE}/#perguntas`,
      mainEntity: perguntas.map((f) => ({
        "@type": "Question",
        name: semHtml(f.pergunta || ""),
        acceptedAnswer: { "@type": "Answer", text: f.resposta || "" },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": grafo };
}

/* ==========================================================================
   404

   Página de verdade, com o menu e caminhos de saída. Um 404 sem saída manda
   o visitante de volta ao Google, e ele não volta.
   ========================================================================== */
function erro404(req) {
  return L.pagina({
    req,
    titulo: "Página não encontrada",
    descricao: "Esta página não existe ou mudou de endereço.",
    canonical: "/",
    corpo: `
<section class="secao">
  <div class="env env--fino" style="text-align:center">
    <p class="rotulo" style="justify-content:center">${engrenagem("", 12)}Erro 404</p>
    <h1 class="titulo">Esta página <em>não existe</em></h1>
    <p class="sub" style="margin-inline:auto">Ou ela mudou de endereço. Estes caminhos funcionam:</p>
    <div class="hero__acoes" style="justify-content:center">
      <!-- Depois da 0.4.0 o site tem dois destinos, e o 404 só pode oferecer
           esses dois. Oferecer /consertos/ e /loja/ daqui era mandar quem já
           se perdeu para outro 404. -->
      <a class="btn btn--acao" href="/">Voltar ao início</a>
      <a class="btn btn--linha" href="/blog/">Ler o blog</a>
    </div>
  </div>
</section>`,
  });
}

module.exports = { home, erro404, jsonldLoja, prazoTexto, apartirDe, icone };
