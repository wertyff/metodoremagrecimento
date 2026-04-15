const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const rootDir = __dirname;
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(rootDir, "data");
const ordersFile = path.join(dataDir, "orders.json");

const config = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  baseUrl: (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  cookieSecret: process.env.COOKIE_SECRET || "troque-esta-chave",
  supportEmail: process.env.SUPPORT_EMAIL || "",
  supportWhatsApp: process.env.SUPPORT_WHATSAPP || "",
  environment:
    process.env.APP_ENV ||
    (String(process.env.MERCADO_PAGO_PUBLIC_KEY || "").startsWith("TEST-")
      ? "sandbox"
      : "production"),
  mercadoPago: {
    publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || "",
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || "",
    webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET || "",
    statementDescriptor: (process.env.MERCADO_PAGO_STATEMENT_DESCRIPTOR || "SECARAPIDO")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 13)
  }
};

app.disable("x-powered-by");
app.set("trust proxy", 1);

const catalog = {
  main: {
    code: "main_14d",
    kind: "main",
    name: "Metodo Seca Rapido 14D",
    description: "Metodo digital com passo a passo de 14 dias.",
    price: 19.9,
    oldPrice: 97,
    type: "digital",
    delivery: {
      title: "Metodo Seca Rapido 14D",
      summary: "Seu plano principal de 14 dias ja esta liberado na area de acesso.",
      modules: [
        {
          title: "Mapa dos 14 dias",
          description: "Veja como dividir sua rotina nas duas primeiras semanas sem exagero.",
          bullets: [
            "Prioridades claras para cada etapa",
            "Sequencia simples para comecar hoje",
            "Ritmo pensado para celular e leitura rapida"
          ]
        },
        {
          title: "Checklist diario",
          description: "Use esta lista curta para acompanhar sua consistencia todos os dias.",
          bullets: [
            "Passos objetivos para nao esquecer o essencial",
            "Leitura rapida antes de dormir ou ao acordar",
            "Ideal para manter foco sem complicacao"
          ]
        },
        {
          title: "Guia de continuidade",
          description: "Quando terminar os 14 dias, siga para a proxima etapa sem voltar ao zero.",
          bullets: [
            "Como manter o ritmo depois do plano principal",
            "Ajustes simples para a semana seguinte",
            "Pontos de atencao para evitar recaidas"
          ]
        }
      ]
    }
  },
  bump: {
    code: "capsulas_termogenicas",
    kind: "bump",
    name: "Capsulas Termogenicas",
    description: "Complemento fisico opcional para a rotina.",
    price: 19.9,
    oldPrice: 39.9,
    type: "physical",
    delivery: {
      title: "Capsulas Termogenicas",
      summary: "Complemento fisico confirmado. A equipe vai separar e enviar para o endereco informado.",
      nextSteps: [
        "Separacao do item",
        "Preparacao para envio",
        "Atualizacao futura para disparo por e-mail ou painel"
      ]
    }
  },
  upsell: {
    code: "upsell_30d",
    kind: "upsell",
    name: "Acelerador Seca Rapido 30D",
    description: "Plano complementar de continuidade por 30 dias.",
    price: 27,
    oldPrice: 67,
    type: "digital",
    delivery: {
      title: "Acelerador Seca Rapido 30D",
      summary: "Conteudo complementar liberado para continuar depois do plano principal.",
      modules: [
        {
          title: "Plano de 30 dias",
          description: "Extensao do metodo para manter regularidade por mais tempo.",
          bullets: [
            "Rotina semanal para nao perder o embalo",
            "Organizacao simples de segunda a domingo",
            "Acompanhamento pensado para continuidade"
          ]
        },
        {
          title: "Checklist semanal",
          description: "Resumo rapido da semana para revisar progresso e ajustar a rota.",
          bullets: [
            "Pontes entre a fase de 14 dias e a fase de 30 dias",
            "Revisao de constancia e foco",
            "Passos simples para seguir sem travar"
          ]
        }
      ]
    }
  },
  downsell: {
    code: "downsell_21d",
    kind: "downsell",
    name: "Versao Essencial 21D",
    description: "Versao mais curta e acessivel para continuidade.",
    price: 14.9,
    oldPrice: 37,
    type: "digital",
    delivery: {
      title: "Versao Essencial 21D",
      summary: "Versao enxuta liberada como continuidade mais leve do seu pedido principal.",
      modules: [
        {
          title: "Plano essencial",
          description: "Versao resumida para manter a rotina com um roteiro menor.",
          bullets: [
            "Passo a passo mais direto",
            "Carga menor para uma decisao mais simples",
            "Continuacao objetiva do metodo principal"
          ]
        }
      ]
    }
  }
};

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(ordersFile)) {
    fs.writeFileSync(
      ordersFile,
      JSON.stringify({ orders: {}, payments: {} }, null, 2),
      "utf8"
    );
  }
}

