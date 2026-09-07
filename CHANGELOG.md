# Histórico de versões — Alafcell Assistec

Segunda casa = funcionalidade nova. Terceira casa = correção. A primeira não muda.

---

## 0.12.0 — 07/09/2026 — VARREDURA DE SEO: as palavras, a ficha e as IAs

Auditoria com medição, não com checklist. Três achados que valiam a rodada.

### 1. "conserto de celular" aparecia ZERO vezes na página

O site dizia "assistência técnica" — que é como o **setor** se descreve, não
como o cliente busca. Quem está com o aparelho quebrado na mão digita
"conserto de celular caruaru", "tela quebrada", "celular molhado". Nenhum
desses termos existia no texto.

Três campos mudaram, e o texto ficou **melhor** de ler, não pior — isto não é
encher a página de palavra-chave (o buscador pune, e com razão), é chamar as
coisas pelo nome que o cliente usa:

| | antes | agora |
|---|---|---|
| Título no Google | *(o nome + o slogan)* | **Conserto de celular em Caruaru** — Alafcell Assistec |
| H1 | Seu celular de volta no mesmo dia | **Conserto de celular em Caruaru**, com o aparelho de volta *no mesmo dia* |
| Rótulo | Assistência técnica especializada · Caruaru | **Conserto de celular** · Caruaru e região |

### 2. A ficha que o Google lê estava quase vazia

Ela tinha nome, url, imagem — e mais nada. **Sem telefone, endereço,
coordenadas, horário, mapa nem logotipo.** Numa busca local, é exatamente isso
que decide quem aparece: o buscador precisa saber onde a loja fica e como
chegar.

Os dados existem e são públicos — estão na ficha ALAFCELL ASSISTEC do próprio
Google. Foram para o cadastro inicial: endereço com CEP, bairro, telefone,
WhatsApp, coordenadas e o link do mapa pelo CID.

A ficha passou de 6 para **20 campos**: `telephone`, `address`, `geo`,
`hasMap`, `logo`, `slogan`, `email`, `paymentAccepted`, `currenciesAccepted`,
`openingHoursSpecification` e `knowsAbout`.

**`knowsAbout` é o campo de expertise** — não aparece na tela e é o que responde
"quem conserta iPhone em Caruaru?". Sai dos serviços e das marcas que a loja
realmente cadastrou; uma lista inventada ali seria a loja afirmando competência
que não tem.

**O horário não foi preenchido, de propósito.** A ficha do Google diz "Aberto 24
horas", o que quase certamente é cadastro errado dela, e inventar horário de
loja é mandar cliente para uma porta fechada. Fica para o dono, e o verificador
cobra a cada conferência.

### 3. Três regras de semeadura, e a diferença entre elas importa

Uma melhoria de texto não chegava ao cliente: o campo já existe no banco dele, e
`semearTexto` (de propósito) nunca toca no valor. Faltavam duas regras:

- **`completarSeVazio`** — preenche só o que está em branco. É o único jeito de
  completar o cadastro de quem já tem o campo (vazio). O texto de espera conta
  como vazio: deixá-lo no ar é pior que preencher.
- **`atualizarSeIntocado`** — melhora um texto **só se ele ainda for exatamente
  o que nós escrevemos**. Se o dono mudou uma vírgula, a decisão é dele.

A pergunta certa não era "está vazio?", e sim **"alguém mexeu nisto?"**.

### Para as IAs recomendarem a loja

**`/llms.txt`** — convenção recente (llmstxt.org): o resumo do negócio em texto
puro, no lugar previsível. Um assistente que responde "quem conserta celular em
Caruaru?" não vai desmontar uma landing de 58 KB para achar o telefone.

Ele traz endereço, contato, o que a loja conserta, marcas, cidades atendidas, o
FAQ inteiro — **e o que a loja NÃO faz**. Isso não é modéstia: metade das
perguntas que chegam a uma assistência é sobre serviço que ela não presta, e um
"não" claro na fonte evita o cliente errado e a resposta errada.

Nada ali é inventado: tudo sai do painel, e campo vazio não vira linha. Um
arquivo feito para ser citado **sem conferência** é o último lugar onde cabe um
dado provisório.

**Os robôs de IA passaram a ser nomeados no `robots.txt`** — e liberados. Eles
já entravam por omissão, mas "liberado por esquecimento" e "liberado por
decisão" parecem iguais no arquivo: no dia em que alguém colar ali um
robots.txt de modelo da internet, metade deles bloqueia esses robôs "por
segurança", e a loja sai das respostas sem ninguém perceber.

⚠ **E aqui eu abri um buraco antes de fechá-lo.** `robots.txt` **não herda**:
cada robô obedece a **um** grupo — o mais específico que casa com o nome dele —
e ignora o `User-agent: *` inteiro. Meu primeiro rascunho dava a cada robô um
grupo com só `Allow: /`, o que **liberou o painel para dez robôs**, porque o
`Disallow: /admin/` morava no outro grupo. Agora é um grupo só, com as mesmas
proibições, e há prova conferindo que **todo** grupo proíbe o painel.

### Carregamento

O logotipo do **rodapé** baixava junto com o do topo — ninguém o vê antes de
rolar, e ele disputava banda com a foto que a pessoa está esperando. E a foto do
topo, que quase sempre é o maior elemento da primeira tela (o que o buscador
mede como LCP), não tinha prioridade nenhuma.

Imagens que carregam de imediato: de 5 para 3. Mais `og:image:width/height/alt`,
que evitam o retângulo em branco enquanto o WhatsApp baixa a imagem para
descobrir o tamanho — e é no WhatsApp que este link mais circula.

### Corrigido no caminho

**`loja.horario_dados` estava na lista de texto puro**, e `semHtml` colapsa
quebras: as duas faixas ("Mo-Fr…" e "Sa…") viravam uma linha só, que o
conversor não entende. **O horário simplesmente sumia da ficha.** Achado por
uma prova nova.

### Provas

277 na suíte principal (eram 256), 49 nas de rota (eram 36). **Onze sabotagens,
e uma passou na primeira rodada**: a prova de que texto de espera não vaza para
o `/llms.txt` era cega, porque no cenário do teste nenhum campo lido estava com
texto de espera. **Uma prova só vê o defeito se o estado de que ela precisa
existir** — teve de ser criado.

O `verificar.sh` passou a cobrar de fora o que só o dono pode preencher:
telefone, endereço, coordenadas, mapa, expertise, horário estruturado, e o
`llms.txt` sem texto de espera dentro.

---

## 0.11.4 — 07/09/2026 — O passo das dependências falhava MUDO

```
3/7  dependências
Error: Process completed with exit code 243.
```

Uma linha, um número, e nada mais. O comando era `npm ci --omit=dev --silent`,
e **`--silent` cala o npm inclusive no erro**. Numa entrega isso é o pior
arranjo possível: não dá para saber se foi permissão, rede, lock fora de
sincronia ou memória — quem lê o log fica adivinhando.

Agora o npm fala. A saída vai para arquivo e, quando ele falha, as últimas 25
linhas aparecem no erro, junto com onde olhar primeiro.

### E há um suspeito com nome e sobrenome neste projeto

`npm ci` **apaga** `node_modules/` antes de reinstalar. Se a pasta pertence ao
root — o que acontece quando alguém roda `sudo npm ci` uma vez, e foi o que
aconteceu aqui na primeira subida ao servidor — o deploy feito como `deploy`
não consegue removê-la.

O passo 3/7 passou a **conferir o dono antes**, e a mensagem já traz o conserto:

```bash
sudo chown -R deploy:deploy /var/www/projetos/Alafcell-Assistec
```

Conferir custa uma linha e transforma um `exit 243` numa instrução.

O lock foi verificado com um `npm ci --omit=dev` limpo, em pasta vazia: 67
pacotes, sem erro. Ele não é a causa.

### Travado contra regressão

A bateria de testes recusa `--silent` no `deploy.sh`. Erro mudo numa entrega é
um defeito de operação como qualquer outro — e este custou uma rodada inteira
de adivinhação. Provado sabotando o arquivo.

---

## 0.11.3 — 07/09/2026 — A trava do sudo disparava com a porta trancada

O passo que eu tinha acabado de acrescentar para *proteger* o deploy passou a
derrubá-lo:

```
Error: o usuário deploy não consegue reiniciar o serviço sem senha.
```

Ele testava `sudo -n systemctl is-active` e `sudo -n true`. **Nenhum dos dois
está no sudoers**, que — corretamente — permite um comando só: `systemctl
restart alafcell.service`. A trava falhava exatamente quando a regra estava
CERTA, e a mensagem mandava configurar o que já estava configurado.

