const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const nodemailer = require("nodemailer");
const { createSportsPlatform } = require("./sports-platform");
require("dotenv").config();

const app = express();
const rootDir = __dirname;
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(rootDir, "data");
const ordersFile = path.join(dataDir, "orders.json");
const authFile = path.join(dataDir, "auth.json");

const config = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  baseUrl: (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  cookieSecret: process.env.COOKIE_SECRET || "troque-esta-chave",
  supportEmail: process.env.SUPPORT_EMAIL || "",
  supportWhatsApp: process.env.SUPPORT_WHATSAPP || "",
  appName: process.env.APP_NAME || "Match Intelligence",
  mobileResetScheme:
    process.env.MOBILE_RESET_SCHEME || "matchintelligence://reset-password",
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
  },
  premium: {
    planCode: process.env.PREMIUM_PLAN_CODE || "match_intelligence_pro",
    title: process.env.PREMIUM_PLAN_TITLE || "Match Intelligence PRO",
    description:
      process.env.PREMIUM_PLAN_DESCRIPTION ||
      "Analises premium, mercados inteligentes, alertas VIP e comparativos avancados.",
    amount: Number.parseFloat(process.env.PREMIUM_PLAN_AMOUNT || "29.9"),
    currency: String(process.env.PREMIUM_PLAN_CURRENCY || "BRL").toUpperCase(),
    frequency: Number.parseInt(process.env.PREMIUM_PLAN_FREQUENCY || "1", 10),
    frequencyType: String(process.env.PREMIUM_PLAN_FREQUENCY_TYPE || "months").toLowerCase()
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SUPPORT_EMAIL || "",
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true"
  }
};

app.disable("x-powered-by");
app.set("trust proxy", 1);

