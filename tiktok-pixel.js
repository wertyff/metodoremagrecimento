(function () {
  const PIXEL_ID = "D7G18H3C77U7II46KN6G";
  const CURRENCY = "BRL";
  const sessionKey = "mdg7d-session";
  const trackingStorageKey = "mdg7d-tracking-context";

  const catalog = {
    main: {
      content_id: "main_derreter_gordura",
      content_type: "product",
      content_name: "Metodo Derreter Gordura",
      value: 19.9
    },
    upsell: {
      content_id: "upsell_barriga_zero_30d",
      content_type: "product",
      content_name: "Protocolo Barriga Zero 30D",
      value: 27
    },
    downsell: {
      content_id: "downsell_cardapio_21d",
      content_type: "product",
      content_name: "Cardapio Inteligente 21D",
      value: 14.9
    }
  };

  function loadPixel() {
    if (window.ttq && window.ttq._t && window.ttq._t[PIXEL_ID]) {
      return;
    }

    const ttq = (window.ttq = window.ttq || []);
    ttq.methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
      "holdConsent",
      "revokeConsent",
      "grantConsent"
    ];

    ttq.setAndDefer = function (target, method) {
      target[method] = function () {
        target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };

    for (let i = 0; i < ttq.methods.length; i += 1) {
      ttq.setAndDefer(ttq, ttq.methods[i]);
    }

    ttq.instance = function (id) {
      const instance = ttq._i[id] || [];
      for (let i = 0; i < ttq.methods.length; i += 1) {
        ttq.setAndDefer(instance, ttq.methods[i]);
      }
      return instance;
    };

    ttq.load = function (id, options) {
      const sdkUrl = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = sdkUrl;
      ttq._t = ttq._t || {};
      ttq._t[id] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[id] = options || {};

      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = `${sdkUrl}?sdkid=${id}&lib=ttq`;

      const firstScript = document.getElementsByTagName("script")[0];
      firstScript.parentNode.insertBefore(script, firstScript);
    };

    ttq.load(PIXEL_ID);
    ttq.page();
  }

  function readSession() {
    try {
      const raw = window.localStorage.getItem(sessionKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function readTrackingStore() {
    try {
      const raw = window.localStorage.getItem(trackingStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeTrackingStore(data) {
    window.localStorage.setItem(trackingStorageKey, JSON.stringify(data));
  }

  function getPageType() {
    const path = window.location.pathname.toLowerCase();
    if (path.endsWith("/checkout.html")) return "checkout";
    if (path.endsWith("/upsell.html")) return "upsell";
    if (path.endsWith("/downsell.html")) return "downsell";
    if (path.endsWith("/obrigado.html")) return "thankyou";
    if (path.endsWith("/acesso.html")) return "access";
    return "landing";
  }

  function getLandingPage() {
    return `${window.location.pathname}${window.location.search}`;
  }

  function extractTrackingParams() {
    const params = new URLSearchParams(window.location.search);
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "ttclid",
      "fbclid",
      "gclid",
      "campaign_id",
      "adset_id",
      "ad_id"
    ];

    return keys.reduce((acc, key) => {
      const value = params.get(key);
      if (value) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }

  function persistTrackingContext() {
    const current = extractTrackingParams();
    const existing = readTrackingStore();
    const now = new Date().toISOString();

    const hasNewParams = Object.keys(current).length > 0;
    const firstTouch =
      existing.firstTouch ||
      (hasNewParams
        ? {
            ...current,
            landing_page: getLandingPage(),
            captured_at: now
          }
        : {});

    const lastTouch = hasNewParams
      ? {
          ...current,
          landing_page: getLandingPage(),
          captured_at: now
        }
      : existing.lastTouch || {};

    const payload = {
      firstTouch,
      lastTouch,
      latest_referrer: document.referrer || existing.latest_referrer || "",
      latest_page: getLandingPage(),
      updated_at: now
    };

    writeTrackingStore(payload);
    return payload;
  }

  function getOfferKind() {
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);

    if (path.endsWith("/checkout.html")) {
      const offer = params.get("offer");
      return offer === "upsell" || offer === "downsell" ? offer : "main";
    }

    if (path.endsWith("/upsell.html")) return "upsell";
    if (path.endsWith("/downsell.html")) return "downsell";
    return "main";
  }

  function getCurrentOffer(kind) {
    return catalog[kind] || catalog.main;
  }

  function getSessionContext() {
    const session = readSession();
    return {
      root_reference: session.rootReference || "",
      current_reference: session.currentReference || "",
      payment_method: session.paymentMethod || "",
      customer_email_present: Boolean(session?.customer?.email)
    };
  }

  function getTrackingContext() {
    const store = persistTrackingContext();
    const pageType = getPageType();
    const offerKind = getOfferKind();

    return {
      page_type: pageType,
      offer_kind: offerKind,
      page_path: window.location.pathname,
      page_url: window.location.href,
      page_title: document.title,
      referrer_url: document.referrer || "",
      landing_page: store.lastTouch?.landing_page || store.firstTouch?.landing_page || "",
      first_utm_source: store.firstTouch?.utm_source || "",
      first_utm_medium: store.firstTouch?.utm_medium || "",
      first_utm_campaign: store.firstTouch?.utm_campaign || "",
      first_utm_content: store.firstTouch?.utm_content || "",
      first_utm_term: store.firstTouch?.utm_term || "",
      utm_source: store.lastTouch?.utm_source || store.firstTouch?.utm_source || "",
      utm_medium: store.lastTouch?.utm_medium || store.firstTouch?.utm_medium || "",
      utm_campaign: store.lastTouch?.utm_campaign || store.firstTouch?.utm_campaign || "",
      utm_content: store.lastTouch?.utm_content || store.firstTouch?.utm_content || "",
      utm_term: store.lastTouch?.utm_term || store.firstTouch?.utm_term || "",
      ttclid: store.lastTouch?.ttclid || store.firstTouch?.ttclid || "",
      fbclid: store.lastTouch?.fbclid || store.firstTouch?.fbclid || "",
      gclid: store.lastTouch?.gclid || store.firstTouch?.gclid || "",
      campaign_id: store.lastTouch?.campaign_id || store.firstTouch?.campaign_id || "",
      adset_id: store.lastTouch?.adset_id || store.firstTouch?.adset_id || "",
      ad_id: store.lastTouch?.ad_id || store.firstTouch?.ad_id || "",
      ...getSessionContext()
    };
  }

  function sanitizeParams(input) {
    return Object.entries(input || {}).reduce((acc, [key, value]) => {
      if (value === undefined || value === null || value === "") {
        return acc;
      }
      acc[key] = value;
      return acc;
    }, {});
  }

  function buildContents(kind) {
    const offer = getCurrentOffer(kind);
    return [
      {
        content_id: offer.content_id,
        content_type: offer.content_type,
        content_name: offer.content_name
      }
    ];
  }

  function buildEventPayload(name, params) {
    const input = params || {};
    const offerKind = input.offer || input.offerKind || getOfferKind();
    const offer = getCurrentOffer(offerKind);
    const context = getTrackingContext();
    const customParams = sanitizeParams({
      page_name: input.page || "",
      source: input.source || "",
      method: input.method || "",
      reference: input.reference || "",
      root_reference: input.root_reference || context.root_reference || "",
      current_reference: input.current_reference || context.current_reference || "",
      cta_name: input.cta_name || "",
      cta_position: input.cta_position || "",
      section: input.section || "",
      label: input.label || "",
      question: input.question || "",
      status: input.status || "",
      scroll_percent: input.scroll_percent || "",
      asset_url: input.asset_url || ""
    });

    const payload = {
      contents: input.contents || buildContents(offerKind),
      value:
        typeof input.value === "number"
          ? input.value
          : Number(input.value || offer.value),
      currency: input.currency || CURRENCY,
      content_id: offer.content_id,
      content_name: offer.content_name,
      content_type: offer.content_type,
      ...sanitizeParams(context),
      ...customParams
    };

    if (name === "Search" && input.search_string) {
      payload.search_string = input.search_string;
    }

    return payload;
  }

  function fireEvent(name, params) {
    if (!window.ttq || typeof window.ttq.track !== "function") {
      return;
    }

    const standardEvents = new Set([
      "ViewContent",
      "AddToWishlist",
      "Search",
      "AddPaymentInfo",
      "AddToCart",
      "InitiateCheckout",
      "PlaceAnOrder",
      "CompleteRegistration",
      "Purchase"
    ]);

    if (standardEvents.has(name)) {
      window.ttq.track(name, buildEventPayload(name, params));
      return;
    }

    if (name === "PurchaseAttempt") {
      window.ttq.track("PlaceAnOrder", buildEventPayload("PlaceAnOrder", params));
      return;
    }

    if (name === "PurchaseApproved") {
      window.ttq.track("Purchase", buildEventPayload("Purchase", params));
      return;
    }

    window.ttq.track(name, params || {});
  }

  async function sha256(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || !window.crypto || !window.crypto.subtle) {
      return "";
    }

    const buffer = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalized)
    );

    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function identifyUser(data) {
    const payload = {};

    if (data && data.email) {
      payload.email = await sha256(data.email);
    }

    if (data && data.phone_number) {
      payload.phone_number = await sha256(String(data.phone_number).replace(/\D/g, ""));
    }

    if (data && data.external_id) {
      payload.external_id = await sha256(data.external_id);
    }

    const entries = Object.entries(payload).filter(([, value]) => value);
    if (!entries.length || !window.ttq || typeof window.ttq.identify !== "function") {
      return;
    }

    window.ttq.identify(Object.fromEntries(entries));
  }

  function buildPurchaseKey(reference) {
    return `ttq-purchase-${reference}`;
  }

  function buildEventKey(name, reference = "") {
    return `ttq-event-${name}-${reference || "global"}`;
  }

  function markPurchase(reference) {
    if (!reference) return;
    window.sessionStorage.setItem(buildPurchaseKey(reference), "1");
  }

  function hasTrackedPurchase(reference) {
    if (!reference) return false;
    return window.sessionStorage.getItem(buildPurchaseKey(reference)) === "1";
  }

  function markEvent(name, reference = "") {
    window.sessionStorage.setItem(buildEventKey(name, reference), "1");
  }

  function hasTrackedEvent(name, reference = "") {
    return window.sessionStorage.getItem(buildEventKey(name, reference)) === "1";
  }

  function trackPageSpecificEvents() {
    const path = window.location.pathname.toLowerCase();
    const offerKind = getOfferKind();

    if (path.endsWith("/checkout.html")) {
      fireEvent("ViewContent", {
        offer: offerKind,
        section: "checkout-entry",
        page: "checkout"
      });
      fireEvent("InitiateCheckout", {
        offer: offerKind,
        section: "checkout-entry",
        page: "checkout"
      });
      return;
    }

    if (path.endsWith("/upsell.html") || path.endsWith("/downsell.html")) {
      fireEvent("ViewContent", {
        offer: offerKind,
        page: getPageType(),
        section: "offer-page"
      });
      return;
    }

    if (path.endsWith("/obrigado.html")) {
      fireEvent("ViewThankYou", {
        offer: offerKind,
        page: "thankyou",
        section: "post-purchase-status"
      });
      return;
    }

    if (path.endsWith("/acesso.html")) {
      fireEvent("ViewAccessPage", {
        offer: offerKind,
        page: "access",
        section: "members-area"
      });
    }
  }

  window.dataLayer = window.dataLayer || [];
  window.trackEvent = function trackEvent(name, params) {
    window.dataLayer.push({
      event: name,
      ...sanitizeParams(getTrackingContext()),
      ...sanitizeParams(params || {})
    });
    fireEvent(name, params);
  };

  window.tiktokIdentify = identifyUser;
  window.tiktokPixel = {
    fireEvent,
    identifyUser,
    getOfferKind,
    getCurrentOffer,
    hasTrackedEvent,
    hasTrackedPurchase,
    markEvent,
    markPurchase
  };

  persistTrackingContext();
  loadPixel();
  trackPageSpecificEvents();

  const session = readSession();
  if (session && session.customer && session.customer.email) {
    identifyUser({
      email: session.customer.email,
      external_id: session.rootReference || session.currentReference || ""
    });
  }
})();
