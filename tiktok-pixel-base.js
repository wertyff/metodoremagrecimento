!function (w, d, t) {
  w.TiktokAnalyticsObject = t;
  var ttq = w[t] = w[t] || [];
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
  ttq.setAndDefer = function (target, method) {
    target[method] = function () {
      target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (var i = 0; i < ttq.methods.length; i += 1) {
    ttq.setAndDefer(ttq, ttq.methods[i]);
  }
  ttq.instance = function (id) {
    var instance = ttq._i[id] || [];
    for (var n = 0; n < ttq.methods.length; n += 1) {
      ttq.setAndDefer(instance, ttq.methods[n]);
    }
    return instance;
  };
  ttq.load = function (id, options) {
    var sdkUrl = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    ttq._i[id] = [];
    ttq._i[id]._u = sdkUrl;
    ttq._t = ttq._t || {};
    ttq._t[id] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[id] = options || {};
    var script = d.createElement("script");
    script.type = "text/javascript";
    script.async = !0;
    script.src = sdkUrl + "?sdkid=" + id + "&lib=" + t;
    var firstScript = d.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  };
  if (!ttq._t || !ttq._t.D7G18H3C77U7II46KN6G) {
    ttq.load("D7G18H3C77U7II46KN6G");
    ttq.page();
  }
}(window, document, "ttq");
