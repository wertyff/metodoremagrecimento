# Pixel TikTok: Convencao, UTM e Operacao

## Objetivo

Padronizar:

- nomes de campanha, grupo e criativo
- UTMs e parametros customizados no TikTok Ads Manager
- leitura dos eventos do site no operacional diario

O site ja captura automaticamente:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `ttclid`
- `fbclid`
- `gclid`
- `campaign_id`
- `adset_id`
- `ad_id`

Tambem guarda:

- primeira origem (`first_utm_*`)
- ultima origem (`utm_*`)
- tipo de pagina
- oferta
- referencias do pedido

## Convencao Final de Nomes

Use sempre nomes curtos, sem acento, sem espaco e separados por `_`.

### Campanha

Formato:

```text
tt_{objetivo}_{oferta}_{angulo}_{publico}_{pais}_{versao}
```

Exemplos:

```text
tt_conv_main_transformacao_broad_br_v1
tt_conv_main_prova_social_fem25a44_br_v2
tt_conv_upsell_continuidade_buyers_br_v1
tt_lead_main_quebra_objecao_broad_br_v1
```

Campos sugeridos:

- `objetivo`: `conv`, `lead`, `traffic`
- `oferta`: `main`, `upsell`, `downsell`
- `angulo`: `transformacao`, `prova_social`, `dor`, `autoridade`, `urgencia`, `objecao`
- `publico`: `broad`, `buyers`, `lookalike`, `fem25a44`, `remarketing`
- `pais`: `br`
- `versao`: `v1`, `v2`, `v3`

### Grupo de anuncios

Formato:

```text
ag_{audiencia}_{posicionamento}_{otimizacao}_{janela}_{versao}
```

Exemplos:

```text
ag_broad_tiktok_purchase_7d_v1
ag_buyers_tiktok_purchase_7d_v1
ag_remarketing_tiktok_purchase_1d_v2
```

Campos sugeridos:

- `audiencia`: `broad`, `buyers`, `remarketing`, `lla1`, `lla3`
- `posicionamento`: `tiktok`, `pangle`, `mix`
- `otimizacao`: `purchase`, `initcheckout`, `landingview`
- `janela`: `1d`, `7d`
- `versao`: `v1`, `v2`

### Anuncio / criativo

Formato:

```text
ad_{gancho}_{formato}_{cta}_{duracao}_{versao}
```

Exemplos:

```text
ad_dor_ugc_comprar_30s_v1
ad_prova_social_antesdepois_saibamais_22s_v2
ad_objecao_facil_compra_18s_v1
```

Campos sugeridos:

- `gancho`: `dor`, `prova_social`, `autoridade`, `transformacao`, `objecao`
- `formato`: `ugc`, `talkinghead`, `slides`, `beforeafter`
- `cta`: `comprar`, `saibamais`, `vermais`
- `duracao`: `15s`, `22s`, `30s`
- `versao`: `v1`, `v2`

## UTM Final Recomendada

### Padrao base

```text
utm_source=tiktok
utm_medium=paid_social
utm_campaign=__CAMPAIGN_NAME__
utm_content=__CID_NAME__
utm_term=__AID_NAME__
campaign_id=__CAMPAIGN_ID__
adset_id=__AID__
ad_id=__CID__
placement=__PLACEMENT__
```

### URL pronta para usar

Substitua o dominio pela URL final do anuncio:

```text
https://SEU-DOMINIO/checkout.html?utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__&utm_term=__AID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__&placement=__PLACEMENT__
```

### Quando mandar para a landing

```text
https://SEU-DOMINIO/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__&utm_term=__AID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__&placement=__PLACEMENT__
```

## Como ligar isso ao TikTok Ads Manager

Segundo a ajuda oficial do TikTok Ads Manager:

- da para adicionar parametros `automaticamente` ou `manualmente`
- o TikTok tambem anexa `ttclid` na URL de destino
- o `ttclid` ajuda atribuicao quando os eventos web compartilham esse identificador

Fluxo operacional recomendado:

1. No anuncio, preencha a `Destination URL`.
2. Clique em `Edit` abaixo do preview da URL.
3. Entre em `Build URL parameters`.
4. Preencha as UTMs ou cole a URL final pronta.
5. Em `Custom parameters`, adicione:
   - `campaign_id=__CAMPAIGN_ID__`
   - `adset_id=__AID__`
   - `ad_id=__CID__`
   - `placement=__PLACEMENT__`
6. Use `Preview` para validar a URL final.
7. Deixe o `ttclid` ativo.

### Recomendacao pratica

- Se quiser simplicidade: use `Auto-attach` do TikTok e complemente so com os parametros customizados.
- Se quiser padrao rigido: use `manual` com a estrutura desta pagina.

## Regra operacional de links

### Trafego frio

- Anuncio para `landing`:

```text
https://SEU-DOMINIO/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__&utm_term=__AID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__&placement=__PLACEMENT__
```

### Remarketing direto para checkout

- Anuncio para `checkout`:

```text
https://SEU-DOMINIO/checkout.html?utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__&utm_term=__AID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__&placement=__PLACEMENT__
```

## Tabela: evento -> objetivo -> parametro esperado

