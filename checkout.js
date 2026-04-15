const checkoutSessionKey = "mdg7d-session";

const fallbackCatalog = {
  main: {
    name: "Metodo Derreter Gordura",
    description:
      "Sistema de 7 dias que ativa a queima de gordura sem dieta pesada e sem academia.",
    price: 19.9,
    oldPrice: 97,
    type: "digital"
  },
  bump: {
    name: "Capsulas Seca Barriga",
    description: "Complemento fisico opcional para acompanhar a rotina do metodo.",
    price: 19.9,
    oldPrice: 39.9,
    type: "physical"
  },
  upsell: {
    name: "Protocolo Barriga Zero 30D",
    description:
      "Plano complementar de 30 dias para manter a queima ativa depois da primeira semana.",
    price: 27,
    oldPrice: 67,
    type: "digital"
  },
  downsell: {
    name: "Cardapio Inteligente 21D",
    description:
      "Versao mais enxuta para quem quer apoio alimentar simples com ticket menor.",
    price: 14.9,
    oldPrice: 37,
    type: "digital"
  }
};

const offerCopy = {
  main: {
    eyebrow: "Checkout principal",
    title: "Voce esta a um passo de liberar o Metodo Derreter Gordura.",
    lead:
      "Finalize em poucos passos e receba o guia principal com plano de 7 dias, checklist e bonus no mesmo acesso.",
    priceNote: "pagamento unico",
    items: [
      "Guia digital completo com 4 modulos praticos",
      "Plano de 7 dias passo a passo",
      "Checklist diario para manter o foco",
      "5 bonus estrategicos dentro do material",
      "Garantia de 7 dias"
    ]
  },
  upsell: {
    eyebrow: "Oferta adicional",
    title: "Leve tambem o Protocolo Barriga Zero 30D.",
    lead:
      "Essa oferta complementa o guia principal e ajuda a sustentar a queima por mais tempo.",
    priceNote: "pagamento unico",
    items: [
      "Plano complementar de 30 dias",
      "Rotina de manutencao simples",
      "Checklist de continuidade"
    ]
  },
  downsell: {
    eyebrow: "Ultima oferta",
    title: "Finalize o Cardapio Inteligente 21D.",
    lead:
      "Uma opcao mais leve para quem quer um apoio alimentar pratico com valor menor.",
    priceNote: "pagamento unico",
    items: [
      "Cardapio simples de 21 dias",
      "Roteiro objetivo para o dia a dia",
      "Material enxuto para continuidade"
    ]
  }
};

const paymentCopy = {
  pix: {
    caption: "Gere o Pix em segundos e pague com QR Code ou copia e cola.",
    submit: "GERAR PIX \u26A1",
    submitting: "GERANDO PIX...",
    submitSuccess: "PIX GERADO \u26A1"
  },
  card: {
    caption: "Preencha os dados do cartao e finalize sem sair da pagina.",
    submit: "PAGAR COM CARTAO \uD83D\uDCB3",
    submitting: "PROCESSANDO CARTAO...",
    submitSuccess: "PAGAR COM CARTAO \uD83D\uDCB3"
  }
};

