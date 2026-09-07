#!/usr/bin/env bash
# ==========================================================================
# ALAFCELL ASSISTEC — conferir o site DE FORA
#
#   ./verificar.sh                          → o endereço do .env
#   ./verificar.sh https://alafcell.com.br  → um endereço qualquer
#
# Roda de qualquer lugar: só usa curl. É a conferência que o deploy não faz,
# porque o deploy olha para dentro (127.0.0.1) e aqui se olha pela porta da
# frente — que é por onde o cliente e o Google entram.
# ==========================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ALVO="${1:-}"
if [ -z "$ALVO" ]; then
  ALVO=$(grep -m1 '^ALAFCELL_SITE=' "$RAIZ/.env" 2>/dev/null | cut -d= -f2-)
  ALVO="${ALVO:-http://127.0.0.1:5202}"
fi
ALVO="${ALVO%/}"

verde()   { printf "  \033[1;32m✔\033[0m %s\n" "$1"; }
vermelho(){ printf "  \033[1;31m✖\033[0m %s\n" "$1"; }
amarelo() { printf "  \033[1;33m!\033[0m %s\n" "$1"; }
azul()    { printf "\n\033[1;34m%s\033[0m\n" "$1"; }

FALHAS=0
falha() { vermelho "$1"; FALHAS=$((FALHAS + 1)); }

pega() { curl -s --max-time 10 "$ALVO$1"; }
codigo() { curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$ALVO$1"; }

echo "── Alafcell · verificação de $ALVO ──"

# ==========================================================================
# O SITE ESTÁ DE PÉ?
#
# Sem esta porta de entrada, um site FORA DO AR produzia 27 linhas vermelhas
# — e algumas delas MENTIAM: com o curl devolvendo vazio, o teste do robots
# caía no ramo "indexável" e o dos arquivos expostos acusava vazamento de
# `/server.js`. Vinte e sete problemas onde havia UM, e dois deles inventados.
#
# Diagnóstico em cascata só confunde. Se a porta não abre, o resto não é
# pergunta que faça sentido.
# ==========================================================================
INICIAL=$(codigo "/saude")
if [ "$INICIAL" = "000" ]; then
  echo
  vermelho "o site não respondeu em $ALVO — nada foi conferido."

  # ------------------------------------------------------------------------
  # DE QUEM É A CULPA: DA APLICAÇÃO OU DO NGINX?
  #
  # São duas falhas que se parecem de fora e têm conserto oposto. Perguntar
  # direto à aplicação, por dentro, separa as duas em uma linha — em vez de
  # deixar quem lê escolher entre quatro comandos sem saber por qual começar.
  # ------------------------------------------------------------------------
  PORTA_LOCAL="${ALAFCELL_PORTA:-5202}"
  # Sem `|| echo 000`: o próprio `-w "%{http_code}"` já imprime 000 quando a
  # conexão falha, e o `||` acrescentava um segundo — a mensagem saía "(000000)".
  DENTRO=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3            "http://127.0.0.1:${PORTA_LOCAL}/saude" 2>/dev/null)

  echo
  if [ "$DENTRO" = "200" ]; then
    verde "a APLICAÇÃO está no ar em 127.0.0.1:${PORTA_LOCAL}"
    amarelo "o que falta é o NGINX: não há vhost nem certificado para este endereço."
    echo
    echo "  É exatamente o que o criar-site.sh faz — rode uma vez:"
    echo "    sudo ./criar-site.sh ${ALVO#https://} ${PORTA_LOCAL}"
    echo
    echo "  (sob *.projetos.luizaugust.me o navegador recusa http:// por HSTS,"
    echo "   então até o certificado sair a página não abre. É esperado.)"
  else
    vermelho "a APLICAÇÃO também não responde em 127.0.0.1:${PORTA_LOCAL} (${DENTRO})"
    echo
    echo "  Comece por ela, e só depois olhe o nginx:"
    echo "    sudo systemctl status alafcell --no-pager"
    echo "    sudo journalctl -u alafcell -n 40 --no-pager"
  fi
  echo
  exit 1
fi

