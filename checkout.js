const checkoutSessionKey = "msr14d-session";

const fallbackCatalog = {
  main: {
    name: "Metodo Seca Rapido 14D",
    description: "Metodo digital com passo a passo de 14 dias.",
    price: 19.9,
    oldPrice: 97,
    type: "digital"
  },
  bump: {
    name: "Capsulas Termogenicas",
    description: "Complemento fisico opcional para a rotina.",
    price: 19.9,
    oldPrice: 39.9,
    type: "physical"
  },
  upsell: {
    name: "Acelerador Seca Rapido 30D",
    description: "Plano complementar de continuidade por 30 dias.",
    price: 27,
    oldPrice: 67,
    type: "digital"
  },
  downsell: {
    name: "Versao Essencial 21D",
    description: "Versao mais curta e acessivel para continuidade.",
    price: 14.9,
    oldPrice: 37,
    type: "digital"
  }
};

const offerCopy = {
  main: {
    eyebrow: "Checkout principal",
    title: "Voce esta a um passo de liberar o seu acesso.",
    lead: "Preencha seus dados e finalize sem sair do site.",
    priceNote: "pagamento unico",
    items: [
      "Metodo Seca Rapido 14D completo",
      "Checklist diario de acompanhamento",
      "Guia de continuidade apos os 14 dias",
      "Garantia de 7 dias"
    ]
  },
  upsell: {
    eyebrow: "Oferta adicional",
    title: "Finalize a sua oferta de continuidade de 30 dias.",
    lead: "Esta oferta entra como complemento do pedido principal.",
    priceNote: "pagamento unico",
    items: [
      "Plano complementar por 30 dias",
      "Rotina simples para manter o foco",
      "Checklist semanal de continuidade"
    ]
  },
  downsell: {
    eyebrow: "Ultima oferta",
    title: "Finalize a versao essencial de continuidade.",
    lead: "Uma opcao mais leve para seguir com um valor menor.",
    priceNote: "pagamento unico",
    items: [
      "Plano reduzido de 21 dias",
      "Roteiro semanal simples",
      "Guia enxuto para manter a rotina"
    ]
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
  bumpSelected: false,
  cardForm: null,
  submitting: false
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

async function loadConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Nao foi possivel carregar a configuracao do checkout.");
  }
  state.config = await response.json();
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
  const base = Number(product.price || 0);
  const bump =
    state.offerKind === "main" && state.bumpSelected
      ? Number(state.config.catalog?.bump?.price || fallbackCatalog.bump.price)
      : 0;
  return base + bump;
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

function setLoading(loading) {
  state.submitting = loading;
  const button = qs("[data-submit-order]");
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "PROCESSANDO..." : "PAGAR AGORA";
}

function applyMasks() {
  const cpf = qs("#cpf");
  const cep = qs("#shipping-cep");

  const formatCpf = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatCep = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    return digits.replace(/(\d{5})(\d)/, "$1-$2");
  };

  cpf?.addEventListener("input", () => {
    cpf.value = formatCpf(cpf.value);
  });

  cep?.addEventListener("input", () => {
    cep.value = formatCep(cep.value);
  });
}

function renderSummary() {
  const product = getOfferProduct();
  const copy = offerCopy[state.offerKind];
  const bumpProduct = state.config.catalog?.bump || fallbackCatalog.bump;

  const itemsContainer = qs("[data-offer-items]");
  const parentBox = qs("[data-offer-parent-box]");
  const bumpBox = qs("[data-bump-box]");
  const bumpLineRow = qs("[data-bump-line-row]");

  qs("[data-offer-eyebrow]").textContent = copy.eyebrow;
  qs("[data-offer-title]").textContent = copy.title;
  qs("[data-offer-lead]").textContent = copy.lead;
  qs("[data-offer-old-price]").textContent = `De ${formatBRL(product.oldPrice)}`;
  qs("[data-offer-price]").textContent = formatBRL(product.price);
  qs("[data-offer-price-note]").textContent = copy.priceNote;
  qs("[data-offer-description]").textContent = product.description;
  qs("[data-order-line-title]").textContent = product.name;
  qs("[data-order-line-price]").textContent = formatBRL(product.price);

  itemsContainer.innerHTML = copy.items
    .map(
      (item) => `
        <div class="summary-item">
          <span>${item}</span>
          <strong>Incluido</strong>
        </div>
      `
    )
    .join("");

  if (state.offerKind === "main") {
    bumpBox?.classList.remove("hidden");
    bumpLineRow?.classList.remove("hidden");
    parentBox?.classList.add("hidden");
  } else {
    bumpBox?.classList.add("hidden");
    bumpLineRow?.classList.add("hidden");
    parentBox?.classList.toggle("hidden", !state.parentReference);
    const refNode = qs("[data-parent-reference]");
    if (refNode) refNode.textContent = state.parentReference || "--";
  }

  qs("[data-bump-line]").textContent = state.bumpSelected
    ? formatBRL(bumpProduct.price)
    : "R$ 0,00";
  qs("[data-order-total]").textContent = formatBRL(getCurrentTotal());
}

function syncShippingVisibility() {
  const shippingBox = qs("[data-bump-shipping]");
  const shippingFields = qsa("[data-bump-shipping] input");
  const active = state.offerKind === "main" && state.bumpSelected;
  shippingBox?.classList.toggle("hidden", !active);

  shippingFields.forEach((field) => {
    if (active) {
      field.setAttribute("required", "required");
    } else {
      field.removeAttribute("required");
    }
  });
}

