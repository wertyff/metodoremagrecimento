const storageKey = "msr14d-offer-end";

const checkoutLinks = document.querySelectorAll("[data-checkout-link]");
const stickyCta = document.getElementById("stickyCta");
const faqItems = document.querySelectorAll(".faq-item");

const hoursEl = document.getElementById("hours");
const minutesEl = document.getElementById("minutes");
const secondsEl = document.getElementById("seconds");

function applyCheckoutLinks() {
  const checkoutUrl = window.LP_CONFIG.checkoutUrl || "checkout.html";
  checkoutLinks.forEach((link) => {
    link.setAttribute("href", checkoutUrl);
  });
}

function getCountdownDeadline() {
  const now = Date.now();
  const stored = Number.parseInt(localStorage.getItem(storageKey), 10);

  if (Number.isFinite(stored) && stored > now) {
    return stored;
  }

  const fresh = now + (89 * 60 + 59) * 1000;
  localStorage.setItem(storageKey, String(fresh));
  return fresh;
}

function updateCountdown() {
  const deadline = getCountdownDeadline();
  const now = Date.now();
  let diff = Math.max(0, deadline - now);

  if (diff === 0) {
    localStorage.removeItem(storageKey);
    diff = getCountdownDeadline() - now;
  }

  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  if (hoursEl) hoursEl.textContent = String(hours).padStart(2, "0");
  if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, "0");
  if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, "0");
}

function handleStickyCta() {
  if (!stickyCta) return;

  const toggleSticky = () => {
    stickyCta.classList.toggle("visible", window.scrollY > 540);
  };

  toggleSticky();
  window.addEventListener("scroll", toggleSticky, { passive: true });
}

function bindFaq() {
  faqItems.forEach((item) => {
    const button = item.querySelector(".faq-question");
    if (!button) return;

    button.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      faqItems.forEach((faqItem) => faqItem.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });
}

function bindTracking() {
  window.trackEvent("ViewContent", { page: "metodo-seca-rapido-14d" });

  checkoutLinks.forEach((button) => {
    button.addEventListener("click", () => {
      window.trackEvent("InitiateCheckout", {
        source: "cta_button"
      });
    });
  });
}

applyCheckoutLinks();
updateCountdown();
handleStickyCta();
bindFaq();
bindTracking();

window.setInterval(updateCountdown, 1000);
