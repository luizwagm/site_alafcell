"use strict";
/* ==========================================================================
   AVALIAÇÕES DO GOOGLE — buscadas na API oficial

   ---------------------------------------------------------------------------
   POR QUE ISTO EXIGE UMA CHAVE, E POR QUE NÃO DAVA PARA "SÓ PEGAR DO GOOGLE"

   A página de busca do Google não pode ser lida por um programa: ela responde
   com erro para quem não é navegador, e raspá-la é contra os termos de uso —
   além de quebrar a cada mudança de HTML deles, o que num site de cliente
   significa a seção sumir sozinha numa terça-feira qualquer.

   O caminho oficial é a **Places API**. Ela exige:

     · uma CHAVE de API do Google Cloud (o cliente cria, é dele, e é ele quem
       recebe a fatura se passar da cota gratuita);
     · o PLACE ID da loja — o identificador da ficha no Google Maps.

   Nenhum dos dois eu tenho como criar: os dois pertencem ao dono do negócio.
   Enquanto eles não são preenchidos, o painel continua aceitando as avaliações
   digitadas à mão, e o site funciona igual.

   ---------------------------------------------------------------------------
   O QUE A API DEVOLVE, E O QUE ISSO IMPÕE AO DESENHO

   `Place Details` devolve **no máximo 5 avaliações**, escolhidas pelo próprio
   Google — não dá para pedir "as 3 melhores". Por isso o filtro de 5 estrelas
   acontece AQUI, depois de receber: das cinco que vierem, ficam as de nota 5, e
   dessas as três primeiras.

   Consequência que o painel precisa dizer em voz alta: **se a loja não tiver
   três avaliações de 5 estrelas entre as cinco que o Google devolve, a seção
   mostra menos que três.** Não é defeito, e não há o que fazer pelo lado do
   código.

   ---------------------------------------------------------------------------
   O CACHE NÃO É OTIMIZAÇÃO, É CONTA

   Cada consulta à Places API é cobrada. Buscar a cada visita transformaria uma
   página popular numa fatura — e as avaliações mudam de mês em mês, não de
   minuto em minuto. O resultado é guardado no banco e revalidado uma vez por
   dia; se a busca falhar, o que estava guardado continua no ar.
   ========================================================================== */
const https = require("node:https");
const { Q } = require("./db");

/* ==========================================================================
   A CONFIGURACAO E LIDA DA TABELA, NAO DO PUBLICADO

   `txt()` le o instantaneo publicado, e o instantaneo chama este modulo para
   saber se a busca esta ligada — usar `txt()` aqui fecharia o circulo e
   estouraria a pilha na primeira pagina.

   E e o certo por outro motivo: chave de API e Place ID sao CONFIGURACAO, nao
   conteudo. Devem valer no instante em que sao salvas, sem esperar publicacao —
   ninguem "publica" uma credencial.
   ========================================================================== */
const conf = (chave) => {
  const l = Q.um("SELECT valor FROM config WHERE chave = ?", chave);
  return l ? String(l.valor || "") : "";
};
const { semHtml } = require("./html-seguro");

const HORAS = 24;
const TEMPO_LIMITE = 8000;

/* ==========================================================================
   A BUSCA

   `Promise` em vez de `await fetch`: o resto do projeto é Node puro sem
   dependência, e `https.get` já faz o que precisa. O timeout é explícito
   porque uma chamada pendurada seguraria o pedido do painel até o navegador
   desistir — e a pessoa não saberia se falhou ou se está lento.
   ========================================================================== */
function pedirAoGoogle(placeId, chave) {
  const url = "https://maps.googleapis.com/maps/api/place/details/json"
    + `?place_id=${encodeURIComponent(placeId)}`
    + "&fields=rating,user_ratings_total,reviews,url"
    + "&reviews_sort=newest&language=pt-BR"
    + `&key=${encodeURIComponent(chave)}`;

  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let bruto = "";
      res.setEncoding("utf8");
      res.on("data", (p) => { bruto += p; });
      res.on("end", () => {
        try { resolve(JSON.parse(bruto)); }
        catch { resolve({ status: "RESPOSTA_ILEGIVEL" }); }
      });
    });
    req.on("error", (e) => resolve({ status: "ERRO_DE_REDE", error_message: e.message }));
    req.setTimeout(TEMPO_LIMITE, () => { req.destroy(); resolve({ status: "TEMPO_ESGOTADO" }); });
  });
}

/* ==========================================================================
   O QUE GUARDAMOS DE CADA AVALIAÇÃO

   Só o primeiro nome. O Google devolve o nome completo e a foto do perfil de
   quem avaliou; publicar isso num site aberto é expor dado pessoal de um
   cliente que avaliou a loja, não o site — e ninguém pediu autorização para
   isso. O primeiro nome basta para a avaliação parecer o que é: de gente.

   O texto passa por `semHtml` porque vem de fora: é conteúdo que a Alafcell
   não escreveu nem revisou, e entra numa página do site dela.
   ========================================================================== */
