"use strict";
/* ==========================================================================
   CONTEÚDO DE DEMONSTRAÇÃO

   ---------------------------------------------------------------------------
   LEIA ISTO ANTES DE COLOCAR O SITE NO AR

   Tudo o que este arquivo cria é MATERIAL DE APRESENTAÇÃO: preços de conserto,
   produtos da loja, matérias do blog e uma ordem de serviço de exemplo. Serve
   para o cliente ver as telas cheias, decidindo sobre o que existe em vez de
   sobre caixas vazias.

   NADA AQUI É PREÇO REAL DA ALAFCELL. São valores de referência do mercado de
   Caruaru, plausíveis e redondos, escolhidos para a tela fazer sentido. Antes
   do site entrar no ar, cada linha precisa ser conferida e substituída no
   painel — preço errado no site de uma assistência é promessa que o balcão vai
   ter de desmentir na frente do cliente.

   Por isso duas travas:

   1. Só entra com a tabela VAZIA. Reiniciar o serviço nunca sobrescreve o que
      a loja cadastrou.
   2. Dá para não semear nada: `ALAFCELL_DEMO=nao` desliga este arquivo. É o
      que se usa na subida definitiva, para o site começar limpo.

   A ordem de serviço de exemplo (`DEMO-01`) existe para a tela de
   acompanhamento poder ser demonstrada. Ela também sai com `ALAFCELL_DEMO=nao`.
   ========================================================================== */
const { Q, txt, ajuste, centavos } = require("./db");

const LIGADO = String(process.env.ALAFCELL_DEMO || "").toLowerCase() !== "nao";

/* ==========================================================================
   PREÇOS

   A tabela é curta de propósito: os aparelhos que mais chegam à bancada, e não
   os 38 do catálogo. Preço em branco é informação — significa "traga que a
   gente orça", e é melhor que um número inventado para preencher a grade.

   Os valores estão em reais aqui e viram centavos na gravação: o painel também
   recebe reais, e as duas portas de entrada precisam se comportar igual.
   ========================================================================== */
const PRECOS = {
  /* modelo:            tela  bateria  carga  camera  audio  placa  software  vidro */
  "galaxy-a14":        [ 289,   149,    119,   169,    109,   249,    89,     129 ],
  "galaxy-a54":        [ 449,   189,    139,   229,    129,   329,    89,     169 ],
  "galaxy-a13":        [ 259,   139,    109,   159,    109,   249,    89,     119 ],
  "galaxy-s23":        [ 899,   299,    189,   389,    169,   549,   119,     299 ],
  "moto-g54":          [ 279,   159,    119,   179,    109,   259,    89,     139 ],
  "moto-g22":          [ 239,   139,    109,   149,     99,   249,    89,     119 ],
  "redmi-note-12":     [ 269,   149,    119,   169,    109,   259,    89,     129 ],
  "redmi-note-13":     [ 319,   159,    129,   189,    119,   279,    89,     139 ],
  "iphone-11":         [ 489,   239,    179,   299,    149,   449,   119,     249 ],
  "iphone-12":         [ 649,   259,    189,   339,    159,   499,   119,     279 ],
  "iphone-13":         [ 899,   289,    199,   399,    169,   549,   119,     329 ],
  "iphone-8":          [ 279,   189,    149,   219,    129,   349,    99,     169 ],
};
const ORDEM_SERVICOS = ["troca-de-tela", "troca-de-bateria", "conector-de-carga",
  "camera", "alto-falante-microfone", "placa-e-molhado", "software-e-desbloqueio",
  "vidro-traseiro"];

function precos() {
  if (Q.um("SELECT COUNT(*) c FROM precos").c) return;

  const servico = {};
  for (const s of Q.todos("SELECT id, slug FROM servicos")) servico[s.slug] = s.id;
  const modelo = {};
  for (const m of Q.todos("SELECT id, slug FROM modelos")) modelo[m.slug] = m.id;

  const ins = Q.db.prepare(
    "INSERT OR IGNORE INTO precos (modelo_id, servico_id, preco) VALUES (?,?,?)");

  for (const [slugModelo, valores] of Object.entries(PRECOS)) {
    const mid = modelo[slugModelo];
    if (!mid) continue;                     /* modelo saiu do catálogo: ignora */
    valores.forEach((v, i) => {
      const sid = servico[ORDEM_SERVICOS[i]];
      if (sid && v > 0) ins.run(mid, sid, centavos(v));
    });
  }
}

