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

## Antes de virar para o domínio de verdade

Estes três não podem ficar para depois — os dois primeiros são promessa falsa
ao cliente final, e o terceiro é o site dizendo ao Google o endereço errado.

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

E então:

```bash
sudo ./criar-site.sh alafcell.com.br 5202
./verificar.sh https://alafcell.com.br
```

O `criar-site.sh` grava o `ALAFCELL_SITE` no `.env` e reinicia o serviço — sem
isso o canonical continuaria apontando para o subdomínio de trabalho.

---

## Ficou no radar

- **Backup fora do servidor.** O timer diário guarda 14 cópias no mesmo disco.
  Enquanto a pasta `backups/` não entrar no LA Backup (R2), um disco perdido
  leva o banco junto.
- **LA Chat e LA Publisher** ainda não estão instalados aqui.
- **`/admin` e `/restrito`** ainda não existem: sem eles o cliente não consegue
  trocar os preços de demonstração sozinho.
