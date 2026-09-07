# GitHub Actions — Alafcell Assistec

Depois disto configurado, publicar é:

```bash
git push
```

O GitHub roda as três suítes, e só se todas passarem ele entra no servidor e
executa o `deploy.sh`. Uma suíte vermelha não vira site no ar.

---

## O que já está pronto no repositório

| Arquivo | O que faz |
|---|---|
| `.github/workflows/testes.yml` | Roda em todo push e todo PR. Compila todo JS e todo shell, confere CRLF, confere a versão no lock, e roda as três suítes (279 provas). |
| `.github/workflows/deploy.yml` | Só na `main`. Chama os testes, entra por SSH, roda o `deploy.sh`, e **confere que a versão no ar é a deste commit**. |
| `.gitattributes` | Garante LF nos `.sh`, `.service` e `.conf`. Sem isso o Windows manda CRLF e o bash não roda o script no servidor. |

Você não precisa mexer em nada disso. O que falta é o que **só pode ser feito
por você**: a chave, o sudo e os segredos.

---

## Antes de começar: duas chaves, sentidos opostos

Esta é a confusão que mais custa tempo aqui. São duas chaves diferentes, e
usar uma no lugar da outra dá o mesmo erro sem explicação
(`Permission denied (publickey)`).

| | Quem usa | Para quê |
|---|---|---|
| **Deploy key** (no GitHub) | O **servidor** | Ler o repositório — é o que faz o `git pull` do `deploy.sh` funcionar |
| **Chave de entrega** (no servidor) | O **GitHub** | Entrar no servidor por SSH e mandar rodar o deploy |

Esta página trata da **segunda**. A primeira é o que faltava no Instituto
Kenósis quando o deploy falhou com
`fatal: could not read Username for 'https://github.com'` — sinal de que o
clone estava por HTTPS em vez de SSH.

---

## Passo 1 — O servidor consegue ler o GitHub?

**No servidor**, como o usuário `deploy`:

```bash
cd /var/www/projetos/Alafcell-Assistec && git remote -v && git pull --ff-only
```

- Se pedir usuário e senha, o clone está por **HTTPS** e precisa virar SSH
  (passo 1b).
- Se atualizar sem perguntar nada, pule para o passo 2.

### Passo 1b — Trocar para SSH e criar a deploy key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github-alafcell -N "" -C "deploy-key-alafcell"
cat ~/.ssh/github-alafcell.pub
```

Copie a saída e cole em **GitHub → o repositório `site_alafcell` → Settings →
Deploy keys → Add deploy key**. Deixe **"Allow write access" DESMARCADO** — o
servidor só precisa ler.

Ainda no servidor, ensine o SSH a usar essa chave para este repositório:

```bash
cat >> ~/.ssh/config <<'FIM'

Host github-alafcell
  HostName github.com
  User git
  IdentityFile ~/.ssh/github-alafcell
  IdentitiesOnly yes
FIM
chmod 600 ~/.ssh/config
```

E aponte o repositório para esse apelido:

```bash
cd /var/www/projetos/Alafcell-Assistec
git remote set-url origin git@github-alafcell:luizwagm/site_alafcell.git
git pull --ff-only
```

Tem de atualizar **sem pedir senha**. Se pedir, a chave pública não entrou nas
Deploy keys.

> `IdentitiesOnly yes` não é enfeite: sem ele, o SSH oferece todas as chaves do
> agente antes desta. Com várias chaves no servidor, o GitHub recusa por
> excesso de tentativas — e o erro fala de autenticação, não de quantidade.

---

## Passo 2 — A chave que o GitHub usa para entrar no servidor

**No servidor**, como `deploy`. Este servidor já segue um padrão: uma chave por
projeto em `~/.ssh/chaves-entrega/`, e backup do `authorized_keys` antes de
cada mudança.

```bash
mkdir -p ~/.ssh/chaves-entrega && chmod 700 ~/.ssh/chaves-entrega && ssh-keygen -t ed25519 -f ~/.ssh/chaves-entrega/alafcell -N "" -C "entrega-alafcell" && cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.antes-alafcell.$(date +%Y-%m-%d-%H%M%S) && cat ~/.ssh/chaves-entrega/alafcell.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
```

> **Gerar a chave não é aceitá-la.** Ela só vale depois de entrar no
> `authorized_keys`. Pular esse pedaço dá exatamente
> `Permission denied (publickey)`, sem outra pista.

Confirme que ela está entre as aceitas:

```bash
ssh-keygen -lf ~/.ssh/chaves-entrega/alafcell.pub; echo "--- aceitas ---"; ssh-keygen -lf ~/.ssh/authorized_keys
```

A primeira impressão digital tem de aparecer na lista de baixo.

---

## Passo 3 — Deixar o deploy rodar como root, só ele

```bash
echo 'deploy ALL=(root) NOPASSWD: /var/www/projetos/Alafcell-Assistec/deploy.sh' | sudo tee /etc/sudoers.d/alafcell && sudo chmod 440 /etc/sudoers.d/alafcell && sudo visudo -c
```

`NOPASSWD` para **um comando**, nunca para `ALL` — senão quem tomar a sessão do
`deploy` vira root de graça.

Teste antes de seguir:

```bash
sudo -n /var/www/projetos/Alafcell-Assistec/deploy.sh --help 2>&1 | head -3
```

Se pedir senha, o arquivo do sudoers não está valendo (confira o caminho, que
tem de ser **exatamente** o mesmo).

---

## Passo 4 — Os segredos no GitHub

**Settings → Secrets and variables → Actions → New repository secret**

| Segredo | Valor | Como obter |
|---|---|---|
| `SSH_HOST` | o IP do servidor | você já tem |
| `SSH_USER` | `deploy` | — |
| `SSH_KEY` | a chave **privada** inteira | `cat ~/.ssh/chaves-entrega/alafcell` |
| `SSH_KNOWN_HOSTS` | a identidade do servidor | `ssh-keyscan -H <IP>` |
| `SSH_PORT` | só se o SSH não estiver na 22 | — |

Sobre o `SSH_KEY`: é o arquivo **sem** `.pub`, com as linhas
`-----BEGIN OPENSSH PRIVATE KEY-----` e `-----END...` incluídas. Colar o `.pub`
por engano é o erro campeão — o workflow detecta e avisa, mas melhor não cair
nele.

`SSH_KNOWN_HOSTS` é opcional. Sem ele o runner aceita a chave do servidor sem
conferir na primeira conexão: funciona, mas não protege contra alguém no meio
do caminho — e a chave iria junto. O workflow emite um aviso quando falta.

---

## Passo 5 — Rodar

Aba **Actions** → **Deploy** → **Run workflow**.

Roda tudo sem depender de push, e é a forma segura de conferir a configuração.

### O que você deve ver

```
✓ Testes / provar
✓ Deploy / subir
  → segredos presentes
  → acesso SSH OK
  → esperada: 0.10.0 · no ar: 0.10.0
  → endereço anunciado: https://alafcell.projetos.luizaugust.me · indexável: false
