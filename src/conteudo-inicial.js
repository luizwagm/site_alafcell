"use strict";
/* ==========================================================================
   CONTEÚDO INICIAL

   O que este arquivo faz é o site NASCER CHEIO. Um site que sobe vazio parece
   quebrado — o cliente abre, vê caixas em branco e conclui que não ficou
   pronto, quando na verdade só falta ele preencher.

   Duas regras que valem para tudo aqui:

   1. NADA SOBRESCREVE O QUE JÁ EXISTE. `ajuste` só grava a chave que falta, e
      as listas só entram com a tabela vazia. Sem isso, cada reinício do
      serviço apagaria o texto que o cliente escreveu — que é o pior defeito
      possível num CMS, porque só aparece dias depois.

   2. DADO QUE EU NÃO TENHO ENTRA COMO PLACEHOLDER VISÍVEL, e não inventado.
      Endereço, telefone, horário e CNPJ ficam marcados para preencher no
      painel. Inventar um endereço plausível é pior que deixar em branco: ele
      vai para o Google Meu Negócio e para o JSON-LD, e ninguém percebe que
      está errado até um cliente ir ao lugar errado.
   ========================================================================== */
const { Q, ajuste, semearTexto, completarSeVazio, atualizarSeIntocado } = require("./db");

/* ==========================================================================
   TEXTOS

   `grupo` é a tela do painel. `ordem` é a posição dentro dela. Os dois existem
   para o /admin não virar uma lista de cem campos soltos onde o cliente não
   acha o telefone.
   ========================================================================== */