/* ==========================================================================
   LOJA

   Doze itens nas três categorias, com a proporção que uma assistência técnica
   de bairro realmente tem: poucos aparelhos novos, alguns seminovos (que é
   onde ela ganha margem) e bastante acessório de giro rápido.

   Os seminovos vêm com SAÚDE DA BATERIA e ESTADO preenchidos. É o que decide a
   compra de um usado, e é o campo que quase toda loja esconde.
   ========================================================================== */
const PRODUTOS = [
  ["smartphone", "novo", "samsung", "Samsung Galaxy A16 128 GB",
   "Tela 6.7\", 4 GB de RAM e bateria de 5000 mAh. Lacrado, com nota e garantia Samsung.",
   1299, 1499, { cor: "Preto", armazenamento: "128 GB", destaque: 1, estoque: 4 }],
  ["smartphone", "novo", "motorola", "Motorola Moto G15 128 GB",
   "Bateria de 5200 mAh e carregador turbo na caixa. Lacrado, com garantia Motorola.",
   1099, 0, { cor: "Grafite", armazenamento: "128 GB", destaque: 1, estoque: 3 }],
  ["smartphone", "novo", "xiaomi", "Xiaomi Redmi 14C 256 GB",
   "Tela grande, câmera de 50 MP e muito espaço. Versão global, com garantia da loja.",
   1049, 1199, { cor: "Azul", armazenamento: "256 GB", estoque: 5 }],

  ["smartphone", "seminovo", "apple", "iPhone 11 64 GB — seminovo",
   "Revisado na nossa bancada: bateria testada, alto-falantes, câmeras e conector conferidos um a um.",
   1590, 1890, { cor: "Branco", armazenamento: "64 GB", bateria: 89, estado: "B",
                 garantia_meses: 6, destaque: 1, estoque: 1 }],
  ["smartphone", "seminovo", "samsung", "Galaxy S21 128 GB — seminovo",
   "Aparelho de vitrine, sem marca de uso aparente. Bateria trocada por nós, nova.",
   1790, 0, { cor: "Prata", armazenamento: "128 GB", bateria: 100, estado: "A",
              garantia_meses: 6, destaque: 1, estoque: 1 }],
  ["smartphone", "seminovo", "motorola", "Moto G73 128 GB — seminovo",
   "Riscos leves na traseira, tela sem marca. Funcionamento conferido item por item.",
   899, 1090, { cor: "Azul", armazenamento: "128 GB", bateria: 92, estado: "B",
                garantia_meses: 3, estoque: 1 }],

  ["acessorio", "novo", null, "Película de vidro 3D com aplicação",
   "Vidro temperado com borda curva. A aplicação sai de graça aqui na loja — sem bolha e sem torto.",
   49, 69, { destaque: 1, estoque: 40 }],
  ["acessorio", "novo", null, "Capa antichoque reforçada",
   "Cantos com reforço de absorção, a parte que quebra primeiro numa queda.",
   59, 0, { estoque: 25 }],
  ["acessorio", "novo", null, "Carregador turbo 33W com cabo",
   "Carregador de verdade, com proteção contra sobretensão. O de posto de gasolina é o que mais queima placa.",
   89, 119, { estoque: 18 }],
  ["acessorio", "novo", null, "Fone Bluetooth com estojo de carga",
   "Até 5 horas por carga e 20 com o estojo. Pareamento automático ao abrir.",
   129, 169, { estoque: 12 }],

  ["periferico", "novo", null, "Caixa de som Bluetooth 10W à prova d'água",
   "Aguenta chuva e beira de piscina. Seis horas de som e entrada para cartão.",
   189, 229, { estoque: 8 }],
  ["periferico", "novo", null, "Smartwatch com chamadas e monitor cardíaco",
   "Recebe ligação e notificação do celular, mede batimento e sono. Duas pulseiras na caixa.",
   249, 329, { destaque: 1, estoque: 6 }],
];

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function produtos() {
  if (Q.um("SELECT COUNT(*) c FROM produtos").c) return;

  const marca = {};
  for (const m of Q.todos("SELECT id, slug FROM marcas")) marca[m.slug] = m.id;

  const ins = Q.db.prepare(
    `INSERT INTO produtos (slug, nome, categoria, condicao, marca_id, chamada, descricao,
       preco, preco_de, estoque, cor, armazenamento, bateria, estado, garantia_meses, destaque)
     VALUES (@slug,@nome,@categoria,@condicao,@marca_id,@chamada,@descricao,
       @preco,@preco_de,@estoque,@cor,@armazenamento,@bateria,@estado,@garantia_meses,@destaque)`);

  for (const [categoria, condicao, m, nome, chamada, preco, precoDe, extra] of PRODUTOS) {
    ins.run({
      slug: slug(nome), nome, categoria, condicao,
      marca_id: m ? marca[m] || null : null,
      chamada, descricao: chamada,
      preco: centavos(preco), preco_de: centavos(precoDe || 0),
      estoque: extra.estoque ?? 1,
      cor: extra.cor || "", armazenamento: extra.armazenamento || "",
      bateria: extra.bateria ?? null, estado: extra.estado || "",
      garantia_meses: extra.garantia_meses ?? (condicao === "novo" ? 12 : 3),
      destaque: extra.destaque || 0,
    });
  }
}

