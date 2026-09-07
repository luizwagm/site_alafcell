# Alafcell Assistec

**Landing page** de assistência técnica de celulares — Caruaru/PE.

Uma página, mais o blog. Sem loja virtual e sem preço de conserto: todo caminho
termina numa conversa de WhatsApp já preenchida (ver a 0.4.0 no CHANGELOG).

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

### Rodando na máquina

**Reinicie o servidor a cada mudança em `.js`.** O Node carrega os módulos uma
vez; editar `src/paginas.js` com o servidor de pé não muda nada na tela, e a
página recarregada continua mostrando o código antigo — que é o jeito mais fácil
de passar meia hora depurando uma correção que já estava certa. Conteúdo do
banco, esse sim, aparece só recarregando: as telas são geradas a cada pedido.

| o que | comando |
|---|---|
| subir | `npm start` |
| subir noutra porta | `PORT=5279 npm start` |
| subir SEM os dados de demonstração | `ALAFCELL_DEMO=nao npm start` |
| provas | `npm test` |
| ver todo o conteúdo do site | `node ferramentas/config.cjs` |
| ver um campo | `node ferramentas/config.cjs marca.whatsapp` |
| gravar um campo | `node ferramentas/config.cjs marca.whatsapp 5581988887777` |
| quem entra no painel | `npm run usuario` |
| criar/redefinir senha do painel | `node ferramentas/usuario.cjs dono "Alafcell"` |

Desde a 0.5.0 **o `/admin` existe** e é por ele que se edita o conteúdo no dia
a dia. O `config.cjs` continua útil para o caso em que o painel não serve —
recuperar o site de um valor que quebrou a própria tela de edição, ou preencher
antes de ter usuário. Se ninguém tem acesso ao painel: `npm run usuario`.

**Nota histórica:** Sem ele não há
como testar de verdade nada que dependa dos campos que o dono preencheria:
endereço, horário, telefone, CNPJ, chave Pix — e o **WhatsApp**, que depois da
0.4.0 é o destino de todos os botões do site. Com o campo vazio, eles caem no
número de exemplo `5581999999999`, que é de outra pessoa.

### O roteiro de conferência

Depois de subir, vale percorrer nesta ordem — é onde a 0.4.0 mexeu:

1. **A landing inteira** (`/`): as seções são orçamento, consertos, busca e
   leva, como funciona, garantia, blog e contato. Nenhum preço deve aparecer.
2. **O formulário de orçamento**: escolha marca, modelo e serviço e envie. Ele
   sai do site para o WhatsApp com a mensagem já escrita — confira o texto.
3. **Os botões de WhatsApp** (topo, consertos, coleta, contato, rodapé).
4. **O blog** (`/blog/`) e uma matéria.
5. **O que deve dar 404**: `/loja/`, `/carrinho/`, `/checkout/`, `/consertos/`,
   `/busca-e-leva/`, `/acompanhar/`, `/contato/`.
6. **O rodapé**: "Onde estamos" ao lado de "A Alafcell", e a lista de consertos
   sem link por serviço.

Para ver como o site fica indexável (sitemap e `robots.txt` do endereço real):

```bash
ALAFCELL_SITE=https://alafcell.com.br PORT=5279 npm start
```

No endereço de trabalho o sitemap sai **vazio de propósito** e o `robots.txt`
pede para não indexar nada — não é defeito.

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
| `/` | a landing: orçamento, consertos, busca e leva, como funciona, garantia, blog e contato |
| `/orcamento` | **não é página** — monta a mensagem e redireciona para o WhatsApp |
| `/blog/`, `/blog/:slug/` | índice e matéria |
| `/privacidade/` | fora do menu, apontada só pelo rodapé |
| `/admin/` | o painel do dono — todo o conteúdo do site |
| `/admin/previa` | a home montada com o rascunho, antes de publicar (exige sessão) |

Todo o resto responde **404 de propósito** desde a 0.4.0 — inclusive `/loja/`,
`/carrinho/`, `/checkout/`, `/consertos/`, `/busca-e-leva/`, `/acompanhar/` e
`/contato/`. O CHANGELOG diz o que era cada um e como religar.

## Provas

```bash
npm test
```

**291 provas em três suítes**, num banco temporário — nunca no banco do cliente.

`testes/provar.cjs` (235) chama as funções direto. `testes/rotas.cjs` (36)
**sobe o servidor de verdade** numa porta própria e pede o que o buscador vai
pedir: robots, sitemap, canonical, dados estruturados, 404.