A segunda tentativa foi `sudo -n -l <comando>`, que é o teste correto — ele
pergunta se o comando seria permitido, sem executá-lo. Mas o próprio `sudo -l`
pode exigir senha dependendo da configuração: falso negativo de novo.

**Não dá para determinar isso de fora sem efeito colateral.** O único teste
definitivo é reiniciar o serviço, que é justamente o que não se quer fazer
antes das provas.

Então a trava saiu e virou **aviso**. Quem já é autoridade sobre isso:

- o `deploy.sh`, que falha no passo 7/7 com mensagem;
- o passo **"a versão no ar é a deste commit"**, que pega exatamente o caso de
  "subiu o código e não reiniciou".

Uma trava que dispara com a porta trancada ensina a ignorar o aviso — e aviso
ignorado não protege ninguém. Dois passos protegendo a mesma coisa, um deles
com falso positivo, é pior que um só que funciona.

---

## 0.11.2 — 07/09/2026 — O workflow chamava o deploy com `sudo`

```
Não rode o deploy como root (nem com sudo).
Error: Process completed with exit code 1.
```

Copiei o passo de deploy do **LA Sentinela**, onde o script precisa de root. O
do Alafcell é o oposto: ele **recusa root de propósito**, porque com `sudo` o
`npm ci` faz o root virar dono de `node_modules/` — e a entrega *seguinte*,
feita como `deploy`, não consegue mais escrever ali. O erro aparece no deploy de
amanhã, longe da causa.

Ele roda como o dono do código e pede sudo numa linha só: o `systemctl restart`.

**O sudoers que eu documentei também estava errado.** Não é o `deploy.sh` que
precisa de `NOPASSWD`, é o reinício do serviço:

```
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart alafcell.service, /bin/systemctl restart alafcell.service
```

Os dois caminhos porque o `sudo` casa pelo caminho **absoluto**, e ele varia
entre distribuições — um `which systemctl` apontando para o outro faz a regra
não valer, sem dizer por quê.

O workflow ganhou um passo que **confere esse sudo antes de mexer no servidor**:
sem ele, o deploy sobe o código e não reinicia o serviço — a pior metade de uma
entrega, porque parece que deu certo.

E o de testes ganhou uma conferência para a regressão não voltar: se alguém
escrever `sudo …/deploy.sh` no workflow de novo, a bateria falha antes de
qualquer entrega. Provada sabotando o arquivo.

---

## 0.11.1 — 07/09/2026 — TODA ENTREGA APAGAVA O PAINEL DO CLIENTE

O defeito mais caro encontrado até aqui, e ele estava escondido atrás de um
comentário que afirmava o contrário.

O `deploy.sh` roda `semear()` a cada entrega, com a nota: *"acrescenta o que
falta e não toca no que a loja já cadastrou"*. Isso vale para serviços,
aparelhos e o FAQ, que têm guarda de "tabela vazia".

**Não valia para os textos.** `T()` chamava `ajuste()`, que faz `UPDATE` do
valor quando a chave existe. Endereço, telefone, horário, CNPJ, o conteúdo de
todas as seções — **tudo voltava ao padrão na entrega seguinte.**

O cliente preencheria o painel, veria o site certo, e encontraria "Preencha o
endereço no painel" de volta no dia seguinte. Sem erro, sem aviso, sem nada no
log. Ele culparia o painel — e não teria como saber.

A correção separa por dono: o **valor** é do cliente (só entra quando o campo
nasce); o **rótulo, a ajuda, o grupo e a ordem** são nossos (atualizam sempre,
porque descrevem o campo no painel e precisam poder melhorar a cada versão).

Apareceu porque o endereço que eu tinha gravado para testar sumiu sozinho entre
dois comandos.

### O endereço aparecia como `<p>Rua Benjamin Constant, 31, Casa A</p>`

Duas coisas erradas ao mesmo tempo:

O campo virou **editor de texto** na 0.8.0, então o que ficou gravado tem `<p>`
dentro. Mas `loja.endereco` e `loja.horario` ficaram de fora da lista de campos
de texto puro — ao contrário de cidade, UF, CEP e telefone, que estão lá.

E o site tratava o mesmo dado de **dois jeitos**: a seção de contato escapava
(mostrando a tag na tela) e o rodapé interpretava. Pior, o JSON-LD levava a
marcação **crua** para o Google — `streetAddress` com `<p>` dentro.

Endereço é **dado**, não texto corrido. Virou texto puro — mas não dá para usar
`semHtml`, que junta tudo numa linha: "Rua X, 31" e "Casa A" são duas linhas, e
juntá-las produz um endereço que ninguém escreveria. Entrou `emLinhas`, que
troca as tags de bloco por quebras de verdade.

Aplicado também na **leitura**, e não só na gravação: o valor no banco do
cliente já tem `<p>`, e esperar que ele reabra e salve cada campo é esperar que
o defeito se conserte sozinho.

⚠ `emLinhas` **não era idempotente** na primeira versão: ele perdia as quebras
do texto que ele mesmo tinha produzido, porque `semHtml` colapsa espaço em
branco e `\n` é um deles. E gravar → ler é o caminho normal, não o excepcional.

### `semHtml` deixava o miolo de `<script>` como texto

`<script>alert(1)</script>` virava o **texto** "alert(1)". Não é furo de
segurança — sai escapado —, mas `semHtml` alimenta justamente os lugares onde
texto estranho aparece inteiro e ninguém revisa: o `<title>` da aba, o `alt`
que um leitor de tela lê em voz alta, o `streetAddress` que o Google publica na
ficha. `sanitizarHtml` já removia esses blocos com o miolo junto; duas funções
do mesmo arquivo com políticas diferentes para a mesma ameaça.

### As avaliações reais foram para o conteúdo inicial

Elas estavam só no **meu banco local**. Quem popula o banco do servidor é o
`conteudo-inicial.js`, rodado pelo `deploy.sh` — então o site do cliente
continuava com "(AVALIACAO DE EXEMPLO)" no ar. Cadastrar no banco local e achar
que o cliente vê o mesmo é o erro de fundo: o banco local não vai a lugar
nenhum, o código vai.

O conteúdo inicial agora traz as três da ficha, o selo com a nota (5,0), o
total (38) e o link, **e remove as de exemplo que já subiram** — selecionadas
pela marca no texto, apagadas pelo id, uma a uma. Uma avaliação que o dono tenha
cadastrado não é tocada.

### GitHub Actions: `Permission denied`, exit 126

`./testes/vhost.sh` não roda no runner: o repositório está em Windows com
`core.fileMode=false`, o git grava 644 e o clone recebe o arquivo sem bit de
execução. Corrigido no índice com `git update-index --chmod=+x`, e o workflow
passou a chamar `bash testes/vhost.sh` — imune ao problema, que já tinha mordido
este projeto na primeira subida ao servidor.

### Provas

256 na suíte principal (eram 235). **Oito sabotagens**, e **duas passaram na
primeira rodada** — as provas do rótulo e da limpeza do `<script>` eram cegas:

- a do rótulo só conferia que ele não era a chave, e ele já vinha certo do
  primeiro `semear()`. Para provar *atualização*, o rótulo precisa ser
  **estragado antes**;
- a limpeza do miolo não tinha prova nenhuma.

Corrigidas, as oito são pegas.

---

## 0.11.0 — 07/09/2026 — AS AVALIAÇÕES REAIS DO GOOGLE, E O SELO QUE LEVA A ELAS

A ficha da loja no Google existe: **ALAFCELL ASSISTEC**, R. Benjamin Constant,
31 — São Francisco, Caruaru. **Nota 5,0 com 38 avaliações.**

As três de exemplo saíram. No lugar entraram as **três primeiras avaliações de
cinco estrelas da ficha**, com o texto que está lá, e o selo virou link para a
ficha — o mesmo desenho do Forms Fitness.

O link usa o **CID** da ficha (`maps.google.com/?cid=…`), e não o endereço
longo do Maps: o CID é o identificador do lugar e continua valendo quando o
Google reescreve a URL, que ele reescreve.

### A origem de cada avaliação passou a ser declarada

Na 0.8.0 o site só dava o crédito "Avaliação no Google" quando os dados vinham
da API — porque aí ele *sabe*. Avaliação digitada recebia "Cliente da
Alafcell".

Mas o caso real é um terceiro: **o dono copia da própria ficha do Google**. São
do Google de verdade, e negar o crédito esconderia do visitante a prova social
mais forte que a loja tem — uma nota que ele confere clicando no selo.