function textos() {
  /* `semearTexto` e NAO `ajuste`: esta funcao roda a cada entrega (o
     `deploy.sh` chama `semear()`), e `ajuste` sobrescreve o valor. Com ele
     aqui, toda entrega apagava o que o cliente tinha escrito no painel —
     endereco, telefone, horario, os textos de todas as secoes — e ele
     encontrava o padrao de volta no dia seguinte, sem nenhum aviso.

     O metadado (rotulo, ajuda, grupo, ordem) continua sendo atualizado: ele e
     nosso, e melhora a cada versao. O VALOR e do cliente. */
  const T = (chave, valor, grupo, rotulo, tipo = "texto", ordem = 0, ajuda = "") =>
    semearTexto(chave, valor, { grupo, rotulo, tipo, ordem, ajuda });

  /* ------------------------------------------------------------ a empresa */
  T("marca.nome", "Alafcell Assistec", "marca", "Nome da empresa", "texto", 1);
  T("marca.slogan", "Assistência técnica especializada em Caruaru. A gente busca, conserta e devolve.",
    "marca", "Frase da marca", "area", 2);
  T("marca.whatsapp", "", "marca", "WhatsApp (com 55 e DDD, só números)", "texto", 3,
    "Exemplo: 5581999998888. É o número que abre em todos os botões do site.");
  T("marca.telefone", "", "marca", "Telefone para exibição", "texto", 4,
    "Como deve aparecer escrito: (81) 99999-8888");
  T("marca.email", "", "marca", "E-mail de contato", "texto", 5);
  T("marca.instagram", "https://www.instagram.com/alafcell_assistec/", "marca", "Instagram", "url", 6);
  T("marca.cnpj", "00.000.000/0001-00", "marca", "CNPJ", "texto", 7,
    "Aparece no rodapé e no cadastro do Google. Preencha com o CNPJ real.");

  /* ------------------------------------------------------- como funciona
     Quatro passos, cada um com título e descrição próprios. Estavam fixos no
     `paginas.js`; agora o dono ajusta a promessa que a loja faz — e é ele quem
     responde por ela no balcão. */
  T("etapas.titulo", "Quatro passos, <em>nenhuma surpresa</em>", "etapas",
    "Título da seção", "texto", 1,
    "Pode usar <em> para destacar um trecho.");
  T("etapas.1_titulo", "Você chama", "etapas", "Passo 1 — título", "texto", 2);
  T("etapas.1_texto", "WhatsApp ou o balcão. Diz o aparelho e o que houve — "
    + "com foto, se der. A resposta vem no mesmo dia.", "etapas", "Passo 1 — texto", "area", 3);
  T("etapas.2_titulo", "A gente busca ou você traz", "etapas", "Passo 2 — título", "texto", 4);
  T("etapas.2_texto", "A coleta é gratuita em Caruaru, no horário que você marcar. "
    + "Se preferir, deixe o aparelho aqui na loja — atendemos no balcão sem hora marcada.",
    "etapas", "Passo 2 — texto", "area", 5);
  T("etapas.3_titulo", "Diagnóstico e orçamento", "etapas", "Passo 3 — título", "texto", 6);
  T("etapas.3_texto", "Testamos o aparelho e dizemos o que ele tem, o que custa e "
    + "quanto tempo leva. Só abrimos depois do seu ok — e se você desistir, não paga nada.",
    "etapas", "Passo 3 — texto", "area", 7);
  T("etapas.4_titulo", "Conserto e devolução", "etapas", "Passo 4 — título", "texto", 8);
  T("etapas.4_texto", "Consertado, testado na sua frente e de volta na sua mão, "
    + "com a garantia por escrito no comprovante.", "etapas", "Passo 4 — texto", "area", 9);

  /* ------------------------------------------------------ por que confiar
     Os três motivos eram literais no código. O da garantia continua lendo o
     prazo de `legal.garantia`, para o número não viver em dois lugares e
     divergir no dia em que a loja mudar a política. */
  T("confianca.rotulo", "Por que confiar", "confianca", "Rótulo pequeno", "texto", 1);
  T("confianca.titulo", "Do jeito que a gente <em>gostaria</em> de ser atendido",
    "confianca", "Título da seção", "texto", 2, "Pode usar <em> para destacar.");
  T("confianca.sub", "Sem promessa que o balcão desmente depois.", "confianca",
    "Frase de apoio", "area", 3);
  T("confianca.foto", "/assets/img/banco/bancada.webp", "confianca", "Foto da seção", "imagem", 4,
    "Foto larga (proporção 3x2). Aparece ao lado do título.");
  T("confianca.foto_alt", "Técnico da Alafcell trabalhando em um aparelho aberto na bancada",
    "confianca", "Descrição da foto", "area", 5,
    "Lido por quem usa leitor de tela e mostrado se a imagem não carregar.");
  T("confianca.1_titulo", "Garantia por escrito", "confianca", "Motivo 1 — título", "texto", 6);
  T("confianca.1_texto", "na peça e no serviço, impressa no comprovante que você leva — "
    + "não no \"confia\". Deu problema no prazo, a gente resolve sem discussão.",
    "confianca", "Motivo 1 — texto", "area", 7,
    "O prazo entra automaticamente no começo da frase, vindo de Garantia → prazo.");
  T("confianca.2_titulo", "Você aprova antes", "confianca", "Motivo 2 — título", "texto", 8);
  T("confianca.2_texto", "O aparelho só é aberto depois do orçamento fechado. "
    + "Se o conserto não compensar, a gente diz — e você não paga a avaliação.",
    "confianca", "Motivo 2 — texto", "area", 9);
  T("confianca.3_titulo", "Peça com procedência", "confianca", "Motivo 3 — título", "texto", 10);
  T("confianca.3_texto", "Você escolhe entre original e paralela de primeira linha "
    + "sabendo a diferença de preço e de garantia, antes de decidir.",
    "confianca", "Motivo 3 — texto", "area", 11);

  /* ---------------------------------------------------------------- blog */
  T("blog.rotulo", "Blog", "blog", "Rótulo pequeno", "texto", 1);
  T("blog.titulo", "Antes de gastar, <em>leia</em>", "blog", "Título na página inicial",
    "texto", 2, "Pode usar <em> para destacar.");
  T("blog.capa_titulo", "Antes de gastar, <em>leia</em>", "blog", "Título da página /blog/",
    "texto", 3);
  T("blog.capa_texto", "O que a gente explica no balcão todo dia, escrito para você "
    + "decidir sozinho — inclusive quando a resposta é não consertar.",
    "blog", "Texto da página /blog/", "area", 4);

  /* ------------------------------------------------- o que o Google diz
     A NOTA e o TOTAL são digitados, e não buscados: a API de avaliações do
     Google é paga e exige cadastro. Digitado tem um custo — envelhece — e por
     isso o painel avisa para conferir de vez em quando. O link leva à busca
     real, onde qualquer um confere o número na hora. */
  T("google.rotulo", "O que dizem", "google", "Rótulo pequeno", "texto", 1);
  T("google.titulo", "Quem já passou por aqui <em>recomenda</em>", "google",
    "Título da seção", "texto", 2);
  T("google.nota", "5,0", "google", "Nota no Google", "texto", 3,
    "Exemplo: 5,0. Deixe em branco para esconder o selo da nota.");
  T("google.total", "38", "google", "Quantas avaliações", "texto", 4,
    "Exemplo: 42. Aparece ao lado da nota.");
  /* O LINK DA FICHA, pelo CID e nao pelo endereco longo do Maps: o CID
     identifica o LUGAR e continua valendo quando o Google reescreve a URL —
     e ele reescreve. */
  T("google.link", "https://maps.google.com/?cid=1757333140515284266",
    "google", "Link para as avaliações", "url", 5,
    "O endereço da sua ficha no Google. O selo vira link para ele.");
  T("google.place_id", "", "google", "Place ID da loja", "texto", 6,
    "O identificador da sua ficha no Google Maps — começa com \"ChIJ\". "
    + "Com ele e a chave abaixo, as avaliações são buscadas direto do Google.");
  T("google.chave_api", "", "google", "Chave da API do Google", "texto", 7,
    "Criada no Google Cloud, com a \"Places API\" ativada. A chave é sua e a "
    + "cobrança também — o site consulta uma vez por dia, não a cada visita.");

  /* --------------------------------------------------------------- a loja */
  T("loja.endereco", "Preencha o endereço no painel", "loja", "Endereço completo", "area", 1,
    "Rua, número, bairro, cidade e CEP. É este texto que vai para o Google Maps e para o Schema.org.");
  T("loja.bairro", "", "loja", "Bairro", "texto", 2);
  T("loja.cidade", "Caruaru", "loja", "Cidade", "texto", 3);
  T("loja.uf", "PE", "loja", "Estado (sigla)", "texto", 4);
  T("loja.cep", "", "loja", "CEP", "texto", 5);
  T("loja.horario", "Preencha o horário no painel", "loja", "Horário de funcionamento", "area", 6,
    "Como o cliente lê: Segunda a sexta, 8h às 18h · Sábado, 8h às 12h");
  T("loja.horario_dados", "", "loja", "Horário para o Google (opcional)", "area", 7,
    "Uma linha por faixa, no formato: Mo-Fr 08:00-18:00. Serve para o Schema.org; sem isto o site usa só o texto acima.");
  T("loja.mapa", "", "loja", "Link do Google Maps", "url", 8);
  T("loja.latitude", "", "loja", "Latitude", "texto", 9);
  T("loja.longitude", "", "loja", "Longitude", "texto", 10);
  T("loja.atende", "Caruaru\nToritama\nBezerros\nGravatá\nSanta Cruz do Capibaribe\nBelo Jardim\nSão Caetano\nAgrestina",
    "loja", "Cidades atendidas", "area", 11,
    "Uma cidade por linha. Vão para a ficha que o Google lê (\"atende também\") "
    + "e para o rodapé. Quem procura \"conserto de celular em Toritama\" não "
    + "encontra uma loja que só diz Caruaru — esta lista é o que abre essas buscas. "
    + "Só ponha cidade onde a busca e leva vai de verdade.");

  /* ------------------------------------------------------- o que sai no Google
     As duas linhas que a pessoa lê ANTES de clicar. Estavam escritas no código
     — e continuavam prometendo preço na tela e loja de aparelhos, removidos do
     site na 0.4.0. Promessa que a página não cumpre faz quem clica voltar em
     segundos, e esse retorno derruba a posição. */
  /* 50 caracteres, e comeca pelo que a pessoa digitou: o buscador destaca em
     negrito o trecho que casa com a busca, e o comeco e o que sobrevive ao
     corte em tela pequena. */
  T("seo.titulo", "Conserto de celular em Caruaru — Alafcell Assistec",
    "seo", "Título no Google (home)", "texto", 1,
    "Até 60 caracteres. Vazio usa \"<nome da empresa> — <frase da marca>\". "
    + "Comece pelo que a pessoa digita: \"Assistência técnica de celular em Caruaru\".");
  T("seo.descricao",
    /* 141 caracteres. O Google corta perto de 155, e o corte cai no meio da
       frase — a chamada morre justo onde deveria convencer. */
    "Conserto de celular em Caruaru: tela, bateria e conector. "
    + "A gente busca no seu endereço, conserta e devolve. Orçamento gratuito pelo WhatsApp.",
    "seo", "Descrição no Google (home)", "area", 2,
    "Entre 120 e 155 caracteres — mais que isso o Google corta. Só prometa o que "
    + "a página entrega: promessa não cumprida faz a pessoa voltar, e voltar "
    + "derruba a posição na busca.");

  /* ---------------------------------------------------------------- topo */
  T("home.rotulo", "Conserto de celular · Caruaru e região", "home", "Rótulo acima do título", "texto", 1);
  T("home.titulo", "Conserto de celular em Caruaru,<br>com o aparelho de volta <em>no mesmo dia</em>",
    "home", "Título do topo", "area", 2,
    "O que estiver entre <em> e </em> sai em vermelho. Use <br> para quebrar a linha.");
  T("home.texto",
    "Tela, bateria, conector de carga, câmera e placa. Diagnóstico na sua frente, preço fechado antes de abrir o aparelho e garantia por escrito.",
    "home", "Texto de apresentação", "area", 3);
  T("home.btn1", "Pedir orçamento", "home", "Botão principal", "texto", 4);
  T("home.btn2", "Buscar meu aparelho", "home", "Botão secundário", "texto", 5);

  T("home.n1_valor", "24h", "home", "Número 1 — valor", "texto", 10);
  T("home.n1_rotulo", "prazo médio dos consertos mais pedidos", "home", "Número 1 — legenda", "texto", 11);
  T("home.n2_valor", "90 dias", "home", "Número 2 — valor", "texto", 12);
  T("home.n2_rotulo", "de garantia no serviço e na peça", "home", "Número 2 — legenda", "texto", 13);
  T("home.n3_valor", "Grátis", "home", "Número 3 — valor", "texto", 14);
  T("home.n3_rotulo", "busca e leva em Caruaru", "home", "Número 3 — legenda", "texto", 15);

  /* -------------------------------------------------------- busca e leva */
  T("coleta.titulo", "A gente vai até você", "coleta", "Título da seção", "texto", 1);
  T("coleta.texto",
    "Você não precisa sair de casa nem fechar a loja para consertar o celular. A gente busca, leva para a bancada, manda o orçamento pelo WhatsApp e devolve na sua mão.",
    "coleta", "Texto", "area", 2);
  T("coleta.area", "Caruaru e região", "coleta", "Área atendida", "texto", 3);
  T("coleta.aviso", "Coleta gratuita dentro de Caruaru. Combinamos o horário pelo WhatsApp.",
    "coleta", "Observação da coleta", "area", 4);

  /* ---------------------------------------------------------- pagamento
     A chave Pix monta o código copia e cola do checkout. Em branco, a tela do
     pedido mostra "combine pelo WhatsApp" — nunca um código quebrado, que
     parece funcionar e o banco recusa. */
  T("pagamento.pix_chave", "", "pagamento", "Chave Pix da loja", "texto", 1,
    "CPF, CNPJ, telefone, e-mail ou chave aleatória. É ela que recebe o dinheiro dos pedidos do site.");
  T("pagamento.pix_nome", "", "pagamento", "Nome do recebedor", "texto", 2,
    "Como aparece no aplicativo do banco de quem vai pagar. Até 25 caracteres, sem acento.");
  T("pagamento.cartao", "Parcelamos no cartão em até 12x na loja e na entrega.",
    "pagamento", "Texto sobre cartão", "area", 3);

  /* ------------------------------------------------------------- medição */
  T("medicao.ga4", "", "medicao", "ID do Google Analytics 4", "texto", 1,
    "Formato G-XXXXXXXXXX. Em branco, nada é carregado.");
  T("medicao.pixel", "", "medicao", "ID do Meta Pixel", "texto", 2,
    "Só números. Em branco, nada é carregado.");

  /* ------------------------------------------------------------ políticas */
  T("legal.garantia", "90 dias", "legal", "Prazo de garantia padrão", "texto", 1);
  T("legal.privacidade_email", "", "legal", "E-mail do encarregado de dados (LGPD)", "texto", 2);
}