| Evento | Pagina | Objetivo | Parametros esperados |
|---|---|---|---|
| `ViewContent` | landing | medir visita qualificada | `offer_kind`, `page_type`, `utm_*`, `ttclid`, `campaign_id`, `adset_id`, `ad_id` |
| `AddToCart` | landing CTA | medir clique comercial | `cta_name`, `cta_position`, `offer_kind`, `value`, `utm_*` |
| `PlayVSL` | landing | medir interesse real | `section=hero-vsl`, `offer_kind`, `utm_*` |
| `FAQOpen` | landing | medir objecao ativa | `question`, `section=faq`, `offer_kind` |
| `StickyCTAVisible` | landing | medir maturidade da visita | `section=sticky`, `offer_kind`, `value` |
| `ScrollDepth75` | landing | medir profundidade | `scroll_percent=75`, `offer_kind` |
| `ViewContent` | checkout | medir entrada no checkout | `page_type=checkout`, `section=checkout-entry`, `offer_kind` |
| `InitiateCheckout` | checkout | medir inicio de intencao | `page_type=checkout`, `offer_kind`, `utm_*` |
| `PaymentMethodSelected` | checkout | comparar metodo escolhido | `method`, `offer_kind`, `section=payment-method` |
| `AddPaymentInfo` | checkout | medir uso de cartao | `method=card`, `offer_kind`, `value` |
| `PlaceAnOrder` | checkout | medir envio de pagamento | `method`, `cta_name`, `section=checkout-submit`, `offer_kind`, `value` |
| `PixGenerated` | checkout | medir emissao de Pix | `method=pix`, `status=pending`, `reference`, `offer_kind` |
| `CopyPixCode` | checkout | medir alta intencao no Pix | `method=pix`, `label=pix-copy-paste`, `offer_kind` |
| `PaymentRejected` | checkout | medir perda na aprovacao | `status=rejected`, `reference`, `offer_kind`, `value` |
| `ViewContent` | upsell/downsell | medir exposicao da oferta | `page_type`, `offer_kind`, `utm_*` |
| `AddToCart` | upsell/downsell | medir aceitacao da oferta | `cta_name`, `cta_position`, `offer_kind`, `value` |
| `UpsellDeclined` | upsell | medir rejeicao da upsell | `reference`, `cta_position=upsell-secondary` |
| `DownsellDeclined` | downsell | medir rejeicao da downsell | `reference`, `cta_position=downsell-secondary` |
| `ViewThankYou` | obrigado | medir chegada no status | `page_type=thankyou`, `offer_kind` |
| `RefreshOrderStatus` | obrigado | medir ansiedade/friccao | `reference`, `section=thankyou-status` |
| `Purchase` | obrigado/checkout | medir compra aprovada | `reference`, `root_reference`, `status=approved`, `value`, `contents`, `utm_*`, `ttclid` |
| `ViewAccessPage` | acesso | medir entrada na area | `page_type=access`, `offer_kind` |
| `CompleteRegistration` | acesso | medir liberacao do acesso | `reference`, `root_reference`, `status=access-released`, `contents`, `value` |
| `DownloadContent` | acesso | medir consumo do produto | `reference`, `label`, `asset_url`, `offer_kind` |

## Leitura operacional diaria

### KPI principal

- `Purchase`

### KPI de intencao

- `InitiateCheckout`
- `PlaceAnOrder`
- `PixGenerated`
- `CopyPixCode`
- `AddPaymentInfo`

### KPI de criativo

- `ViewContent`
- `AddToCart`
- `PlayVSL`
- `ScrollDepth75`

### KPI de objecao

- `FAQOpen`
- `PaymentRejected`
- `UpsellDeclined`
- `DownsellDeclined`
- `RefreshOrderStatus`

## Diagnostico rapido

### Muito clique e pouco checkout

Olhar:

- `AddToCart` alto
- `InitiateCheckout` baixo

Leitura:

- promessa forte, pagina lenta, link errado ou quebra entre LP e checkout

### Checkout entra, mas pouca emissao de Pix ou envio de cartao

Olhar:

- `InitiateCheckout` alto
- `PlaceAnOrder` baixo

Leitura:

- friccao no formulario, preco, metodo, prova ou confianca

### Gera Pix, mas nao compra

Olhar:

- `PixGenerated` alto
- `Purchase` baixo

Leitura:

- problema de intencao final, aprovacao, urgencia ou acompanhamento

### Cartao selecionado, mas baixa aprovacao

Olhar:

- `AddPaymentInfo` alto
- `Purchase` baixo
- `PaymentRejected` alto

Leitura:

- recusas, antifraude, limite, emissor ou friccao no preenchimento

## Padrao de analise semanal

Separar por:

- `utm_campaign`
- `utm_content`
- `utm_term`
- `campaign_id`
- `adset_id`
- `ad_id`

Ordem recomendada:

1. campanha
2. grupo
3. criativo

## Fontes oficiais

- TikTok Ads Manager: [Informacoes sobre os parametros de UTM](https://ads.tiktok.com/help/article/track-offsite-web-events-with-utm-parameters?lang=en)
- TikTok Ads Manager: [Como adicionar parametros de URL](https://ads.tiktok.com/help/article/how-to-add-url-parameters-to-your-website-url-in-tiktok-ads-manager?lang=pt)
- TikTok Ads Manager: [Sobre a ID de clique do TikTok](https://ads.tiktok.com/help/article/tiktok-click-id?lang=en)