```

O aviso de "fora do índice" é esperado enquanto o site estiver no endereço de
trabalho. Ele some depois da virada para `alafcell.com.br` (ver
[SUBIR.md](SUBIR.md)).

---

## Quando der errado

### `Permission denied (publickey)`

O workflow imprime a **impressão digital da chave que usou**. No servidor:

```bash
ssh-keygen -lf ~/.ssh/authorized_keys | grep '<a impressão digital do log>'
```

Sem saída, a pública não foi acrescentada — refaça o passo 2.

O workflow também detecta o caso de você ter colado a **deploy key do GitHub**
no `SSH_KEY`: ele pergunta ao próprio GitHub se a chave é dele e avisa. São
sentidos opostos (ver a tabela lá em cima).

### `sudo: a password is required`

O arquivo em `/etc/sudoers.d/alafcell` não está valendo. O caminho ali tem de
ser **idêntico** ao que o workflow chama, incluindo maiúsculas.

### `fatal: could not read Username for 'https://github.com'`

Isto acontece **dentro** do `deploy.sh`, no servidor — não é a chave de
entrega. O clone está por HTTPS: refaça o passo 1b.

### O deploy passa mas a versão não bate

```
::error::a versão no ar (0.9.0) não é a deste commit (0.10.0)
```

O script rodou e o serviço não pegou o código novo. No servidor:

```bash
sudo systemctl status alafcell
sudo journalctl -u alafcell -n 50 --no-pager
```

Este passo existe justamente porque nada mais denuncia esse caso: o deploy
termina com sucesso e o site continua no código antigo.

---

## O que o workflow confere, e por que cada coisa

Nenhum destes passos é genérico — cada um veio de algo que já quebrou:

| Conferência | O que ela impede |
|---|---|
| Todo JS compila | Crase dentro de template literal já derrubou `db.js`, `layout.js` e `paginas.js` |
| Todo shell compila | `.sh` quebrado só aparece no meio de uma entrega |
| Nenhum CRLF | `#!/usr/bin/env bash\r` vira "interpretador não encontrado", apontando para um arquivo que existe |
| Versão bate no lock | O lock veio copiado de outro projeto na primeira subida e o `npm ci` recusou |
| Provas do vhost | Heredoc com `$` mal escapado **não escreve o bloco**, em silêncio — foi assim que o redirecionamento do `www` sumiu |
| Suíte de rotas | `/robots.txt` e `/saude` responderam 404 por várias versões com as provas verdes: a função existia, a rota não |
| Nenhum lixo para trás | A suíte deixava o banco de prova acumulando (177 arquivos) |
| Versão no ar | "O script rodou mas o serviço não reiniciou" |
| Endereço anunciado | Canonical errado manda o Google indexar outro site, e nada na tela denuncia |

---

## Armadilha guardada: `command=` no `authorized_keys`

Se um dia você quiser prender a chave de entrega a um comando único (o que o
BemEstarClinic faz), saiba disto antes:

> A chave presa com `command=` **ignora o comando pedido** e roda o dela.
> Testar a conexão **já dispara o deploy**.

Prenda primeiro a um `echo` para conferir o acesso, e só depois troque pelo
comando de verdade. E confira `git log HEAD..@{u}` antes de testar num site com
cliente — o teste vai entregar o que estiver no repositório.
