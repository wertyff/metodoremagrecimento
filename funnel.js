const sessionKey = "mdg7d-session";
const upsellTimerKey = "mdg7d-upsell-deadline";

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

function readSession() {
  try {
    const raw = localStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSession(data) {
  const current = readSession();
  localStorage.setItem(sessionKey, JSON.stringify({ ...current, ...data }));
}

async function fetchOrder(reference) {
  const response = await fetch(`/api/orders/${encodeURIComponent(reference)}`);
  if (!response.ok) {
    throw new Error("Nao foi possivel carregar o pedido.");
  }
  return response.json();
}

function renderParentReference() {
  const params = getParams();
  const session = readSession();
  const reference = params.get("ref") || session.rootReference || "--";

  document.querySelectorAll("[data-parent-reference]").forEach((node) => {
    node.textContent = reference;
  });

  return reference;
}

function setupUpsell() {
  const accept = document.querySelector("[data-accept-upsell]");
  const decline = document.querySelector("[data-decline-upsell]");

  if (!accept && !decline) {
    return;
  }

  const reference = renderParentReference();

  accept?.addEventListener("click", () => {
    if (typeof window.trackEvent === "function") {
      window.trackEvent("AddToCart", {
        offer: "upsell",
        value: 27,
        cta_name: "QUERO ADICIONAR",
        cta_position: "upsell-primary"
      });
    }
    saveSession({ rootReference: reference });
    window.location.href = `checkout.html?offer=upsell&parent=${encodeURIComponent(reference)}`;
  });

  decline?.addEventListener("click", () => {
    if (typeof window.trackEvent === "function") {
      window.trackEvent("UpsellDeclined", {
        offer: "upsell",
        reference,
        cta_name: "NAO, PREFIRO SEGUIR",
        cta_position: "upsell-secondary"
      });
    }
    saveSession({ rootReference: reference });
    window.location.href = `downsell.html?ref=${encodeURIComponent(reference)}`;
  });

  const timerEls = {
    hours: document.querySelector("[data-upsell-hours]"),
    minutes: document.querySelector("[data-upsell-minutes]"),
    seconds: document.querySelector("[data-upsell-seconds]")
  };

  const now = Date.now();
  let deadline = Number.parseInt(localStorage.getItem(upsellTimerKey), 10);

  if (!Number.isFinite(deadline) || deadline <= now) {
    deadline = now + 10 * 60 * 1000;
    localStorage.setItem(upsellTimerKey, String(deadline));
  }

  const update = () => {
    const diff = Math.max(0, deadline - Date.now());
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);

    if (timerEls.hours) timerEls.hours.textContent = String(hours).padStart(2, "0");
    if (timerEls.minutes) {
      timerEls.minutes.textContent = String(minutes).padStart(2, "0");
    }
    if (timerEls.seconds) {
      timerEls.seconds.textContent = String(seconds).padStart(2, "0");
    }
  };

  update();
  window.setInterval(update, 1000);
}

function setupDownsell() {
  const accept = document.querySelector("[data-accept-downsell]");
  const skip = document.querySelector("[data-skip-downsell]");

  if (!accept && !skip) {
    return;
  }

  const reference = renderParentReference();

  accept?.addEventListener("click", () => {
    if (typeof window.trackEvent === "function") {
      window.trackEvent("AddToCart", {
        offer: "downsell",
        value: 14.9,
        cta_name: "QUERO ADICIONAR",
        cta_position: "downsell-primary"
      });
    }
    saveSession({ rootReference: reference });
    window.location.href = `checkout.html?offer=downsell&parent=${encodeURIComponent(reference)}`;
  });

  skip?.addEventListener("click", () => {
    if (typeof window.trackEvent === "function") {
      window.trackEvent("DownsellDeclined", {
        offer: "downsell",
        reference,
        cta_name: "NAO, QUERO O MEU ACESSO",
        cta_position: "downsell-secondary"
      });
    }
    saveSession({ rootReference: reference });
    window.location.href = `obrigado.html?ref=${encodeURIComponent(reference)}`;
  });
}

function renderOrderList(container, orders) {
  if (!container) {
    return;
  }

  const items = orders.flatMap((order) =>
    order.items.map(
      (item) => `
        <div class="summary-item">
          <span>${item.name}</span>
          <strong>${formatBRL(item.price)}</strong>
        </div>
      `
    )
  );

  container.innerHTML =
    items.join("") ||
    `
      <div class="summary-item">
        <span>Nenhum item aprovado ainda</span>
        <strong>--</strong>
      </div>
    `;
}

function statusCopy(status, paymentMethod) {
  if (status === "paid") {
    return {
      pill: "Pagamento aprovado",
      title: "Seu pagamento foi confirmado.",
      text: "Agora o acesso ja pode ser liberado automaticamente.",
      helperTitle: "Tudo certo com o seu pedido",
      helperText: "Em instantes voce sera redirecionado automaticamente para a area de acesso."
    };
  }

  if (status === "rejected") {
    return {
      pill: "Pagamento nao aprovado",
      title: "Nao conseguimos confirmar o pagamento.",
      text: "Voce pode voltar ao checkout e tentar novamente com outra forma de pagamento.",
      helperTitle: "Tente novamente sem perder o pedido",
      helperText:
        paymentMethod === "card"
          ? "Se preferir, refaca a compra com outro cartao ou use Pix para confirmar mais rapido."
          : "Se o Pix expirou ou foi interrompido, voce pode voltar ao checkout e gerar um novo codigo."
    };
  }

  return {
    pill: paymentMethod === "pix" ? "Pix aguardando pagamento" : "Pagamento em analise",
    title:
      paymentMethod === "pix"
        ? "Seu Pix foi gerado. Falta so concluir o pagamento."
        : "Estamos aguardando a confirmacao do pagamento.",
    text:
      paymentMethod === "pix"
        ? "Assim que o banco confirmar o Pix, o acesso sera liberado automaticamente nesta pagina."
        : "Esta pagina atualiza automaticamente. Se preferir, toque em atualizar status.",
    helperTitle:
      paymentMethod === "pix" ? "Pague o Pix e mantenha esta pagina aberta" : "Aguarde a confirmacao",
    helperText:
      paymentMethod === "pix"
        ? "Use o QR Code ou o copia e cola salvo abaixo. Depois do pagamento, a liberacao costuma acontecer sem precisar falar com suporte."
        : "Assim que o sistema confirmar o pagamento, o acesso sera liberado aqui automaticamente."
  };
}

function paymentMethodCopy(method, status) {
  if (method === "card") {
    return {
      label: "Cartao de credito",
      note:
        status === "rejected"
          ? "O banco nao aprovou a tentativa atual. Voce pode tentar novamente com outro cartao."
          : "A aprovacao pode ser imediata ou levar alguns minutos, dependendo da analise do emissor."
    };
  }

  return {
    label: "Pix",
    note:
      status === "paid"
        ? "Pix confirmado com sucesso. O acesso esta sendo liberado."
        : "Se voce ainda nao pagou, use o QR Code ou o codigo copia e cola salvo nesta pagina."
  };
}

function setStatusSteps(container, status) {
  if (!container) {
    return;
  }

  const steps = Array.from(container.querySelectorAll(".status-step"));
  steps.forEach((step) => step.classList.remove("is-active"));

  if (status === "paid") {
    steps.forEach((step) => step.classList.add("is-active"));
    return;
  }

  if (status === "rejected") {
    steps.slice(0, 2).forEach((step) => step.classList.add("is-active"));
    return;
  }

  steps.slice(0, 2).forEach((step) => step.classList.add("is-active"));
}

function togglePendingPixBox(elements, session, status, paymentMethod) {
  if (!elements.box) {
    return;
  }

  const lastPix = session.lastPix || {};
  const shouldShow =
    paymentMethod === "pix" &&
    status !== "paid" &&
    status !== "rejected" &&
    Boolean(lastPix.qrCode);

  elements.box.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    return;
  }

  if (elements.qr) {
    if (lastPix.qrCodeBase64) {
      elements.qr.src = `data:image/png;base64,${lastPix.qrCodeBase64}`;
    } else {
      elements.qr.removeAttribute("src");
    }
  }

  if (elements.code) {
    elements.code.value = lastPix.qrCode || "";
  }

  if (elements.ticket) {
    const hasTicket = Boolean(lastPix.ticketUrl);
    elements.ticket.classList.toggle("hidden", !hasTicket);
    elements.ticket.href = hasTicket ? lastPix.ticketUrl : "#";
  }
}

