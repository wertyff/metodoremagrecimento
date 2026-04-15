const checkoutLinks = document.querySelectorAll("[data-checkout-link]");
const stickyCta = document.getElementById("stickyCta");
const faqItems = document.querySelectorAll(".faq-item");
const playButton = document.getElementById("playBtn");
const vslThumb = document.getElementById("vslThumb");
const vslFrame = document.getElementById("vslFrame");

function applyCheckoutLinks() {
  const checkoutUrl = window.LP_CONFIG?.checkoutUrl || "checkout.html";
  checkoutLinks.forEach((link) => {
    link.setAttribute("href", checkoutUrl);
  });
}

function bindTracking() {
  if (typeof window.trackEvent === "function") {
    window.trackEvent("ViewContent", {
      page: "metodo-derreter-gordura-vsl",
      offer: "main",
      value: 19.9
    });
  }

  checkoutLinks.forEach((button) => {
    button.addEventListener("click", () => {
      if (typeof window.trackEvent === "function") {
        window.trackEvent("AddToCart", {
          source: "landing_vsl",
          offer: "main",
          value: 19.9,
          cta_name: button.textContent.trim(),
          cta_position:
            button.closest(".sticky-cta")
              ? "sticky"
              : button.closest(".final-cta")
                ? "final"
                : button.closest(".offer-section")
                  ? "offer"
                  : "hero"
        });
      }
    });
  });
}

function bindFaq() {
  faqItems.forEach((item) => {
    const button = item.querySelector(".faq-q");
    if (!button) return;

    button.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      faqItems.forEach((faqItem) => faqItem.classList.remove("open"));
      if (!isOpen) {
        item.classList.add("open");
        if (typeof window.trackEvent === "function") {
          window.trackEvent("FAQOpen", {
            offer: "main",
            question: button.textContent.trim(),
            section: "faq"
          });
        }
      }
    });
  });
}

function handleStickyCta() {
  if (!stickyCta) return;
  let stickyTracked = false;

  const toggleSticky = () => {
    stickyCta.classList.toggle("visible", window.scrollY > 680);
    if (!stickyTracked && window.scrollY > 680 && typeof window.trackEvent === "function") {
      stickyTracked = true;
      window.trackEvent("StickyCTAVisible", {
        offer: "main",
        value: 19.9,
        section: "sticky"
      });
    }
  };

  toggleSticky();
  window.addEventListener("scroll", toggleSticky, { passive: true });
}

function setupReveal() {
  const revealItems = document.querySelectorAll(".fade-in");
  if (!revealItems.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function setupVsl() {
  if (!playButton || !vslThumb || !vslFrame) return;

  playButton.addEventListener("click", () => {
    const embedUrl = String(window.LP_CONFIG?.vslEmbedUrl || "").trim();

    if (embedUrl) {
      vslFrame.src = embedUrl;
      vslFrame.classList.remove("hidden");
      vslThumb.classList.add("hidden");
    } else {
      vslThumb.innerHTML = `
        <div class="vsl-side before" style="grid-column: 1 / -1; background: linear-gradient(160deg, #31101c, #571e36);">
          <span class="vsl-side-label">Video</span>
          <strong>Adicione o link da VSL em \`window.LP_CONFIG.vslEmbedUrl\`</strong>
        </div>
      `;
    }

    if (typeof window.trackEvent === "function") {
      window.trackEvent("PlayVSL", {
        page: "metodo-derreter-gordura-vsl",
        offer: "main",
        value: 19.9,
        section: "hero-vsl"
      });
    }
  });
}

function setupDepthTracking() {
  let depthTracked = false;

  const handleScroll = () => {
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;

    const progress = window.scrollY / maxScroll;
    if (!depthTracked && progress >= 0.75 && typeof window.trackEvent === "function") {
      depthTracked = true;
      window.trackEvent("ScrollDepth75", {
        offer: "main",
        value: 19.9,
        scroll_percent: 75
      });
      window.removeEventListener("scroll", handleScroll);
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();
}

applyCheckoutLinks();
bindTracking();
bindFaq();
handleStickyCta();
setupReveal();
setupVsl();
setupDepthTracking();
