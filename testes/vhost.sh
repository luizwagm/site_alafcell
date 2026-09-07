#!/usr/bin/env bash
# ==========================================================================
#  PROVAS DO GERADOR DE VHOST — criar-site.sh
#
#  ---------------------------------------------------------------------------
#  POR QUE ISTO EXISTE
#
#  O vhost do nginx é montado por heredoc, e heredoc quebra de um jeito
#  traiçoeiro: um `$` mal escapado NÃO derruba o bash — ele faz a substituição
#  falhar e o bloco simplesmente não ser escrito, em silêncio. O script termina
#  com sucesso, o arquivo existe, e falta um pedaço dentro dele.
#
#  Aconteceu com o bloco do `www`: `\\$request_uri` (duas barras) matava a
#  expansão com `set -u`, e o vhost saía sem o redirecionamento — o site teria
#  ido ao ar respondendo igual em dois endereços.
#
#  A primeira tentativa de proteger isso foi um `grep` procurando o escape
#  certo. Conferência por texto de escape é frágil: depende de quantas camadas
#  de citação o shell atravessa, e deu resultados contraditórios nos meus
#  próprios testes. Um teste que engana é pior que nenhum.
#
#  Aqui o script GERA o arquivo de verdade (modo de ensaio, sem root e sem
#  tocar em nginx/certbot/DNS) e a gente olha o que saiu. Comportamento, não
#  texto.
#
#  Uso:  ./testes/vhost.sh
# ==========================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

passou=0; falhou=0
ok()   { printf "    \033[1;32m✓\033[0m %s\n" "$1"; passou=$((passou+1)); }
nao()  { printf "    \033[1;31m✗\033[0m %s\n" "$1"; falhou=$((falhou+1)); }
# `grep -c` imprime 0 E SAI COM ERRO quando nao acha. Com `|| echo 0` isso
# produzia "0\n0" — duas linhas — e todo `[ "$(conta ...)" -eq 0 ]` virava
# "integer expression expected". O sintoma era a prova FALHANDO, o que manda
# procurar defeito no vhost em vez de no teste.
conta() { local n; n=$(grep -cF -- "$2" "$1" 2>/dev/null); echo "${n:-0}"; }

echo ""
echo "  Gerador de vhost"
echo ""

# --------------------------------------------------------------------------
#  Gerar os dois casos
# --------------------------------------------------------------------------
REAL="$TMP/real.conf"
SUB="$TMP/sub.conf"

ALAFCELL_VHOST_ENSAIO="$REAL" "$RAIZ/criar-site.sh" alafcell.com.br 5202 >/dev/null 2>&1
ALAFCELL_VHOST_ENSAIO="$SUB"  "$RAIZ/criar-site.sh" alafcell.projetos.luizaugust.me 5202 >/dev/null 2>&1

[ -s "$REAL" ] && ok "o ensaio gera o vhost do domínio próprio" \
                || nao "o ensaio NÃO gerou o vhost do domínio próprio"
[ -s "$SUB" ]  && ok "e o do subdomínio de trabalho" \
                || nao "o ensaio NÃO gerou o vhost do subdomínio"

# --------------------------------------------------------------------------
#  Nada de shell pode vazar para dentro do arquivo
#
#  Já aconteceu: um bloco `if/exit/fi` foi parar nas primeiras linhas do vhost
#  porque a âncora casou com a ABERTURA do heredoc em vez do fechamento — o
#  delimitador aparece duas vezes. O `bash -n` aprova, porque o script continua
#  sendo shell válido; quem denuncia é olhar o arquivo gerado.
# --------------------------------------------------------------------------
if grep -qE '^\s*(if |fi$|exit |verde |amarelo |vermelho )' "$REAL"; then
  nao "VAZOU shell para dentro do vhost:"
  grep -nE '^\s*(if |fi$|exit |verde |amarelo )' "$REAL" | head -5 | sed 's/^/         /'
else
  ok "nenhuma linha de shell vazou para dentro do vhost"
fi

# --------------------------------------------------------------------------
#  DOMÍNIO PRÓPRIO — o que só existe aqui
# --------------------------------------------------------------------------
echo ""
echo "  Domínio próprio (alafcell.com.br)"
echo ""

# Servir o site igual em www e sem www dá ao buscador duas cópias do mesmo
# site: a força de cada link recebido se divide entre os dois endereços.
# A pergunta NAO e "existe um bloco para o www?" — e "em quantos server_name o
# www aparece?". A primeira versao desta prova contava a linha exata
# `server_name www.alafcell.com.br` e deixou passar a sabotagem: com o www de
# volta ao bloco principal, aquela linha vira
# `server_name alafcell.com.br www.alafcell.com.br` (nao casa) e a contagem
# continuava 1 por causa do bloco de redirecionamento.
#
# O www ficaria em DOIS server_name na porta 80: o nginx avisa "conflicting
# server name", usa o primeiro que carregar, e o site responde igual nos dois
# enderecos — o defeito que este bloco existe para impedir.
VEZES_WWW=$(grep -c '^[[:space:]]*server_name .*www\.alafcell\.com\.br' "$REAL")
[ "${VEZES_WWW:-0}" -eq 1 ] \
  && ok "o www aparece em exatamente um server_name" \
  || nao "o www aparece em ${VEZES_WWW:-0} server_name (esperado 1) — em dois, o site vira cópia de si mesmo"