async function setupThankYou() {
  const list = document.querySelector("[data-order-items]");
  const total = document.querySelector("[data-final-total]");

  if (!list || !total) {
    return;
  }

  const params = getParams();
  const session = readSession();
  const reference = params.get("ref") || session.rootReference || session.currentReference;
  const statusPill = document.querySelector("[data-status-pill]");
  const statusTitle = document.querySelector("[data-status-title]");
  const statusText = document.querySelector("[data-status-text]");
  const orderReference = document.querySelector("[data-order-reference]");
  const accessButton = document.querySelector("[data-access-button]");
  const refreshButton = document.querySelector("[data-refresh-order]");
  const copyReferenceButton = document.querySelector("[data-copy-reference]");
  const autoRefreshTimer = document.querySelector("[data-auto-refresh-timer]");
  const paymentMethodLabel = document.querySelector("[data-payment-method-label]");
  const paymentMethodNote = document.querySelector("[data-payment-method-note]");
  const helperTitle = document.querySelector("[data-helper-title]");
  const helperText = document.querySelector("[data-helper-text]");
  const statusSteps = document.querySelector("[data-status-steps]");
  const pixElements = {
    box: document.querySelector("[data-thankyou-pix-box]"),
    qr: document.querySelector("[data-thankyou-pix-qr]"),
    code: document.querySelector("[data-thankyou-pix-code]"),
    copy: document.querySelector("[data-copy-thankyou-pix]"),
    ticket: document.querySelector("[data-thankyou-pix-ticket]")
  };
  let accessRedirectScheduled = false;
  let refreshTimeout = null;
  let countdownTimeout = null;

  if (!reference) {
    if (statusTitle) statusTitle.textContent = "Pedido nao encontrado.";
    if (statusText) {
      statusText.textContent = "Volte ao checkout para concluir a compra.";
    }
    return;
  }

  const scheduleCountdown = (seconds) => {
    window.clearTimeout(countdownTimeout);

    if (!autoRefreshTimer) {
      return;
    }

    const tick = (remaining) => {
      autoRefreshTimer.textContent =
        remaining > 0 ? `Nova consulta em ${remaining}s` : "Atualizando status...";

      if (remaining > 0) {
        countdownTimeout = window.setTimeout(() => tick(remaining - 1), 1000);
      }
    };

    tick(seconds);
  };

  const scheduleRefresh = (delayMs) => {
    window.clearTimeout(refreshTimeout);
    scheduleCountdown(Math.ceil(delayMs / 1000));
    refreshTimeout = window.setTimeout(refresh, delayMs);
  };

  copyReferenceButton?.addEventListener("click", async () => {
    const currentReference = orderReference?.textContent || reference;
    if (!currentReference) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentReference);
      copyReferenceButton.textContent = "COPIADO";
      window.setTimeout(() => {
        copyReferenceButton.textContent = "COPIAR";
      }, 1800);
    } catch {
      copyReferenceButton.textContent = "COPIE MANUALMENTE";
      window.setTimeout(() => {
        copyReferenceButton.textContent = "COPIAR";
      }, 2200);
    }
  });

  pixElements.copy?.addEventListener("click", async () => {
    const code = pixElements.code?.value || "";
    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      pixElements.copy.textContent = "PIX COPIADO";
      if (typeof window.trackEvent === "function") {
        window.trackEvent("CopyPixCode", {
          offer: "main",
          reference,
          label: "thankyou-copy-pix"
        });
      }
      window.setTimeout(() => {
        pixElements.copy.textContent = "COPIAR PIX";
      }, 1800);
    } catch {
      pixElements.copy.textContent = "COPIE MANUALMENTE";
      window.setTimeout(() => {
        pixElements.copy.textContent = "COPIAR PIX";
      }, 2200);
    }
  });

  const render = async () => {
    const data = await fetchOrder(reference);
    const paymentMethod = data.root.selectedPaymentMethod || session.paymentMethod || "pix";
    const copy = statusCopy(data.root.status, paymentMethod);
    const methodCopy = paymentMethodCopy(paymentMethod, data.root.status);

    if (statusPill) statusPill.textContent = copy.pill;
    if (statusTitle) statusTitle.textContent = copy.title;
    if (statusText) statusText.textContent = copy.text;
    if (orderReference) orderReference.textContent = data.root.reference;
    if (paymentMethodLabel) paymentMethodLabel.textContent = methodCopy.label;
    if (paymentMethodNote) paymentMethodNote.textContent = methodCopy.note;
    if (helperTitle) helperTitle.textContent = copy.helperTitle;
    if (helperText) helperText.textContent = copy.helperText;

    renderOrderList(list, [data.root, ...data.extras].filter(Boolean));
    total.textContent = formatBRL(data.approvedTotal || 0);
    setStatusSteps(statusSteps, data.root.status);

    saveSession({
      rootReference: data.root.reference,
      currentReference: data.root.reference,
      paymentMethod,
      paymentStatus: data.root.paymentStatus || data.root.status
    });

    togglePendingPixBox(pixElements, readSession(), data.root.status, paymentMethod);

    if (accessButton) {
      accessButton.classList.toggle("hidden", !data.access.available);
      if (data.access.available) {
        accessButton.setAttribute("href", data.access.url);
        if (
          typeof window.trackEvent === "function" &&
          window.tiktokPixel &&
          !window.tiktokPixel.hasTrackedPurchase(data.root.reference)
        ) {
          window.trackEvent("Purchase", {
            offer: data.root.kind || "main",
            value: Number(data.approvedTotal || 0),
            reference: data.root.reference,
            status: "approved",
            root_reference: data.root.reference,
            contents: (data.approvedItems || []).map((item) => ({
              content_id: item.code,
              content_type: item.type === "physical" ? "product_group" : "product",
              content_name: item.name
            }))
          });
          window.tiktokPixel.markPurchase(data.root.reference);
        }
        if (!accessRedirectScheduled) {
          accessRedirectScheduled = true;
          if (autoRefreshTimer) {
            autoRefreshTimer.textContent = "Acesso sendo liberado...";
          }
          window.setTimeout(() => {
            window.location.href = data.access.url;
          }, 2200);
        }
      }
    }

    return data;
  };

  const refresh = async () => {
    try {
      const data = await render();
      if (data.root.status !== "paid" && data.root.status !== "rejected") {
        scheduleRefresh(5000);
      } else if (autoRefreshTimer) {
        autoRefreshTimer.textContent =
          data.root.status === "paid"
            ? "Pagamento confirmado"
            : "Pagamento nao aprovado";
      }
    } catch (_error) {
      if (autoRefreshTimer) {
        autoRefreshTimer.textContent = "Tentando novamente...";
      }
      scheduleRefresh(7000);
    }
  };

  refreshButton?.addEventListener("click", () => {
    window.clearTimeout(refreshTimeout);
    window.clearTimeout(countdownTimeout);

    if (typeof window.trackEvent === "function") {
      window.trackEvent("RefreshOrderStatus", {
        offer: "main",
        reference,
        section: "thankyou-status"
      });
    }
    refresh();
  });

  refresh();
}