const state = {
  config: {
    paymentEnabled: false,
    publicKey: "",
    catalog: fallbackCatalog
  },
  offerKind: "main",
  parentReference: "",
  paymentMethod: "pix",
  cardForm: null,
  submitting: false,
  cardholderTouched: false,
  pixPollTimer: null,
  paymentInfoTracked: false
};

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setText(selector, value) {
  const node = qs(selector);
  if (node) {
    node.textContent = value;
  }
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

function readSession() {
  try {
    const raw = localStorage.getItem(checkoutSessionKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSession(data) {
  const current = readSession();
  localStorage.setItem(checkoutSessionKey, JSON.stringify({ ...current, ...data }));
}

async function parseJsonResponse(response) {
  const raw = await response.text();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Resposta invalida do servidor. Atualize a pagina e tente novamente.");
  }
}

async function loadConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Nao foi possivel carregar a configuracao do checkout.");
  }
  state.config = await parseJsonResponse(response);
}

function resolveOfferKind() {
  const params = getParams();
  const requested = params.get("offer");
  state.offerKind = ["upsell", "downsell"].includes(requested) ? requested : "main";
  state.parentReference = params.get("parent") || params.get("ref") || "";
}

function getOfferProduct() {
  return state.config.catalog?.[state.offerKind] || fallbackCatalog[state.offerKind];
}

function getCurrentTotal() {
  const product = getOfferProduct();
  return Number(product.price || 0);
}

function getCompareTotal() {
  const product = getOfferProduct();
  return Number(product.oldPrice || 0);
}

function getSavingsTotal() {
  return Math.max(0, getCompareTotal() - getCurrentTotal());
}

function setFeedback(message, type = "error") {
  const feedback = qs("[data-checkout-feedback]");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.remove("hidden", "success", "error");
  feedback.classList.add(type);
}

function clearFeedback() {
  const feedback = qs("[data-checkout-feedback]");
  if (!feedback) return;
  feedback.textContent = "";
  feedback.classList.add("hidden");
  feedback.classList.remove("success", "error");
}

function clearPixPolling() {
  if (state.pixPollTimer) {
    window.clearTimeout(state.pixPollTimer);
    state.pixPollTimer = null;
  }
}

function clearPixResult() {
  clearPixPolling();
  const resultBox = qs("[data-pix-result]");
  const qrImage = qs("[data-pix-qr-image]");
  const codeField = qs("[data-pix-code]");
  const statusLink = qs("[data-pix-status-link]");
  const statusLabel = qs("[data-pix-status-label]");

  resultBox?.classList.add("hidden");
  if (qrImage) {
    qrImage.removeAttribute("src");
  }
  if (codeField) {
    codeField.value = "";
  }
  if (statusLink) {
    statusLink.setAttribute("href", "#");
  }
  if (statusLabel) {
    statusLabel.textContent = "Aguardando pagamento";
  }
}

async function handlePixSubmit() {
  if (state.submitting) return;

  clearFeedback();
  setLoading(true);

  try {
    const { payload, customer } = await sendPayment(paymentPayloadFromPix(collectCustomer()));
    saveSession({
      rootReference: payload.rootReference,
      currentReference: payload.reference,
      accessToken: payload.accessToken,
      customer,
      paymentMethod: "pix"
    });
    await identifyCheckoutCustomer(customer, payload.rootReference || payload.reference);

    if (typeof window.trackEvent === "function") {
      window.trackEvent("PlaceAnOrder", {
        offer: state.offerKind,
        value: getCurrentTotal(),
        method: "pix",
        section: "checkout-submit",
        cta_name: "GERAR PIX"
      });
    }

    if (payload.paymentStatus === "approved") {
      if (typeof window.trackEvent === "function") {
        window.trackEvent("Purchase", {
          offer: state.offerKind,
          value: getCurrentTotal(),
          reference: payload.reference,
          method: "pix",
          status: "approved",
          root_reference: payload.rootReference || payload.reference
        });
        if (window.tiktokPixel) {
          window.tiktokPixel.markPurchase(payload.rootReference || payload.reference);
        }
      }
      window.location.href = payload.nextUrl;
      return;
    }

    renderPixResult(payload);
  } catch (error) {
    setFeedback(error.message || "Falha ao gerar o Pix.");
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  state.submitting = loading;
  const button = qs("[data-submit-order]");
  if (!button) return;

  const activeCopy = paymentCopy[state.paymentMethod];
  button.disabled = loading;
  setText("[data-submit-label]", loading ? activeCopy.submitting : activeCopy.submit);
  setText("[data-submit-total]", formatBRL(getCurrentTotal()));
}

function applyMasks() {
  const cpf = qs("#cpf");

  const formatCpf = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  cpf?.addEventListener("input", () => {
    cpf.value = formatCpf(cpf.value);
  });
}

function renderSummary() {
  const product = getOfferProduct();
  const copy = offerCopy[state.offerKind];
  const itemsContainer = qs("[data-offer-items]");
  const parentBox = qs("[data-offer-parent-box]");

  setText("[data-offer-eyebrow]", copy.eyebrow);
  setText("[data-offer-title]", copy.title);
  setText("[data-offer-lead]", copy.lead);
  setText("[data-offer-old-price]", `De ${formatBRL(product.oldPrice)}`);
  setText("[data-offer-price]", formatBRL(product.price));
  setText("[data-offer-price-note]", copy.priceNote);
  setText("[data-offer-description]", product.description);

  qsa("[data-order-line-title]").forEach((node) => {
    node.textContent = product.name;
  });

  setText("[data-order-line-price]", formatBRL(product.price));
  setText("[data-header-total]", formatBRL(getCurrentTotal()));
  setText("[data-order-total]", formatBRL(getCurrentTotal()));
  setText("[data-submit-total]", formatBRL(getCurrentTotal()));
  setText("[data-order-compare]", formatBRL(getCompareTotal()));
  setText("[data-order-savings]", formatBRL(getSavingsTotal()));

  itemsContainer.innerHTML = copy.items
    .map(
      (item) => `
        <div class="summary-item">
          <span>${item}</span>
          <strong class="summary-item-badge">Acesso liberado</strong>
        </div>
      `
    )
    .join("");

  if (state.offerKind === "main") {
    parentBox?.classList.add("hidden");
  } else {
    parentBox?.classList.toggle("hidden", !state.parentReference);
    const refNode = qs("[data-parent-reference]");
    if (refNode) refNode.textContent = state.parentReference || "--";
  }
}

function prefillFields() {
  const session = readSession();
  const customer = session.customer || {};

  const fields = {
    name: customer.name || "",
    email: customer.email || "",
    cpf: customer.cpf || "",
    "cardholder-name": customer.name || ""
  };

  Object.entries(fields).forEach(([id, value]) => {
    const field = qs(`#${id}`);
    if (field && !field.value) {
      field.value = value;
    }
  });
}

function bindSmartFields() {
  const nameField = qs("#name");
  const cardholderField = qs("#cardholder-name");
  const emailField = qs("#email");

  cardholderField?.addEventListener("input", () => {
    state.cardholderTouched = Boolean(cardholderField.value.trim());
  });

  nameField?.addEventListener("input", () => {
    const cleanName = nameField.value.trimStart();
    if (nameField.value !== cleanName) {
      nameField.value = cleanName;
    }

    if (cardholderField && !state.cardholderTouched) {
      cardholderField.value = nameField.value;
    }
  });

  emailField?.addEventListener("blur", () => {
    emailField.value = emailField.value.trim().toLowerCase();
  });
}

function collectCustomer() {
  return {
    name: qs("#name")?.value.trim() || "",
    email: qs("#email")?.value.trim() || "",
    cpf: qs("#cpf")?.value.trim() || ""
  };
}

async function identifyCheckoutCustomer(customer, reference) {
  if (typeof window.tiktokIdentify !== "function") {
    return;
  }

  try {
    await window.tiktokIdentify({
      email: customer.email,
      external_id: reference
    });
  } catch {
    // Falha de identificacao nao deve bloquear o checkout.
  }
}

function validateBeforeSubmit(customer) {
  if (!customer.name || !customer.email || !customer.cpf) {
    return "Preencha nome, e-mail e CPF para continuar.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    return "Digite um e-mail valido para receber seu acesso.";
  }

  if (state.paymentMethod === "card") {
    const cardholder = qs("#cardholder-name")?.value.trim() || "";
    if (!cardholder) {
      return "Informe o nome como esta no cartao.";
    }
  }

  if (!state.parentReference && state.offerKind !== "main") {
    return "Nao foi possivel localizar o pedido principal desta oferta.";
  }

  return "";
}

function paymentPayloadFromCard(cardFormData) {
  return {
    method: "card",
    token: cardFormData.token,
    issuerId: cardFormData.issuerId,
    paymentMethodId: cardFormData.paymentMethodId,
    installments: cardFormData.installments,
    identificationType: cardFormData.identificationType,
    identificationNumber: cardFormData.identificationNumber,
    cardholderName: qs("#cardholder-name")?.value.trim() || ""
  };
}

function paymentPayloadFromPix(customer) {
  return {
    method: "pix",
    paymentMethodId: "pix",
    identificationType: "CPF",
    identificationNumber: customer.cpf
  };
}

async function sendPayment(paymentData) {
  const customer = collectCustomer();
  const error = validateBeforeSubmit(customer);

  if (error) {
    throw new Error(error);
  }

  const response = await fetch("/api/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      offerKind: state.offerKind,
      parentReference: state.offerKind === "main" ? null : state.parentReference,
      customer,
      payment: paymentData
    })
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel processar o pagamento.");
  }

  return { payload, customer };
}

