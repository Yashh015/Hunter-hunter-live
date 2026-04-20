(function (global) {
  var POPUP_ID = "huntersEmailPopup";
  var STYLE_ID = "huntersEmailPopupStyles";
  var HIDE_KEY = "hunters_email_popup_hide_until_v1";
  var SUBSCRIBED_KEY = "hunters_email_popup_subscribed_v1";
  var DEFAULT_DELAY_AFTER_SCROLL_MS = 5000;
  var DEFAULT_HIDE_DAYS = 14;

  var DEFAULT_CONTENT = {
    eyebrow: "Hunters weekly",
    title: "Get the best cafes and events before everyone else.",
    copy: "One useful weekly update with fresh picks, hidden gems, and local plans worth your time.",
    bullets: [
      "Curated Vadodara cafes and events",
      "No paid placements",
      "No spam, unsubscribe anytime"
    ],
    emailPlaceholder: "you@example.com",
    submitLabel: "Join free",
    dismissLabel: "Not now",
    note: "By joining, you agree to receive the Hunters weekly email.",
    invalidEmailMessage: "Please enter a valid email address.",
    loadingMessage: "Saving...",
    successMessage: "You are in. Check your inbox.",
    errorMessage: "Could not save right now. Please try again.",
    sourceContext: "email_popup",
    delayAfterScrollMs: DEFAULT_DELAY_AFTER_SCROLL_MS,
    hideDays: DEFAULT_HIDE_DAYS
  };

  function nowMs() {
    return Date.now();
  }

  function hideUntil(days) {
    return nowMs() + days * 24 * 60 * 60 * 1000;
  }

  function readStorage(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      global.localStorage.setItem(key, value);
    } catch (error) {
      // no-op
    }
  }

  function isSubscribed() {
    return readStorage(SUBSCRIBED_KEY) === "1";
  }

  function canShowPopup() {
    if (isSubscribed()) return false;

    var hiddenUntil = parseInt(readStorage(HIDE_KEY) || "0", 10);
    if (!hiddenUntil) return true;
    return nowMs() > hiddenUntil;
  }

  function emailLooksValid(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  function readNumber(value, fallback, min, max) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (Number.isFinite(min) && parsed < min) return min;
    if (Number.isFinite(max) && parsed > max) return max;
    return Math.round(parsed);
  }

  function sanitizeText(value, fallback) {
    var text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizePopupConfig(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var config = {
      eyebrow: sanitizeText(source.eyebrow, DEFAULT_CONTENT.eyebrow),
      title: sanitizeText(source.title, DEFAULT_CONTENT.title),
      copy: sanitizeText(source.copy, DEFAULT_CONTENT.copy),
      emailPlaceholder: sanitizeText(source.email_placeholder || source.emailPlaceholder, DEFAULT_CONTENT.emailPlaceholder),
      submitLabel: sanitizeText(source.submit_label || source.submitLabel, DEFAULT_CONTENT.submitLabel),
      dismissLabel: sanitizeText(source.dismiss_label || source.dismissLabel, DEFAULT_CONTENT.dismissLabel),
      note: sanitizeText(source.note, DEFAULT_CONTENT.note),
      invalidEmailMessage: sanitizeText(source.invalid_email_message || source.invalidEmailMessage, DEFAULT_CONTENT.invalidEmailMessage),
      loadingMessage: sanitizeText(source.loading_message || source.loadingMessage, DEFAULT_CONTENT.loadingMessage),
      successMessage: sanitizeText(source.success_message || source.successMessage, DEFAULT_CONTENT.successMessage),
      errorMessage: sanitizeText(source.error_message || source.errorMessage, DEFAULT_CONTENT.errorMessage),
      sourceContext: sanitizeText(source.source_context || source.sourceContext, DEFAULT_CONTENT.sourceContext),
      delayAfterScrollMs: readNumber(source.delay_after_scroll_ms || source.delayAfterScrollMs, DEFAULT_CONTENT.delayAfterScrollMs, 500, 60000),
      hideDays: readNumber(source.hide_days || source.hideDays, DEFAULT_CONTENT.hideDays, 1, 3650),
      bullets: DEFAULT_CONTENT.bullets.slice()
    };

    if (Array.isArray(source.bullets)) {
      var nextBullets = source.bullets
        .map(function (item) { return sanitizeText(item, ""); })
        .filter(Boolean)
        .slice(0, 4);
      if (nextBullets.length > 0) {
        config.bullets = nextBullets;
      }
    }

    return config;
  }

  async function loadPopupConfig() {
    var backend = global.HuntersBackend;
    if (!(backend && typeof backend.fetchSiteContent === "function" && backend.isConfigured())) {
      return DEFAULT_CONTENT;
    }

    try {
      var result = await backend.fetchSiteContent("email_popup");
      if (!(result && result.ok && result.data && typeof result.data === "object")) {
        return DEFAULT_CONTENT;
      }
      return normalizePopupConfig(result.data);
    } catch (error) {
      return DEFAULT_CONTENT;
    }
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ""
      + "#" + POPUP_ID + " { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; z-index: 10050; }"
      + "#" + POPUP_ID + ".open { display: flex; }"
      + "#" + POPUP_ID + " .hep-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.74); backdrop-filter: blur(6px); }"
      + "#" + POPUP_ID + " .hep-modal { position: relative; width: min(92vw, 500px); border-radius: 22px; border: 1px solid rgba(242,237,230,0.18); background: linear-gradient(170deg, rgba(22,22,22,0.96), rgba(7,7,7,0.98)); color: #f2ede6; box-shadow: 0 26px 90px rgba(0,0,0,0.58); padding: 26px 22px 20px; overflow: hidden; }"
      + "#" + POPUP_ID + " .hep-modal::before { content: ''; position: absolute; width: 180px; height: 180px; border-radius: 999px; right: -60px; top: -70px; background: radial-gradient(circle, rgba(242,237,230,0.2), transparent 72%); pointer-events: none; }"
      + "#" + POPUP_ID + " .hep-close { position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; border: 1px solid rgba(242,237,230,0.22); border-radius: 999px; background: rgba(242,237,230,0.05); color: #f2ede6; cursor: pointer; font-size: 15px; line-height: 1; }"
      + "#" + POPUP_ID + " .hep-eyebrow { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(242,237,230,0.55); margin-bottom: 10px; font-weight: 800; }"
      + "#" + POPUP_ID + " .hep-title { margin: 0 0 10px; font-size: clamp(26px, 4vw, 34px); line-height: 1.02; letter-spacing: -0.03em; max-width: 16ch; }"
      + "#" + POPUP_ID + " .hep-copy { margin: 0 0 12px; color: rgba(242,237,230,0.76); font-size: 14px; line-height: 1.58; max-width: 48ch; }"
      + "#" + POPUP_ID + " .hep-list { list-style: none; display: grid; gap: 6px; margin: 0 0 14px; padding: 0; }"
      + "#" + POPUP_ID + " .hep-item { color: rgba(242,237,230,0.72); font-size: 12px; line-height: 1.45; letter-spacing: 0.01em; }"
      + "#" + POPUP_ID + " .hep-item::before { content: '\\2022'; margin-right: 8px; color: rgba(242,237,230,0.9); }"
      + "#" + POPUP_ID + " .hep-form { display: flex; gap: 8px; }"
      + "#" + POPUP_ID + " .hep-input { flex: 1; min-height: 46px; border-radius: 12px; border: 1px solid rgba(242,237,230,0.22); background: rgba(242,237,230,0.03); color: #f2ede6; padding: 0 13px; font-size: 14px; outline: none; }"
      + "#" + POPUP_ID + " .hep-input:focus { border-color: rgba(242,237,230,0.42); }"
      + "#" + POPUP_ID + " .hep-submit { min-height: 46px; border-radius: 12px; border: 1px solid rgba(242,237,230,0.26); background: #f2ede6; color: #000; font-weight: 800; padding: 0 16px; cursor: pointer; letter-spacing: 0.03em; }"
      + "#" + POPUP_ID + " .hep-submit[disabled] { opacity: 0.7; cursor: wait; }"
      + "#" + POPUP_ID + " .hep-meta { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }"
      + "#" + POPUP_ID + " .hep-note { font-size: 11px; color: rgba(242,237,230,0.5); }"
      + "#" + POPUP_ID + " .hep-dismiss { background: transparent; border: 0; color: rgba(242,237,230,0.58); text-decoration: underline; cursor: pointer; font-size: 12px; }"
      + "#" + POPUP_ID + " .hep-status { margin-top: 10px; min-height: 18px; font-size: 12px; color: rgba(242,237,230,0.78); }"
      + "@media (max-width: 560px) {"
      + "  #" + POPUP_ID + " .hep-form { flex-direction: column; }"
      + "  #" + POPUP_ID + " .hep-submit { width: 100%; }"
      + "  #" + POPUP_ID + " .hep-title { max-width: 100%; }"
      + "}";

    document.head.appendChild(style);
  }

  function buildPopup(content) {
    var existing = document.getElementById(POPUP_ID);
    if (existing) return existing;

    var bulletHtml = (content.bullets || []).map(function (item) {
      return '<li class="hep-item">' + escapeHtml(item) + "</li>";
    }).join("");

    var root = document.createElement("div");
    root.id = POPUP_ID;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = ""
      + '<div class="hep-backdrop" data-hep-close="1"></div>'
      + '<div class="hep-modal" role="dialog" aria-modal="true" aria-labelledby="hepTitle">'
      + '  <button class="hep-close" type="button" aria-label="Close" data-hep-close="1">x</button>'
      + '  <div class="hep-eyebrow">' + escapeHtml(content.eyebrow) + "</div>"
      + '  <h3 class="hep-title" id="hepTitle">' + escapeHtml(content.title) + "</h3>"
      + '  <p class="hep-copy">' + escapeHtml(content.copy) + "</p>"
      + '  <ul class="hep-list">' + bulletHtml + "</ul>"
      + '  <form class="hep-form" id="hepForm">'
      + '    <input class="hep-input" id="hepEmail" type="email" placeholder="' + escapeHtml(content.emailPlaceholder) + '" required />'
      + '    <button class="hep-submit" id="hepSubmit" type="submit">' + escapeHtml(content.submitLabel) + "</button>"
      + '  </form>'
      + '  <div class="hep-meta">'
      + '    <span class="hep-note">' + escapeHtml(content.note) + "</span>"
      + '    <button class="hep-dismiss" type="button" data-hep-dismiss="1">' + escapeHtml(content.dismissLabel) + "</button>"
      + '  </div>'
      + '  <div class="hep-status" id="hepStatus" aria-live="polite"></div>'
      + '</div>';

    document.body.appendChild(root);
    return root;
  }

  function openPopup(root) {
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");
  }

  function closePopup(root, rememberDays) {
    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");
    if (rememberDays > 0) {
      writeStorage(HIDE_KEY, String(hideUntil(rememberDays)));
    }
  }

  async function submitEmail(email, sourceContext) {
    var backend = global.HuntersBackend;
    if (!(backend && typeof backend.submitEmailSubscription === "function" && backend.isConfigured())) {
      return false;
    }

    var result = await backend.submitEmailSubscription({
      email: email,
      source_page: global.location ? global.location.pathname : "unknown",
      source_context: sourceContext || "email_popup"
    });
    return !!result.ok;
  }

  function wirePopup(root, content) {
    var form = root.querySelector("#hepForm");
    var emailInput = root.querySelector("#hepEmail");
    var submitButton = root.querySelector("#hepSubmit");
    var status = root.querySelector("#hepStatus");

    root.querySelectorAll("[data-hep-close='1']").forEach(function (el) {
      el.addEventListener("click", function () {
        closePopup(root, HIDE_DAYS);
      });
    });

    var later = root.querySelector("[data-hep-dismiss='1']");
    if (later) {
      later.addEventListener("click", function () {
        closePopup(root, HIDE_DAYS);
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && root.classList.contains("open")) {
        closePopup(root, HIDE_DAYS);
      }
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var email = String(emailInput.value || "").trim().toLowerCase();
      if (!emailLooksValid(email)) {
        status.textContent = content.invalidEmailMessage;
        return;
      }

      status.textContent = content.loadingMessage;
      submitButton.disabled = true;

      try {
        var ok = await submitEmail(email, content.sourceContext);
        if (ok) {
          writeStorage(SUBSCRIBED_KEY, "1");
          status.textContent = content.successMessage;
          global.setTimeout(function () {
            closePopup(root, 3650);
          }, 900);
        } else {
          status.textContent = content.errorMessage;
        }
      } catch (error) {
        status.textContent = content.errorMessage;
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  async function boot() {
    if (!canShowPopup()) return;

    var content = await loadPopupConfig();
    ensureStyles();
    var root = buildPopup(content);
    wirePopup(root, content);

    var scheduled = false;
    var delayMs = readNumber(content.delayAfterScrollMs, DEFAULT_DELAY_AFTER_SCROLL_MS, 500, 60000);
    var hideDays = readNumber(content.hideDays, DEFAULT_HIDE_DAYS, 1, 3650);

    function scheduleOpen() {
      if (scheduled) return;
      scheduled = true;
      global.setTimeout(function () {
        if (canShowPopup()) {
          openPopup(root);
        }
      }, delayMs);
    }

    function onScroll() {
      if ((global.scrollY || global.pageYOffset || 0) <= 0) return;
      scheduleOpen();
      global.removeEventListener("scroll", onScroll);
    }

    root.querySelectorAll("[data-hep-close='1'], [data-hep-dismiss='1']").forEach(function (node) {
      node.addEventListener("click", function () {
        closePopup(root, hideDays);
      });
    });

    global.addEventListener("scroll", onScroll, { passive: true });
    if ((global.scrollY || global.pageYOffset || 0) > 0) {
      scheduleOpen();
      global.removeEventListener("scroll", onScroll);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