/* ==========================================================================
   BLOG

   Três matérias que respondem a busca de verdade, e não "novidades da loja".
   Um blog de assistência técnica só traz visita se ele resolver a dúvida que
   antecede o conserto — e a dúvida que antecede o conserto quase sempre é
   "vale a pena?".
   ========================================================================== */
const POSTS = [
  ["vale-a-pena-trocar-a-tela-ou-comprar-outro-celular",
   "Vale a pena trocar a tela ou é melhor comprar outro celular?",
   "A conta é simples e quase ninguém faz: compare o preço do conserto com o que o aparelho vale hoje usado, e não com o que ele custou novo.",
   `<p>A pergunta chega aqui todo dia, e a resposta honesta não é sempre "conserta". Existe uma conta que resolve em dois minutos.</p>
<h2>A conta</h2>
<p><strong>Pegue o valor do conserto e compare com o preço do seu aparelho usado hoje</strong> — não com o que você pagou nele. Um aparelho de R$ 2.000 comprado há três anos vale hoje uns R$ 700; se a tela custa R$ 450, você está gastando dois terços do valor do bem.</p>
<p>A régua que usamos no balcão:</p>
<ul>
<li><strong>Conserto até 30% do valor usado</strong> — vale sempre. Você compra mais dois ou três anos de uso por pouco.</li>
<li><strong>Entre 30% e 50%</strong> — vale se o aparelho estiver bom no resto: bateria saudável, câmera boa, sem histórico de queda na água.</li>
<li><strong>Acima de 50%</strong> — pare e pense. Aqui costuma compensar consertar e vender, ou dar de entrada num seminovo.</li>
</ul>
<h2>O que muda a conta</h2>
<p>Três coisas empurram para o conserto mesmo em valores altos: aparelho com armazenamento grande, aparelho que ainda recebe atualização do fabricante, e — a mais importante — <strong>dado que você não quer perder</strong>. Migrar conversa, foto e aplicativo de banco é um custo que ninguém coloca na planilha e todo mundo paga.</p>
<h2>E quando não vale</h2>
<p>Não vale trocar a tela de um aparelho que já tem outro problema grave junto: bateria estufada, conector solto e câmera embaçada somados passam do preço de um seminovo bom. Nesses casos a gente diz isso na sua frente, com o orçamento aberto.</p>`,
   "Antes de gastar"],

  ["bateria-do-celular-viciada-mito-ou-verdade",
   "Bateria viciada é mito? O que realmente estraga a sua",
   "Bateria não vicia — ela envelhece. E o que acelera esse envelhecimento não é o que a maioria pensa.",
   `<p>A ideia de "viciar a bateria" vem das antigas, de níquel. As de lítio, que estão em todo celular há mais de quinze anos, não têm efeito memória nenhum. O que elas têm é <strong>desgaste por ciclo e por calor</strong>.</p>
<h2>O que realmente desgasta</h2>
<ul>
<li><strong>Calor.</strong> É o vilão número um. Celular no painel do carro, no bolso da calça no sol, ou carregando dentro da capa e debaixo do travesseiro envelhece muito mais rápido.</li>
<li><strong>Descarregar até zero com frequência.</strong> Deixar chegar a 0% repetidamente cobra caro. O ideal é circular entre 20% e 80%.</li>
<li><strong>Carregador ruim.</strong> Fonte sem proteção entrega tensão irregular — e isso não estraga só a bateria, estraga a placa.</li>
</ul>
<h2>O que NÃO desgasta</h2>
<p>Carregar durante a noite não estraga: o aparelho para de puxar corrente quando enche. Usar o celular carregando também não, desde que ele não esteja esquentando muito.</p>
<h2>Como saber a hora de trocar</h2>
<p>No iPhone, em Ajustes → Bateria → Saúde da Bateria: <strong>abaixo de 80% já é hora</strong>. No Android o número está escondido, e é o que a gente mede aqui na bancada, de graça, em poucos minutos. Se ele cair de 40% para 5% de uma vez, ou desligar sozinho com carga, a bateria já passou do ponto.</p>`,
   "Manutenção"],

  ["celular-caiu-na-agua-o-que-fazer",
   "Celular caiu na água: o que fazer nos primeiros 10 minutos",
   "O que você faz nos primeiros minutos decide se o conserto vai custar cem reais ou o preço de um aparelho novo.",
   `<p>Água não estraga o celular na hora. O que estraga é a <strong>corrosão</strong>, que começa depois e não para — por isso um aparelho que "voltou a funcionar" pode morrer três dias depois.</p>
<h2>Faça, nesta ordem</h2>
<ol>
<li><strong>Desligue.</strong> Agora, e sem testar se ainda funciona. Circuito energizado com água dentro é o que queima a placa.</li>
<li><strong>Não coloque para carregar.</strong> Nem para ver se liga.</li>
<li><strong>Tire capa, chip e cartão</strong> e seque o que der por fora com pano.</li>
<li><strong>Leve para uma assistência no mesmo dia.</strong> A limpeza da placa antes da corrosão começar custa uma fração de uma troca de placa.</li>
</ol>
<h2>Não faça</h2>
<ul>
<li><strong>Arroz não funciona.</strong> Ele não puxa a água de dentro da placa e ainda solta amido e pó nas entradas.</li>
<li><strong>Secador de cabelo empurra a água para dentro</strong> e esquenta componente que não deveria esquentar.</li>
<li><strong>Sacudir</strong> espalha o líquido para onde ele ainda não tinha chegado.</li>
</ul>
<h2>Água do mar e piscina são piores</h2>
<p>Sal e cloro corroem muito mais rápido que água doce. Se foi um desses, a pressa é maior ainda — o relógio começou a correr no momento em que o aparelho entrou na água.</p>`,
   "Emergência"],
];

