# Subir a Alafcell no servidor

Os passos manuais, na ordem. Depois disto, entregar versão nova é só
`./deploy.sh`.

---

## 0. Antes de tudo: a porta

A porta **5202** foi conferida livre na máquina de desenvolvimento, e isso não
prova nada sobre o servidor — lá existem sites que não estão aqui. Confira
**no servidor**:

```bash
ss -ltnp | grep 5202
```

Se estiver ocupada, escolha outra livre e troque nos três lugares:
`operacao/alafcell.service`, `criar-site.sh` e o `deploy.sh`. Repassar para uma
porta ocupada não dá erro: devolve a resposta do site VIZINHO.

## 1. O código no servidor

```bash
sudo -u deploy git clone <repo> /var/www/projetos/Alafcell-Assistec
cd /var/www/projetos/Alafcell-Assistec
sudo -u deploy npm ci --omit=dev
```

> **Sem `sudo` puro no npm.** `sudo npm ci` faz o **root** virar dono de
> `node_modules/`, e a partir daí o usuário `deploy` não consegue mais escrever
> ali — o erro só aparece na entrega seguinte, longe da causa. É sempre
> `sudo -u deploy`. Se já aconteceu, devolva a posse:
>
> ```bash
> sudo chown -R deploy:deploy /var/www/projetos/Alafcell-Assistec
> ```
>
> O `deploy.sh` recusa rodar como root justamente por isso.

## 2. As fotos

Elas não vão no repositório — 2,8 MB de binário que nunca muda. O script baixa
e confere a assinatura de cada arquivo:

```bash
sudo -u deploy node ferramentas/baixar-imagens.cjs
```

## 2b. As pastas de escrita

`data/` e `backups/` ficam fora do repositório (são do cliente), então o clone
não as traz. E o `ReadWritePaths` da unidade **exige caminho existente**: com
uma delas faltando, o serviço morre com `226/NAMESPACE` e "Failed to set up
mount namespacing" — mensagem que não menciona pasta nenhuma. O processo
também não consegue criá-las: sob `ProtectSystem=strict` o pai está
somente-leitura.

```bash
sudo -u deploy mkdir -p data backups assets/img/banco assets/img/uploads
```

O `deploy.sh` faz isso sozinho a cada entrega; aqui é porque o serviço ainda
não subiu nenhuma vez.

## 3. O serviço

```bash
sudo cp operacao/alafcell.service /etc/systemd/system/
sudo cp operacao/alafcell-backup.service /etc/systemd/system/
sudo cp operacao/alafcell-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now alafcell.service
sudo systemctl enable --now alafcell-backup.timer
```

**Anote a senha do primeiro acesso**, que aparece uma vez só:

```bash
sudo journalctl -u alafcell -n 40 --no-pager
```

## 4. O endereço e o certificado

```bash
sudo ./criar-site.sh alafcell.projetos.luizaugust.me 5202
```

Sob `*.projetos.luizaugust.me` o navegador **recusa `http://`** por causa do
HSTS do domínio pai. Antes do certificado a página não abre em navegador
nenhum — é esperado, e o certbot não é afetado porque valida por um cliente
próprio.

## 5. Conferir

```bash
./verificar.sh https://alafcell.projetos.luizaugust.me
```

---

## Virar para alafcell.com.br

### Antes: o DNS

Dois registros apontando para o IP do servidor, e os dois **antes** de rodar o
`criar-site.sh` — ele confere o DNS e só pede certificado para o que resolve:

| Tipo | Nome  | Valor              |
|------|-------|--------------------|
| A    | `@`   | IP do servidor     |
| A    | `www` | IP do servidor     |

O `www` não é opcional: quem digita `www.alafcell.com.br` e não encontra nada vê
erro de navegador, não o site. Com ele no DNS, o script cria o redirecionamento
permanente para o endereço sem `www`.

### Antes: o que é promessa falsa

Estes não podem ficar para depois — os dois primeiros são promessa falsa ao
cliente final, e o terceiro é o site dizendo ao Google o endereço errado.

1. **Os preços.** Todos os valores da tabela de conserto são de *demonstração*.
   Conferir e substituir em `/admin`.
2. **A chave Pix.** Está a de demonstração (`00000000000`), que não recebe
   dinheiro. Cadastrar a real em `/admin`.
   Depois, desligar o conteúdo de demonstração na unidade:
   ```
   Environment=ALAFCELL_DEMO=nao
   ```