Adivinhar pelo contexto ("se tem link, é do Google") daria o crédito a qualquer
texto digitado. Então virou **campo por avaliação**: `Copiada da nossa ficha do
Google`, com padrão "sim" porque é o que a tela pede. Elogio que chegou por
WhatsApp ou no balcão é verdadeiro do mesmo jeito, mas **não está no Google** —
desmarque, e aquele cartão passa a dizer "Cliente da Alafcell".

O crédito é **por cartão**, não da seção: as duas origens podem conviver na
mesma página, cada uma dizendo o que é. A origem aparece **na lista** do
painel, e não escondida dentro do formulário — quem revisa não abre um por um.

### O selo aparece com o link, mesmo sem nota

Antes ele exigia a nota preenchida. Agora, com link e sem nota, ele diz apenas
**"Ver as avaliações no Google"** — sem inventar número, que é o mesmo desenho
do Forms Fitness. Sem link **e** sem nota não há selo: um selo do Google que não
leva ao Google é enfeite.

### Migração

`CREATE TABLE IF NOT EXISTS` não acrescenta coluna em tabela que já existe — o
banco do cliente ficaria sem `do_google` e a consulta quebraria na primeira
visita depois do deploy. Entrou um bloco de `ALTER TABLE` idempotente no
`db.js`.

### Provas

235 na suíte principal (eram 227). As novas cobrem: o crédito por cartão com as
duas origens na mesma página, `do_google` como booleano de verdade (a armadilha
de *type affinity* que já fez item desativado continuar no site), o selo com
link e sem nota, e a ausência do selo sem os dois. **Seis sabotagens, seis
pegas.**

⚠ Uma prova nova falhou por herdar estado do grupo vizinho: o cache do Google
ficava com nota "4,9" e o selo mostrava esse número, fazendo a prova de "sem
nota" acusar defeito num código correto. **Prova declara o estado de que
precisa, não herda o do vizinho.**

### O que ficou de fora