A segunda existe por dois defeitos reais da mesma família. O `/robots.txt`
respondeu 404 por várias versões enquanto a prova de `Endereco.robots()`
passava: a função existia, era exportada, estava provada — e a **rota tinha sido
apagada** na 0.4.0, na limpeza que removeu as telas da loja. O `/saude` era pior: o `deploy.sh` o consulta com `curl -fsS`
para saber se o site subiu, e `-f` falha em 404, então **toda entrega reportaria
falha com o site no ar**.

Chamar função não cobre essa família inteira de erro.

`testes/vhost.sh` (20) roda o `criar-site.sh` em **modo de ensaio** e olha o
arquivo de configuração que saiu. O vhost é montado por heredoc, e heredoc
quebra em silêncio: um `$` mal escapado não derruba o bash — faz o bloco não ser
escrito. Foi assim que o redirecionamento do `www` sumiu. Cobrem o que dói
caro se quebrar: dinheiro em centavos, o preço vindo do servidor e não do
cookie, a privacidade do pedido e da ordem de serviço, o CRC do Pix, o endereço
de trabalho continuar fora do índice, e o filtro de HTML dos campos do painel.

Sabotagem a cada versão — defeitos plantados de propósito, todos apanhados. Um
teste que não falha quando o código quebra não é teste.

**Não é coberta** a chamada HTTP à Places API do Google: sem chave, uma prova
que fala com o Google de verdade falharia em máquina sem rede e gastaria cota
alheia. O que é nosso (a peneira das cinco estrelas, a limpeza do que vem de
fora, o cache de 24h, a troca de fonte, os recados de erro) está provado em
memória.

O `deploy.sh` roda as provas **antes** de reiniciar o serviço: falharam, o site
continua no ar com a versão anterior.

## Entrega automática

`git push` na `main` → o GitHub roda as suítes e, se todas passarem, entra no
servidor e executa o `deploy.sh`. Configuração em
[GITHUB-ACTIONS.md](GITHUB-ACTIONS.md) — a chave, o sudo e os segredos são a
parte que só o dono do servidor pode fazer.

Depois de subir, o workflow confere o que nada mais denuncia: **a versão no ar
é a deste commit** (pega "o script rodou mas o serviço não reiniciou") e **qual
endereço o site anuncia** (canonical errado manda o Google indexar outro site).

## Subir ao servidor

Ver [SUBIR.md](SUBIR.md). Em resumo: `criar-site.sh` uma vez por domínio,
`deploy.sh` a cada versão, `verificar.sh` para conferir de fora.

## As avaliações do Google

A seção "quem já passou por aqui recomenda" tem duas fontes possíveis e usa
**uma de cada vez**.

**Digitadas no painel** (é o que vale por padrão). Três de exemplo vêm
cadastradas para a seção nascer visível — a seção some quando não há nenhuma, e
um site que nasce sem ela parece não ter a funcionalidade. O texto das três diz
que são exemplo: trocar ou apagar é a primeira coisa a fazer.

Enquanto a fonte é esta, o cartão se credita como **"Cliente da Alafcell"**, e
não como avaliação do Google. Dar o crédito do Google a um texto digitado é
afirmar ao visitante que aquele elogio está numa ficha pública e verificável —
quem for conferir não acha, e leva junto a credibilidade da página.

**Buscadas na ficha do Google** (Places API). Preenchidos o **Place ID** e a
**chave da API** na tela "Recomendações", o botão *Buscar agora* puxa direto do
Google e o cadastro manual sai de cena.

### Como conseguir os dois

Nenhum dos dois pode ser criado por quem desenvolve: são do dono do negócio, e a
cobrança é dele.

1. **Place ID** — em <https://developers.google.com/maps/documentation/places/web-service/place-id>,
   procurar a loja pelo nome e copiar o identificador (começa com `ChIJ`).
2. **Chave da API** — em <https://console.cloud.google.com>: criar um projeto,
   ativar a **Places API**, gerar uma chave em *Credenciais*. Vale restringir a
   chave à Places API para ela não servir para mais nada se vazar.

### O que a API impõe

`Place Details` devolve **no máximo 5 avaliações**, escolhidas pelo Google — não
existe pedir "as três melhores". O filtro de cinco estrelas acontece depois de
receber, no `src/google.js`. **Se a loja não tiver três de nota cheia entre
essas cinco, a seção mostra menos que três**, e isso não tem conserto pelo lado
do código.

O resultado é guardado no banco e revalidado **uma vez por dia**: cada consulta
é cobrada, e buscar a cada visita transformaria uma página popular numa fatura.
Se a busca falhar, o que estava guardado continua no ar — cota estourada ou
queda de rede não pode apagar a seção.

Do que o Google devolve, o site guarda **só o primeiro nome** de quem avaliou.
Nome completo e foto de perfil são dados de um cliente que avaliou a loja, não o
site, e ninguém pediu autorização para publicá-los aqui.

### Por que não "só ler a página do Google"