function posts() {
  if (Q.um("SELECT COUNT(*) c FROM posts").c) return;
  const ins = Q.db.prepare(
    `INSERT INTO posts (slug, titulo, resumo, corpo, etiqueta, autor, data)
     VALUES (?,?,?,?,?,?, date('now', '-' || ? || ' days'))`);
  POSTS.forEach(([s, t, r, c, e], i) => ins.run(s, t, r, c, e, "Equipe Alafcell", i * 9 + 3));
}

/* ==========================================================================
   UMA ORDEM DE SERVIÇO DE EXEMPLO

   Existe para a tela de acompanhamento poder ser demonstrada com a linha do
   tempo cheia. O código é fixo (DEMO-01) e o telefone termina em 0000 — os
   dois são necessários para consultar, e o par vai escrito no README.

   A última etapa é "pronto", e não "entregue": é o estado mais interessante de
   mostrar, porque é quando o cliente abre a tela.
   ========================================================================== */
function ordemExemplo() {
  if (Q.um("SELECT COUNT(*) c FROM ordens").c) return;

  const modelo = Q.um("SELECT id FROM modelos WHERE slug = 'iphone-11'");
  const r = Q.roda(
    `INSERT INTO ordens (codigo, cliente, telefone, modelo_id, aparelho, defeito,
                         acessorios, orcamento, aprovado, situacao, coleta, prazo)
     VALUES (?,?,?,?,?,?,?,?,1,'pronto',1, date('now'))`,
    "DEMO-01", "Cliente de demonstração", "(81) 90000-0000",
    modelo ? modelo.id : null, "iPhone 11 64 GB — branco",
    "Tela trincada depois de queda; o toque falha no canto de baixo.",
    "Capa e película", centavos(489));

  const id = r.lastInsertRowid;
  const et = Q.db.prepare(
    `INSERT INTO ordem_etapas (ordem_id, situacao, nota, publico, autor, criado)
     VALUES (?,?,?,?,?, datetime('now', '-' || ? || ' hours'))`);

  et.run(id, "recebido", "Aparelho coletado no endereço do cliente.", 1, "Coleta", 52);
  et.run(id, "diagnostico", "Testes de toque, câmera, alto-falante e carga. Só a tela apresentou falha.", 1, "Bancada", 47);
  et.run(id, "orcamento", "Orçamento enviado pelo WhatsApp: display original, R$ 489, 24h.", 1, "Bancada", 45);
  et.run(id, "aprovado", "Cliente aprovou pelo WhatsApp.", 1, "Atendimento", 44);
  et.run(id, "reparo", "Display substituído. Vedação refeita.", 1, "Bancada", 20);
  et.run(id, "teste", "Toque conferido em toda a área, brilho e sensor de proximidade OK.", 1, "Bancada", 6);
  et.run(id, "pronto", "Pronto para devolução. Combinamos a entrega pelo WhatsApp.", 1, "Atendimento", 2);
}