function readStore() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(ordersFile, "utf8"));
}

function writeStore(store) {
  fs.writeFileSync(ordersFile, JSON.stringify(store, null, 2), "utf8");
}

function updateStore(mutator) {
  const store = readStore();
  const result = mutator(store) || store;
  writeStore(result);
  return result;
}

function randomId(size = 16) {
  return crypto.randomBytes(size).toString("hex");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatNameParts(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "Cliente"
  };
}

function buildItems(kind, bumpSelected) {
  const items = [];

  if (kind === "main") {
    items.push({ ...catalog.main, quantity: 1 });
    if (bumpSelected) {
      items.push({ ...catalog.bump, quantity: 1 });
    }
  }

  if (kind === "upsell") {
    items.push({ ...catalog.upsell, quantity: 1 });
  }

  if (kind === "downsell") {
    items.push({ ...catalog.downsell, quantity: 1 });
  }

  return items;
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
}

function isPaidStatus(status) {
  return ["paid", "approved"].includes(String(status || "").toLowerCase());
}

function generateReference(kind) {
  return `MSR-${kind.toUpperCase()}-${Date.now()}-${randomId(3).toUpperCase()}`;
}

function summarizeOrder(order) {
  return {
    reference: order.reference,
    parentReference: order.parentReference,
    kind: order.kind,
    status: order.status,
    paymentStatus: order.paymentStatus,
    statusDetail: order.statusDetail,
    total: order.total,
    createdAt: order.createdAt,
    approvedAt: order.approvedAt || null,
    accessReleasedAt: order.delivery?.accessReleasedAt || null,
    items: order.items,
    customer: {
      name: order.customer.name
    }
  };
}

function getOrder(reference) {
  const store = readStore();
  return store.orders[reference] || null;
}

function getRootReference(reference) {
  let current = getOrder(reference);
  while (current && current.parentReference) {
    current = getOrder(current.parentReference);
  }
  return current ? current.reference : reference;
}

function getBundle(reference) {
  const store = readStore();
  const rootReference = getRootReference(reference);
  const root = store.orders[rootReference];

  if (!root) {
    return null;
  }

  const children = Object.values(store.orders)
    .filter((order) => order.parentReference === rootReference)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const approvedOrders = [root, ...children].filter((order) => isPaidStatus(order.status));

  const pendingOrders = [root, ...children].filter((order) => !isPaidStatus(order.status));

  return {
    root,
    children,
    approvedOrders,
    pendingOrders,
    approvedItems: approvedOrders.flatMap((order) => order.items),
    approvedTotal: approvedOrders.reduce((sum, order) => sum + order.total, 0)
  };
}

function createAccessUrl(reference, accessToken) {
  return `/liberar-acesso?ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(
    accessToken
  )}`;
}

function saveOrder(order) {
  updateStore((store) => {
    store.orders[order.reference] = order;
    if (order.paymentId) {
      store.payments[String(order.paymentId)] = order.reference;
    }
    return store;
  });
}

