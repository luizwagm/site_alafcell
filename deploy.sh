#!/usr/bin/env bash
# ==========================================================================
# ALAFCELL ASSISTEC — deploy
#
#   ./deploy.sh
#
# Roda NO SERVIDOR, como o usuário `deploy`, de dentro da pasta do projeto.
#
# ---------------------------------------------------------------------------
# QUATRO COISAS QUE ESTE ARQUIVO NÃO FAZ, DE PROPÓSITO
#
# 1. Não roda `pkill -f "node server.js"`. Todos os sites do servidor rodam
#    exatamente esse comando, com o mesmo usuário — um pkill assim já derrubou
#    o site de outro cliente no meio do expediente. Aqui quem para é o systemd,
#    pela unidade, que sabe qual processo é qual.
#
# 2. Não faz `chown -R root`. O dono do código é `deploy`, senão a entrega
#    seguinte não consegue escrever na própria pasta. A contenção quem faz é o
#    systemd, não a permissão do arquivo.
#
# 3. Não segue em frente depois de um erro. `set -euo pipefail`, e no pipe é o
#    `pipefail` que segura: sem ele, `comando_que_falha | tee log` retorna zero
#    e o deploy continua sobre um passo quebrado.
#
# 4. Não reinicia o serviço se as provas falharem. O site continua no ar com a
#    versão anterior, que é o comportamento certo — release quebrada no ar é
#    pior que release atrasada.
# ==========================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ"

UNIDADE="${ALAFCELL_UNIDADE:-alafcell}"
PORTA="${ALAFCELL_PORTA:-5202}"

# O endereço público sai do .env, que é quem manda no canonical e no robots.
# Lido aqui só para MOSTRAR no fim — o serviço lê o arquivo por conta própria.
ENDERECO=$(grep -m1 '^ALAFCELL_SITE=' "$RAIZ/.env" 2>/dev/null | cut -d= -f2-)
ENDERECO="${ENDERECO:-https://alafcell.projetos.luizaugust.me}"

azul()  { printf '\033[1;34m%s\033[0m\n' "$*"; }
verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
amar()  { printf '\033[1;33m%s\033[0m\n' "$*"; }
erro()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }

# ==========================================================================
# NÃO RODE ISTO COMO ROOT
#
# `sudo npm ci` faz o root virar dono de node_modules/ — e a entrega SEGUINTE,
# feita pelo usuário `deploy`, não consegue mais escrever ali. O erro só
# aparece no deploy de amanhã, longe da causa.
#
# O único passo que precisa de raiz é o `systemctl restart`, e ele já pede
# sudo sozinho, na linha dele.
# ==========================================================================
if [ "$(id -u)" -eq 0 ]; then
  erro "Não rode o deploy como root (nem com sudo)."
  erro "Rode como o usuário dono do código:  sudo -u deploy ./deploy.sh"
  erro ""
  erro "Se já rodou com sudo, devolva a posse antes:"
  erro "  sudo chown -R deploy:deploy \"$RAIZ\""
  exit 1
fi

azul "── Alafcell · deploy ────────────────────────────────"

# ---------------------------------------------------------------- 1. backup
# ANTES de qualquer coisa. Se a migração de esquema der errado, o que salva é a
# cópia de agora — não a de ontem de madrugada.
azul "1/7  cópia de segurança do banco"
node ferramentas/backup.cjs | sed 's/^/     /'

# ------------------------------------------------------------------ 2. código
azul "2/7  buscando o código novo"
ANTES="$(git rev-parse HEAD)"
git fetch --quiet origin
# Conferir ANTES de puxar: `git status` mostra se há trabalho não commitado no
# servidor (alguém editou um arquivo direto lá — acontece).
if [ -n "$(git status --porcelain)" ]; then
  erro "     Há alterações não commitadas NO SERVIDOR. Resolva antes de continuar:"
  git status --short | sed 's/^/       /'
  exit 1
fi
git pull --ff-only --quiet
DEPOIS="$(git rev-parse HEAD)"

if [ "$ANTES" = "$DEPOIS" ]; then
  echo "     nada novo ($(git rev-parse --short HEAD))"
else
  echo "     $(git rev-parse --short "$ANTES") → $(git rev-parse --short "$DEPOIS")"
  git log --oneline "$ANTES..$DEPOIS" | sed 's/^/       /'
fi

# ------------------------------------------------------------ 3. dependências
azul "3/7  dependências"
npm ci --omit=dev --silent
echo "     ok"