3. **Endereço, telefone, horário e CNPJ**, em `/admin`. Sem endereço real o
   `LocalBusiness` do Schema.org não monta — e é justamente o que trava as
   páginas de franquia dos concorrentes no Google.
4. **As avaliações de exemplo** (`/admin` → Recomendações). Elas dizem
   "AVALIAÇÃO DE EXEMPLO" no texto e vão para o ar assim se ninguém trocar.
5. **As cidades atendidas** (`/admin` → Endereço e horário). A lista que vem
   pronta cobre o Agreste inteiro — **tire as cidades onde a busca e leva não
   vai de verdade.** Cada cidade ali é uma promessa operacional.

### A virada

```bash
sudo ./criar-site.sh alafcell.com.br 5202
./verificar.sh https://alafcell.com.br
```

O script faz, nesta ordem: confere o DNS dos dois nomes, escreve o vhost, emite
o certificado para `alafcell.com.br` **e** `www.alafcell.com.br`, grava
`ALAFCELL_SITE=https://alafcell.com.br` no `.env` e reinicia o serviço.

**O que muda sozinho ao mudar o `ALAFCELL_SITE`** — está todo em
`src/endereco.js`, num lugar só:

- o site sai do modo "endereço de trabalho" e **passa a ser indexável**;
- o `robots.txt` deixa de ser `Disallow: /` e passa a liberar tudo menos os
  painéis, com a linha `Sitemap:`;
- o cabeçalho `X-Robots-Tag: noindex` **para de sair** em todas as respostas;
- o `sitemap.xml` deixa de sair vazio;
- o canonical, o JSON-LD e o `og:url` passam a apontar para o domínio real.

Sem reiniciar o serviço, nada disso vale: o endereço é lido na subida.

### Depois: o Google

O site indexável não é o mesmo que o site encontrado. Estes três passos são do
dono e nenhum script faz por ele:

1. **Google Search Console** (<https://search.google.com/search-console>) —
   adicionar a propriedade, provar a posse (registro TXT no DNS) e **enviar o
   sitemap** `https://alafcell.com.br/sitemap.xml`. É por aqui que se descobre
   página com erro, e é o único lugar que mostra o que as pessoas digitaram
   para chegar ao site.
2. **Google Business Profile** — a ficha da loja no Maps. **É lá que ficam as
   estrelas**, não no site: o Google não exibe nota de avaliação marcada na
   página do próprio negócio. Para uma assistência técnica, a ficha bem
   preenchida (endereço, horário, fotos, serviços) traz mais gente que o site.
3. **O mesmo endereço, escrito igual, em toda parte** — site, ficha do Google,
   Instagram, catálogo. Endereço divergente entre as fontes é o que faz o Google
   desconfiar de qual é a loja de verdade.

### Depois: conferir de fora

```bash
curl -s https://alafcell.com.br/robots.txt
curl -s https://alafcell.com.br/sitemap.xml | head
curl -sI https://www.alafcell.com.br | head -3
curl -sI https://alafcell.com.br | grep -i "strict-transport\|x-robots"
```

Espera-se: o robots liberando o site, o sitemap com as URLs, o `www`
respondendo **301** para o endereço sem `www`, o `Strict-Transport-Security`
presente e **nenhum** `X-Robots-Tag`.

Um `X-Robots-Tag: noindex` sobrando aqui apaga o site inteiro da busca, e é
invisível para quem só olha a tela.

---

## Entrega automática

Depois da primeira subida, ligar o GitHub Actions faz `git push` publicar
sozinho — com as três suítes como portão, e conferindo depois que a versão no
ar é a do commit. Passo a passo em [GITHUB-ACTIONS.md](GITHUB-ACTIONS.md).

---

## Ficou no radar

- **Backup fora do servidor.** O timer diário guarda 14 cópias no mesmo disco.
  Enquanto a pasta `backups/` não entrar no LA Backup (R2), um disco perdido
  leva o banco junto.
- **LA Chat e LA Publisher** ainda não estão instalados aqui.
- **O `/restrito`** ainda não existe (gerenciador da loja: estoque, pedidos,
  ordens de serviço e financeiro). O `/admin` está pronto desde a 0.5.0.
- **Sem `preload` no HSTS**, de propósito: entrar na lista de precarga dos
  navegadores é praticamente irreversível e vale para o domínio inteiro. É
  decisão do dono do domínio, não de um script de instalação.