# ------------------------------------------------------------ as páginas
azul "Páginas"
# A LISTA ACOMPANHOU A 0.4.0. Ela cobrava /consertos/, /loja/, /carrinho/,
# /contato/ e /acompanhar/ — removidos de propósito quando o site virou landing
# — e acusava 8 problemas onde não havia nenhum. Verificador que grita sempre é
# verificador que ninguém lê, e o problema de verdade passa no meio dos falsos.
for R in / /blog/ /privacidade/ /saude /robots.txt /sitemap.xml; do
  C=$(codigo "$R")
  if [ "$C" = "200" ]; then verde "$R"; else falha "$R respondeu $C"; fi
done

# As rotas removidas não saem da conferência: viram a lista do que TEM de
# responder 404. Uma delas voltando a responder 200 é loja reaberta sem querer
# — com carrinho, checkout e preço de conserto na tela.
for R in /consertos/ /loja/ /carrinho/ /checkout/ /contato/ /acompanhar/; do
  C=$(codigo "$R")
  if [ "$C" = "404" ]; then verde "$R continua fora (404)"
  else falha "$R respondeu $C — esta rota foi REMOVIDA na 0.4.0 e não deveria existir"; fi
done

# Uma página que NÃO deve existir precisa responder 404, e não 200. Um
# roteador que devolve a home para qualquer caminho faz o Google indexar
# milhares de endereços duplicados.
C=$(codigo "/pagina-que-nao-existe/")
if [ "$C" = "404" ]; then verde "/pagina-que-nao-existe/ responde 404"; else falha "caminho inexistente respondeu $C (devia ser 404)"; fi

# --------------------------------------------------------------- o Google
azul "Como o Google vê"
HOME_HTML=$(pega "/")
CANON=$(echo "$HOME_HTML" | grep -o 'rel="canonical" href="[^"]*"' | head -1 | sed 's/.*href="//;s/"//')

# ==========================================================================
# O CANONICAL SE COMPARA COM O ENDEREÇO PÚBLICO, NÃO COM O QUE FOI PEDIDO
#
# Conferindo por 127.0.0.1 — que é como se confere no servidor e no deploy — o
# canonical NUNCA vai ser "http://127.0.0.1", e nem deve ser: ele tem de
# apontar para o domínio público. Comparar com o alvo faria o verificador
# gritar em toda execução local, e verificador que grita sempre é verificador
# que ninguém lê.
#
# A conta certa: quando se pede por localhost, o esperado é o ALAFCELL_SITE do
# .env. Quando se pede pelo domínio de verdade, o esperado é o próprio.
# ==========================================================================
ESPERADO="$ALVO"
case "$ALVO" in
  *127.0.0.1*|*localhost*)
    DO_ENV=$(grep -m1 '^ALAFCELL_SITE=' "$RAIZ/.env" 2>/dev/null | cut -d= -f2-)
    ESPERADO="${DO_ENV:-https://alafcell.projetos.luizaugust.me}"
    ESPERADO="${ESPERADO%/}"
    echo "  (conferindo por localhost: o canonical esperado é o do .env)"
    ;;
esac

if [ "$CANON" = "$ESPERADO/" ]; then
  verde "canonical: $CANON"
else
  falha "canonical é '$CANON', mas o endereço público é '$ESPERADO/' — o Google indexaria o site errado"
fi

