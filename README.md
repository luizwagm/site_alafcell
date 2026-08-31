# Alafcell Assistec

Site, loja e sistema de assistência técnica de celulares — Caruaru/PE.

Node puro, sem framework. **As páginas são geradas a cada pedido, a partir do
banco**: não existe arquivo HTML com conteúdo dentro para o painel reescrever,
e por isso "editou no painel, apareceu no site" é consequência da arquitetura,
não de um passo de publicação que alguém pode esquecer de rodar.

```bash
npm install
npm start
```

Sobe em `http://127.0.0.1:5202`. Na primeira subida o banco é criado, os textos
e o catálogo de serviços entram sozinhos, e o **primeiro usuário nasce com
senha sorteada, escrita uma vez só no log** — anote antes de fechar o terminal.

---

## Conceito

**SINAL DE VIDA.** Aparelho quebrado é aparelho apagado; a Alafcell devolve o
sinal. A superfície é escura, e o vermelho só aparece onde existe energia:
ação, estado, movimento. Vermelho decorativo não entra — se ele estiver em
tudo, ele para de avisar qualquer coisa.

A paleta foi **medida no logotipo em PDF**, não escolhida de fora: vermelho
dominante `#E50000` (pico em `#FF0000`) e cromo entre `#DBDCDC` e `#ECEDED`.

A regra de contraste que atravessa o sistema inteiro: `#E50000` sobre o
grafite dá **4,04:1** — passa para peça grande e componente de interface
(mínimo 3:1) e **reprova para texto corrido** (exige 4,5:1). Por isso o
vermelho da marca é cor de superfície e de título grande; quando vermelho
precisa virar texto pequeno, ele sobe para `--vermelho-luz` (5,05:1). Branco
sobre o vermelho cheio dá 4,85:1 — o botão é seguro.

## O que este site tem que os concorrentes não têm

Os três concorrentes de Caruaru (ConsertaSmart, Rede Multi, Suporte Smart) são
**páginas de cidade de franquia nacional**. Nenhum deles vende online, nenhum
publica preço por aparelho, nenhum deixa acompanhar o conserto, e o "busca e
leva" deles é por transportadora. As quatro lacunas viraram as quatro decisões
centrais do produto.

## Estrutura

```
server.js                 rotas, estáticos, freio de envio, sitemap/robots
src/
  db.js                   esquema e camada fina de consultas
  endereco.js             em que domínio o site está rodando (e se indexa)
  conteudo-inicial.js     o site nasce cheio; nada sobrescreve o que existe
  layout.js               cabeçalho, rodapé, <head>, a engrenagem em SVG
  paginas.js              home e 404
  consertos.js            serviços, tabela de preços, recorte por marca/modelo
  coleta.js               busca e leva e o agendamento
  loja.js                 vitrine, produto, carrinho, checkout e pedido
  blog.js                 índice e matéria
  acompanhar.js           consulta da ordem de serviço
  institucional.js        contato e privacidade
  pix.js                  código copia e cola (padrão EMV do Banco Central)
  qr.js                   QR em SVG, montado no servidor
  demo.js                 conteúdo de apresentação — ver a seção abaixo
  painel.js               scrypt, sessão em banco, cookie HttpOnly
  medicao.js              GA4 e Pixel — só depois do aceite (LGPD)
assets/
  css/estilo.css          tokens + componentes, um arquivo só
  js/site.js              menu, revelação na rolagem, marca → modelo, copiar Pix
  img/                    logotipo extraído do PDF, com transparência real
  img/banco/              as 29 fotos (fora do repositório — ver abaixo)
ferramentas/
  baixar-imagens.cjs      baixa e CONFERE as fotos; gera folha de contato
  backup.cjs              VACUUM INTO — a única cópia correta de um banco em uso
  semear.cjs              conteúdo inicial sem subir o site
testes/provar.cjs         48 provas, em banco temporário
operacao/                 unidade do systemd, backup diário e timer
deploy.sh                 entrega uma versão nova
criar-site.sh             cria o vhost e emite o certificado (uma vez por domínio)
verificar.sh              confere o site DE FORA
data/alafcell.db          SQLite (WAL)
```

## As fotos

Vêm do **Unsplash** (licença livre, inclusive comercial) e ficam **no
projeto**, servidas do nosso domínio — não consumidas por link do fornecedor:
link de banco de imagem muda de endereço e o site aparece com buraco no lugar
da foto, sem erro em lugar nenhum.

Elas **não vão no repositório** (2,8 MB de binário que nunca muda). O que fica
versionado é a lista — o próprio script — e os créditos.

```bash
npm run imagens              # baixa o que faltar
node ferramentas/baixar-imagens.cjs --conferir   # diz o que está faltando
node ferramentas/baixar-imagens.cjs --refazer    # rebaixa tudo
```

Depois de baixar, **abra `assets/img/banco/conferir.html`**. É a única
conferência que nenhum teste automático faz: nome de arquivo certo com foto
errada passa em qualquer verificação de bytes.