function limparAvaliacao(r) {
  const autor = String(r.author_name || "").trim().split(/\s+/)[0] || "Cliente";
  return {
    autor,
    texto: semHtml(r.text || "").slice(0, 600),
    estrelas: Number(r.rating) || 0,
    quando: String(r.relative_time_description || "").trim(),
  };
}

/* ==========================================================================
   A REGRA DO CLIENTE: TRES, E SO AS DE CINCO ESTRELAS

   Isto e uma funcao a parte, e nao duas linhas dentro de `atualizar()`, porque
   e a UNICA regra de negocio deste modulo — o resto e encanamento de rede. Solta
   aqui, ela e conferivel sem chave de API e sem internet.

   A API devolve no maximo 5 avaliacoes, escolhidas por ela, sem opcao de
   filtrar na consulta: por isso a peneira acontece depois de receber.
   ========================================================================== */
function escolher(reviews) {
  return (reviews || [])
    .map(limparAvaliacao)
    .filter((a) => a.estrelas === 5)
    .slice(0, 3);
}

/* ==========================================================================
   BUSCAR E GUARDAR
   ========================================================================== */
async function atualizar({ forcar = false } = {}) {
  const placeId = conf("google.place_id").trim();
  const chave = conf("google.chave_api").trim();
  if (!placeId || !chave) {
    return { ok: false, motivo: "sem_configuracao",
             recado: "Preencha o Place ID e a chave da API para buscar do Google." };
  }

  const guardado = Q.um("SELECT * FROM google_cache WHERE id = 1");
  if (!forcar && guardado && guardado.criado) {
    const idade = (Date.now() - new Date(guardado.criado).getTime()) / 3600000;
    if (idade < HORAS) {
      return { ok: true, doCache: true, ...JSON.parse(guardado.dados) };
    }
  }

  const r = await pedirAoGoogle(placeId, chave);
  if (r.status !== "OK") {
    /* A BUSCA FALHOU E O SITE NÃO PODE CAIR JUNTO. O que estava guardado
       continua valendo — uma cota estourada ou uma queda de rede não pode
       apagar as avaliações da página. */
    return {
      ok: false, motivo: r.status || "desconhecido",
      recado: recadoDoStatus(r.status, r.error_message),
      ...(guardado ? JSON.parse(guardado.dados) : {}),
    };
  }

  const recebidas = (r.result.reviews || []).length;
  const dados = {
    nota: r.result.rating != null ? String(r.result.rating).replace(".", ",") : "",
    total: r.result.user_ratings_total != null ? String(r.result.user_ratings_total) : "",
    link: r.result.url || "",
    avaliacoes: escolher(r.result.reviews),
    recebidas,
  };

  Q.roda(`INSERT INTO google_cache (id, dados, criado) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, criado = excluded.criado`,
    JSON.stringify(dados), new Date().toISOString());

  return { ok: true, doCache: false, ...dados };
}

/* Mensagens que dizem O QUE FAZER. "REQUEST_DENIED" sozinho manda o dono
   pesquisar na internet; a frase abaixo manda ele ao lugar certo. */
function recadoDoStatus(status, detalhe) {
  const mapa = {
    REQUEST_DENIED: "O Google recusou a chave. Confira se ela é válida e se a "
      + "\"Places API\" está ativada no projeto do Google Cloud.",
    INVALID_REQUEST: "O Place ID parece errado. Ele começa com \"ChIJ\" e sai da "
      + "ficha da loja no Google Maps.",
    NOT_FOUND: "O Google não encontrou essa ficha. Confira o Place ID.",
    OVER_QUERY_LIMIT: "A cota da chave acabou. As avaliações que já estavam "
      + "guardadas continuam no site.",
    ZERO_RESULTS: "A ficha existe, mas não tem avaliação nenhuma ainda.",
    TEMPO_ESGOTADO: "O Google não respondeu a tempo. Tente de novo em instantes.",
    ERRO_DE_REDE: "Não consegui falar com o Google. O servidor tem saída para a internet?",
  };
  return (mapa[status] || `O Google respondeu "${status}".`) + (detalhe ? ` (${detalhe})` : "");
}

/* O que está guardado, sem ir ao Google. É o que o site usa. */
function guardadas() {
  const l = Q.um("SELECT dados, criado FROM google_cache WHERE id = 1");
  if (!l) return null;
  try { return { ...JSON.parse(l.dados), criado: l.criado }; }
  catch { return null; }
}

const configurado = () =>
  !!(conf("google.place_id").trim() && conf("google.chave_api").trim());

module.exports = { atualizar, guardadas, configurado, escolher, limparAvaliacao, recadoDoStatus };