O texto da avaliação do Robinho vem **cortado na ficha** (o Google mostra "…
Mais" e só carrega o resto por clique). O que está no site é o trecho visível,
que termina em frase completa — mas vale conferir na ficha se ele continua.

---

## 0.10.1 — 07/09/2026 — O `limit_req_zone` derrubava a virada de domínio

Ao rodar o `criar-site.sh` para `alafcell.com.br`, o nginx recusou a
configuração inteira:

```
[emerg] limit_req_zone "alafcell_forms" is already bound to key
        "$binary_remote_addr" in .../alafcell.projetos.luizaugust.me:5
```

**`limit_req_zone` é diretiva do contexto `http`, e o nome da zona é global.**
Eu a declarava dentro do arquivo do vhost — o que funciona perfeitamente
enquanto existe **um** vhost. No minuto em que o site ganha o domínio de
verdade e passam a existir dois arquivos, os dois declaram a mesma zona e o
nginx recusa tudo.

Ou seja: um defeito que só podia aparecer **na virada para produção**, com o
cliente esperando. É o pior momento possível, e não é acaso — é a natureza do
erro: ele precisa do segundo vhost para existir.

**Agora a zona vive em `/etc/nginx/conf.d/alafcell-limites.conf`**, declarada
uma vez. De brinde, o limite passa a ser **compartilhado** entre os endereços:
quem estiver abusando pelo `www` não ganha uma cota nova ao trocar para o
domínio sem `www`.

O `criar-site.sh` também **limpa a declaração de vhosts antigos** deste site
(guardando cópia `.bak`), senão o vhost do endereço de trabalho continuaria
derrubando o nginx durante a transição.

Quatro provas novas em `testes/vhost.sh` (20 no total): a zona **não** pode
estar no vhost, e o freio dos formulários **tem** que continuar ligado — tirar
a declaração e levar o uso junto desligaria a proteção em silêncio.

### Correção do que eu afirmei na 0.9.0

Escrevi que `/saude` e `/robots.txt` **nunca tinham sido ligados a uma rota**.
O git desmente, e o servidor também: em produção, ainda na 0.3.2, o `/saude`
responde normalmente.

As duas rotas **existiam no primeiro commit** e foram **apagadas na 0.4.0**,
na limpeza que removeu as telas da loja — vitrine, carrinho, checkout,
acompanhar. Nada disso tinha relação com elas.

A lição muda, e fica mais útil: não é "esqueci de ligar a rota". É **remoção em
massa leva junto o que não devia**, e a menção sobrevivente noutro lugar (aqui,
a lista `OPERACAO`) faz parecer que continua tudo lá. Depois de remover um
bloco de rotas, pedir cada caminho que sobrou.

---

## 0.10.0 — 04/09/2026 — ENTREGA AUTOMÁTICA (GitHub Actions)

Dali em diante, publicar é `git push`. O GitHub roda as três suítes e, só se
todas passarem, entra no servidor e executa o `deploy.sh`.

Dois workflows: **Testes** (todo push e todo PR) e **Deploy** (só na `main`,
chamando os testes como portão). Passo a passo da configuração — a chave, o
sudo e os segredos — em [GITHUB-ACTIONS.md](GITHUB-ACTIONS.md).

### O `deploy.sh` não tem como saber se o código está com defeito

Ele protege o CONTEÚDO: faz backup, compara o inventário, restaura se algo
sumir. Mas ele não sabe se o código novo funciona — quem sabe disso é a suíte,
e até agora ela dependia de alguém lembrar de rodá-la.

O workflow também confere duas coisas **depois** de subir, que nada mais
denuncia:

- **A versão no ar é a deste commit?** Se o script rodou e o serviço não pegou
  o código novo, o deploy termina com sucesso e o site continua no antigo.
- **Que endereço o site anuncia?** Canonical errado manda o Google indexar
  outro site, e não há nada na tela que denuncie isso.

### Provas do gerador de vhost — `testes/vhost.sh`, 16 provas

O vhost do nginx é montado por heredoc, e heredoc quebra de um jeito
traiçoeiro: um `$` mal escapado **não derruba o bash** — ele faz o bloco não ser
escrito, em silêncio. O script termina com sucesso e falta um pedaço dentro do
arquivo. Foi assim que o redirecionamento do `www` sumiu na 0.9.0.

O `criar-site.sh` ganhou um **modo de ensaio** (`ALAFCELL_VHOST_ENSAIO`) que
gera o arquivo num caminho dado e sai antes de tocar em nginx, certbot ou DNS —
sem root, porque teste que exige `sudo` é teste que ninguém roda. A suíte gera
os dois casos (domínio próprio e subdomínio) e confere o que saiu: bloco do
`www` com 301, o desafio do certbot **antes** do redirecionamento, HSTS nos dois
lugares que o `add_header` exige, e nada disso no subdomínio.

⚠ A primeira versão desta conferência era um `grep` procurando o escape certo.
**Conferência por texto de escape é frágil** — depende de quantas camadas de
citação o shell atravessa, e me deu resultados contraditórios no mesmo arquivo.
Um teste que engana é pior que nenhum. Agora se olha o arquivo gerado:
comportamento, não texto.

### Dois bloqueadores que apareceram ao configurar

**O `package-lock.json` estava na versão 0.3.3 com o pacote em 0.9.0.** O lock
veio copiado de outro projeto na primeira subida deste site, e `npm ci` já
recusou uma vez por isso. Sincronizado, e o workflow passou a conferir — o erro
só apareceria no servidor, no meio de uma entrega.

**Não havia `.gitattributes`.** Com `core.autocrlf` ligado no Windows, os `.sh`
podem chegar ao servidor com `\r` no fim da linha, e aí `#!/usr/bin/env bash\r`
vira "interpretador não encontrado" — apontando para um arquivo que existe. O
arquivo previne; o workflow confere, porque prevenção sem conferência é
promessa.

### Erros meus no caminho, que valem como lição

⚠ **A saída do modo de ensaio foi parar DENTRO do vhost gerado.** Ancorei a
substituição no delimitador do heredoc, que aparece **duas vezes** — casou com
a abertura. O `bash -n` aprova, porque o script continua sendo shell válido; só
olhar o arquivo gerado denuncia. Virou prova: "nenhuma linha de shell vazou
para dentro do vhost".

⚠ **Oito sabotagens deram "OK" sem provar nada.** O executor chamava `bash`,
que no PATH do Windows resolve para o do WSL e não enxerga este sistema de
arquivos. Todas deram "SEM PLACAR" — **inclusive o controle**, e é isso que
denuncia: se até o código intacto "falha", quem falhou foi o executor.

⚠ **O ensaio saía na internet.** Dois `curl` para o `ifconfig.me` com timeout de
8s cada, para descobrir o IP do servidor — informação que o ensaio nem usa. Meio
minuto por rodada, e num runner sem saída para a rede o teste ficaria pendurado
e pareceria defeito do código.

---

## 0.9.0 — 04/09/2026 — SEO COMPLETO E A OPERAÇÃO DE alafcell.com.br

### Primeiro, quatro coisas que estavam erradas

**O `/saude` respondia 404 — e é o que o deploy usa para saber se o site
subiu.** Mesma origem do robots, e a origem não é a que eu supus: as duas rotas
**existiam no primeiro commit** e foram **removidas na 0.4.0**, junto com as
rotas da loja. A limpeza que tirou vitrine, carrinho, checkout e acompanhar
levou de arrasto duas rotas de *operação* que não tinham relação nenhuma com a
loja — e o caminho continuou listado entre as rotas de operação, o que fazia
parecer que ainda existia. O
`deploy.sh` pede esse endereço com `curl -fsS`, e `-f` falha em 404: **toda
entrega ia esgotar as vinte tentativas e reportar que o site não subiu, com o
site no ar e funcionando.** O Izatec, que foi o molde deste projeto, tem as
duas rotas — aqui elas foram apagadas por uma limpeza que mirava outra coisa.

**O `/robots.txt` respondia 404.** A função que monta o arquivo existe desde o
começo, é exportada e tinha prova passando — e a rota também existia, até a
0.4.0 removê-la junto com as da loja. O caminho continuou na lista que o poupa
do redirecionamento canônico, o que fazia tudo parecer resolvido. No domínio real isso significaria nenhuma regra e
nenhuma linha `Sitemap:` — que é por onde o buscador descobre o mapa do site.

**A descrição que aparece no Google prometia o que o site não tem.** O texto era
literal no código e dizia "preço na tela" e "loja de aparelhos novos e
seminovos" — as duas coisas removidas na 0.4.0. É a pior falha possível no
orgânico: a pessoa clica, não acha o que foi prometido, volta em segundos, e
esse retorno é lido como má qualidade. A página cai justamente pelas visitas que
ganhou. Agora é campo do painel, e o texto novo só promete o que a página
entrega.

**O sitemap não tinha `lastmod`.** Sem ele todas as páginas parecem igualmente
antigas, e matéria nova demora a ser revisitada.

### A ficha que o Google lê

A marcação da loja passou a incluir:

- **Onde a loja atende** — Caruaru e mais sete cidades do Agreste, editável no
  painel. Quem procura "conserto de celular em Toritama" não encontra uma loja
  que só diz "Caruaru", e essa informação não existia em lugar nenhum. **A lista
  é uma promessa operacional**: tire as cidades onde a busca e leva não vai de
  verdade.
- **O catálogo dos oito consertos** — eles perderam página própria na 0.4.0 e
  com isso sumiram da leitura do buscador. O catálogo devolve a informação sem
  criar página nenhuma, que é a restrição do site atual. Sem preço, de propósito.
- **A organização com logotipo e o site como entidade** — é o que alimenta o
  quadro de informações à direita na busca.

### Perguntas frequentes — a maior alavanca deste site

Oito perguntas com resposta pronta, editáveis no painel, com a marcação
`FAQPage`.

**Por que isto e não outra coisa:** o site é uma landing de página única. O
Google tem UMA página para ranquear, competindo com franquias que têm uma por
serviço. Não dá para criar páginas — foram removidas de propósito. O FAQ
responde, na mesma página, as perguntas que as pessoas digitam ("quanto tempo
demora para trocar a tela", "vocês buscam em casa", "vou perder minhas fotos"),
e cada uma é uma porta de entrada sem custar página nova.

Feito com `<details>` nativo: abre sem JavaScript, o teclado navega sozinho, o
leitor de tela anuncia o estado e — o que decide aqui — **o texto está no HTML
mesmo com o item fechado**. Acordeão que só monta o conteúdo ao clicar esconde
do buscador exatamente o texto que se quer indexar.

### O que eu NÃO fiz, e por quê

**Não marquei as avaliações como nota do site (`aggregateRating`/`Review`).**
Parece o caminho óbvio para ganhar estrelas no resultado da busca, e não é:
avaliação do próprio negócio na própria página é o que o Google chama de
*self-serving review*, e **desde 2019 ele não exibe estrela para isso** em
LocalBusiness. O trabalho não renderia a estrela que se espera dele. Pior:
republicar como conteúdo do site as avaliações que vieram da API deles seria
apresentar como nosso o que é da ficha do Google.

**O lugar dessas estrelas é o Google Business Profile**, onde as avaliações já
estão. Não há atalho pelo site — e há prova na suíte guardando essa decisão,
para ninguém "consertar" isso depois sem saber o custo.

### A operação de alafcell.com.br

`criar-site.sh` e `deploy.sh` já existiam e já aceitavam o domínio real. O que
mudou é o que só aparece quando o domínio é próprio:

- **O `www` deixou de ser uma cópia do site.** Ele estava no mesmo
  `server_name`, servindo conteúdo idêntico em dois endereços — para o buscador,
  dois sites competindo entre si, dividindo a força de cada link recebido. Agora
  tem bloco próprio com **301** para o endereço sem `www`.
- **HSTS.** Sob `*.projetos.luizaugust.me` ele vinha do domínio pai. Em domínio
  próprio ninguém anuncia por você: sem o cabeçalho, a primeira visita de cada
  pessoa sai em HTTP antes do redirecionamento — e é nessa visita que dá para
  interceptar. Sem `preload`, de propósito: a lista de precarga é praticamente
  irreversível e vale para o domínio inteiro; é decisão do dono.
- **Armadilha do nginx evitada:** `add_header` dentro de um `location` apaga os
  do `server`. O bloco de `/assets/` tem o seu, então o HSTS precisou ser
  repetido lá — sem isso, CSS, JS e as 29 fotos sairiam sem proteção, em
  silêncio.

`gzip` e cache de estáticos já estavam desde a primeira versão da operação.

O `SUBIR.md` ganhou o passo a passo completo da virada: os dois registros de
DNS, o que muda sozinho ao trocar o `ALAFCELL_SITE`, o que fazer no Search
Console e no Business Profile, e os quatro `curl` que conferem tudo de fora.

### O verificador estava gritando à toa

`verificar.sh` cobrava `/consertos/`, `/loja/`, `/carrinho/`, `/contato/` e
`/acompanhar/` — todos removidos de propósito na 0.4.0. Ele acusava **oito
problemas onde não havia nenhum**, e verificador que grita sempre é verificador
que ninguém lê: o problema de verdade passa no meio dos falsos.

A lista foi atualizada, e as rotas removidas **não saíram da conferência**:
viraram a lista do que *tem* de responder 404. Uma delas voltando a responder
200 é loja reaberta sem querer, com carrinho e preço de conserto na tela.

Ele também passou a conferir, no domínio próprio, o que nenhuma suíte alcança
(porque é configuração de nginx): o `www` respondendo **301**, o HSTS presente,
e o HSTS **também nos estáticos** — o furo do `add_header`.

### Provas — e uma suíte nova

**`testes/rotas.cjs`**, 36 provas que sobem o servidor de verdade numa porta
própria e pedem o que o buscador vai pedir.

Ela existe por causa do `robots.txt`: `provar.cjs` chama as funções direto, e é
cego para uma família inteira de defeito — **a função existe, é exportada, está
provada, e ninguém a ligou numa rota**. As duas coisas eram verdade ao mesmo
tempo e nenhum teste podia notar. Ela também confere que toda página anunciada
no sitemap responde 200, e que nenhum `noindex` sobrou no domínio real.

O `deploy.sh` roda as duas suítes antes de reiniciar o serviço.

⚠ **A própria suíte nova quase deixou o `/saude` passar:** ela usava esse
endereço para esperar o servidor subir e aceitava *qualquer* resposta — um 404 é
resposta válida do ponto de vista da conexão. Passou a exigir 200. É o mesmo
erro de fundo do robots, uma camada acima.

**263 provas** ao todo (227 + 36), de 235. **Quatorze sabotagens, quatorze
pegas.**

⚠ **As duas suítes deixavam o banco de prova para trás** — 177 arquivos
acumulados na pasta temporária desta máquina. O código de faxina existia e
estava certo; o que falha é o Windows, onde **não se apaga arquivo ainda
aberto**, e o `catch` engolia o erro. No Linux do servidor passa, então nunca
apareceu onde alguém olhava. Corrigido nas duas: `provar.cjs` fecha *todas* as
conexões (ele recarrega o módulo do banco e abria mais de uma), e `rotas.cjs`
espera o servidor filho morrer de verdade antes de apagar — `kill()` só pede
para o processo sair.

Uma prova precisou ser endurecida no caminho: ela estourava um `TypeError` em
vez de falhar limpo quando o campo sumia, e derrubava a suíte inteira — que
esconde todas as provas abaixo dela.

---

## 0.8.0 — 03/09/2026 — EDITOR DE TEXTO NO PAINEL E AVALIAÇÕES DO GOOGLE

Três coisas, e a terceira depende de você.

### 1. Todo campo de texto do painel virou editor

Os 19 campos longos do painel deixaram de ser caixas de texto puro. Agora têm
barra de formatação: negrito, itálico, sublinhado, dois tamanhos de subtítulo,
lista com marcadores, lista numerada, citação, link e "limpar formatação". Tem
também um botão **"Ver e escrever o HTML"** para quem quiser mexer no código
direto — e ele sincroniza nos dois sentidos, então dá para ir e voltar sem
perder o que foi escrito de um lado.

Colar texto do Word ou de um site **entra limpo**: a formatação estranha que
vem junto (fonte, cor, tamanho, espaçamento) é descartada na colagem. Sem isso,
um parágrafo colado do Word arrastaria a fonte do Word para dentro do site e
quebraria o visual da página inteira.

### 2. O site passou a interpretar a formatação

O que se escreve em negrito no painel aparece em negrito no site — em 19 pontos
de texto corrido: chamadas, descrições, o "como funciona", o "por que confiar",
as matérias do blog e o rodapé.

**O filtro que veio junto é a parte que importa.** Interpretar HTML significa
que o que é gravado num campo é executado no navegador de todo visitante. Sem
peneira, bastaria colar um pedaço de código num campo para o site passar a
fazer o que aquele código mandasse — inclusive roubar a sessão de quem estivesse
logado no painel. Então:

- entram só as marcações de formatação (negrito, itálico, listas, links, etc.);
- `<script>`, `<iframe>`, `onclick`, `style=` e links `javascript:` são
  removidos — inclusive as variações escritas para enganar filtro ingênuo;
- e **o destino do campo decide o tratamento**: o que vai para dentro de um
  atributo HTML (o nome que aparece no `<title>`, o texto alternativo da foto,
  o telefone do WhatsApp, os dados que o Google lê) continua sem marcação
  nenhuma. Ali, uma aspa solta quebraria a página.

### 3. Seção de avaliações, com busca no Google

A seção mostra **três avaliações de cinco estrelas**, como você pediu. Ela tem
duas fontes possíveis, e usa **uma de cada vez**:

**Avaliações digitadas no painel** — é o que está valendo agora. Três de
exemplo já vêm cadastradas para a seção nascer visível; o texto delas diz que
são exemplo, e a primeira coisa a fazer é trocar ou apagar.

**Busca automática na ficha do Google** — precisa de duas coisas que **só você
pode criar**, porque são suas e a cobrança é sua:

1. o **Place ID** da loja (o identificador da sua ficha no Google Maps);
2. uma **chave de API** do Google Cloud com a *Places API* ativada.

Com os dois preenchidos na tela "Recomendações", o botão **Buscar agora** puxa
as avaliações direto do Google, e o cadastro manual sai de cena. A consulta
acontece **uma vez por dia**, não a cada visita — cada consulta é cobrada na sua
conta.

**O que o Google impõe, e não dá para contornar:** a API devolve **no máximo 5
avaliações**, escolhidas por ela — não existe "me dê as três melhores". O filtro
de cinco estrelas acontece depois de receber. Se a loja não tiver três de nota
cheia entre essas cinco, a seção mostra menos que três. Inventar a terceira
seria mentir.

Não dá para "só ler a página de resultados do Google": ela recusa acesso
automatizado, raspá-la é contra os termos de uso, e ela muda de estrutura sem
aviso — a seção sumiria sozinha numa terça-feira qualquer.

### Corrigido no meio do caminho — dois defeitos que a tela mostrou

**O cartão dizia "Avaliação no Google" mesmo sem vir do Google.** Enquanto a
busca não está configurada, os cartões são o que foi digitado no painel; dar a
eles o crédito do Google é o site afirmando ao visitante que aquele elogio está
numa ficha pública verificável. Quem fosse conferir não acharia — e levaria
junto a credibilidade do resto da página. Agora o crédito diz "Cliente da
Alafcell" enquanto a fonte for o painel, e só vira "Avaliação no Google" quando
os dados vêm de lá.

**As avaliações de exemplo se multiplicavam a cada reinício do servidor.** A
função que as cadastra roda em toda subida e não tinha guarda: eram nove na
terceira subida, com "Exemplo 1" repetido na página — e as que você apagasse
voltariam sozinhas no reinício seguinte. Passou a cadastrar só quando a lista
está vazia.

### Provas

De 157 para 205. As novas cobrem o filtro de HTML (inclusive as variações de
`javascript:` escritas para enganar), a separação entre campo formatado e campo
de texto puro, o site interpretando no corpo e continuando a escapar dentro de
atributo, a regra das três de cinco estrelas, a troca de fonte, e os dois
defeitos acima.

Dez sabotagens no código — cada uma um defeito plantado de propósito — e as dez
foram apanhadas pelas provas.

**O que NÃO está coberto:** a chamada HTTP à Places API. Sem chave, uma prova
que fala com o Google de verdade falharia em máquina sem rede e gastaria cota
alheia. O que é nosso (a peneira das cinco estrelas, a limpeza do que vem de
fora, o cache, a troca de fonte, os recados de erro) está provado em memória.

### LGPD

O Google devolve o nome completo e a foto de perfil de quem avaliou. O site
guarda **só o primeiro nome**: são dados de um cliente que avaliou a loja, não o
site, e ninguém pediu autorização para publicá-los aqui.

---

## 0.7.0 — 03/09/2026 — RASCUNHO E BOTÃO DE PUBLICAR

Até aqui, salvar era publicar. Agora não é: **o que você edita fica guardado
como rascunho, e o site continua mostrando a última versão publicada** até o
clique em Publicar.

Eu tinha argumentado que este botão não era necessário — e estava certo sobre o
fato (as páginas são geradas a cada visita, então salvar já ia ao ar) e errado
sobre o que isso custa no uso: **quem mexe em três telas deixa o site pela
metade entre um salvamento e outro**. O cliente que entra nesse intervalo vê o
endereço novo com o horário velho. O botão resolve isso, e por isso ele segura
as alterações de verdade em vez de só confirmar que já foram.

### Como funciona

| | onde mora | quem lê |
|---|---|---|
| **Rascunho** | as tabelas (`config`, `servicos`, `marcas`, `modelos`, `posts`, `avaliacoes`) | o painel |
| **Publicado** | um instantâneo em JSON na tabela `publicacao` | o site |

Publicar copia um no outro, **numa linha só** — e por ser uma linha só, a troca
é atômica: não existe instante em que metade do site é nova e metade é velha.

**Por que instantâneo, e não uma coluna `rascunho` em cada tabela:** a coluna
espelho obrigaria a duplicar todas as colunas de seis tabelas, e a cada campo
novo alguém teria de lembrar de duplicá-lo. O tipo de disciplina que falha em
silêncio — o campo esquecido iria ao ar sem publicação e ninguém descobriria.
O instantâneo guarda o que existe, do jeito que existe; campo novo entra
sozinho. De brinde vem o **histórico**: cada publicação é uma linha com data e
autor (as 20 últimas).

### No painel

* Uma **barra no rodapé** aparece quando há alteração esperando — e só então.
  Barra permanente vira moldura, e moldura ninguém lê.
* **"Ver como vai ficar"** abre a MESMA home do site, montada lendo o rascunho.
  Não é uma segunda tela que imita a primeira: uma cópia divergiria da real, e
  pré-visualização que mente é pior que nenhuma. Exige sessão.
* A pergunta "há algo para publicar?" é respondida pelo **servidor**, comparando
  o rascunho com o que está no ar. A tela poderia deduzir ("salvou, logo tem
  pendência") e mentiria em dois casos: ao ABRIR com alteração de ontem, e ao
  salvar um valor igual ao que já estava publicado.

### Detalhes que custam caro se ficarem de fora

* **A matéria do blog pelo endereço direto** era a porta lateral mais fácil de
  esquecer: a lista lia o instantâneo, mas `/blog/<slug>/` lia a tabela — um
  texto salvo e não publicado abriria para quem tivesse o link.
* **`/api/modelos` e `/orcamento`** também passaram a ler o instantâneo: o
  seletor não pode oferecer um modelo em rascunho, e o nome que entra na
  mensagem do WhatsApp tem de ser o que está no ar.
* **O sitemap** também — matéria não publicada nele é 404 servido ao Google.
* **Instalação nova**: sem nenhuma publicação, o rascunho vale como publicado.
  Um site que nasce em branco parece quebrado, não "falta publicar".
* **`txt()` mudou num lugar só** (`db.js`) e com isso os mais de cem pontos que
  o chamam passaram a ler o publicado. Trocar um a um deixaria justamente o
  esquecido mostrando rascunho no ar.

⚠ **O modo rascunho é uma flag de processo**, e isso só é seguro porque a
renderização é SÍNCRONA (`better-sqlite3` é síncrono e as páginas são montadas
sem `await` no meio). Se um dia entrar `await` no caminho de renderização, isto
vira condição de corrida — dois pedidos ao mesmo tempo, um vendo o rascunho do
outro. O `try/finally` garante que a flag sempre volta, inclusive se o render
estourar; há prova para os dois casos.

**157 provas** (eram 138). **8 sabotagens, 8 pegas** — todas sobre a mesma
pergunta: existe algum caminho por onde o rascunho chega ao visitante?

---

## 0.6.0 — 03/09/2026 — Seções revisadas e as recomendações do Google

### O que estava preso no código virou conteúdo

"Como funciona", "Por que confiar" e os títulos do blog eram literais dentro do
`paginas.js`. Depois que o painel passou a existir, texto que só eu consigo
mudar é texto que o dono não controla — e a promessa do painel é que ele
controla o site inteiro. São **29 campos novos**, em quatro telas:
**Como funciona**, **Por que confiar**, **Textos do blog** e **Recomendações**.

Os textos também foram revisados. O que mudou de verdade:

* **Passo 1** ganhou "com foto, se der. A resposta vem no mesmo dia" — o que a
  loja realmente pede e promete no WhatsApp.
* **Passo 2** diz que o balcão atende **sem hora marcada**.
* **Passo 3** passou a dizer que **a avaliação não se paga** se você desistir.
  Era a informação que mais faltava: sem ela, "orçamento" soa a custo.
* **Motivo 2** de "por que confiar" agora diz que a loja avisa quando **não
  compensa consertar** — a coisa mais difícil de uma assistência dizer, e a que
  mais constrói confiança.

A **foto** da seção "Por que confiar" também virou campo (com descrição para
leitor de tela). Sem foto, a seção continua de pé e o `<img>` não é renderizado
— um `src=""` faz o navegador pedir a própria página de volta e mostrar ícone
de imagem quebrada.

⚠ O **prazo da garantia continua vivendo num lugar só** (`legal.garantia`) e é
colado no começo do primeiro motivo. Escrevê-lo de novo criaria dois números
para a mesma promessa, e no dia em que a loja mudasse de 90 para 180 dias um
dos dois ficaria mentindo.

### Recomendações do Google

Seção nova, no padrão do BemEstarClinic: cartões com estrelas, autor e a fonte,
mais o selo com a nota geral que leva à ficha real no Google.

**As duas regras do cliente vivem na CONSULTA, não na tela:** no máximo **3**, e
**só as de 5 estrelas**. Uma avaliação de 4 pode ser cadastrada, fica ativa, e
mesmo assim não aparece — o painel mostra isso na etiqueta da linha, para
ninguém achar que o site está ignorando o cadastro.

**A seção inteira some quando não há avaliação**, em vez de estrear vazia.

⚠ **O CONTEÚDO É DIGITADO, NÃO BUSCADO.** A API de avaliações do Google é paga,
exige chave e restringe onde o texto pode aparecer; raspar a página deles quebra
a cada mudança de HTML e é contra os termos. Então: **as avaliações são copiadas
à mão da ficha da loja**, e o painel avisa em letras claras que só entram
avaliações reais. O selo leva ao Google, onde qualquer visitante confere.

Nada foi semeado com texto de exemplo — nem um depoimento fictício. Um elogio
que ninguém escreveu custa mais do que vale.

**138 provas** (eram 116). **9 sabotagens, 9 pegas**, incluindo "o limite de 3
vira 6", "aceita qualquer nota" e "a seção aparece mesmo vazia".

⚠ Uma prova passava pelo motivo errado: a do prazo procurava o texto na página
INTEIRA, e `legal.garantia` aparece em dois lugares — então ela passava mesmo
com o motivo 1 sem o prazo. Agora procura dentro da seção.

---

## 0.5.0 — 03/09/2026 — O PAINEL DO DONO (`/admin`)

O site subiu com "Preencha o endereço no painel" escrito na página, e o painel
não existia. Agora existe: **todo texto, imagem e informação que aparece no
site é editável em `/admin/`**, em telas organizadas por seção da página.

### As telas

| tela | o que edita |
|---|---|
| **Início** | resumo e **o que falta preencher**, com o efeito de cada campo vazio |
| **Acessos** | quantas visitas, de quantas pessoas, em quais páginas |
| Marca e contato | nome, slogan, WhatsApp, telefone, e-mail, Instagram, CNPJ |
| Endereço e horário | endereço, bairro, cidade, UF, CEP, horário, mapa, coordenadas |
| Topo da página | título, texto, botões e os três números do topo |
| O que a gente conserta | cada conserto: nome, descrição, sintomas, prazo, garantia, ícone, ordem |
| Busca e leva | os textos da seção de coleta |
| Garantia | prazo de garantia e textos legais |
| Marcas e modelos | as opções do seletor de orçamento |
| Blog | matérias, com capa e rascunho |
| Analytics | GA4 e Meta Pixel |
| Pagamento | Pix e cartão (marcado como **desligado**, porque a loja saiu na 0.4.0) |

**Não existe botão de "Publicar", e não é esquecimento.** As páginas são
geradas a cada visita, direto do banco: salvar já é publicar. O painel do
BemEstarClinic, que serviu de modelo para a organização das telas, tem esse
botão porque lá as páginas são arquivos reescritos a cada publicação.

### A tela de Início cobra o que falta

Ela olha os campos que o site mostra com texto de espera e diz o efeito de cada
um em branco — *"WhatsApp: sem ele, TODOS os botões do site levam a um número de
exemplo"*. Sem isso, o dono só descobre o problema quando um cliente reclama.

### Decisões que valem registro

* **A tela não decide o que pode ser gravado.** Cada tabela declara as colunas
  editáveis em `CAMPOS`; o que chegar fora da lista é descartado. Um POST
  montado à mão não troca `id` nem coluna que a tela não mostra.
* **Imagem é conferida pelos BYTES.** Extensão e `Content-Type` são texto que o
  cliente escolhe; um `.png` pode ser um script. O nome do arquivo é sorteado —
  o nome enviado pode ter `..`, barra, ou repetir o de outra foto e
  sobrescrevê-la. ⚠ **Não há redimensionamento** (o projeto não tem `sharp`):
  o teto é 3 MB e a tela avisa que a imagem entra como veio.
* **Marca com modelo dentro não é apagada** — os modelos ficariam órfãos e
  sumiriam do seletor de orçamento sem ninguém entender por quê.
* **Trocar a senha derruba as outras sessões**, menos a de quem trocou.
* O painel usa a identidade do site (grafite + vermelho medido no logotipo) e
  **funciona no celular**, com o mesmo desenho de gaveta do resto do parque.

### Ferramenta nova: `usuario.cjs`

`npm run usuario` já estava declarado no `package.json` apontando para um
arquivo que **não existia** — o comando quebrava com "Cannot find module", e é
justamente o que recupera o acesso ao painel. Agora existe: lista quem entra,
cria conta e redefine senha (sorteada e mostrada uma vez; nunca vem na linha de
comando, que fica no `ps` e no histórico).

### Consertos de passagem

- ⚠ **`src/medicao.js` NÃO estava desligado** — a nota da 0.4.0 dizia que sim, e
  que ele fazia "preço por modelo". As duas coisas eram falsas: ele é o GA4 +
  Meta Pixel com o consentimento de cookies, chamado pelo `layout.js` em toda
  página. Quem lesse aquilo poderia apagá-lo e derrubar a conformidade de LGPD.
- **A suíte deixava imagens para trás quando falhava.** O `unlink` estava depois
  da asserção; passou para o `process.on("exit")`. Sobraram cinco arquivos numa
  execução sabotada, um deles de 3 MB, na pasta que vai para o servidor.

**116 provas** (eram 74). **10 sabotagens, 10 pegas** — duas delas só depois de
eu corrigir as provas, que passavam pelo motivo errado: o buffer "grande demais"
era de zeros (recusado por não ser imagem, não por tamanho), e `ativo: "1"` não
distinguia nada porque o SQLite converte `"1"` em 1 sozinho em coluna INTEGER.

---

## 0.4.0 — 03/09/2026 — O SITE VIRA LANDING PAGE

Mudança de escopo pedida pelo cliente. O site tinha nove tipos de tela; passa a
ter **duas**: a landing (`/`) e o blog (`/blog/`, mais cada matéria). A
privacidade continua existindo, fora do menu, porque o site recebe nome e
telefone e a LGPD precisa ter onde ser respondida.

**Não há mais loja virtual.** Saíram vitrine, ficha de produto, carrinho,
checkout e pedido — rotas removidas, não escondidas atrás de bandeira: rota que
existe e não deveria é rota que alguém acha pelo sitemap velho ou por um link
que ficou num WhatsApp de três meses atrás.

**Não há mais preço de conserto em lugar nenhum.** Em celular, preço de tabela
é chute: depende do modelo e do que se encontra ao abrir. Anunciar um "a partir
de" cria justamente a conversa que a assistência não quer ter — a de explicar
por que o valor final é outro. A seção "o que a gente conserta" ficou com nome,
descrição e prazo de bancada; sem preço, sem foto e **sem link para tela
própria** — o cartão deixou de ser `<a>` e virou `<article>`, porque um link
sem destino útil é uma promessa de página que não chega.

**Tudo termina no WhatsApp**, que é onde essa assistência atende:

* o **orçamento** monta a primeira mensagem já com marca, modelo e serviço;
* **agendar a coleta** abre a conversa em vez de gravar um pedido que alguém
  precisa ir buscar no painel;
* contato virou a seção `#contato` da própria landing.

A rota `/orcamento` não desenha nada: lê o que foi escolhido, escreve a mensagem
e responde um 302 para o `wa.me`. **Continua sendo um form GET de verdade** —
poderia ser JavaScript montando o link, e aí ficaria de fora justamente quem
esta assistência atende: o celular velho com a rede ruim. Os nomes saem do
BANCO e não da query, então slug forjado não vira texto na mensagem.

No **como funciona**, o passo 2 passou a dizer as duas portas: *"A gente busca
ou você traz"*. Só "a gente busca" escondia metade do movimento da loja e fazia
quem mora do lado achar que precisava esperar a coleta.

No **rodapé**, "Onde estamos" subiu para o lado de "A Alafcell" (a coluna da
Loja, que separava as duas, saiu).

### Consertos de passagem

- **O telefone vazio virava um link que não disca.** Com `marca.telefone` em
  branco — que é como o site está no ar —, o rodapé gerava
  `<a href="tel:">(00) 0000-0000</a>`. Agora só vira link quando existe.
- **O sitemap oferecia ao Google quase setenta endereços** que agora dão 404.
  Ficaram os três que existem, mais uma linha por matéria. `/orcamento` não
  entra: não é página, é um desvio para o WhatsApp.

### Ferramenta nova: `config.cjs`

`node ferramentas/config.cjs` lista, mostra e grava os textos do site pelo
terminal. Existe porque o `/admin` ainda não existe — e sem ela não há como
testar nada que dependa dos campos que o dono preencheria, a começar pelo
**WhatsApp**, que agora é o destino de todos os botões. Só grava chave que já
existe: campo novo se declara em `src/conteudo-inicial.js`.

⚠ **O texto SEMEADO vence o padrão do código.** Trocar o fallback de
`home.btn1` não mudou a tela: o valor mora no banco desde a primeira subida, e
o site continuou dizendo "Ver preços dos consertos" — num site que acabara de
perder o preço. Base nova pega o texto novo; base que já subiu precisa do
`config.cjs` (ou do painel, quando houver). Vale para todo campo de conteúdo.

### Desligados, não apagados

Os arquivos continuam em `src/`, sem `require` e sem rota. Para religar
qualquer um: o `require` no `server.js` mais a rota que ele tinha.

| arquivo | o que servia | rotas que tinha |
|---|---|---|
| `loja.js` | vitrine, carrinho, checkout, pedido | `/loja/`, `/loja/:cat/`, `/produto/:slug/`, `/carrinho/*`, `/checkout/*`, `/pedido/:codigo/` |
| `consertos.js` | telas por serviço e por modelo, com preços | `/consertos/`, `/consertos/:slug/` |
| `coleta.js` | formulário de agendamento | `/busca-e-leva/` |
| `acompanhar.js` | ordem por código + telefone | `/acompanhar/` (GET e POST) |

⚠ **`src/medicao.js` NÃO está desligado** — uma versão anterior desta nota dizia
que sim, e que ele fazia preço por modelo. As duas coisas eram falsas: ele é o
GA4 + Meta Pixel com o consentimento de cookies, chamado pelo `layout.js` em
toda página. O preço por modelo está na tabela `precos`, lida por `apartirDe()`.

**74 provas** (eram 48). As novas guardam o que foi RETIRADO — que é o que volta
sozinho quando alguém reaproveita um trecho. **9 sabotagens, 9 pegas.**

---

## 0.3.3 — 31/08/2026

- **O verificador agora separa "a aplicação caiu" de "falta o nginx".** São duas
  falhas idênticas vistas de fora e com conserto oposto: numa se olha o journal,
  na outra se roda o `criar-site.sh`. Ele pergunta direto à aplicação, por
  dentro (`127.0.0.1:PORTA/saude`), e diz qual das duas é — em vez de listar
  quatro comandos e deixar quem lê escolher por onde começar.
- `curl -w "%{http_code}"` já imprime `000` quando a conexão falha; o
  `|| echo 000` acrescentava um segundo e a mensagem saía "(000000)".

---

## 0.3.2 — 31/08/2026

Três defeitos que só a primeira subida ao servidor mostra.

- **O serviço não subia: `226/NAMESPACE`.** O `ReadWritePaths` do systemd exige
  caminho existente, e `assets/img/uploads/` não vinha no clone. A mensagem
  ("Failed to set up mount namespacing") não menciona pasta nenhuma, e o
  processo não consegue criar sozinho — sob `ProtectSystem=strict` o pai está
  somente-leitura. Três defesas agora: `.gitkeep` para a pasta viajar no clone,
  `mkdir -p` no `deploy.sh`, e o prefixo `-` em cada `ReadWritePaths` para que
  uma pasta faltando nunca mais derrube o serviço.

- **`StartLimitIntervalSec` estava no `[Service]`, e era ignorado.** Desde o
  systemd 229 a chave pertence ao `[Unit]`. No lugar errado ela não dá erro: o
  journal escreve "Unknown key name … ignoring" e segue — a proteção
  simplesmente não existia.

- **Os `.sh` chegaram ao servidor sem o bit de execução.** O repositório está
  numa máquina Windows com `core.fileMode=false`, então o git gravou modo 644.
  Corrigido com `git update-index --chmod=+x` nos três scripts e nas
  ferramentas.

- **O verificador mentia com o site fora do ar.** Sem resposta do curl, o teste
  do robots caía no ramo "indexável" e o dos arquivos expostos acusava
  vazamento de `/server.js`: 27 problemas onde havia um, dois deles inventados.
  Agora ele pergunta primeiro se o site responde e, se não, para com uma linha e
  a lista de onde olhar.

---

## 0.3.1 — 31/08/2026

Correções apontadas pela primeira subida ao servidor.

- **`npm ci` falhava com "package.json and package-lock.json are in sync".** O
  `package-lock.json` tinha vindo copiado de outro projeto do parque e só teve o
  cabeçalho ajustado — a árvore do `qrcode` (29 pacotes) nunca entrou nele.
  Refeito com `npm install --package-lock-only`, e **provado com um `npm ci` de
  verdade numa pasta limpa**, que é o único jeito de saber que funciona.
  A versão agora sobe no `package.json` **e no lock** juntos: divergir os dois
  reproduz o mesmo erro.
- **O `deploy.sh` recusa rodar como root.** `sudo npm ci` faz o root virar dono
  de `node_modules/`, e a entrega seguinte, feita pelo usuário `deploy`, não
  consegue mais escrever ali — o erro aparece no deploy de amanhã, longe da
  causa. A mensagem já vem com o `chown` de conserto.
- `SUBIR.md` avisa o mesmo no passo do clone.

---

## 0.3.0 — 31/08/2026

Fotografia no site inteiro, e a operação para subir ao servidor.

**As fotos** (`ferramentas/baixar-imagens.cjs`)
- 29 imagens do Unsplash (licença livre, inclusive comercial), baixadas em WebP
  a 1200px — 2,8 MB no total. Ficam **no projeto**, e não consumidas por link do
  fornecedor: link de banco de imagem muda de endereço e o site aparece com
  buraco no lugar da foto, sem erro em lugar nenhum.
- Cada arquivo tem a **assinatura conferida** depois de baixar. Um HTML de erro
  salvo como `.webp` grava sem reclamar e só é descoberto na tela.
- Gera uma **folha de contato** (`assets/img/banco/conferir.html`) e o
  `CREDITOS.md`. A folha responde a única pergunta que nenhum teste automático
  responde: a foto que veio é do assunto certo?
- Cinco fotos vieram 404 (eram Unsplash+) e quatro não batiam com o assunto —
  trocadas depois de olhar a folha de contato.

**Onde elas entram**
- Topo da home: a foto da oficina **dentro da tela do aparelho**, com a
  varredura de luz por cima. É o conceito em uma peça.
- Capa de cada um dos 8 serviços, no cartão e na página.
- Foto em cada um dos 12 produtos da loja.
- Capa das 3 matérias, no cartão e no artigo.
- Busca e leva (com o pulso por cima), garantia, contato, e a faixa vermelha.

**O tratamento** é um só para toda foto de conteúdo: dessatura, escurece e
recebe um véu de grafite; no hover volta ao natural e sobe. Sem isso, doze
fotógrafos diferentes puxam a página para doze lados e o conjunto vira mural.

**Operação**
- `deploy.sh` — backup, git, npm, fotos, semear, **provas**, restart. As provas
  rodam antes do restart: falhou, o site continua no ar com a versão anterior.
  Confere o canonical a cada entrega e grita se a demonstração ainda estiver ativa.
- `criar-site.sh` — DNS, vhost com gzip e cache, certificado, renovação.
- `verificar.sh` — conferir de fora: 15 páginas, 404 de verdade, canonical,
  robots × sitemap coerentes, cabeçalhos e cinco arquivos que não podem vazar.
- `operacao/` — unidade do systemd (sem `MemoryDenyWriteExecute`, que mata o V8),
  backup diário às 03:40 com atraso sorteado.
- `ferramentas/backup.cjs` — `VACUUM INTO`, e não `cp`: em WAL, copiar só o `.db`
  produz um arquivo que abre sem erro e está desatualizado.
- `testes/provar.cjs` — **48 provas** em banco temporário: dinheiro, carrinho,
  privacidade do pedido e da OS, Pix, endereço de trabalho, preços.
  **12 sabotagens, 12 pegas.**
- `SUBIR.md` e `.gitignore` (todo padrão ancorado — `dados/` solto já engoliu
  código em outro projeto do parque).

### Corrigido no caminho

- **`/saude` passou a dizer se a demonstração está ativa** (`demo`, `pixDemo`).
  O aviso do log só é lido por quem está no terminal naquele minuto; assim o
  deploy e o monitoramento também enxergam.
- **O verificador gritava em toda execução local:** comparava o canonical com o
  endereço pedido, e por 127.0.0.1 eles nunca batem. Passou a comparar com o
  `ALAFCELL_SITE` — verificador que grita sempre é verificador que ninguém lê.
- **Uma prova era cega:** a nota interna da bancada usava a situação "reparo",
  que já tinha etapa pública; a deduplicação escondia a nota por acidente e a
  prova passava mesmo com o filtro `publico` removido.
- Fotos de produto sem `width`/`height`, o que fazia a grade pular ao carregar.
- Crase dentro de template literal derrubou o `paginas.js` de novo.

---

## 0.2.0 — 31/08/2026

As sete telas públicas, para apresentação ao cliente.

**Consertos** (`/consertos/`)
- Lista dos serviços com preço "a partir de" e prazo real.
- Recorte por marca (`?marca=`) e a **tabela completa de um aparelho** (`?modelo=`) — é o
  endereço que responde "quanto custa trocar a tela do iPhone 11 em Caruaru".
- Página de cada serviço com a tabela por aparelho ordenada **por preço**, os sintomas na
  linguagem do cliente, ficha de prazo/garantia/orçamento e `Service` no Schema.org.

**Busca e leva** (`/busca-e-leva/`)
- Os cinco passos, a comparação explícita com o "busca e leva por transportadora" das
  franquias, e o formulário de agendamento com endereço e janela de horário.
- Campo isca contra robô: preenchido, o envio é aceito em silêncio e descartado.

**Loja** (`/loja/`, `/loja/:categoria/`, `/produto/:slug/`)
- Vitrine com abas por categoria, ordenação por preço e recorte próprio para **seminovos**.
- O seminovo mostra **saúde da bateria e estado** na vitrine, não escondidos na descrição.
- Sem foto, entra o desenho da categoria em SVG — o cartão nunca fica quebrado.
- Ficha técnica que muda com a condição do produto.

**Carrinho e checkout** (`/carrinho/`, `/checkout/`, `/pedido/:codigo/`)
- Carrinho em cookie guardando só `{id, q}`; **o preço é sempre recalculado no servidor**.
- Checkout de uma tela só, sem cadastro.
- **Pix copia e cola gerado aqui** (padrão EMV do Banco Central, com CRC16) e **QR em SVG
  montado no servidor** — sem gateway, sem taxa e sem dependência externa.
- A tela do pedido só abre para o navegador que comprou, por cookie: o código sozinho não
  mostra os dados de ninguém.
- Estoque baixa na mesma transação do pedido.

**Blog** (`/blog/`, `/blog/:slug/`)
- Índice e matéria, com tempo de leitura, `BlogPosting` e chamada para o orçamento no fim.

**Contato e privacidade** (`/contato/`, `/privacidade/`)
- Canais diretos antes do formulário — numa assistência, quem escreve quer resposta hoje.
- Política de privacidade que lista campo por campo o que cada formulário coleta, por
  quanto tempo fica e como pedir a exclusão.

**Acompanhar o conserto** (`/acompanhar/`)
- Consulta por **código + os quatro últimos dígitos do telefone**; resposta idêntica para
  código inexistente e telefone errado; freio de 5 tentativas por IP a cada 10 minutos.
- Linha do tempo com as oito etapas, a atual acesa e a engrenagem girando nela.
- Nota interna da bancada (`publico = 0`) não aparece.

**Conteúdo de demonstração** (`src/demo.js`)
- Preços de referência, 12 produtos, 3 matérias e a ordem `DEMO-01`. Só entra com as
  tabelas vazias, e sai inteiro com `ALAFCELL_DEMO=nao`.
- Chave Pix de demonstração deliberadamente inválida, com aviso alto a cada subida.

### Corrigido no caminho

- **A consulta de OS consumia o balde de spam dos formulários.** Quem acompanhasse o
  conserto algumas vezes ficava sem conseguir agendar a coleta depois — a trava punindo
  justamente o cliente ansioso. O acompanhamento tem trava própria e saiu do balde geral.
- **O brilho da capa alargava a página em 36px** no celular: o pseudo-elemento passava 10%
  para fora da seção e criava barra de rolagem horizontal em toda tela interna.
  Recortado com `overflow: clip`, que não quebra `position: sticky`.
- **Botão longo não cabia em 345px.** "Ver todos os consertos e os preços" media 358px e
  empurrava a home inteira; com `white-space: nowrap` ele não tinha como ceder. Abaixo de
  420px o rótulo passa a quebrar.
- Descrição da loja tinha 53 caracteres — curta demais para o Google, que completa o
  espaço com trecho aleatório da página.

---

## 0.1.0 — 31/08/2026

Fundação: servidor, banco, sistema visual, layout e home.

- Logotipo extraído do PDF com transparência real (a camada de fundo preto foi cortada do
  fluxo do PDF antes de renderizar), favicons e imagem de compartilhamento.
- Paleta medida no arquivo do logotipo, com a regra de contraste do vermelho documentada.
- Engrenagem de doze dentes em SVG como motivo da interface.
- Página inicial na ordem das perguntas de quem chega, e não na ordem administrativa.
- Endereço de trabalho fora do índice do Google, automaticamente.