# -------------------------------------------------------------------- 4. fotos
# As fotos de banco NÃO vão no repositório (2,8 MB de binário que nunca muda).
# Este passo baixa o que faltar; o que já está no disco não é rebaixado.
azul "4/7  fotos do site"
node ferramentas/baixar-imagens.cjs | tail -3 | sed 's/^/     /'

# ------------------------------------------------------------------ 5. dados
# `semear` é idempotente: acrescenta o que falta e não toca no que a loja já
# cadastrou. É o que permite mandar um serviço novo junto com o código, sem
# passo manual.
azul "5/7  conteúdo inicial (só o que faltar)"
node ferramentas/semear.cjs | sed 's/^/     /'

# ------------------------------------------------------------------ 6. provas
# As provas rodam num banco temporário e NÃO tocam o banco do cliente.
azul "6/7  provando antes de subir"
if ! node testes/provar.cjs > /tmp/alafcell-provas.log 2>&1; then
  erro "     As provas FALHARAM. O serviço NÃO foi reiniciado."
  erro "     O site continua no ar com a versão anterior."
  grep -E '✖' /tmp/alafcell-provas.log | head -20 | sed 's/^/       /' >&2
  exit 1
fi
tail -2 /tmp/alafcell-provas.log | sed 's/^/     /'

# ---------------------------------------------------------------- 7. serviço
azul "7/7  reiniciando o serviço"
sudo systemctl restart "${UNIDADE}.service"

# Espera o site RESPONDER, e não apenas o systemd dizer "active". Um serviço
# pode estar "active" com o Node ainda abrindo o banco.
for i in $(seq 1 20); do
  if curl -fsS --max-time 2 "http://127.0.0.1:${PORTA}/saude" > /tmp/alafcell-saude.json 2>/dev/null; then
    verde ""
    verde "  ✔ no ar — $(cat /tmp/alafcell-saude.json)"
    echo   "    endereço: ${ENDERECO}"

    # ==========================================================================
    # O CANONICAL É CONFERIDO A CADA ENTREGA
    #
    # É o defeito mais caro e mais silencioso desta arquitetura: um canonical
    # apontando para o endereço errado manda o Google indexar outro site, e nada
    # na tela denuncia. Um .env sem ALAFCELL_SITE, ou um serviço que subiu sem
    # ler o arquivo, produz exatamente isso — e passa despercebido por semanas.
    # ==========================================================================
    CANON=$(curl -fsS --max-time 5 "http://127.0.0.1:${PORTA}/" 2>/dev/null \
            | grep -o 'rel="canonical" href="[^"]*"' | head -1 | sed 's/.*href="//;s/"//')
    if [ -n "$CANON" ] && [ "${CANON#"$ENDERECO"}" != "$CANON" ]; then
      echo "    canonical: ${CANON} ✔"
    else
      erro ""
      erro "  ! o canonical saiu como '${CANON}', e não sob '${ENDERECO}'."
      erro "    Confira ALAFCELL_SITE no .env — o site está anunciando o endereço errado."
    fi

    if curl -fsS --max-time 5 "http://127.0.0.1:${PORTA}/robots.txt" 2>/dev/null | grep -q '^Disallow: /$'; then
      echo "    robots: FORA do índice (endereço de trabalho)"
    else
      echo "    robots: indexável"
    fi

    # ------------------------------------------------------------------------
    # DOIS AVISOS QUE PRECISAM GRITAR ENQUANTO O SITE FOR DE DEMONSTRAÇÃO
    #
    # A chave Pix de demonstração não recebe dinheiro, e os preços não são os da
    # loja. Os dois passam despercebidos justamente porque a tela fica bonita.
    # ------------------------------------------------------------------------
    if grep -q '"demo":true' /tmp/alafcell-saude.json 2>/dev/null; then
      amar ""
      amar "  ⚠ conteúdo de DEMONSTRAÇÃO ainda ativo — nenhum preço ali é real."
      amar "    Suba com ALAFCELL_DEMO=nao na unidade quando o cliente preencher os dados."
    fi
    if grep -q '"pixDemo":true' /tmp/alafcell-saude.json 2>/dev/null; then
      amar "  ⚠ a chave Pix ainda é a de DEMONSTRAÇÃO e NÃO recebe pagamento."
      amar "    Cadastre a chave real em /admin antes de divulgar o endereço."
    fi

    verde ""
    exit 0
  fi
  sleep 1
done

erro ""
erro "  ✖ o serviço subiu mas /saude não respondeu em 20s."
erro "    journalctl -u ${UNIDADE} -n 50 --no-pager"
erro ""
exit 1