async function setupAccess() {
  const nameEl = document.querySelector("[data-access-name]");
  const refEl = document.querySelector("[data-access-reference]");
  const itemsEl = document.querySelector("[data-access-items]");
  const contentEl = document.querySelector("[data-access-content]");
  const physicalBox = document.querySelector("[data-physical-box]");
  const shippingEl = document.querySelector("[data-shipping-items]");

  if (!nameEl || !refEl || !itemsEl || !contentEl || !physicalBox || !shippingEl) {
    return;
  }

  try {
    const response = await fetch("/api/access/session");
    if (!response.ok) {
      window.location.href = "checkout.html";
      return;
    }

    const data = await response.json();
    if (typeof window.tiktokIdentify === "function") {
      window.tiktokIdentify({
        email: data.email,
        external_id: data.reference
      }).catch(() => {});
    }

    nameEl.textContent = data.customerName || "Cliente";
    refEl.textContent = data.reference || "--";

    itemsEl.innerHTML = data.items
      .map(
        (item) => `
          <div class="summary-item">
            <span>${item.name}</span>
            <strong>${item.type === "physical" ? "Enviado" : "Liberado"}</strong>
          </div>
        `
      )
      .join("");

    contentEl.innerHTML =
      data.digitalContent
        .map(
          (content) => `
            <article class="delivery-card">
              <div class="delivery-head">
                <strong>${content.title}</strong>
                <span>Liberado</span>
              </div>
              <p>${content.summary}</p>
              <div class="delivery-modules">
                ${content.modules
                  .map(
                    (module) => `
                      <div class="delivery-module">
                        <strong>${module.title}</strong>
                        <p>${module.description}</p>
                        ${
                          module.fileUrl
                            ? `<a class="download-link" href="${module.fileUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(module.fileLabel || "Abrir material")}</a>`
                            : ""
                        }
                        <ul class="delivery-points">
                          ${module.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}
                        </ul>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </article>
          `
        )
        .join("") ||
      `
        <div class="summary-item">
          <span>Nenhum modulo liberado ainda</span>
          <strong>--</strong>
        </div>
      `;

    const hasPhysicalItems = Array.isArray(data.physicalShipments) && data.physicalShipments.length > 0;
    physicalBox.classList.toggle("hidden", !hasPhysicalItems);
    shippingEl.innerHTML = hasPhysicalItems
      ? data.physicalShipments
          .map(
            (shipment) => `
              <article class="shipping-card">
                <div class="delivery-head">
                  <strong>${shipment.name}</strong>
                  <span>Endereco confirmado</span>
                </div>
                <p>${shipment.summary}</p>
                <div class="shipping-address">
                  <strong>${shipment.address.name}</strong>
                  <span>${shipment.address.address}, ${shipment.address.number}</span>
                  <span>${shipment.address.neighborhood} - ${shipment.address.city}/${shipment.address.state}</span>
                  <span>CEP ${shipment.address.cep}</span>
                  ${
                    shipment.address.complement
                      ? `<span>Complemento: ${shipment.address.complement}</span>`
                      : ""
                  }
                </div>
                <ul class="delivery-points">
                  ${shipment.nextSteps.map((step) => `<li>${step}</li>`).join("")}
                </ul>
              </article>
            `
          )
          .join("")
      : "";

    const supportLink = document.querySelector("[data-support-link]");
    if (supportLink) {
      if (data.supportWhatsApp) {
        supportLink.href = `https://wa.me/${data.supportWhatsApp}`;
        supportLink.classList.remove("hidden");
      } else {
        if (data.supportEmail) {
          supportLink.href = `mailto:${data.supportEmail}`;
          supportLink.classList.remove("hidden");
        } else {
          supportLink.classList.add("hidden");
        }
      }
    }

    if (typeof window.trackEvent === "function") {
      const alreadyTracked =
        window.tiktokPixel &&
        window.tiktokPixel.hasTrackedEvent("complete-registration", data.reference);

      if (!alreadyTracked) {
        window.trackEvent("CompleteRegistration", {
          offer: "main",
          value: Number(
            (data.items || []).reduce((sum, item) => sum + Number(item.price || 0), 0)
          ),
          reference: data.reference,
          root_reference: data.reference,
          status: "access-released",
          contents: (data.items || []).map((item) => ({
            content_id: item.code,
            content_type: item.type === "physical" ? "product_group" : "product",
            content_name: item.name
          }))
        });
        if (window.tiktokPixel) {
          window.tiktokPixel.markEvent("complete-registration", data.reference);
        }
      }
    }

    contentEl.addEventListener("click", (event) => {
      const link = event.target.closest(".download-link");
      if (!link || typeof window.trackEvent !== "function") {
        return;
      }

      window.trackEvent("DownloadContent", {
        offer: "main",
        reference: data.reference,
        root_reference: data.reference,
        label: link.textContent.trim(),
        asset_url: link.getAttribute("href") || ""
      });
    });
  } catch (_error) {
    window.location.href = "checkout.html";
  }
}

setupUpsell();
setupDownsell();
setupThankYou();
setupAccess();