São fotos de banco para o site poder ser apresentado — substitua pelas fotos
reais da loja e dos produtos antes de divulgar o endereço.

## Variáveis de ambiente

| variável | para quê | padrão |
|---|---|---|
| `PORT` | porta | `5202` |
| `HOST` | interface | `127.0.0.1` |
| `ALAFCELL_SITE` | domínio público (canonical, JSON-LD, sitemap) | `https://alafcell.projetos.luizaugust.me` |
| `ALAFCELL_INDEXAVEL` | força `sim`/`nao` no dia da virada de domínio | automático |
| `ALAFCELL_DB` | caminho do banco | `data/alafcell.db` |
| `ALAFCELL_DEMO` | `nao` desliga todo o conteúdo de demonstração | ligado |

Qualquer endereço em `.projetos.luizaugust.me` é **endereço de trabalho** e
sai automaticamente fora do índice do Google — no `robots.txt`, na etiqueta
`<meta robots>` e no cabeçalho `X-Robots-Tag` de **toda** resposta, inclusive
imagem e CSS.

## Decisões que valem conhecer antes de mexer

- **Dinheiro em centavos inteiros.** Carrinho soma; ponto flutuante erra
  centavo, e o erro aparece justamente no total, que é o número que o cliente
  confere.
- **Preço de conserto vive no cruzamento modelo × serviço**, e só existe linha
  para o que a loja preencheu. Sem preço, a tela diz "orçamento na hora" — e
  não R$ 0,00.
- **Ordem de serviço é linha do tempo**, não campo de situação: o cliente quer
  saber onde o aparelho está, e um campo único apaga o histórico.
- **O código público é sorteado**, não sequencial, e num alfabeto sem I, O, 0 e
  1 — ele é ditado por telefone. A consulta pública exige código **mais** os
  quatro últimos dígitos do telefone: código sozinho é varredura.
- **Estático é autorizado por lugar, não por extensão.** Uma lista de extensões
  já deixou `GET /server.js` responder 200 em outro projeto do parque.
- **O IP vem do último item do `X-Forwarded-For`**, não do primeiro: o primeiro
  é texto que o cliente escreve.

## Conteúdo de demonstração — leia antes de publicar

O site sobe **cheio**, para poder ser apresentado: preços de conserto, 12 produtos,
3 matérias de blog e uma ordem de serviço de exemplo.

**Nenhum preço ali é real.** São valores de referência do mercado de Caruaru,
plausíveis e redondos, escolhidos para a tela fazer sentido. Cada linha precisa
ser conferida e substituída no painel antes de o site ir ao ar.

A **chave Pix** também é de demonstração (`00000000000`) — deliberadamente
inválida, para o banco recusar em vez de mandar dinheiro para lugar errado. O
servidor avisa isso em voz alta a cada subida.

Para subir limpo:

```bash
ALAFCELL_DEMO=nao npm start
```

Para demonstrar o acompanhamento de conserto, use o código **DEMO-01** com o
telefone **0000**.

## Telas prontas

| endereço | o que é |
|---|---|
| `/` | home |
| `/consertos/` | serviços com preço; `?marca=` e `?modelo=` recortam |
| `/consertos/:slug/` | um serviço, com a tabela por aparelho |
| `/busca-e-leva/` | o diferencial + agendamento da coleta |
| `/loja/`, `/loja/:categoria/` | vitrine, com recorte próprio para seminovos |
| `/produto/:slug/` | ficha do produto |
| `/carrinho/`, `/checkout/` | compra em duas telas, sem cadastro |
| `/pedido/:codigo/` | pedido fechado, com Pix e QR — só para quem comprou |
| `/blog/`, `/blog/:slug/` | índice e matéria |
| `/acompanhar/` | ordem de serviço por código + 4 dígitos do telefone |
| `/contato/`, `/privacidade/` | institucional |

## Provas

```bash
npm test
```

48 provas num banco temporário — nunca no banco do cliente. Cobrem o que dói
caro se quebrar: dinheiro em centavos, o preço vindo do servidor e não do
cookie, a privacidade do pedido e da ordem de serviço, o CRC do Pix e o
endereço de trabalho continuar fora do índice.

O `deploy.sh` roda as provas **antes** de reiniciar o serviço: falharam, o site
continua no ar com a versão anterior.

## Subir ao servidor

Ver [SUBIR.md](SUBIR.md). Em resumo: `criar-site.sh` uma vez por domínio,
`deploy.sh` a cada versão, `verificar.sh` para conferir de fora.

## Estado

Site público inteiro pronto e provado: 15 páginas, sem falha de contraste AA,
sem rolagem horizontal de 320px a 1440px, 48 provas verdes e 12 sabotagens
todas pegas. Operação pronta (deploy, criar-site, verificar, systemd, backup),
ainda **não executada** no servidor.

Faltam o `/admin` (CMS de textos, produtos e blog) e o `/restrito` (gerenciador
da loja: estoque, pedidos, ordens de serviço e financeiro).