A página de resultados recusa acesso automatizado, raspá-la é contra os termos
de uso, e a estrutura dela muda sem aviso — a seção sumiria sozinha numa terça
qualquer, no site de um cliente.

## Os campos de texto do painel

Os 19 campos longos do painel são editores com barra de formatação (negrito,
itálico, listas, subtítulos, citação, link), com modo "ver o HTML" para quem
quiser mexer no código. Texto colado do Word ou de um site entra limpo: a
formatação que vem junto é descartada, senão a fonte do Word entraria no site.

O site **interpreta** essa formatação. Como isso significa executar no navegador
do visitante o que foi gravado num campo, tudo passa por `src/html-seguro.js`
antes de ser gravado — lista branca de marcações, nada de `<script>`, `<iframe>`,
`onclick`, `style=` ou `javascript:`.

E **o destino do campo decide o tratamento**: o que vai para dentro de um
atributo HTML (o nome no `<title>`, o texto alternativo da foto, o telefone do
WhatsApp, os dados estruturados que o Google lê) é gravado sem marcação nenhuma.
Ali, uma aspa solta quebraria a página.

## SEO

O site é uma **landing de página única**: o buscador tem UMA página para
ranquear, e ela concorre com franquias que têm uma página por serviço. Essa é a
restrição que decide tudo aqui — as páginas de serviço foram removidas de
propósito na 0.4.0, e não vão voltar.

### O que compensa dentro dessa restrição

**As perguntas frequentes** (`/admin` → Perguntas frequentes) são a maior
alavanca. Cada pergunta responde uma busca real na mesma página, e a marcação
`FAQPage` é dos poucos rich results que o Google ainda exibe. Feitas com
`<details>` nativo: o texto está no HTML mesmo fechado, então o buscador lê tudo
— acordeão montado por script esconde justamente o que se quer indexar.

⚠ **Só marque pergunta que a página responde.** Marcar o que o visitante não
encontra é dado estruturado enganoso e tira o site inteiro do recurso. A lista
que vai para o JSON-LD é a mesma variável que desenhou a seção, para as duas não
poderem divergir.

**As cidades atendidas** (`/admin` → Endereço e horário) abrem a busca local
fora de Caruaru. Cada cidade da lista é uma promessa operacional: tire as que a
busca e leva não atende.

**O blog** é a única superfície onde cabe conteúdo novo. É por ali que o site
cresce a médio prazo.

### O que NÃO fazemos, e por quê

**Não declaramos `aggregateRating` nem `review`.** Avaliação do próprio negócio
na própria página é *self-serving review*: o Google **não exibe estrela para
isso** em LocalBusiness desde 2019. Marcar daria trabalho e nenhuma estrela — e
republicar como conteúdo do site as avaliações vindas da API deles seria
apresentar como nosso o que é da ficha do Google.

O lugar dessas estrelas é o **Google Business Profile**. Há prova na suíte
guardando essa decisão, para ninguém "consertar" isso depois sem saber o custo.

### O que muda sozinho na virada de domínio

Tudo está em `src/endereco.js`, e depende de uma variável só. Trocar o
`ALAFCELL_SITE` e reiniciar faz o site sair do modo "endereço de trabalho":
`robots.txt` liberado com a linha `Sitemap:`, `X-Robots-Tag: noindex` para de
sair, sitemap deixa de ser vazio, canonical e JSON-LD passam a apontar para o
domínio real.

⚠ **É lido na subida.** Sem reiniciar, o canonical continua o antigo — e
canonical errado é o site pedindo ao Google que indexe outro endereço.

### Depois de subir: o que nenhum script faz

1. **Search Console** — provar a posse e enviar o sitemap.
2. **Google Business Profile** — a ficha da loja. Para uma assistência técnica,
   a ficha bem preenchida traz mais gente que o site.
3. **O mesmo endereço, escrito igual em toda parte** — site, ficha, Instagram.
   Divergência é o que faz o Google desconfiar de qual é a loja de verdade.

Passo a passo completo em [SUBIR.md](SUBIR.md).

## Estado

Site público inteiro pronto e provado: 15 páginas, sem falha de contraste AA,
sem rolagem horizontal de 320px a 1440px, 291 provas verdes em três suítes e as
sabotagens todas pegas. **Entrega automática por GitHub Actions** configurada
(falta só a chave e os segredos, que são do dono do servidor). O **`/admin` está pronto** — todas as seções do site editáveis em
telas organizadas, tela de acessos, rascunho com botão de publicar, editores de
texto e a busca de avaliações no Google.

Operação pronta (deploy, criar-site, verificar, systemd, backup), ainda **não
executada** no servidor.

Falta o `/restrito` (gerenciador da loja: estoque, pedidos, ordens de serviço e
financeiro).