const catalog = {
  main: {
    code: "main_derreter_gordura",
    kind: "main",
    name: "Metodo Derreter Gordura",
    description: "Sistema de 7 dias que ativa a queima de gordura sem dieta pesada e sem academia.",
    price: 19.9,
    oldPrice: 97,
    type: "digital",
    delivery: {
      title: "Metodo Derreter Gordura",
      summary: "Seu guia principal ja esta liberado com plano pratico, checklist diario e bonus exclusivos.",
      modules: [
        {
          title: "Guia digital completo",
          description: "Abra o material principal com os 4 modulos, o plano de 7 dias e os bonus do Metodo Derreter Gordura.",
          fileUrl: "/downloads/metodo-derreter-gordura/Metodo_Derreter_Gordura.pdf",
          fileLabel: "Baixar guia completo",
          bullets: [
            "Promessa simples e facil de aplicar no dia a dia",
            "4 modulos para ativar metabolismo, ajustar alimentacao e manter foco",
            "Material unico para consultar no celular ou no computador"
          ]
        },
        {
          title: "Plano pratico + checklist",
          description: "O material traz um plano de 7 dias e um checklist diario para acelerar a aplicacao.",
          bullets: [
            "Acoes objetivas para comecar no mesmo dia",
            "Rotina simples para manter constancia sem dieta pesada",
            "Estrutura pensada para quem quer resultado com menos atrito"
          ]
        },
        {
          title: "Bonus estrategicos",
          description: "Os bonus ajudam a transformar o guia em um plano mais vendavel e mais pratico para o cliente final.",
          bullets: [
            "Lista de alimentos aliados e cardapio base",
            "Rotina expressa matinal e protocolo barriga zero",
            "Guia de emergencia para momentos de fraqueza"
          ]
        }
      ]
    }
  },
  bump: {
    code: "capsulas_seca_barriga",
    kind: "bump",
    name: "Capsulas Seca Barriga",
    description: "Complemento fisico opcional para acompanhar a rotina do metodo.",
    price: 19.9,
    oldPrice: 39.9,
    type: "physical",
    delivery: {
      title: "Capsulas Seca Barriga",
      summary: "Complemento fisico confirmado. A equipe vai separar e enviar para o endereco informado.",
      nextSteps: [
        "Separacao do item",
        "Preparacao para envio",
        "Atualizacao futura para disparo por e-mail ou painel"
      ]
    }
  },
  upsell: {
    code: "upsell_barriga_zero_30d",
    kind: "upsell",
    name: "Protocolo Barriga Zero 30D",
    description: "Plano complementar de 30 dias para manter a queima ativa depois da primeira semana.",
    price: 27,
    oldPrice: 67,
    type: "digital",
    delivery: {
      title: "Protocolo Barriga Zero 30D",
      summary: "Conteudo complementar liberado para quem quer manter a consistencia depois do guia principal.",
      modules: [
        {
          title: "Plano de continuidade",
          description: "Extensao do metodo com foco em manter a barriga mais seca nas semanas seguintes.",
          bullets: [
            "Rotina semanal para continuar sem voltar ao zero",
            "Ajustes simples para reduzir recaidas",
            "Aplicacao leve, pensada para manter o ritmo"
          ]
        },
        {
          title: "Checklist de manutencao",
          description: "Resumo pratico para revisar a semana e sustentar o foco.",
          bullets: [
            "Acompanhamento das principais alavancas do metodo",
            "Passos simples para seguir mesmo nos dias mais corridos",
            "Mais clareza para transformar o resultado inicial em continuidade"
          ]
        }
      ]
    }
  },
  downsell: {
    code: "downsell_cardapio_21d",
    kind: "downsell",
    name: "Cardapio Inteligente 21D",
    description: "Versao mais enxuta para quem quer apoio alimentar simples com ticket menor.",
    price: 14.9,
    oldPrice: 37,
    type: "digital",
    delivery: {
      title: "Cardapio Inteligente 21D",
      summary: "Material complementar liberado para quem prefere uma continuidade mais leve e objetiva.",
      modules: [
        {
          title: "Roteiro alimentar objetivo",
          description: "Plano resumido para facilitar as escolhas do dia a dia sem complicacao.",
          bullets: [
            "Cardapio mais simples para manter o foco",
            "Decisao rapida para quem quer uma opcao acessivel",
            "Complemento objetivo do Metodo Derreter Gordura"
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

  if (!fs.existsSync(authFile)) {
    fs.writeFileSync(
      authFile,
      JSON.stringify({ users: {}, sessions: {}, passwordResets: {} }, null, 2),
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

function pruneExpiredEntries(store) {
  const now = Date.now();
  const sessions = store.sessions || {};
  const passwordResets = store.passwordResets || {};

  Object.keys(sessions).forEach((key) => {
    const session = sessions[key];
    if (!session?.expiresAt || new Date(session.expiresAt).getTime() <= now) {
      delete sessions[key];
    }
  });

  Object.keys(passwordResets).forEach((key) => {
    const reset = passwordResets[key];
    if (!reset?.expiresAt || new Date(reset.expiresAt).getTime() <= now) {
      delete passwordResets[key];
    }
  });

  store.sessions = sessions;
  store.passwordResets = passwordResets;
  return store;
}

function readAuthStore() {
  ensureStorage();
  const store = JSON.parse(fs.readFileSync(authFile, "utf8"));
  const pruned = pruneExpiredEntries(store);
  writeAuthStore(pruned);
  return pruned;
}

function writeAuthStore(store) {
  fs.writeFileSync(authFile, JSON.stringify(pruneExpiredEntries(store), null, 2), "utf8");
}

function updateAuthStore(mutator) {
  const store = readAuthStore();
  const result = mutator(store) || store;
  writeAuthStore(result);
  return result;
}

function randomId(size = 16) {
  return crypto.randomBytes(size).toString("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function createPasswordHash(password) {
  const salt = randomId(12);
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const expected = crypto.scryptSync(String(password || ""), salt, 64);
  const received = Buffer.from(String(hash || ""), "hex");

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

function serializeAuthUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || null,
    premium: buildPremiumSnapshot(user)
  };
}

function premiumAccessLevelFromStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (["authorized", "active"].includes(normalized)) {
    return "premium";
  }
  if (["pending", "in_process", "payment_in_process"].includes(normalized)) {
    return "pending";
  }
  return "free";
}

function premiumStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (["authorized", "active"].includes(normalized)) return "Ativa";
  if (["pending", "in_process", "payment_in_process"].includes(normalized)) return "Pendente";
  if (normalized === "paused") return "Pausada";
  if (normalized === "cancelled") return "Cancelada";
  return "Inativa";
}

function buildPremiumSnapshot(user) {
  const premium = user?.premium || {};
  const status = premium.status || "inactive";

  return {
    status,
    statusLabel: premiumStatusLabel(status),
    accessLevel: premium.accessLevel || premiumAccessLevelFromStatus(status),
    planCode: premium.planCode || config.premium.planCode,
    planTitle: premium.planTitle || config.premium.title,
    amount: premium.amount || Number(config.premium.amount.toFixed(2)),
    currency: premium.currency || config.premium.currency,
    frequency: premium.frequency || config.premium.frequency,
    frequencyType: premium.frequencyType || config.premium.frequencyType,
    mercadoPagoPreapprovalId: premium.mercadoPagoPreapprovalId || "",
    checkoutUrl: premium.checkoutUrl || "",
    sandboxCheckoutUrl: premium.sandboxCheckoutUrl || "",
    externalReference: premium.externalReference || "",
    nextBillingDate: premium.nextBillingDate || null,
    approvedAt: premium.approvedAt || null,
    lastSyncAt: premium.lastSyncAt || null,
    source: premium.source || "mercado_pago",
    reason: premium.reason || ""
  };
}

function premiumExternalReference(user) {
  return `MI-PRO-${String(user?.id || "").toUpperCase()}`;
}

function upsertUserPremium(user, remotePremium, source = "api") {
  const current = buildPremiumSnapshot(user);
  const remoteStatus = remotePremium?.status || current.status || "inactive";
  const nextBillingDate =
    remotePremium?.auto_recurring?.next_payment_date ||
    remotePremium?.next_payment_date ||
    current.nextBillingDate ||
    null;
  const approvedAt =
    premiumAccessLevelFromStatus(remoteStatus) === "premium"
      ? current.approvedAt || remotePremium?.date_created || new Date().toISOString()
      : current.approvedAt || null;

  user.premium = {
    status: remoteStatus,
    accessLevel: premiumAccessLevelFromStatus(remoteStatus),
    planCode: current.planCode,
    planTitle: current.planTitle,
    amount: Number(config.premium.amount.toFixed(2)),
    currency: config.premium.currency,
    frequency: config.premium.frequency,
    frequencyType: config.premium.frequencyType,
    mercadoPagoPreapprovalId: remotePremium?.id
      ? String(remotePremium.id)
      : current.mercadoPagoPreapprovalId || "",
    checkoutUrl: remotePremium?.init_point || current.checkoutUrl || "",
    sandboxCheckoutUrl:
      remotePremium?.sandbox_init_point || current.sandboxCheckoutUrl || "",
    externalReference:
      remotePremium?.external_reference ||
      current.externalReference ||
      premiumExternalReference(user),
    nextBillingDate,
    approvedAt,
    lastSyncAt: new Date().toISOString(),
    source,
    reason: remotePremium?.reason || current.reason || config.premium.title
  };

  user.updatedAt = new Date().toISOString();
  return user.premium;
}

function validateAuthPayload({ name, email, password, confirmPassword }, { requireName = false } = {}) {
  const normalizedEmail = normalizeEmail(email);

  if (requireName && String(name || "").trim().length < 3) {
    const error = new Error("Digite um nome com pelo menos 3 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error("Digite um e-mail valido.");
    error.statusCode = 400;
    throw error;
  }

  if (String(password || "").length < 6) {
    const error = new Error("A senha precisa ter pelo menos 6 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    const error = new Error("A confirmacao da senha nao confere.");
    error.statusCode = 400;
    throw error;
  }
}

function createAuthSession(store, email) {
  const token = randomId(24);
  const tokenHash = sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 45).toISOString();

  store.sessions[tokenHash] = {
    email,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt
  };

  return token;
}

function removeSessionsForEmail(store, email) {
  Object.keys(store.sessions || {}).forEach((tokenHash) => {
    if (store.sessions[tokenHash]?.email === email) {
      delete store.sessions[tokenHash];
    }
  });
}

function getAuthSessionFromRequest(req) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return null;
  }

  const store = readAuthStore();
  const tokenHash = sha256(token);
  const session = store.sessions[tokenHash];

  if (!session) {
    return null;
  }

  const user = store.users[session.email];
  if (!user) {
    delete store.sessions[tokenHash];
    writeAuthStore(store);
    return null;
  }

  session.lastSeenAt = new Date().toISOString();
  store.sessions[tokenHash] = session;
  writeAuthStore(store);

  return { token, tokenHash, session, user };
}

function requireAuth(req, res, next) {
  const auth = getAuthSessionFromRequest(req);
  if (!auth) {
    return res.status(401).json({ error: "Sessao invalida ou expirada." });
  }

  req.auth = auth;
  next();
}

async function sendPasswordResetMail(email, token) {
  if (!config.smtp.host || !config.smtp.from) {
    const error = new Error("SMTP nao configurado para envio de e-mails.");
    error.statusCode = 503;
    throw error;
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth:
      config.smtp.user || config.smtp.pass
        ? {
            user: config.smtp.user,
            pass: config.smtp.pass
          }
        : undefined
  });

  const encodedEmail = encodeURIComponent(email);
  const encodedToken = encodeURIComponent(token);
  const resetLink = `${config.mobileResetScheme}?token=${encodedToken}&email=${encodedEmail}`;

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: `${config.appName} - redefinir senha`,
    text: [
      `Voce pediu para redefinir sua senha no ${config.appName}.`,
      "",
      `Abra este link no celular: ${resetLink}`,
      `Ou use este token no app: ${token}`,
      "",
      "Se voce nao pediu essa alteracao, ignore este e-mail."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;background:#081523;color:#F4F8FF;padding:24px">
        <h2 style="margin:0 0 12px">Redefinir senha</h2>
        <p>Voce pediu para redefinir sua senha no <strong>${config.appName}</strong>.</p>
        <p><a href="${resetLink}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#22C55E;color:#081523;text-decoration:none;font-weight:700">Abrir no app</a></p>
        <p>Se preferir, cole este token no app:</p>
        <p style="font-size:20px;font-weight:700;letter-spacing:1px">${token}</p>
        <p style="opacity:.8">Se voce nao pediu essa alteracao, ignore este e-mail.</p>
      </div>
    `
  });
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

function buildItems(kind) {
  const items = [];

  if (kind === "main") {
    items.push({ ...catalog.main, quantity: 1 });
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
    selectedPaymentMethod: order.selectedPaymentMethod || "",
    paymentMethodId: order.paymentMethodId || "",
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
  const identificationNumber = onlyDigits(paymentData.identificationNumber || order.customer.cpf);

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

  const basePayload = {
    transaction_amount: Number(order.total.toFixed(2)),
    description: order.items.map((item) => item.name).join(" + "),
    external_reference: order.reference,
    notification_url: `${config.baseUrl}/api/webhooks/mercadopago`,
    payer: {
      email: order.customer.email,
      first_name: firstName,
      last_name: lastName,
      entity_type: "individual",
      ...(identificationNumber
        ? {
            identification: {
              type: paymentData.identificationType || "CPF",
              number: identificationNumber
            }
          }
        : {})
    },
    additional_info: additionalInfo,
    metadata: {
      order_reference: order.reference,
      order_kind: order.kind,
      parent_reference: order.parentReference || "",
      bump_selected: "false"
    }
  };

  if (paymentData.method === "pix") {
    return {
      ...basePayload,
      payment_method_id: "pix"
    };
  }

  return {
    ...basePayload,
    token: paymentData.token,
    installments: Number(paymentData.installments || 1),
    payment_method_id: paymentData.paymentMethodId,
    issuer_id: paymentData.issuerId || undefined,
    statement_descriptor: config.mercadoPago.statementDescriptor
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

async function createMercadoPagoPremiumSubscription(user) {
  const now = Date.now();
  const body = {
    reason: config.premium.title,
    external_reference: premiumExternalReference(user),
    payer_email: user.email,
    back_url: `${config.baseUrl}/premium/return`,
    notification_url: `${config.baseUrl}/api/webhooks/mercadopago`,
    status: "pending",
    auto_recurring: {
      frequency: config.premium.frequency,
      frequency_type: config.premium.frequencyType,
      transaction_amount: Number(config.premium.amount.toFixed(2)),
      currency_id: config.premium.currency,
      start_date: new Date(now + 1000 * 60 * 5).toISOString()
    }
  };

  return mercadoPagoRequest("/preapproval", {
    method: "POST",
    headers: {
      "X-Idempotency-Key": randomId(12)
    },
    body: JSON.stringify(body)
  });
}

async function fetchMercadoPagoPreapproval(preapprovalId) {
  return mercadoPagoRequest(`/preapproval/${preapprovalId}`, {
    method: "GET"
  });
}

function findUserByPremiumReference(store, { externalReference, preapprovalId }) {
  return Object.values(store.users || {}).find((user) => {
    const premium = user?.premium || {};
    return (
      (externalReference && premium.externalReference === externalReference) ||
      (preapprovalId &&
        String(premium.mercadoPagoPreapprovalId || "") === String(preapprovalId))
    );
  });
}

function extractPixData(payment) {
  const transactionData = payment?.point_of_interaction?.transaction_data || {};

  return {
    qrCode: transactionData.qr_code || "",
    qrCodeBase64: transactionData.qr_code_base64 || "",
    ticketUrl: transactionData.ticket_url || "",
    expiresAt: payment?.date_of_expiration || null
  };
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
    premiumEnabled: Boolean(
      config.mercadoPago.accessToken && config.premium.amount > 0
    ),
    environment: config.environment,
    publicKey: config.mercadoPago.publicKey,
    supportEmail: config.supportEmail,
    supportWhatsApp: config.supportWhatsApp,
    premium: {
      planCode: config.premium.planCode,
      title: config.premium.title,
      description: config.premium.description,
      amount: Number(config.premium.amount.toFixed(2)),
      currency: config.premium.currency,
      frequency: config.premium.frequency,
      frequencyType: config.premium.frequencyType
    },
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

function normalizeDownloadPath(rawPath) {
  const normalized = path.posix.normalize(`/${String(rawPath || "").replace(/\\/g, "/")}`);
  if (!normalized.startsWith("/downloads/")) {
    return "";
  }
  if (normalized.includes("..")) {
    return "";
  }
  return normalized;
}

function getAuthorizedDownloadPaths(bundle) {
  const paths = new Set();

  buildDigitalAccess(bundle).forEach((content) => {
    (content.modules || []).forEach((module) => {
      const fileUrl = normalizeDownloadPath(module.fileUrl);
      if (fileUrl) {
        paths.add(fileUrl);
      }
    });
  });

  return paths;
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

app.get("/premium/return", (_req, res) => {
  const appOpenUrl = `${String(config.mobileResetScheme || "matchintelligence://reset-password").split("://")[0]}://`;
  res.type("html").send(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${config.appName} Premium</title>
        <style>
          body{margin:0;font-family:Arial,sans-serif;background:#07111f;color:#f4f8ff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
          .card{max-width:480px;width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:28px}
          h1{margin:0 0 12px;font-size:28px}
          p{margin:0 0 12px;line-height:1.6;color:#cbd5e1}
          a{display:inline-block;margin-top:8px;padding:12px 16px;border-radius:12px;background:#22c55e;color:#07111f;text-decoration:none;font-weight:700}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Pagamento enviado</h1>
          <p>Se a assinatura foi aprovada, volte ao app e toque em <strong>Atualizar premium</strong>.</p>
          <p>Se quiser, voce tambem pode fechar esta tela agora.</p>
          <a href="${appOpenUrl}">Abrir o app</a>
        </div>
      </body>
    </html>
  `);
});

app.post("/api/auth/register", (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    validateAuthPayload({ name, email, password, confirmPassword }, { requireName: true });

    const store = readAuthStore();
    if (store.users[email]) {
      return res.status(409).json({ error: "Ja existe uma conta cadastrada com esse e-mail." });
    }

    const passwordData = createPasswordHash(password);
    const now = new Date().toISOString();
    const user = {
      id: randomId(10),
      name,
      email,
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      premium: {
        status: "inactive",
        accessLevel: "free",
        planCode: config.premium.planCode,
        planTitle: config.premium.title,
        amount: Number(config.premium.amount.toFixed(2)),
        currency: config.premium.currency,
        frequency: config.premium.frequency,
        frequencyType: config.premium.frequencyType,
        source: "mercado_pago",
        lastSyncAt: now
      },
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    };

    store.users[email] = user;
    const token = createAuthSession(store, email);
    writeAuthStore(store);

    res.json({
      ok: true,
      token,
      user: serializeAuthUser(user)
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Nao foi possivel criar a conta agora."
    });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Digite e-mail e senha para entrar." });
    }

    const store = readAuthStore();
    const user = store.users[email];
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return res.status(401).json({ error: "E-mail ou senha invalidos." });
    }

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = user.lastLoginAt;
    store.users[email] = user;
    const token = createAuthSession(store, email);
    writeAuthStore(store);

    res.json({
      ok: true,
      token,
      user: serializeAuthUser(user)
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Nao foi possivel entrar agora."
    });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: serializeAuthUser(req.auth.user)
  });
});

app.patch("/api/auth/profile", requireAuth, (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (name.length < 3) {
      return res.status(400).json({ error: "Digite um nome com pelo menos 3 caracteres." });
    }

    const store = readAuthStore();
    const email = req.auth.user.email;
    const user = store.users[email];

    if (!user) {
      return res.status(404).json({ error: "Conta nao encontrada." });
    }

    user.name = name;
    user.updatedAt = new Date().toISOString();
    store.users[email] = user;
    writeAuthStore(store);

    res.json({
      ok: true,
      user: serializeAuthUser(user)
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Nao foi possivel salvar o perfil agora."
    });
  }
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const store = readAuthStore();
  delete store.sessions[req.auth.tokenHash];
  writeAuthStore(store);
  res.json({ ok: true });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Digite um e-mail valido." });
    }

    const store = readAuthStore();
    const user = store.users[email];

    if (!config.smtp.host || !config.smtp.from) {
      return res.status(503).json({
        error: "Recuperacao por e-mail ainda nao esta configurada no servidor."
      });
    }

    if (user) {
      const token = randomId(6).toUpperCase();
      const tokenHash = sha256(token);
      store.passwordResets[tokenHash] = {
        email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 20).toISOString()
      };
      writeAuthStore(store);
      await sendPasswordResetMail(email, token);
    }

    res.json({
      ok: true,
      message: "Se existir uma conta com esse e-mail, o link de recuperacao foi enviado."
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Nao foi possivel iniciar a recuperacao agora."
    });
  }
});

app.post("/api/auth/reset-password", (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const token = String(req.body?.token || "").trim().toUpperCase();
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    validateAuthPayload({ email, password, confirmPassword });

    if (!token) {
      return res.status(400).json({ error: "Informe o token recebido por e-mail." });
    }

    const store = readAuthStore();
    const reset = store.passwordResets[sha256(token)];

    if (!reset || reset.email !== email) {
      return res.status(400).json({ error: "Token invalido ou expirado." });
    }

    const user = store.users[email];
    if (!user) {
      return res.status(404).json({ error: "Conta nao encontrada." });
    }

    const passwordData = createPasswordHash(password);
    user.passwordSalt = passwordData.salt;
    user.passwordHash = passwordData.hash;
    user.updatedAt = new Date().toISOString();
    store.users[email] = user;

    delete store.passwordResets[sha256(token)];
    removeSessionsForEmail(store, email);
    const authToken = createAuthSession(store, email);
    writeAuthStore(store);

    res.json({
      ok: true,
      token: authToken,
      user: serializeAuthUser(user)
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Nao foi possivel redefinir a senha agora."
    });
  }
});

app.get("/api/subscriptions/me", requireAuth, async (req, res) => {
  try {
    const email = req.auth.user.email;
    let subscription = null;
    let user = null;

    const store = readAuthStore();
    user = store.users[email];

    if (!user) {
      return res.status(404).json({ error: "Conta nao encontrada." });
    }

    if (user.premium?.mercadoPagoPreapprovalId) {
      try {
        const remoteSubscription = await fetchMercadoPagoPreapproval(
          user.premium.mercadoPagoPreapprovalId
        );
        upsertUserPremium(user, remoteSubscription, "subscriptions_api");
        store.users[email] = user;
        writeAuthStore(store);
      } catch (error) {
        subscription = buildPremiumSnapshot(user);
        return res.status(200).json({
          user: serializeAuthUser(user),
          subscription,
          warning:
            error?.message ||
            "Nao foi possivel sincronizar a assinatura premium agora."
        });
      }
    }

    subscription = buildPremiumSnapshot(user);

    res.json({
      user: serializeAuthUser(user),
      subscription
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Falha ao carregar assinatura premium."
    });
  }
});

app.post("/api/subscriptions/premium/start", requireAuth, async (req, res) => {
  try {
    const email = req.auth.user.email;
    const store = readAuthStore();
    const user = store.users[email];

    if (!user) {
      return res.status(404).json({ error: "Conta nao encontrada." });
    }

    let remoteSubscription = null;
    if (user.premium?.mercadoPagoPreapprovalId) {
      try {
        remoteSubscription = await fetchMercadoPagoPreapproval(
          user.premium.mercadoPagoPreapprovalId
        );
      } catch {
        remoteSubscription = null;
      }
    }

    if (!remoteSubscription || ["cancelled", "paused"].includes(String(remoteSubscription.status || "").toLowerCase())) {
      remoteSubscription = await createMercadoPagoPremiumSubscription(user);
    }

    upsertUserPremium(user, remoteSubscription, "subscriptions_start");
    store.users[email] = user;
    writeAuthStore(store);

    res.json({
      user: serializeAuthUser(user),
      subscription: buildPremiumSnapshot(user),
      checkoutUrl:
        user.premium.checkoutUrl ||
        user.premium.sandboxCheckoutUrl ||
        ""
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Falha ao iniciar assinatura premium."
    });
  }
});

app.post("/api/payments", async (req, res) => {
  try {
    const offerKind = ["main", "upsell", "downsell"].includes(req.body.offerKind)
      ? req.body.offerKind
      : "main";
    const parentReference = String(req.body.parentReference || "").trim() || null;
    const customer = req.body.customer || {};
    const payment = req.body.payment || {};
    const paymentMethod = payment.method === "pix" ? "pix" : "card";
    const customerEmail = String(customer.email || "").trim();

    if (!customer.name || !customer.email) {
      return res.status(400).json({
        error: "Preencha nome e e-mail antes de pagar."
      });
    }

    if (paymentMethod === "card" && (!payment.token || !payment.paymentMethodId)) {
      return res.status(400).json({
        error: "Os dados do cartao nao foram carregados corretamente."
      });
    }

    if (paymentMethod === "card" && !payment.identificationNumber && !customer.cpf) {
      return res.status(400).json({
        error: "Informe o CPF do titular do cartao para continuar."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({
        error: "Informe um e-mail valido para liberar e acompanhar o pedido."
      });
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

    const items = buildItems(offerKind);
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
      selectedPaymentMethod: paymentMethod,
      installments: Number(payment.installments || 1),
      transactionAmount: total,
      total,
      items,
      bumpSelected: false,
      customer: {
        name: String(customer.name || "").trim(),
        email: customerEmail,
        phone: String(customer.phone || "").trim(),
        cpf: onlyDigits(customer.cpf || payment.identificationNumber)
      },
      shipping: null,
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
      paymentMethod,
      paymentId: order.paymentId,
      paymentStatus: order.paymentStatus,
      status: order.status,
      statusDetail: order.statusDetail,
      pix: paymentMethod === "pix" ? extractPixData(paymentResponse) : null,
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

    const eventType = String(req.query.type || req.body?.type || req.body?.topic || "").toLowerCase();
    const resourceId =
      req.query["data.id"] || req.body?.data?.id || req.query.id || req.body?.id;

    if (eventType === "payment" && resourceId) {
      const payment = await fetchMercadoPagoPayment(resourceId);
      const reference = String(payment.external_reference || "").trim();

      if (!reference) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      const order = getOrder(reference);
      if (!order) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      applyPaymentData(order, payment, "webhook");
      return res.status(200).json({ ok: true, type: "payment" });
    }

    if (resourceId && (eventType.includes("preapproval") || eventType.includes("subscription"))) {
      const remoteSubscription = await fetchMercadoPagoPreapproval(resourceId);
      const store = readAuthStore();
      const user = findUserByPremiumReference(store, {
        externalReference: String(remoteSubscription.external_reference || "").trim(),
        preapprovalId: remoteSubscription.id
      });

      if (!user) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      upsertUserPremium(user, remoteSubscription, "webhook");
      store.users[user.email] = user;
      writeAuthStore(store);

      return res.status(200).json({ ok: true, type: "subscription" });
    }

    return res.status(200).json({ ok: true, ignored: true });
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

app.get(/^\/downloads\/.*$/, (req, res) => {
  const reference = req.signedCookies.msr_access || "";
  if (!reference) {
    return res.redirect("/checkout.html");
  }

  const bundle = getBundle(reference);
  if (!bundle || bundle.root.status !== "paid") {
    return res.redirect("/checkout.html");
  }

  const requestedPath = normalizeDownloadPath(req.path);
  const authorizedPaths = getAuthorizedDownloadPaths(bundle);

  if (!requestedPath || !authorizedPaths.has(requestedPath)) {
    return res.status(403).send("Arquivo indisponivel para esta sessao.");
  }

  const relativeFilePath = requestedPath.replace(/^\//, "");
  const absoluteFilePath = path.resolve(rootDir, relativeFilePath);
  const downloadsRoot = path.resolve(rootDir, "downloads");

  if (!absoluteFilePath.startsWith(downloadsRoot + path.sep) && absoluteFilePath !== downloadsRoot) {
    return res.status(403).send("Arquivo indisponivel para esta sessao.");
  }

  if (!fs.existsSync(absoluteFilePath)) {
    return res.status(404).send("Arquivo nao encontrado.");
  }

  return res.sendFile(absoluteFilePath, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0"
    }
  });
});

createSportsPlatform({
  rootDir,
  getAuthSessionFromRequest,
  buildPremiumSnapshot
}).register(app);

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
  if (!config.smtp.host || !config.smtp.from) {
    console.warn("Recuperacao por e-mail desativada: configure SMTP_HOST e SMTP_FROM para habilitar reset de senha.");
  }
});