function renderPaymentMethod() {
  const submitButton = qs("[data-submit-order]");

  qsa("[data-method-button]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.getAttribute("data-method-option") === state.paymentMethod
    );
  });

  qs("[data-card-fields]")?.classList.toggle("hidden", state.paymentMethod !== "card");
  qs("[data-pix-preview]")?.classList.toggle("hidden", state.paymentMethod !== "pix");
  setText("[data-method-caption]", paymentCopy[state.paymentMethod].caption);
  setText("[data-submit-label]", paymentCopy[state.paymentMethod].submit);
  if (submitButton) {
    submitButton.type = state.paymentMethod === "card" ? "submit" : "button";
  }

  if (
    state.paymentMethod === "card" &&
    !state.paymentInfoTracked &&
    typeof window.trackEvent === "function"
  ) {
    state.paymentInfoTracked = true;
    window.trackEvent("AddPaymentInfo", {
      offer: state.offerKind,
      value: getCurrentTotal(),
      method: "card",
      section: "payment-method"
    });
  }

  if (state.paymentMethod !== "pix") {
    clearPixResult();
  }
}

function bindPaymentMethodSwitch() {
  const session = readSession();
  if (session.paymentMethod === "card" || session.paymentMethod === "pix") {
    state.paymentMethod = session.paymentMethod;
  }

  qsa("[data-method-button]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.getAttribute("data-method-option");
      if (!selected || state.paymentMethod === selected) {
        return;
      }

      state.paymentMethod = selected;
      state.paymentInfoTracked = false;
      saveSession({ paymentMethod: selected });
      clearFeedback();
      if (typeof window.trackEvent === "function") {
        window.trackEvent("PaymentMethodSelected", {
          offer: state.offerKind,
          value: getCurrentTotal(),
          method: selected,
          section: "payment-method"
        });
      }
      renderPaymentMethod();
    });
  });

  const copyPixButton = qs("[data-copy-pix]");
  copyPixButton?.addEventListener("click", async () => {
    const code = qs("[data-pix-code]")?.value || "";
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      copyPixButton.textContent = "CODIGO COPIADO";
      if (typeof window.trackEvent === "function") {
        window.trackEvent("CopyPixCode", {
          offer: state.offerKind,
          value: getCurrentTotal(),
          method: "pix",
          label: "pix-copy-paste"
        });
      }
      window.setTimeout(() => {
        copyPixButton.textContent = "COPIAR CODIGO PIX";
      }, 1800);
    } catch {
      setFeedback("Nao foi possivel copiar automaticamente. Selecione o codigo Pix manualmente.");
    }
  });

  const submitButton = qs("[data-submit-order]");
  submitButton?.addEventListener("click", () => {
    if (state.paymentMethod === "pix") {
      handlePixSubmit();
    }
  });
}

