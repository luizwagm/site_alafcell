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
const { Q, ajuste } = require("./db");

/* ==========================================================================
   TEXTOS

   `grupo` é a tela do painel. `ordem` é a posição dentro dela. Os dois existem
   para o /admin não virar uma lista de cem campos soltos onde o cliente não
   acha o telefone.
   ========================================================================== */
function textos() {
  const T = (chave, valor, grupo, rotulo, tipo = "texto", ordem = 0, ajuda = "") =>
    ajuste(chave, valor, { grupo, rotulo, tipo, ordem, ajuda });

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

  /* ---------------------------------------------------------------- topo */
  T("home.rotulo", "Assistência técnica especializada · Caruaru", "home", "Rótulo acima do título", "texto", 1);
  T("home.titulo", "Seu celular de volta<br><em>no mesmo dia</em>", "home", "Título do topo", "area", 2,
    "O que estiver entre <em> e </em> sai em vermelho. Use <br> para quebrar a linha.");
  T("home.texto",
    "Tela, bateria, conector de carga, câmera e placa. Diagnóstico na sua frente, preço fechado antes de abrir o aparelho e garantia por escrito.",
    "home", "Texto de apresentação", "area", 3);
  T("home.btn1", "Ver preços dos consertos", "home", "Botão principal", "texto", 4);
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

function semear() {
  textos();
  servicos();
  aparelhos();
}

module.exports = { semear };