function paymentStatusToOrderStatus(status) {
  if (status === "approved") return "paid";
  if (status === "rejected" || status === "cancelled") return "rejected";
  return "pending";
}

function applyPaymentData(order, payment, source = "api") {
  if (!order) {
    return null;
  }

  order.paymentId = payment.id ? String(payment.id) : order.paymentId || "";
  order.paymentStatus = payment.status || order.paymentStatus || "pending";
  order.statusDetail = payment.status_detail || order.statusDetail || "";
  order.status = paymentStatusToOrderStatus(order.paymentStatus);
  order.paymentMethodId = payment.payment_method_id || order.paymentMethodId || "";
  order.installments = payment.installments || order.installments || 1;
  order.transactionAmount = payment.transaction_amount || order.transactionAmount || order.total;
  order.approvedAt =
    order.paymentStatus === "approved"
      ? payment.date_approved || new Date().toISOString()
      : order.approvedAt || null;
  order.delivery = {
    ...(order.delivery || {}),
    accessReleasedAt:
      order.paymentStatus === "approved" && order.items.some((item) => item.type === "digital")
        ? order.delivery?.accessReleasedAt || payment.date_approved || new Date().toISOString()
        : order.delivery?.accessReleasedAt || null,
    emailReady: Boolean(order.customer?.email),
    emailSentAt: order.delivery?.emailSentAt || null
  };
  order.lastPaymentSyncSource = source;
  order.updatedAt = new Date().toISOString();
  saveOrder(order);
  return order;
}