function prefillFields() {
  const session = readSession();
  const customer = session.customer || {};
  const shipping = session.shipping || {};

  const fields = {
    name: customer.name || "",
    email: customer.email || "",
    cpf: customer.cpf || "",
    "cardholder-name": customer.name || "",
    "shipping-name": shipping.name || customer.name || "",
    "shipping-cep": shipping.cep || "",
    "shipping-address": shipping.address || "",
    "shipping-number": shipping.number || "",
    "shipping-complement": shipping.complement || "",
    "shipping-neighborhood": shipping.neighborhood || "",
    "shipping-city": shipping.city || "",
    "shipping-state": shipping.state || ""
  };

  Object.entries(fields).forEach(([id, value]) => {
    const field = qs(`#${id}`);
    if (field && !field.value) {
      field.value = value;
    }
  });
}

function bindBump() {
  const bumpToggle = qs("[data-bump-toggle]");
  if (!bumpToggle) return;

  const session = readSession();
  const initialState = state.offerKind === "main" && Boolean(session.bumpSelected);
  bumpToggle.checked = initialState;
  state.bumpSelected = initialState;

  bumpToggle.addEventListener("change", () => {
    state.bumpSelected = bumpToggle.checked;
    saveSession({ bumpSelected: state.bumpSelected });
    renderSummary();
    syncShippingVisibility();
  });
}

function collectCustomer() {
  return {
    name: qs("#name")?.value.trim() || "",
    email: qs("#email")?.value.trim() || "",
    cpf: qs("#cpf")?.value.trim() || ""
  };
}

function collectShipping() {
  return {
    name: qs("#shipping-name")?.value.trim() || "",
    cep: qs("#shipping-cep")?.value.trim() || "",
    address: qs("#shipping-address")?.value.trim() || "",
    number: qs("#shipping-number")?.value.trim() || "",
    complement: qs("#shipping-complement")?.value.trim() || "",
    neighborhood: qs("#shipping-neighborhood")?.value.trim() || "",
    city: qs("#shipping-city")?.value.trim() || "",
    state: qs("#shipping-state")?.value.trim().toUpperCase() || ""
  };
}

function validateBeforeSubmit(customer, shipping) {
  if (!customer.name || !customer.email || !customer.cpf) {
    return "Preencha nome, e-mail e CPF para continuar.";
  }

  const cardholder = qs("#cardholder-name")?.value.trim() || "";
  if (!cardholder) {
    return "Informe o nome como esta no cartao.";
  }

  if (state.offerKind === "main" && state.bumpSelected) {
    const required = [
      shipping.name,
      shipping.cep,
      shipping.address,
      shipping.number,
      shipping.neighborhood,
      shipping.city,
      shipping.state
    ];

    if (required.some((field) => !field)) {
      return "Preencha os dados de entrega para receber as capsulas.";
    }
  }

  if (!state.parentReference && state.offerKind !== "main") {
    return "Nao foi possivel localizar o pedido principal desta oferta.";
  }

  return "";
}

async function sendPayment(cardFormData) {
  const customer = collectCustomer();
  const shipping = collectShipping();
  const error = validateBeforeSubmit(customer, shipping);

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
      bumpSelected: state.bumpSelected,
      customer,
      shipping,
      payment: {
        token: cardFormData.token,
        issuerId: cardFormData.issuerId,
        paymentMethodId: cardFormData.paymentMethodId,
        installments: cardFormData.installments,
        identificationType: cardFormData.identificationType,
        identificationNumber: cardFormData.identificationNumber,
        cardholderName: qs("#cardholder-name")?.value.trim() || ""
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel processar o pagamento.");
  }
  return { payload, customer, shipping };
}

function mountMercadoPago() {
  if (!window.MercadoPago || !state.config.publicKey) {
    setFeedback("Configure a PUBLIC_KEY do Mercado Pago para ativar o checkout.");
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
      onFormMounted: (error) => {
        if (error) {
          setFeedback("Nao foi possivel carregar os campos seguros do cartao.");
        }
      },
      onSubmit: async (event) => {
        event.preventDefault();
        if (state.submitting) return;

        clearFeedback();
        setLoading(true);

        try {
          const cardFormData = state.cardForm.getCardFormData();
          if (!cardFormData.token || !cardFormData.paymentMethodId) {
            throw new Error("Preencha corretamente os dados do cartao.");
          }

          const { payload, customer, shipping } = await sendPayment(cardFormData);
          saveSession({
            rootReference: payload.rootReference,
            currentReference: payload.reference,
            accessToken: payload.accessToken,
            bumpSelected: state.bumpSelected,
            customer,
            shipping
          });

          if (typeof window.trackEvent === "function") {
            window.trackEvent("PurchaseAttempt", {
              offer: state.offerKind,
              value: getCurrentTotal()
            });

            if (payload.paymentStatus === "approved") {
              window.trackEvent("PurchaseApproved", {
                offer: state.offerKind,
                value: getCurrentTotal(),
                reference: payload.reference
              });
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

  try {
    await loadConfig();
  } catch (error) {
    setFeedback(error.message);
  }

  renderSummary();
  bindBump();
  syncShippingVisibility();

  if (!state.config.paymentEnabled) {
    setFeedback(
      "Adicione a PUBLIC_KEY e o ACCESS_TOKEN no arquivo .env para ativar o pagamento."
    );
    return;
  }

  mountMercadoPago();
}

init();