TITULO=$(echo "$HOME_HTML" | grep -o '<title>[^<]*' | head -1 | sed 's/<title>//')
DESC=$(echo "$HOME_HTML" | grep -o 'name="description" content="[^"]*"' | head -1 | sed 's/.*content="//;s/"//')
[ -n "$TITULO" ] && verde "título ($(echo -n "$TITULO" | wc -c) car.): $TITULO" || falha "sem <title>"
[ ${#DESC} -ge 70 ] && verde "descrição: ${#DESC} caracteres" || amarelo "descrição curta (${#DESC} car.) — o Google completa com trecho aleatório"

echo "$HOME_HTML" | grep -q 'application/ld+json' && verde "JSON-LD presente" || falha "sem JSON-LD na home"

ROBOTS=$(pega "/robots.txt")
if echo "$ROBOTS" | grep -q '^Disallow: /$'; then
  amarelo "robots.txt: FORA do índice (endereço de trabalho)"
  echo "$ROBOTS" | grep -q 'Sitemap:' && falha "…mas publica Sitemap — as duas coisas ao mesmo tempo" \
                                       || verde "e sem linha de Sitemap, como deve ser"
else
  verde "robots.txt: indexável"
  echo "$ROBOTS" | grep -q 'Sitemap:' && verde "com a linha do Sitemap" \
    || falha "sem linha 'Sitemap:' — é por ela que o buscador acha o mapa do site"

  MAPA=$(pega "/sitemap.xml")
  URLS=$(echo "$MAPA" | grep -c '<loc>')
  [ "$URLS" -gt 0 ] && verde "sitemap com $URLS endereços" || falha "sitemap vazio num site indexável"
  # Sem `lastmod` o buscador revisita tudo na mesma cadência e matéria nova
  # demora a aparecer.
  echo "$MAPA" | grep -q '<lastmod>' && verde "com data de última alteração" \
    || amarelo "sitemap sem <lastmod> — o buscador não sabe o que revisitar"

  # O cabeçalho de noindex NÃO pode existir num site que quer ser encontrado.
  # Ele apaga o site inteiro da busca e é invisível para quem só olha a tela.
  if curl -s -I --max-time 10 "$ALVO/" | tr -d '\r' | grep -qi '^X-Robots-Tag:.*noindex'; then
    falha "X-Robots-Tag: noindex num site indexável — o Google vai TIRAR o site da busca"
  else
    verde "sem X-Robots-Tag de noindex"
  fi
fi

# ------------------------------------------------ o www e o HSTS (domínio próprio)
# Isto é configuração de NGINX: não aparece em nenhuma das duas suítes, que
# rodam contra o Node. Só dá para conferir de fora.
HOST=$(echo "$ALVO" | sed 's|^https\?://||; s|/.*||')
case "$HOST" in
  *.projetos.luizaugust.me|localhost*|127.0.0.1*)
    : ;;  # subdomínio de trabalho: não tem www e herda o HSTS do domínio pai
  *)
    azul "Domínio próprio"

    # Servir o site igual em www e sem www dá ao buscador duas cópias do mesmo
    # site, dividindo a força de cada link recebido entre os dois endereços.
    CODIGO_WWW=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://www.$HOST/" 2>/dev/null || echo "000")
    case "$CODIGO_WWW" in
      301) verde "www redireciona (301) para o endereço sem www" ;;
      302|307) falha "www redireciona com $CODIGO_WWW — tem de ser 301, senão os dois ficam no índice" ;;
      200) falha "www responde 200: o site está no ar em DOIS endereços, competindo consigo mesmo" ;;
      000) amarelo "www.$HOST não respondeu — confira o DNS e o certificado" ;;
      *)   amarelo "www.$HOST respondeu $CODIGO_WWW" ;;
    esac

    # Sem HSTS a PRIMEIRA visita de cada pessoa sai em HTTP antes do
    # redirecionamento — e é nessa visita que dá para interceptar.
    curl -s -I --max-time 10 "$ALVO/" | tr -d '\r' | grep -qi '^Strict-Transport-Security:' \
      && verde "HSTS presente" \
      || falha "sem Strict-Transport-Security — a primeira visita de cada pessoa sai em HTTP"

    # ARMADILHA DO NGINX: `add_header` dentro de um `location` APAGA os do
    # `server`. O bloco de /assets/ tem o seu (Cache-Control), então o HSTS
    # precisa estar repetido lá. A home aprovar não prova nada sobre os
    # estáticos — é o furo clássico, e some sem aviso.
    curl -s -I --max-time 10 "$ALVO/assets/css/estilo.css" | tr -d '\r' \
      | grep -qi '^Strict-Transport-Security:' \
      && verde "HSTS também nos estáticos" \
      || falha "estáticos SEM HSTS: add_header no location /assets/ apagou o do server"
    ;;