async function mercadoPagoRequest(endpoint, options = {}) {
  if (!config.mercadoPago.accessToken) {
    const error = new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`https://api.mercadopago.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.mercadoPago.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Falha ao comunicar com o Mercado Pago.");
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

function splitPhone(rawPhone) {
  const digits = onlyDigits(rawPhone);
  if (!digits) {
    return null;
  }

  if (digits.length <= 2) {
    return { area_code: digits, number: "" };
  }

  return {
    area_code: digits.slice(0, 2),
    number: digits.slice(2)
  };
}

function buildPaymentPayload(order, paymentData) {
  const { firstName, lastName } = formatNameParts(order.customer.name);
  const phone = splitPhone(order.customer.phone);
  const shipping = order.shipping || null;

  const additionalInfo = {
    items: order.items.map((item) => ({
      id: item.code,
      title: item.name,
      description: item.description,
      quantity: item.quantity || 1,
      category_id: item.type === "physical" ? "health" : "digital_goods",
      unit_price: Number(item.price.toFixed(2))
    })),
    payer: {
      first_name: firstName,
      last_name: lastName,
      ...(phone ? { phone } : {})
    }
  };

  if (shipping) {
    additionalInfo.shipments = {
      receiver_address: {
        zip_code: onlyDigits(shipping.cep),
        street_name: shipping.address,
        street_number: shipping.number,
        apartment: shipping.complement,
        neighborhood_name: shipping.neighborhood,
        city_name: shipping.city,
        federal_unit: shipping.state
      }
    };
  }

  return {
    transaction_amount: Number(order.total.toFixed(2)),
    token: paymentData.token,
    description: order.items.map((item) => item.name).join(" + "),
    installments: Number(paymentData.installments || 1),
    payment_method_id: paymentData.paymentMethodId,
    issuer_id: paymentData.issuerId || undefined,
    statement_descriptor: config.mercadoPago.statementDescriptor,
    external_reference: order.reference,
    notification_url: `${config.baseUrl}/api/webhooks/mercadopago`,
    payer: {
      email: order.customer.email,
      first_name: firstName,
      last_name: lastName,
      entity_type: "individual",
      identification: {
        type: paymentData.identificationType || "CPF",
        number: onlyDigits(paymentData.identificationNumber)
      },
      address: shipping
        ? {
            zip_code: onlyDigits(shipping.cep),
            street_name: shipping.address,
            street_number: shipping.number,
            neighborhood: shipping.neighborhood,
            city: shipping.city,
            federal_unit: shipping.state
          }
        : undefined
    },
    additional_info: additionalInfo,
    metadata: {
      order_reference: order.reference,
      order_kind: order.kind,
      parent_reference: order.parentReference || "",
      bump_selected: String(Boolean(order.bumpSelected))
    }
  };
}

async function createMercadoPagoPayment(order, paymentData) {
  const body = buildPaymentPayload(order, paymentData);
  const idempotencyKey = randomId(12);
  return mercadoPagoRequest("/v1/payments", {
    method: "POST",
    headers: {
      "X-Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(body)
  });
}

async function fetchMercadoPagoPayment(paymentId) {
  return mercadoPagoRequest(`/v1/payments/${paymentId}`, {
    method: "GET"
  });
}

function parseSignatureHeader(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, raw] = part.split("=");
      if (key && raw) {
        acc[key] = raw;
      }
      return acc;
    }, {});
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a || ""), "utf8");
  const second = Buffer.from(String(b || ""), "utf8");
  if (first.length !== second.length) {
    return false;
  }
  return crypto.timingSafeEqual(first, second);
}

function validateWebhookSignature(req) {
  if (!config.mercadoPago.webhookSecret) {
    return true;
  }

  const signature = parseSignatureHeader(req.headers["x-signature"]);
  const ts = signature.ts;
  const received = signature.v1;
  const requestId = req.headers["x-request-id"];
  const dataId =
    req.query["data.id"] ||
    req.body?.data?.id ||
    req.query.id ||
    req.body?.id ||
    "";

  if (!ts || !received || !requestId || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", config.mercadoPago.webhookSecret)
    .update(manifest)
    .digest("hex");

  return safeEqual(received, expected);
}

function sanitizePublicConfig() {
  return {
    paymentEnabled: Boolean(
      config.mercadoPago.publicKey && config.mercadoPago.accessToken
    ),
    environment: config.environment,
    publicKey: config.mercadoPago.publicKey,
    supportEmail: config.supportEmail,
    supportWhatsApp: config.supportWhatsApp,
    catalog
  };
}

function buildDigitalAccess(bundle) {
  return bundle.approvedOrders
    .flatMap((order) =>
      order.items
        .filter((item) => item.type === "digital" && item.delivery?.modules?.length)
        .map((item) => ({
          reference: order.reference,
          code: item.code,
          name: item.name,
          title: item.delivery.title || item.name,
          summary: item.delivery.summary || item.description,
          modules: item.delivery.modules || []
        }))
    )
    .filter(
      (item, index, list) =>
        list.findIndex((entry) => entry.code === item.code && entry.reference === item.reference) ===
        index
    );
}

function buildPhysicalShipments(bundle) {
  return bundle.approvedOrders.flatMap((order) => {
    const physicalItems = order.items.filter((item) => item.type === "physical");
    if (!physicalItems.length || !order.shipping) {
      return [];
    }

    return physicalItems.map((item) => ({
      reference: order.reference,
      name: item.name,
      summary: item.delivery?.summary || item.description,
      nextSteps: item.delivery?.nextSteps || [],
      address: {
        name: order.shipping.name,
        cep: order.shipping.cep,
        address: order.shipping.address,
        number: order.shipping.number,
        complement: order.shipping.complement,
        neighborhood: order.shipping.neighborhood,
        city: order.shipping.city,
        state: order.shipping.state
      }
    }));
  });
}

app.use(express.json());
app.use(cookieParser(config.cookieSecret));

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    environment: config.environment,
    paymentEnabled: Boolean(
      config.mercadoPago.publicKey && config.mercadoPago.accessToken
    )
  });
});

app.get("/api/config", (_req, res) => {
  res.json(sanitizePublicConfig());
});

app.post("/api/payments", async (req, res) => {
  try {
    const offerKind = ["main", "upsell", "downsell"].includes(req.body.offerKind)
      ? req.body.offerKind
      : "main";
    const parentReference = String(req.body.parentReference || "").trim() || null;
    const bumpSelected = offerKind === "main" && Boolean(req.body.bumpSelected);
    const customer = req.body.customer || {};
    const payment = req.body.payment || {};
    const shipping = req.body.shipping || null;
    const customerEmail = String(customer.email || "").trim();

    if (!customer.name || !customer.email) {
      return res.status(400).json({
        error: "Preencha nome e e-mail antes de pagar."
      });
    }

    if (!payment.token || !payment.paymentMethodId) {
      return res.status(400).json({
        error: "Os dados do cartao nao foram carregados corretamente."
      });
    }

    if (!payment.identificationNumber) {
      return res.status(400).json({
        error: "Informe o CPF do titular do cartao."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({
        error: "Informe um e-mail valido para liberar e acompanhar o pedido."
      });
    }

    if (bumpSelected) {
      const requiredShipping = [
        "name",
        "cep",
        "address",
        "number",
        "neighborhood",
        "city",
        "state"
      ];
      const missing = requiredShipping.find((field) => !shipping?.[field]);
      if (missing) {
        return res.status(400).json({
          error: "Preencha todos os dados de entrega das capsulas."
        });
      }
    }

    if (offerKind !== "main" && !parentReference) {
      return res.status(400).json({
        error: "Nao foi possivel identificar o pedido principal desta oferta."
      });
    }

    if (parentReference && !getOrder(parentReference)) {
      return res.status(404).json({
        error: "Pedido principal nao encontrado para vincular a oferta."
      });
    }

    const items = buildItems(offerKind, bumpSelected);
    const total = calculateTotal(items);
    const reference = generateReference(offerKind);
    const accessToken = randomId(18);

    const order = {
      reference,
      parentReference,
      kind: offerKind,
      status: "created",
      paymentStatus: "created",
      statusDetail: "",
      paymentId: "",
      paymentMethodId: "",
      installments: Number(payment.installments || 1),
      transactionAmount: total,
      total,
      items,
      bumpSelected,
      customer: {
        name: String(customer.name || "").trim(),
        email: customerEmail,
        phone: String(customer.phone || "").trim(),
        cpf: onlyDigits(customer.cpf || payment.identificationNumber)
      },
      shipping: bumpSelected
        ? {
            name: String(shipping.name || "").trim(),
            cep: String(shipping.cep || "").trim(),
            address: String(shipping.address || "").trim(),
            number: String(shipping.number || "").trim(),
            complement: String(shipping.complement || "").trim(),
            neighborhood: String(shipping.neighborhood || "").trim(),
            city: String(shipping.city || "").trim(),
            state: String(shipping.state || "").trim()
          }
        : null,
      delivery: {
        accessReleasedAt: null,
        emailReady: Boolean(customerEmail),
        emailSentAt: null
      },
      accessToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveOrder(order);

    const paymentResponse = await createMercadoPagoPayment(order, payment);
    applyPaymentData(order, paymentResponse, "payments_api");

    const rootReference = getRootReference(order.reference);
    const rootOrder = getOrder(rootReference);
    const nextUrl =
      order.status === "paid"
        ? offerKind === "main"
          ? `/upsell.html?ref=${encodeURIComponent(order.reference)}`
          : `/obrigado.html?ref=${encodeURIComponent(rootReference)}`
        : `/obrigado.html?ref=${encodeURIComponent(rootReference)}`;

    res.json({
      ok: true,
      reference: order.reference,
      rootReference,
      paymentId: order.paymentId,
      paymentStatus: order.paymentStatus,
      status: order.status,
      statusDetail: order.statusDetail,
      accessToken: rootOrder ? rootOrder.accessToken : order.accessToken,
      accessUrl:
        rootOrder && rootOrder.status === "paid"
          ? createAccessUrl(rootOrder.reference, rootOrder.accessToken)
          : null,
      nextUrl
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error:
        error.payload?.cause?.[0]?.description ||
        error.payload?.message ||
        error.message ||
        "Nao foi possivel criar o pagamento agora."
    });
  }
});

app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    if (!validateWebhookSignature(req)) {
      return res.status(401).json({ error: "Assinatura do webhook invalida." });
    }

    const eventType = req.query.type || req.body?.type || req.body?.topic || "";
    const paymentId =
      req.query["data.id"] || req.body?.data?.id || req.query.id || req.body?.id;

    if (eventType !== "payment" || !paymentId) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const payment = await fetchMercadoPagoPayment(paymentId);
    const reference = String(payment.external_reference || "").trim();

    if (!reference) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const order = getOrder(reference);
    if (!order) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    applyPaymentData(order, payment, "webhook");
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || "Falha ao processar webhook."
    });
  }
});

app.get("/api/orders/:reference", (req, res) => {
  const bundle = getBundle(req.params.reference);
  if (!bundle) {
    return res.status(404).json({ error: "Pedido nao encontrado." });
  }

  const accessAvailable = bundle.root.status === "paid";

  res.json({
    root: summarizeOrder(bundle.root),
    extras: bundle.children.map(summarizeOrder),
    approvedItems: bundle.approvedItems,
    approvedTotal: bundle.approvedTotal,
    access: {
      available: accessAvailable,
      url: accessAvailable
        ? createAccessUrl(bundle.root.reference, bundle.root.accessToken)
        : null
    }
  });
});

app.get("/api/access/session", (req, res) => {
  const reference = req.signedCookies.msr_access || "";
  if (!reference) {
    return res.status(401).json({ error: "Sem sessao ativa." });
  }

  const bundle = getBundle(reference);
  if (!bundle || bundle.root.status !== "paid") {
    return res.status(401).json({ error: "Acesso indisponivel." });
  }

  res.json({
    customerName: bundle.root.customer.name,
    reference: bundle.root.reference,
    email: bundle.root.customer.email,
    items: bundle.approvedItems,
    digitalContent: buildDigitalAccess(bundle),
    physicalShipments: buildPhysicalShipments(bundle),
    accessReleasedAt: bundle.root.delivery?.accessReleasedAt || bundle.root.approvedAt || null,
    supportEmail: config.supportEmail,
    supportWhatsApp: config.supportWhatsApp
  });
});

app.get("/liberar-acesso", (req, res) => {
  const reference = String(req.query.ref || "").trim();
  const token = String(req.query.token || "").trim();
  const bundle = getBundle(reference);

  if (!bundle || bundle.root.status !== "paid" || bundle.root.accessToken !== token) {
    return res.redirect("/checkout.html");
  }

  res.cookie("msr_access", bundle.root.reference, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: config.baseUrl.startsWith("https://"),
    maxAge: 1000 * 60 * 60 * 24 * 30
  });

  res.redirect(`/acesso.html?ref=${encodeURIComponent(bundle.root.reference)}`);
});

app.get("/acesso.html", (req, res) => {
  const reference = req.signedCookies.msr_access || "";
  const bundle = reference ? getBundle(reference) : null;

  if (!bundle || bundle.root.status !== "paid") {
    return res.redirect("/checkout.html");
  }

  res.sendFile(path.join(rootDir, "acesso.html"));
});

app.use(express.static(rootDir));

app.listen(config.port, () => {
  console.log(`Servidor ativo em ${config.baseUrl}`);
  if (!config.mercadoPago.publicKey || !config.mercadoPago.accessToken) {
    console.warn("Mercado Pago desativado: configure PUBLIC_KEY e ACCESS_TOKEN no .env");
  }
  if (config.baseUrl.startsWith("http://") && config.environment === "production") {
    console.warn("BASE_URL esta sem HTTPS. Em producao, publique com HTTPS para cookies seguros e webhook.");
  }
  if (!config.mercadoPago.webhookSecret) {
    console.warn("Webhook sem segredo configurado. Preencha MERCADO_PAGO_WEBHOOK_SECRET antes de publicar.");
  }
});