# E esse server_name tem de ser o do bloco de redirecionamento, sozinho — nao
# pendurado no bloco que serve o site.
[ "$(conta "$REAL" 'server_name www.alafcell.com.br;')" -eq 1 ] \
  && ok "e é o do bloco de redirecionamento, sozinho" \
  || nao "o www está pendurado no server_name do site, não num bloco próprio"

[ "$(conta "$REAL" 'return 301 https://alafcell.com.br$request_uri')" -eq 1 ] \
  && ok "com 301 para o endereço sem www" \
  || nao "o 301 do www não foi escrito (escape do heredoc?)"

# 302 mantém os dois endereços no índice para sempre; só o permanente
# transfere a força do antigo para o novo.
[ "$(conta "$REAL" 'return 302')" -eq 0 ] \
  && ok "e nenhum redirecionamento temporário" \
  || nao "há um 302 no vhost — redirecionamento de domínio tem de ser 301"

# O certbot valida o www por HTTP: se o 301 vier antes do desafio, o
# certificado do www nunca sai, e o erro só aparece na hora de emitir.
ORDEM=$(awk '/server_name www/,/^}/' "$REAL" | grep -n 'acme-challenge\|return 301' | cut -d: -f1 | tr '\n' ' ')
ACME=$(echo "$ORDEM" | awk '{print $1}')
R301=$(echo "$ORDEM" | awk '{print $2}')
if [ -n "$ACME" ] && [ -n "$R301" ] && [ "$ACME" -lt "$R301" ]; then
  ok "o desafio do certbot vem ANTES do redirecionamento"
else
  nao "o acme-challenge não vem antes do 301 — o certificado do www não sai"
fi

# Sem HSTS, a PRIMEIRA visita de cada pessoa sai em HTTP antes do
# redirecionamento — e é nessa visita que dá para interceptar.
#
# DOIS, e não um: `add_header` dentro de um `location` APAGA os do `server`. O
# bloco de /assets/ tem `Cache-Control` próprio, então o HSTS precisa estar
# repetido lá — senão CSS, JS e as fotos saem sem proteção, em silêncio.
[ "$(conta "$REAL" 'Strict-Transport-Security')" -eq 2 ] \
  && ok "HSTS no server E no bloco de estáticos" \
  || nao "HSTS aparece $(conta "$REAL" 'Strict-Transport-Security') vez(es) — esperado 2 (o add_header do location apaga o do server)"

# `preload` é praticamente irreversível e vale para o domínio inteiro: é
# decisão do dono do domínio, não de um script de instalação.
[ "$(conta "$REAL" 'preload')" -eq 0 ] \
  && ok "sem preload (decisão do dono do domínio)" \
  || nao "o HSTS está com preload — isso é irreversível e não cabe a um script"

# --------------------------------------------------------------------------
#  SUBDOMÍNIO DE TRABALHO — o que NÃO pode aparecer aqui
# --------------------------------------------------------------------------
echo ""
echo "  Subdomínio de trabalho"
echo ""

# `www.alafcell.projetos.luizaugust.me` não é endereço nenhum. Pedir
# certificado para ele derruba o certificado INTEIRO, inclusive a parte que
# estava certa.
[ "$(conta "$SUB" 'server_name www')" -eq 0 ] \
  && ok "sem bloco de www (ele não existe num subdomínio)" \
  || nao "há bloco de www num subdomínio — o certbot vai falhar por inteiro"

# O domínio pai já anuncia HSTS com includeSubDomains; repetir aqui não muda
# nada e só faz o arquivo divergir sem motivo.
[ "$(conta "$SUB" 'Strict-Transport-Security')" -eq 0 ] \
  && ok "sem HSTS (herda do domínio pai)" \
  || nao "HSTS repetido no subdomínio — o pai já anuncia com includeSubDomains"

# O que vale nos dois casos.
for A in "$REAL" "$SUB"; do
  N=$(basename "$A" .conf)
  [ "$(conta "$A" 'gzip on;')" -ge 1 ] && ok "[$N] compressão ligada" \
    || nao "[$N] sem gzip — foi o gargalo de TTFB em outro site do parque"
  # O $proxy_add_x_forwarded_for mora em /etc/nginx/proxy_alafcell.conf, que o
  # ensaio nao gera (escrever ali exige root). O que da para conferir aqui e
  # que o vhost INCLUI esse arquivo: sem o include, o Node nao recebe o IP
  # real e a trava de forca bruta conta todos os visitantes como um so.
  [ "$(conta "$A" 'include /etc/nginx/proxy_alafcell.conf;')" -ge 1 ] \
    && ok "[$N] inclui os cabeçalhos de proxy" \
    || nao "[$N] sem o include do proxy — o Node não recebe o IP real do visitante"
done

echo ""
if [ "$falhou" -gt 0 ]; then
  printf "  \033[1;31m✖\033[0m %d passaram, %d falharam\n\n" "$passou" "$falhou"
  exit 1
fi
printf "  \033[1;32m✔\033[0m %d passaram, 0 falharam\n\n" "$passou"
