# Integracao Mercado Pago

## Estrutura encontrada no projeto

- Landing page: `index.html`
- Checkout principal: `checkout.html`
- Logica do checkout: `checkout.js`
- Upsell: `upsell.html`
- Downsell: `downsell.html`
- Confirmacao e status do pedido: `obrigado.html`
- Area de acesso protegida: `acesso.html`
- Backend Node.js + Express: `server.js`
- Persistencia simples de pedidos: `data/orders.json`

## O que foi deixado funcional

- Checkout Transparente dentro da propria pagina
- Criacao de pagamento pela API de Pagamentos do Mercado Pago
- `external_reference` salvo para cada pedido
- Order bump fisico com exibicao condicional de endereco
- Webhook para confirmacao automatica
- Liberacao automatica da area de acesso apos pagamento aprovado
- Area do produto protegida por cookie assinado
- Estrutura pronta para produto digital e expansao futura por e-mail

## Arquivos alterados

- `server.js`
- `checkout.js`
- `funnel.js`
- `funnel.css`
- `acesso.html`
- `package.json`
- `.env.example`
- `.env`
- `render.yaml`
- `README-MERCADO-PAGO.md`

## Como instalar

1. Use Node.js 18 ou superior.
2. No terminal da pasta do projeto, rode:

```bash
npm install
npm start
```

3. Abra:

```text
http://localhost:3000
```

## Onde colocar PUBLIC_KEY e ACCESS_TOKEN

As credenciais ficam em `.env`.

- Front-end: `MERCADO_PAGO_PUBLIC_KEY`
- Backend: `MERCADO_PAGO_ACCESS_TOKEN`
- Webhook: `MERCADO_PAGO_WEBHOOK_SECRET`

O projeto ja ficou com o `.env` criado. Se voce quiser trocar ambiente, edite esse arquivo.

## Variaveis de ambiente

```env
PORT=3000
BASE_URL=http://localhost:3000
APP_ENV=sandbox
COOKIE_SECRET=troque-esta-chave
SUPPORT_EMAIL=suporte@seudominio.com
SUPPORT_WHATSAPP=5511999999999
MERCADO_PAGO_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_STATEMENT_DESCRIPTOR=SECARAPIDO
```

## Como testar em sandbox

1. Troque no `.env` as credenciais `APP_USR` por credenciais `TEST`.
2. Defina `APP_ENV=sandbox`.
3. Rode `npm start`.
4. Para testar webhook local, exponha a porta 3000 com uma URL HTTPS publica.
5. Cadastre no painel do Mercado Pago a URL:

```text
https://SEU-DOMINIO/api/webhooks/mercadopago
```

6. Use cartoes de teste do Mercado Pago no checkout.
7. Finalize a compra e acompanhe o status em `obrigado.html`.
8. Quando o pagamento virar `approved`, o acesso sera liberado automaticamente.

## Como publicar em producao

1. Publique este projeto em um servidor Node.js.
2. Use uma hospedagem com backend Node.js e disco persistente para manter `data/orders.json`.
3. Nao publique em hospedagem apenas estatica, porque o checkout depende de `server.js`, webhook e salvamento de pedidos.
4. Configure todas as variaveis do `.env` no ambiente do servidor.
5. Troque `BASE_URL` para o dominio real com HTTPS.
6. Defina `APP_ENV=production`.
7. Cadastre o webhook do Mercado Pago apontando para:

```text
https://SEU-DOMINIO/api/webhooks/mercadopago
```

8. Gere o segredo do webhook no painel do Mercado Pago e preencha `MERCADO_PAGO_WEBHOOK_SECRET`.
9. Reinicie a aplicacao.

## Deploy no Render

O projeto ja ficou preparado com `render.yaml`.

1. Envie este projeto para um repositorio Git.
2. No Render, escolha `New +` -> `Blueprint`.
3. Conecte o repositorio.
4. O Render vai ler `render.yaml` e criar:
   - web service Node.js
   - healthcheck em `/healthz`
   - disco persistente montado em `/opt/render/project/src/data`
5. Preencha no Render:
   - `BASE_URL`
   - `MERCADO_PAGO_PUBLIC_KEY`
   - `MERCADO_PAGO_ACCESS_TOKEN`
   - `MERCADO_PAGO_WEBHOOK_SECRET`
6. Depois do deploy, use a URL publicada do Render como `BASE_URL`.
7. Cadastre no Mercado Pago:

```text
https://SEU-SERVICO.onrender.com/api/webhooks/mercadopago
```

## Rotas criadas e usadas

- `GET /api/config`
- `POST /api/payments`
- `POST /api/webhooks/mercadopago`
- `GET /api/orders/:reference`
- `GET /api/access/session`
- `GET /liberar-acesso`
- `GET /acesso.html`

## Como editar preco, nome do produto, order bump, upsell e downsell

Tudo fica no objeto `catalog` dentro de `server.js`.

- Produto principal: `catalog.main`
- Order bump: `catalog.bump`
- Upsell: `catalog.upsell`
- Downsell: `catalog.downsell`

Ali voce pode editar:

- `name`
- `description`
- `price`
- `oldPrice`
- `type`
- `delivery`

## Como funciona a liberacao do produto digital

1. O cliente paga em `checkout.html`.
2. O backend cria o pagamento em `POST /api/payments`.
3. O Mercado Pago notifica `POST /api/webhooks/mercadopago`.
4. O backend consulta o pagamento, confirma `approved` e atualiza o pedido.
5. A pagina `obrigado.html` detecta que o pedido foi aprovado.
6. O acesso abre automaticamente por `GET /liberar-acesso`.
7. `acesso.html` so abre com cookie assinado de pedido pago.

## Como funciona o order bump fisico

- O endereco so aparece quando o checkbox do bump esta marcado.
- O backend so exige endereco se o bump fisico for selecionado.
- O endereco confirmado aparece dentro da area de acesso apos aprovacao.

## Observacoes importantes

- `MERCADO_PAGO_ACCESS_TOKEN` nunca vai para o front-end.
- `MERCADO_PAGO_PUBLIC_KEY` e usada apenas no browser.
- O webhook valida assinatura quando `MERCADO_PAGO_WEBHOOK_SECRET` estiver preenchido.
- `data/orders.json` guarda pedidos e relacao com pagamentos.
- A area de acesso foi preparada para produto digital e para futura automacao de envio por e-mail.
