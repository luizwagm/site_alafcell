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

# ------------------------------------------------------------ as páginas
azul "Páginas"
for R in / /consertos/ /consertos/troca-de-tela/ /busca-e-leva/ /loja/ /loja/seminovos/ \
         /carrinho/ /blog/ /contato/ /privacidade/ /acompanhar/ /saude /robots.txt /sitemap.xml; do
  C=$(codigo "$R")
  if [ "$C" = "200" ]; then verde "$R"; else falha "$R respondeu $C"; fi
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
  URLS=$(pega "/sitemap.xml" | grep -c '<loc>')
  [ "$URLS" -gt 0 ] && verde "sitemap com $URLS endereços" || falha "sitemap vazio num site indexável"
fi

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
