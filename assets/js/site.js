"use strict";
/* ==========================================================================
   ALAFCELL — comportamento do site

   Regra que vale para o arquivo inteiro: NADA AQUI É NECESSÁRIO PARA VER OU
   COMPRAR. O menu do celular abre por JavaScript, mas os mesmos links estão no
   rodapé; a busca por aparelho é um <form> com GET, que envia sem script; a
   revelação na rolagem só existe se a classe `js` entrou no <html>.

   Numa assistência técnica isso não é purismo. Metade do público chega de um
   celular com a tela trincada, bateria ruim e internet de dados — que é
   exatamente o cenário em que um script grande falha.
   ========================================================================== */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ------------------------------------------------------- menu do celular */
  const botao = $(".topo__menu");
  const menu = $("#nav-movel");
  if (botao && menu) {
    botao.addEventListener("click", function () {
      const aberto = botao.getAttribute("aria-expanded") === "true";
      botao.setAttribute("aria-expanded", String(!aberto));
      menu.hidden = aberto;
    });
    /* Esc fecha e devolve o foco ao botão — sem isso quem abriu por teclado
       fica preso dentro do menu. */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && botao.getAttribute("aria-expanded") === "true") {
        botao.setAttribute("aria-expanded", "false");
        menu.hidden = true;
        botao.focus();
      }
    });
  }

  /* ------------------------------------------------------ topo ao rolar
     Só troca uma classe. Nada de medir altura nem mexer em posição: cabeçalho
     que encolhe na rolagem empurra o conteúdo e faz a página tremer. */
  const topo = $(".topo");
  if (topo) {
    let ultimo = null;
    const marcar = () => {
      const rolado = window.scrollY > 12;
      if (rolado !== ultimo) { topo.classList.toggle("topo--rolado", rolado); ultimo = rolado; }
    };
    marcar();
    addEventListener("scroll", marcar, { passive: true });
  }

  /* --------------------------------------------------- revelar na rolagem
     IntersectionObserver, e não evento de scroll: o navegador avisa quando o
     bloco entra na tela, em vez de o site perguntar sessenta vezes por segundo.

     Sem suporte ao observador, tudo aparece de uma vez — que é o estado certo,
     não o estado quebrado. */
  const blocos = $$("[data-revela]");
  if (blocos.length) {
    if (!("IntersectionObserver" in window)) {
      blocos.forEach((b) => b.classList.add("revelado"));
    } else {
      const obs = new IntersectionObserver((entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("revelado");
          obs.unobserve(e.target);      /* revelou, acabou: não observa para sempre */
        }
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
      blocos.forEach((b) => obs.observe(b));
    }
  }

  /* ------------------------------------------------- some com o WhatsApp
     O botão flutuante fica em cima do teclado do celular e tampa justamente o
     campo que a pessoa está preenchendo. Sai de cena enquanto ela digita. */
  document.addEventListener("focusin", function (e) {
    if (e.target.matches("input, textarea, select")) document.body.classList.add("digitando");
  });
  document.addEventListener("focusout", function () {
    document.body.classList.remove("digitando");
  });

  /* ==========================================================================
     MARCA → MODELO

     O segundo seletor é preenchido depois de escolher a marca. Sem script, ele
     continua ali com "Todos os modelos" e o formulário funciona — a página de
     consertos aceita só a marca.

     A lista vem por fetch e não impressa no HTML: são mais de quarenta modelos
     hoje e a tendência é crescer, e despejar todos em cada página custaria
     peso em toda visita para servir a uma minoria que usa o filtro.
     ========================================================================== */
  const selMarca = $("[data-busca-marca]");
  const selModelo = $("[data-busca-modelo]");
  if (selMarca && selModelo) {
    const encher = function (lista, escolhido) {
      selModelo.innerHTML = '<option value="">Todos os modelos</option>'
        + lista.map((m) =>
            '<option value="' + m.slug + '"' + (m.slug === escolhido ? " selected" : "") + '>'
            + m.nome.replace(/[<>&]/g, "") + "</option>").join("");
    };

    selMarca.addEventListener("change", function () {
      const marca = selMarca.value;
      if (!marca) { encher([]); return; }
      selModelo.disabled = true;
      fetch("/api/modelos?marca=" + encodeURIComponent(marca))
        .then((r) => (r.ok ? r.json() : { modelos: [] }))
        .then((d) => encher(d.modelos || []))
        /* Falhou a rede? O seletor volta vazio com "Todos os modelos", e o
           formulário continua enviando a marca. Perde-se o refino, não a
           busca. */
        .catch(() => encher([]))
        .finally(() => { selModelo.disabled = false; });
    });
  }
})();

/* ==========================================================================
   COPIAR O PIX

   O código copia e cola tem mais de cem caracteres. Selecionar isso à mão no
   celular, com o teclado abrindo e o campo rolando, é onde o pagamento morre.

   O `<textarea>` continua na tela e selecionável: quem estiver sem clipboard
   (navegador antigo, conexão sem HTTPS) ainda copia do jeito de sempre. O
   botão é atalho, não a única porta.
   ========================================================================== */
(function () {
  document.addEventListener("click", function (e) {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    const alvo = document.querySelector(b.dataset.copiar);
    if (!alvo) return;

    const rotulo = b.textContent;
    const avisar = (txt) => {
      b.textContent = txt;
      setTimeout(() => { b.textContent = rotulo; }, 2200);
    };

    /* `navigator.clipboard` só existe em contexto seguro (https ou localhost).
       No endereço de trabalho por http ele é `undefined` — e sem esta volta o
       botão simplesmente não faria nada, sem nenhum aviso. */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(alvo.value || alvo.textContent)
        .then(() => avisar("Copiado!"))
        .catch(() => { alvo.select(); avisar("Selecionado — use Ctrl+C"); });
    } else {
      alvo.select();
      alvo.setSelectionRange(0, 99999);          /* iOS ignora o select() sozinho */
      try {
        document.execCommand("copy");
        avisar("Copiado!");
      } catch (err) { avisar("Selecionado — use Ctrl+C"); }
    }
  });
})();