esac

# ------------------------------------------------------- o que o Google lê
azul "Ficha do negócio"
LD=$(echo "$HOME_HTML" | tr -d '\n' | grep -o '<script type="application/ld+json">.*</script>' | head -1)

confere_ld() {   # $1 = campo, $2 = por que importa
  if echo "$LD" | grep -q "\"$1\""; then
    verde "$1"
  else
    amarelo "$1 ausente — $2"
  fi
}
confere_ld telephone   "o botão de ligar do resultado de busca não aparece"
confere_ld address     "sem endereço a loja não entra na busca local"
confere_ld geo         "é o que responde 'perto de mim' sem depender do endereço"
confere_ld hasMap      "é o que liga esta página à ficha do negócio no Maps"
confere_ld knowsAbout  "é o campo que responde 'quem conserta iPhone em Caruaru?'"
confere_ld areaServed  "sem ele, só quem busca por Caruaru encontra"
# O horário é o mais esquecido, e é o que decide se o Google mostra
# "aberto agora" ao lado do nome.
if echo "$LD" | grep -q "openingHoursSpecification"; then
  verde "horário estruturado"
else
  amarelo "horário estruturado ausente — preencha 'Horário para o Google' no /admin"
  echo   "      (formato: uma faixa por linha, ex.: Mo-Fr 09:00-18:00)"
fi

# ---------------------------------------------------- o resumo para as IAs
LLMS=$(pega "/llms.txt")
if echo "$LLMS" | grep -q "^# "; then
  verde "llms.txt ($(echo "$LLMS" | wc -c) bytes)"
  # Ele é feito para ser citado SEM conferência: um dado provisório aqui seria
  # repetido por um assistente com a autoridade da fonte oficial.
  echo "$LLMS" | grep -qi "preencha" \
    && falha "…mas há texto de espera dentro dele — preencha o cadastro no /admin" \
    || verde "sem texto de espera dentro"
else
  amarelo "llms.txt não respondeu (só existe no endereço público)"
fi

# Os robôs de IA obedecem a UM grupo só e ignoram o `User-agent: *`: um grupo
# sem os Disallow libera o painel para eles.
GRUPOS_SEM_BLOQUEIO=$(echo "$ROBOTS" | awk -v RS='' '/User-agent:/ && !/Disallow: \/admin\//' | grep -c 'User-agent:' || true)
[ "${GRUPOS_SEM_BLOQUEIO:-0}" -eq 0 ] \
  && verde "todo grupo do robots proíbe o painel" \
  || falha "há grupo no robots.txt sem 'Disallow: /admin/' — robots.txt não herda regras"

# ------------------------------------------------------------- segurança
azul "Segurança"
CAB=$(curl -s -I --max-time 10 "$ALVO/" | tr -d '\r')
for H in "X-Content-Type-Options" "X-Frame-Options" "Referrer-Policy"; do
  echo "$CAB" | grep -qi "^$H:" && verde "$H" || falha "falta o cabeçalho $H"
done

# O código-fonte não pode sair pela web. Uma lista de extensões permitidas já
# deixou `GET /server.js` responder 200 em outro projeto do parque.
for A in /server.js /package.json /.env /data/alafcell.db /src/db.js; do
  C=$(codigo "$A")
  [ "$C" = "404" ] && verde "$A não vaza (404)" || falha "$A respondeu $C — o arquivo está exposto"
done

# ---------------------------------------------------------------- estado
azul "Estado"
SAUDE=$(pega "/saude")
echo "  $SAUDE"
echo "$SAUDE" | grep -q '"demo":true' && amarelo "conteúdo de DEMONSTRAÇÃO ativo — nenhum preço é real"
echo "$SAUDE" | grep -q '"pixDemo":true' && amarelo "chave Pix de DEMONSTRAÇÃO — não recebe pagamento"

echo
if [ "$FALHAS" -eq 0 ]; then
  printf "\033[1;32m  Tudo certo.\033[0m\n\n"
else
  printf "\033[1;31m  %d problema(s).\033[0m\n\n" "$FALHAS"
  exit 1
fi