async function pollPaymentStatus(reference) {
  clearPixPolling();

  const check = async () => {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(reference)}`);
      if (!response.ok) {
        throw new Error("Falha ao consultar pedido.");
      }

      const data = await parseJsonResponse(response);
      if (data.access?.available && data.access?.url) {
        window.location.href = data.access.url;
        return;
      }

      if (data.root?.status === "rejected") {
        if (typeof window.trackEvent === "function") {
          window.trackEvent("PaymentRejected", {
            offer: state.offerKind,
            value: getCurrentTotal(),
            reference,
            status: "rejected"
          });
        }
        setFeedback("O pagamento nao foi aprovado. Se preferir, tente novamente com outra forma.", "error");
        return;
      }

      state.pixPollTimer = window.setTimeout(check, 4000);
    } catch {
      state.pixPollTimer = window.setTimeout(check, 6000);
    }
  };

  state.pixPollTimer = window.setTimeout(check, 4000);
}

function renderPixResult(payload) {
  const resultBox = qs("[data-pix-result]");
  const qrImage = qs("[data-pix-qr-image]");
  const codeField = qs("[data-pix-code]");
  const statusLink = qs("[data-pix-status-link]");
  const statusLabel = qs("[data-pix-status-label]");
  const pix = payload.pix || {};
  const reference = payload.rootReference || payload.reference;

  if (!pix.qrCode || !pix.qrCodeBase64) {
    window.location.href = payload.nextUrl;
    return;
  }

  if (qrImage) {
    qrImage.src = `data:image/png;base64,${pix.qrCodeBase64}`;
  }
  if (codeField) {
    codeField.value = pix.qrCode;
  }
  if (statusLink) {
    statusLink.href = payload.nextUrl;
  }
  if (statusLabel) {
    statusLabel.textContent = "Aguardando pagamento";
  }

  resultBox?.classList.remove("hidden");
  resultBox?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (typeof window.trackEvent === "function") {
    window.trackEvent("PixGenerated", {
      offer: state.offerKind,
      value: getCurrentTotal(),
      reference,
      method: "pix",
      status: "pending"
    });
  }

  setFeedback("Pix gerado com sucesso. Pague com o QR Code ou use o copia e cola abaixo.", "success");
  pollPaymentStatus(reference);
}

function mountMercadoPago() {
  if (!window.MercadoPago || !state.config.publicKey) {
    return;
  }

  const mp = new window.MercadoPago(state.config.publicKey, {
    locale: "pt-BR"
  });

  state.cardForm = mp.cardForm({
    amount: String(getCurrentTotal().toFixed(2)),
    iframe: true,
    form: {
      id: "mp-checkout-form",
      cardNumber: {
        id: "form-checkout__cardNumber",
        placeholder: "Numero do cartao"
      },
      expirationDate: {
        id: "form-checkout__expirationDate",
        placeholder: "MM/AA"
      },
      securityCode: {
        id: "form-checkout__securityCode",
        placeholder: "CVV"
      },
      cardholderName: {
        id: "cardholder-name",
        placeholder: "Nome como esta no cartao"
      },
      issuer: {
        id: "form-checkout__issuer"
      },
      installments: {
        id: "form-checkout__installments"
      },
      identificationType: {
        id: "form-checkout__identificationType"
      },
      identificationNumber: {
        id: "cpf",
        placeholder: "000.000.000-00"
      },
      cardholderEmail: {
        id: "email",
        placeholder: "voce@exemplo.com"
      }
    },
    callbacks: {
      onFormMounted: () => {},
      onSubmit: async (event) => {
        event.preventDefault();
        if (state.submitting) return;
        if (state.paymentMethod !== "card") return;

        clearFeedback();
        setLoading(true);

        try {
          let paymentData;

          if (state.paymentMethod === "card") {
            const cardFormData = state.cardForm.getCardFormData();
            if (!cardFormData.token || !cardFormData.paymentMethodId) {
              throw new Error("Preencha corretamente os dados do cartao.");
            }
            paymentData = paymentPayloadFromCard(cardFormData);
          } else {
            paymentData = paymentPayloadFromPix(collectCustomer());
          }

          const { payload, customer } = await sendPayment(paymentData);
          saveSession({
            rootReference: payload.rootReference,
            currentReference: payload.reference,
            accessToken: payload.accessToken,
            customer,
            paymentMethod: state.paymentMethod
          });
          await identifyCheckoutCustomer(customer, payload.rootReference || payload.reference);

          if (typeof window.trackEvent === "function") {
            window.trackEvent("PlaceAnOrder", {
              offer: state.offerKind,
              value: getCurrentTotal(),
              method: state.paymentMethod,
              section: "checkout-submit",
              cta_name: "PAGAR COM CARTAO"
            });
          }

          if (state.paymentMethod === "pix" && payload.paymentStatus !== "approved") {
            renderPixResult(payload);
            return;
          }

          if (typeof window.trackEvent === "function" && payload.paymentStatus === "approved") {
            window.trackEvent("Purchase", {
              offer: state.offerKind,
              value: getCurrentTotal(),
              reference: payload.reference,
              method: state.paymentMethod,
              status: "approved",
              root_reference: payload.rootReference || payload.reference
            });
            if (window.tiktokPixel) {
              window.tiktokPixel.markPurchase(payload.rootReference || payload.reference);
            }
          }

          window.location.href = payload.nextUrl;
        } catch (error) {
          setFeedback(error.message || "Falha ao processar o pagamento.");
        } finally {
          setLoading(false);
        }
      },
      onFetching: () => () => {}
    }
  });
}

async function init() {
  resolveOfferKind();
  applyMasks();
  prefillFields();
  bindSmartFields();
  bindPaymentMethodSwitch();

  try {
    await loadConfig();
  } catch (error) {
    setFeedback(error.message);
  }

  renderSummary();
  renderPaymentMethod();

  if (!state.config.paymentEnabled) {
    setFeedback(
      "Pagamento temporariamente indisponivel. Atualize a pagina em alguns instantes."
    );
    return;
  }

  mountMercadoPago();
}

init();
