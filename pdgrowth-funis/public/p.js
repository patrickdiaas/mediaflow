/*!
 * pdgrowth-funis pixel — v0.1
 *
 * Cola a atribuição cross-domain:
 *   1. Lê mfv/mfvar/mfs da query string (vindos do split router) e persiste
 *      em localStorage + cookie de 1ª festa.
 *   2. Injeta esses ids em TODOS os <form> e <a href> de checkout conhecidos
 *      (Hotmart, DMGuru, Eduzz, Kiwify, Pagar.me) — como hidden field e/ou
 *      query param `src` no caso do Hotmart (formato mf_<slug>_<var>_<vid>).
 *   3. Dispara um `view` event pro endpoint /api/track.
 *
 * Uso na sales page:
 *   <script async src="https://funis.seu-dominio.com/p.js"></script>
 *
 * Override do endpoint (auto-host):
 *   <script>window.MF_ENDPOINT="https://funis.seu-dominio.com";</script>
 *   <script async src="https://funis.seu-dominio.com/p.js"></script>
 */
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var ENDPOINT =
    (window.MF_ENDPOINT && String(window.MF_ENDPOINT).replace(/\/$/, "")) ||
    (SCRIPT && SCRIPT.src ? new URL(SCRIPT.src).origin : "");

  // Cliente indica em qual step do funil essa página está. Aceita name OU type.
  //   <script async data-step="bump" src="..."></script>
  //   <script async data-step="Checkout principal" src="..."></script>
  var STEP_HINT =
    (SCRIPT && SCRIPT.getAttribute && SCRIPT.getAttribute("data-step")) ||
    (window.MF_STEP ? String(window.MF_STEP) : null);

  var STORAGE_KEY = "mf_attr";
  var COOKIE_DAYS = 90;

  var CHECKOUT_HOSTS = [
    "pay.hotmart.com", "checkout.hotmart.com", "payments.hotmart.com",
    "digitalmanager.guru", "pay.digitalmanager.guru", "pay.dmguru.com.br",
    "checkout.eduzz.com", "sun.eduzz.com",
    "pay.kiwify.com.br", "pay.kiwify.com", "kiwify.com.br",
    "checkout.pagar.me", "pagar.me"
  ];

  // ---------------------------------------------------------------- helpers
  function qp(name) {
    var m = window.location.search.match(
      new RegExp("[?&]" + name + "=([^&]+)")
    );
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(k, v, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie =
      k + "=" + encodeURIComponent(v) + ";expires=" + d.toUTCString() +
      ";path=/;samesite=lax";
  }
  function getCookie(k) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + k + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function saveAttr(attr) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(attr)); } catch (_) {}
    if (attr.mfv)  setCookie("mf_vid",        attr.mfv,  COOKIE_DAYS);
    if (attr.mfvar) setCookie("mf_variant",   attr.mfvar, COOKIE_DAYS);
    if (attr.mfs)   setCookie("mf_slug",      attr.mfs,   COOKIE_DAYS);
  }
  function loadAttr() {
    var fromUrl = {
      mfv:   qp("mfv"),
      mfvar: qp("mfvar"),
      mfs:   qp("mfs")
    };
    if (fromUrl.mfv && fromUrl.mfvar) {
      saveAttr(fromUrl);
      return fromUrl;
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      mfv:   getCookie("mf_vid"),
      mfvar: getCookie("mf_variant"),
      mfs:   getCookie("mf_slug")
    };
  }
  function isCheckoutHost(host) {
    host = (host || "").toLowerCase();
    for (var i = 0; i < CHECKOUT_HOSTS.length; i++) {
      if (host === CHECKOUT_HOSTS[i] || host.endsWith("." + CHECKOUT_HOSTS[i])) return true;
    }
    return false;
  }
  function isHotmart(host) {
    host = (host || "").toLowerCase();
    return host.indexOf("hotmart.com") !== -1;
  }
  function hotmartToken(attr) {
    // src=mf_<slug>_<variant>_<visitor>  (lido pelo webhook em tracking.source_sck)
    return "mf_" + (attr.mfs || "x") + "_" + attr.mfvar + "_" + attr.mfv;
  }
  function addParam(url, name, value) {
    try {
      var u = new URL(url, window.location.href);
      if (!u.searchParams.has(name)) u.searchParams.set(name, value);
      return u.toString();
    } catch (_) { return url; }
  }
  function injectFormFields(form, attr) {
    var fields = { _mfv: attr.mfv, _mfvar: attr.mfvar, _mfs: attr.mfs };
    Object.keys(fields).forEach(function (k) {
      if (!fields[k]) return;
      if (form.querySelector('input[name="' + k + '"]')) return;
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = fields[k];
      form.appendChild(input);
    });
  }

  // ----------------------------------------------------------- main routine
  var attr = loadAttr();
  if (!attr.mfv) return; // não tem atribuição → sai silencioso

  // Reescreve links de checkout
  function rewriteLinks() {
    var anchors = document.querySelectorAll("a[href]");
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#") continue;
      var host;
      try { host = new URL(href, window.location.href).hostname; } catch (_) { continue; }
      if (!isCheckoutHost(host)) continue;
      if (isHotmart(host)) {
        a.href = addParam(href, "src", hotmartToken(attr));
      } else {
        var u = href;
        u = addParam(u, "mfv",   attr.mfv);
        u = addParam(u, "mfvar", attr.mfvar);
        if (attr.mfs) u = addParam(u, "mfs", attr.mfs);
        a.href = u;
      }
    }
  }
  function injectAllForms() {
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) injectFormFields(forms[i], attr);
  }

  function run() { rewriteLinks(); injectAllForms(); }
  run();

  // Observa DOM (sales pages costumam injetar CTA via JS)
  if (window.MutationObserver) {
    new MutationObserver(run).observe(document.documentElement, {
      childList: true, subtree: true
    });
  }

  // Dispara view event (e step_view se data-step estiver presente)
  if (ENDPOINT) {
    try {
      var body = JSON.stringify({
        type:    STEP_HINT ? "step_view" : "view",
        mfv:     attr.mfv,
        mfvar:   attr.mfvar,
        mfs:     attr.mfs,
        step:    STEP_HINT,
        url:     window.location.href,
        referer: document.referrer || null,
        title:   document.title
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT + "/api/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch(ENDPOINT + "/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body,
          keepalive: true,
          mode: "cors"
        });
      }
    } catch (_) {}
  }

  // API pública pra disparar eventos custom: window.mfTrack('add_to_cart', { value: 197 })
  window.mfTrack = function (type, meta) {
    if (!ENDPOINT || !attr.mfv) return;
    try {
      var body = JSON.stringify({
        type: String(type || "custom"),
        mfv:  attr.mfv,
        mfvar: attr.mfvar,
        mfs:  attr.mfs,
        step: STEP_HINT,
        url:  window.location.href,
        value: meta && meta.value != null ? Number(meta.value) : null,
        meta: meta || null
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT + "/api/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch(ENDPOINT + "/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body,
          keepalive: true,
          mode: "cors"
        });
      }
    } catch (_) {}
  };
})();