/* ==========================================================================
   CHAVE PIX DE DEMONSTRAÇÃO

   O checkout precisa mostrar o QR para a tela poder ser apresentada. Uma chave
   inventada geraria um código com a cara de bom apontando para conta nenhuma.

   A saída é uma chave DELIBERADAMENTE INVÁLIDA: "00000000000" tem formato de
   CPF e não existe. O banco recusa na hora, com a mensagem dele. Falhar assim
   é seguro — o dinheiro não vai para lugar nenhum, que é exatamente o que
   precisa acontecer enquanto a chave real não for cadastrada.

   `CHAVE_DEMO` é exportada para o servidor poder gritar na subida enquanto ela
   ainda estiver lá. */
const CHAVE_DEMO = "00000000000";

function pagamento() {
  if (txt("pagamento.pix_chave", "")) return;
  ajuste("pagamento.pix_chave", CHAVE_DEMO);
  ajuste("pagamento.pix_nome", "ALAFCELL ASSISTEC");
}

/* ==========================================================================
   AS FOTOS DE BANCO NOS SEUS LUGARES

   Os arquivos vivem em `assets/img/banco/` e são baixados por
   `ferramentas/baixar-imagens.cjs`. Aqui eles só são AMARRADOS ao conteúdo:
   a capa de cada serviço, a capa de cada matéria e a foto de cada produto.

   O amarrado é por SLUG, e não por id: id muda quando o banco é recriado, slug
   não. E cada linha só é escrita se o campo estiver vazio — no dia em que a
   loja subir a foto real pelo painel, este arquivo não a sobrescreve.

   Se a imagem não tiver sido baixada, o campo fica vazio e a página cai no
   desenho da categoria. Nada quebra por falta de foto.
   ========================================================================== */
const BANCO = "/assets/img/banco/";