/* ==========================================================================
   SERVIÇOS

   Os oito consertos que respondem por quase toda a procura de uma assistência
   de celular. Entram só se a tabela estiver vazia.

   `sintomas` é o campo que faz este site ser achado. O cliente não busca
   "substituição de conector de carga" — ele busca "meu celular não carrega".
   Guardar as duas formas separadas deixa o título técnico na tela e a frase
   do cliente no texto, sem transformar a página num amontoado de palavra-chave.
   ========================================================================== */
function servicos() {
  if (Q.um("SELECT COUNT(*) c FROM servicos").c) return;

  const lista = [
    ["troca-de-tela", "Troca de tela", "tela", "O conserto mais pedido, e o que mais tem peça ruim no mercado.",
      "Tela trincada, manchada, com linha vertical, sem toque ou apagada.\nTrabalhamos com display original e com paralelo de primeira linha — você escolhe sabendo a diferença de preço e de garantia, antes de a gente abrir o aparelho.",
      "A tela trincou\nApareceu uma mancha roxa ou preta\nO toque não responde em parte da tela\nLinha colorida atravessando a tela\nA tela apagou mas o celular liga", 24, 90, "tela", 1, 1],
    ["troca-de-bateria", "Troca de bateria", "bateria", "Quando o celular não passa da tarde.",
      "Bateria é peça de consumo: depois de uns dois anos ela perde capacidade e o aparelho começa a desligar sozinho, esquentar e cair de porcentagem de repente. A troca resolve em poucas horas e devolve o dia inteiro de uso.",
      "Descarrega muito rápido\nDesliga sozinho com carga\nCai de 40% para 5% de uma vez\nEsquenta demais\nA bateria estufou", 4, 90, "bateria", 1, 2],
    ["conector-de-carga", "Conector de carga", "carga", "Não carrega, ou só carrega numa posição.",
      "Quase sempre o problema é o conector cheio de sujeira ou com os pinos desgastados — e não a bateria. Fazemos a limpeza e o teste antes de propor a troca, porque trocar o que não era o defeito é o jeito mais rápido de perder um cliente.",
      "Não carrega\nSó carrega se segurar o cabo\nO cabo entra frouxo\nCarrega muito devagar\nO computador não reconhece o aparelho", 6, 90, "carga", 1, 3],
    ["camera", "Câmera", "camera", "Foto embaçada, lente trincada ou câmera que não abre.",
      "Trocamos o módulo da câmera e o vidro que a protege. Muita gente troca o aparelho inteiro por causa de uma lente riscada de vinte reais.",
      "Foto saindo embaçada\nO vidro da câmera trincou\nA câmera não abre\nAparece um borrão na foto\nO flash não acende", 24, 90, "camera", 0, 4],
    ["alto-falante-microfone", "Som e microfone", "audio", "Quando a ligação vira um problema.",
      "Alto-falante sem volume, auricular abafado ou microfone que a outra pessoa não escuta. Costuma ser sujeira acumulada — e quando não é, a peça é barata.",
      "Ninguém me escuta na ligação\nO som saiu baixo\nNão escuto quem está do outro lado\nO som está chiando\nO fone de ouvido não funciona", 8, 90, "audio", 0, 5],
    ["placa-e-molhado", "Placa e aparelho molhado", "placa", "O conserto que precisa de bancada de verdade.",
      "Aparelho que caiu na água, que não liga ou que entra em curto exige microssoldagem, e não troca de peça. É o serviço em que a diferença entre uma assistência e um balcão de troca de tela aparece.",
      "Caiu na água\nNão liga de jeito nenhum\nLiga e desliga sozinho\nEsquenta muito e desliga\nMolhou e parou depois de uns dias", 72, 90, "placa", 1, 6],
    ["software-e-desbloqueio", "Software e recuperação", "software", "Quando o aparelho está inteiro e mesmo assim não serve.",
      "Sistema travado na logo, atualização que deu errado, aparelho lento demais e recuperação de dados. Antes de qualquer coisa a gente tenta salvar o que está dentro — porque foto não tem peça de reposição.",
      "Travou na tela da marca\nEstá muito lento\nA atualização deu errado\nEsqueci a senha do aparelho\nPreciso recuperar minhas fotos", 24, 30, "software", 0, 7],
    ["vidro-traseiro", "Vidro traseiro", "tela", "A trinca que não atrapalha o uso mas derruba o valor de revenda.",
      "Troca da tampa de vidro. Barato de fazer, e faz diferença grande na hora de vender ou dar o aparelho de entrada.",
      "A traseira trincou\nO vidro de trás está estilhaçado\nEstá cortando a mão", 24, 90, "tela", 0, 8],
  ];

  const ins = Q.db.prepare(
    `INSERT INTO servicos (slug, nome, categoria, chamada, descricao, sintomas,
                           prazo_horas, garantia_dias, icone, destaque, ordem)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const s of lista) ins.run(...s);
}

/* ==========================================================================
   MARCAS E MODELOS

   Uma base curta e verdadeira do que circula em Caruaru, para a tabela de
   preços nascer com estrutura. NENHUM PREÇO É SEMEADO — preço inventado no
   site de uma assistência é promessa que o balcão vai ter de desmentir.
   A loja preenche no painel, e só aparece na tela o que ela preencheu.
   ========================================================================== */
function aparelhos() {
  if (Q.um("SELECT COUNT(*) c FROM marcas").c) return;

  const base = {
    samsung: ["Samsung", [
      ["Galaxy A03", 2022], ["Galaxy A04", 2022], ["Galaxy A13", 2022], ["Galaxy A14", 2023],
      ["Galaxy A15", 2024], ["Galaxy A20", 2019], ["Galaxy A30", 2019], ["Galaxy A32", 2021],
      ["Galaxy A34", 2023], ["Galaxy A54", 2023], ["Galaxy S21", 2021], ["Galaxy S23", 2023],
    ]],
    motorola: ["Motorola", [
      ["Moto E13", 2023], ["Moto E22", 2022], ["Moto G22", 2022], ["Moto G32", 2022],
      ["Moto G54", 2023], ["Moto G73", 2023], ["Moto G84", 2023], ["Edge 30", 2022],
    ]],
    xiaomi: ["Xiaomi", [
      ["Redmi 9A", 2020], ["Redmi 10", 2021], ["Redmi 12", 2023], ["Redmi Note 11", 2022],
      ["Redmi Note 12", 2023], ["Redmi Note 13", 2024], ["Poco X5", 2023],
    ]],
    apple: ["Apple", [
      ["iPhone 8", 2017], ["iPhone X", 2017], ["iPhone 11", 2019], ["iPhone 12", 2020],
      ["iPhone 13", 2021], ["iPhone 14", 2022], ["iPhone 15", 2023],
    ]],
    realme: ["Realme", [["Realme C53", 2023], ["Realme 11", 2023]]],
    lg: ["LG", [["LG K52", 2020], ["LG K62", 2020]]],
  };

  /* Os populares saem daqui, e não de um campo marcado a dedo em cada modelo:
     a lista curta da home é uma decisão de negócio ("o que mais chega na
     bancada"), e ela muda. Fica no painel, marcável. */
  const populares = new Set([
    "galaxy-a14", "galaxy-a54", "moto-g54", "redmi-note-12", "iphone-11", "iphone-13",
  ]);

  /* O intervalo dos acentos vai escrito em \u….  A mesma faixa digitada como
     caractere fica INVISÍVEL no editor — e uma regex que ninguém consegue ler
     é uma regex que ninguém consegue corrigir. */
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const insM = Q.db.prepare("INSERT INTO marcas (slug, nome, ordem) VALUES (?,?,?)");
  const insD = Q.db.prepare(
    "INSERT INTO modelos (marca_id, slug, nome, ano, popular, ordem) VALUES (?,?,?,?,?,?)");

  let i = 0;
  for (const [chave, [nome, modelos]] of Object.entries(base)) {
    const r = insM.run(chave, nome, i++);
    let j = 0;
    for (const [m, ano] of modelos) {
      const s = slug(m);
      insD.run(r.lastInsertRowid, s, m, ano, populares.has(s) ? 1 : 0, j++);
    }
  }
}

/* ==========================================================================
   AS AVALIACOES DA FICHA DO GOOGLE

   Nao sao exemplo: sao as tres primeiras de cinco estrelas da ficha
   ALAFCELL ASSISTEC no Google (nota 5,0 com 38 avaliacoes), lidas em
   07/09/2026. O texto e o que esta la.

   So o PRIMEIRO NOME de quem avaliou: nome completo e foto sao dados de um
   cliente que avaliou a LOJA, nao o site, e ninguem pediu autorizacao para
   publica-los aqui.

   `do_google: 1` porque foram copiadas da ficha — e por isso o cartao pode
   dizer "Avaliacao no Google", uma afirmacao que qualquer visitante confere
   clicando no selo.

   ATE A 0.10.x AQUI HAVIA TRES DE EXEMPLO, com "(AVALIACAO DE EXEMPLO)" no
   texto. Elas foram ao ar no servidor — o `deploy.sh` roda esta funcao a cada
   entrega, e cadastrar as reais so no banco local nao muda nada para o
   cliente. A limpeza abaixo as remove.

   Quando o Place ID e a chave da API forem preenchidos, estas somem sozinhas:
   com a busca ligada, o site so mostra o que veio direto do Google.
   ========================================================================== */
function avaliacoesExemplo() {
  /* SO NUMA INSTALACAO NOVA. `semear()` roda a cada subida do servidor — as
     outras funcoes daqui se protegem do mesmo jeito. Sem esta linha, cada
     reinicio empilha mais tres avaliacoes iguais no site do cliente, e as que
     ele apagar voltam sozinhas na proxima subida. */
  /* AS DE EXEMPLO SAEM. Elas ja subiram para o servidor com o texto
     "(AVALIACAO DE EXEMPLO — troque ou apague no painel)" a mostra na pagina.
     Sao registros SEMEADOS POR NOS, com marca propria no texto — nao conteudo
     do cliente. Selecionados pela marca, apagados PELO ID, um a um. */
  for (const velha of Q.todos(
    "SELECT id FROM avaliacoes WHERE texto LIKE '%AVALIACAO DE EXEMPLO%'")) {
    Q.roda("DELETE FROM avaliacoes WHERE id = ?", velha.id);
  }

  if (Q.um("SELECT COUNT(*) c FROM avaliacoes").c) return;

  const ins = Q.db.prepare(
    `INSERT INTO avaliacoes (autor, texto, estrelas, quando, ordem, ativo, do_google, criado)
     VALUES (?,?,5,?,?,1,1,?)`);
  const agora = new Date().toISOString();
  const base = [
    ["Cicero", "Ótimo ambiente, honesto e resolveu o problema do meu telefone.",
      "há 2 meses"],
    ["Robinho", "Muito bom trabalho. Estava ficando sem esperanças de recuperar o "
      + "meu telefone. Com muita paciência e profissionalismo, o cara deu um jeito. "
      + "Saí no mesmo dia com meu telefone.", "há 6 meses"],
    ["Júnior", "Compro direto acessório e faço serviço. Muito bom.", "há 1 mês"],
  ];
  base.forEach(([autor, texto, quando], i) => ins.run(autor, texto, quando, i, agora));
}

/* ==========================================================================
   AS PERGUNTAS FREQUENTES

   Estas oito sao as que uma assistencia responde no balcao o dia inteiro — e,
   nao por acaso, as que as pessoas digitam na busca. Ao contrario das
   avaliacoes de exemplo, estas NAO sao texto de espera: sao respostas de
   verdade, escritas para serem publicadas como estao e ajustadas onde a
   operacao for diferente.

   Sem preco em nenhuma resposta: o cliente tirou preco de conserto do site
   inteiro, e repor aqui seria devolver pela porta dos fundos o que ele mandou
   tirar da tela.
   ========================================================================== */
function faq() {
  if (Q.um("SELECT COUNT(*) c FROM faq").c) return;

  const ins = Q.db.prepare(
    "INSERT INTO faq (pergunta, resposta, ordem, ativo, criado) VALUES (?,?,?,1,?)");
  const agora = new Date().toISOString();
  const lista = [
    ["Quanto tempo demora para consertar o celular?",
     "<p>A maioria dos consertos fica pronta <b>no mesmo dia</b> — troca de tela, "
     + "bateria e conector de carga saem em algumas horas quando a peça está aqui. "
     + "Reparo de placa e aparelho que caiu na água levam mais tempo, porque "
     + "dependem do diagnóstico. Você recebe o prazo junto com o orçamento, antes "
     + "de a gente abrir o aparelho.</p>"],
    ["Vocês buscam o aparelho em casa?",
     "<p>Sim. A gente busca no seu endereço, conserta e devolve — você não precisa "
     + "sair. Se preferir, também pode trazer na loja e esperar. É só combinar pelo "
     + "WhatsApp o endereço e o horário.</p>"],
    ["O orçamento é cobrado?",
     "<p>Não. A avaliação do aparelho é gratuita e <b>você não paga nada se decidir "
     + "não consertar</b>. A gente passa o valor antes de mexer; se não compensar o "
     + "conserto, a gente fala isso também.</p>"],
    ["Qual é a garantia do conserto?",
     "<p>Todo serviço sai com garantia por escrito. O prazo vale para a peça trocada "
     + "e para a mão de obra — se o mesmo defeito voltar dentro do período, a gente "
     + "resolve sem cobrar de novo.</p>"],
    ["A peça é original?",
     "<p>Trabalhamos com peça original e com paralelo de primeira linha, e "
     + "<b>você escolhe sabendo a diferença</b> de preço e de garantia antes do "
     + "conserto. A gente não troca uma pela outra sem avisar.</p>"],
    ["Vou perder minhas fotos e conversas?",
     "<p>Nos consertos comuns — tela, bateria, conector, câmera — <b>nada é apagado</b>: "
     + "a gente não mexe na memória do aparelho. Em reparo de placa e em aparelho "
     + "molhado existe risco, e a gente avisa antes. Fazer um backup pelo Google ou "
     + "iCloud antes de deixar o aparelho é sempre a recomendação.</p>"],
    ["Vocês consertam celular que caiu na água?",
     "<p>Sim, e o tempo conta muito. <b>Não ligue e não coloque para carregar</b> — é "
     + "o que costuma queimar o que ainda estava bom. Traga o mais rápido possível "
     + "para a limpeza da placa; quanto antes chegar, maior a chance de recuperar.</p>"],
    ["Precisa agendar?",
     "<p>Não. Você pode chamar no WhatsApp a qualquer hora ou aparecer na loja no "
     + "horário de funcionamento. Para a busca e leva, aí sim a gente combina uma "
     + "janela de horário para o aparelho não ficar esperando.</p>"],
  ];
  lista.forEach(([p, r], i) => ins.run(p, r, i, agora));
}

/* ==========================================================================
   O CADASTRO DA LOJA — o que mais pesa numa busca local

   A ficha que o site publica para o Google tinha nome, endereco na tela e mais
   nada: sem telefone, sem coordenadas, sem CEP. Numa busca por "conserto de
   celular perto de mim", e exatamente isso que decide quem aparece — o
   buscador precisa saber ONDE fica e COMO chegar.

   Os valores abaixo sao PUBLICOS e verificaveis: estao na ficha ALAFCELL
   ASSISTEC do proprio Google (lida em 07/09/2026). Nao ha nada inventado aqui.

   `completarSeVazio` e nao `ajuste`: o que a loja tiver escrito fica como
   esta. Isto so preenche o que esta em branco — e um campo de contato em
   branco deixa o site pior sem que ninguem perceba.

   ⚠ O HORARIO NAO ENTRA. A ficha do Google diz "Aberto 24 horas", o que quase
   certamente e um cadastro errado dela, e o formato tecnico
   (`loja.horario_dados`) exige a semana inteira. Inventar horario de loja e
   mandar cliente para uma porta fechada. Fica para o dono preencher, e o
   verificador cobra.
   ========================================================================== */
function cadastroDaLoja() {
  const daFicha = {
    "loja.endereco": "Rua Benjamin Constant, 31\nSão Francisco",
    "loja.bairro": "São Francisco",
    "loja.cidade": "Caruaru",
    "loja.uf": "PE",
    "loja.cep": "55006-210",
    /* As coordenadas fazem o `geo` do Schema.org existir — é o que responde
       "perto de mim" sem depender de o buscador adivinhar pelo endereço. */
    "loja.latitude": "-8.291555",
    "loja.longitude": "-35.9770444",
    /* O link pelo CID identifica o LUGAR e sobrevive à reescrita da URL. */
    "loja.mapa": "https://maps.google.com/?cid=1757333140515284266",
    "marca.telefone": "(81) 99707-2502",
    "marca.whatsapp": "5581997072502",
  };
  for (const [chave, valor] of Object.entries(daFicha)) completarSeVazio(chave, valor);
}

/* ==========================================================================
   AS PALAVRAS QUE O CLIENTE DIGITA

   "conserto de celular" aparecia ZERO vezes na pagina. O site dizia
   "assistencia tecnica" — como o SETOR se descreve, nao como quem esta com o
   aparelho quebrado busca. Quem procura digita "conserto de celular caruaru",
   "tela quebrada", "celular molhado".

   Isto NAO e encher a pagina de palavra-chave (o buscador pune isso, e com
   razao): e chamar as coisas pelo nome que o cliente usa. Os textos ficam
   melhores de ler, nao piores.

   `atualizarSeIntocado` porque estes campos JA EXISTEM no banco de quem
   instalou antes: so muda o que ainda e exatamente o texto que escrevemos. Se
   o dono reescreveu, a redacao e dele.
   ========================================================================== */
function palavrasDeBusca() {
  const melhorias = [
    ["home.rotulo",
      "Assistência técnica especializada · Caruaru",
      "Conserto de celular · Caruaru e região"],
    ["home.titulo",
      "Seu celular de volta<br><em>no mesmo dia</em>",
      "Conserto de celular em Caruaru,<br>com o aparelho de volta <em>no mesmo dia</em>"],
    /* "tela quebrada" e "celular molhado" sao como o problema e descrito na
       busca — "tela" e "placa" sao como a loja o nomeia na bancada. */
    ["home.texto",
      "Tela, bateria, conector de carga, câmera e placa. Diagnóstico na sua frente, "
      + "preço fechado antes de abrir o aparelho e garantia por escrito.",
      "Tela quebrada, bateria viciada, conector de carga, câmera e celular molhado. "
      + "Diagnóstico na sua frente, preço fechado antes de abrir o aparelho e "
      + "garantia por escrito."],
  ];
  for (const [chave, antigo, novo] of melhorias) atualizarSeIntocado(chave, antigo, novo);
}

function semear() {
  textos();
  cadastroDaLoja();
  palavrasDeBusca();
  servicos();
  aparelhos();
  avaliacoesExemplo();
  faq();
}

module.exports = { semear };
