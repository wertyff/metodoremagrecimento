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
    saveSession({ rootReference: reference });
    window.location.href = `checkout.html?offer=upsell&parent=${encodeURIComponent(reference)}`;
  });

  decline?.addEventListener("click", () => {
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
    saveSession({ rootReference: reference });
    window.location.href = `checkout.html?offer=downsell&parent=${encodeURIComponent(reference)}`;
  });

  skip?.addEventListener("click", () => {
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

function statusCopy(status) {
  if (status === "paid") {
    return {
      pill: "Pagamento aprovado",
      title: "Seu pagamento foi confirmado.",
      text: "Agora o acesso ja pode ser liberado automaticamente."
    };
  }

  if (status === "rejected") {
    return {
      pill: "Pagamento nao aprovado",
      title: "Nao conseguimos confirmar o pagamento.",
      text: "Voce pode voltar ao checkout e tentar novamente com outro cartao."
    };
  }

  return {
    pill: "Pagamento em analise",
    title: "Estamos aguardando a confirmacao do pagamento.",
    text: "Esta pagina atualiza automaticamente. Se preferir, toque em atualizar status."
  };
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
  let accessRedirectScheduled = false;

  if (!reference) {
    if (statusTitle) statusTitle.textContent = "Pedido nao encontrado.";
    if (statusText) {
      statusText.textContent = "Volte ao checkout para concluir a compra.";
    }
    return;
  }

  const render = async () => {
    const data = await fetchOrder(reference);
    const copy = statusCopy(data.root.status);

    if (statusPill) statusPill.textContent = copy.pill;
    if (statusTitle) statusTitle.textContent = copy.title;
    if (statusText) statusText.textContent = copy.text;
    if (orderReference) orderReference.textContent = data.root.reference;

    renderOrderList(list, [data.root, ...data.extras].filter(Boolean));
    total.textContent = formatBRL(data.approvedTotal || 0);

    if (accessButton) {
      accessButton.classList.toggle("hidden", !data.access.available);
      if (data.access.available) {
        accessButton.setAttribute("href", data.access.url);
        if (!accessRedirectScheduled) {
          accessRedirectScheduled = true;
          window.setTimeout(() => {
            window.location.href = data.access.url;
          }, 2200);
        }
      }
    }

    saveSession({
      rootReference: data.root.reference
    });

    return data;
  };

  const refresh = async () => {
    try {
      const data = await render();
      if (data.root.status !== "paid" && data.root.status !== "rejected") {
        window.setTimeout(refresh, 5000);
      }
    } catch (_error) {
      window.setTimeout(refresh, 7000);
    }
  };

  refreshButton?.addEventListener("click", () => {
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
  } catch (_error) {
    window.location.href = "checkout.html";
  }
}

setupUpsell();
setupDownsell();
setupThankYou();
setupAccess();