const FOTO_SERVICO = {
  "troca-de-tela": "serv-tela",
  "troca-de-bateria": "serv-bateria",
  "conector-de-carga": "serv-carga",
  "camera": "serv-camera",
  "alto-falante-microfone": "serv-audio",
  "placa-e-molhado": "serv-placa",
  "software-e-desbloqueio": "serv-software",
  "vidro-traseiro": "serv-vidro",
};

const FOTO_POST = {
  "vale-a-pena-trocar-a-tela-ou-comprar-outro-celular": "post-tela",
  "bateria-do-celular-viciada-mito-ou-verdade": "post-bateria",
  "celular-caiu-na-agua-o-que-fazer": "post-agua",
};

const FOTO_PRODUTO = {
  "samsung-galaxy-a16-128-gb": ["prod-a16", "Samsung Galaxy A16 com a tela ligada"],
  "motorola-moto-g15-128-gb": ["prod-motog", "Motorola Moto G15 em exposição"],
  "xiaomi-redmi-14c-256-gb": ["prod-redmi", "Xiaomi Redmi 14C sobre a mesa"],
  "iphone-11-64-gb-seminovo": ["prod-iphone11", "iPhone 11 seminovo na mão"],
  "galaxy-s21-128-gb-seminovo": ["prod-s21", "Galaxy S21 seminovo sobre a mesa"],
  "moto-g73-128-gb-seminovo": ["prod-motog73", "Moto G73 seminovo na mão"],
  "pelicula-de-vidro-3d-com-aplicacao": ["prod-pelicula", "tela protegida por película de vidro"],
  "capa-antichoque-reforcada": ["prod-capa", "capas antichoque em várias cores"],
  "carregador-turbo-33w-com-cabo": ["prod-carregador", "carregador turbo com cabo"],
  "fone-bluetooth-com-estojo-de-carga": ["prod-fone", "fones bluetooth com o estojo de carga"],
  "caixa-de-som-bluetooth-10w-a-prova-d-agua": ["prod-caixa", "caixa de som bluetooth portátil"],
  "smartwatch-com-chamadas-e-monitor-cardiaco": ["prod-relogio", "smartwatch com pulseira"],
};

/* A imagem só é amarrada se o arquivo existir de verdade. Gravar o caminho de
   uma foto que ninguém baixou daria 404 em toda página — e 404 de imagem não
   aparece em lugar nenhum do log do site, só na tela. */
const fs = require("node:fs");
const path = require("node:path");
const PASTA = path.join(__dirname, "..", "assets", "img", "banco");
const existe = (nome) => fs.existsSync(path.join(PASTA, nome + ".webp"));

function fotos() {
  /* ---------------------------------------------------------- serviços */
  const marcaServico = Q.db.prepare("UPDATE servicos SET foto = ? WHERE slug = ? AND foto = ''");
  for (const [slug, nome] of Object.entries(FOTO_SERVICO))
    if (existe(nome)) marcaServico.run(BANCO + nome + ".webp", slug);

  /* -------------------------------------------------------------- blog */
  const marcaPost = Q.db.prepare("UPDATE posts SET capa = ? WHERE slug = ? AND capa = ''");
  for (const [slug, nome] of Object.entries(FOTO_POST))
    if (existe(nome)) marcaPost.run(BANCO + nome + ".webp", slug);

  /* ---------------------------------------------------------- produtos */
  const insFoto = Q.db.prepare(
    "INSERT INTO produto_fotos (produto_id, arquivo, alt, ordem) VALUES (?,?,?,0)");
  for (const [slug, [nome, alt]] of Object.entries(FOTO_PRODUTO)) {
    if (!existe(nome)) continue;
    const pr = Q.um("SELECT id FROM produtos WHERE slug = ?", slug);
    if (!pr) continue;
    if (Q.um("SELECT 1 FROM produto_fotos WHERE produto_id = ?", pr.id)) continue;
    insFoto.run(pr.id, BANCO + nome + ".webp", alt);
  }
}

function semear() {
  if (!LIGADO) return;
  pagamento();
  precos();
  produtos();
  posts();
  ordemExemplo();
  fotos();
}

module.exports = { semear, LIGADO, CHAVE_DEMO };
