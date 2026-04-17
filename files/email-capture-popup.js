(function (global) {
  var POPUP_ID = "huntersEmailPopup";
  var STYLE_ID = "huntersEmailPopupStyles";
  var HIDE_KEY = "hunters_email_popup_hide_until_v1";
  var SUBSCRIBED_KEY = "hunters_email_popup_subscribed_v1";
  var DELAY_MS = 9000;
  var HIDE_DAYS = 14;

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

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ""
      + "#" + POPUP_ID + " { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; z-index: 10050; }"
      + "#" + POPUP_ID + ".open { display: flex; }"
      + "#" + POPUP_ID + " .hep-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.62); backdrop-filter: blur(4px); }"
      + "#" + POPUP_ID + " .hep-modal { position: relative; width: min(92vw, 460px); border-radius: 16px; border: 1px solid rgba(242,237,230,0.16); background: #070707; color: #f2ede6; box-shadow: 0 22px 80px rgba(0,0,0,0.55); padding: 22px 20px 18px; }"
      + "#" + POPUP_ID + " .hep-close { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; border: 1px solid rgba(242,237,230,0.2); border-radius: 999px; background: rgba(242,237,230,0.06); color: #f2ede6; cursor: pointer; font-size: 16px; line-height: 1; }"
      + "#" + POPUP_ID + " .hep-eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(242,237,230,0.48); margin-bottom: 8px; font-weight: 700; }"
      + "#" + POPUP_ID + " .hep-title { margin: 0 0 8px; font-size: clamp(24px, 4vw, 30px); line-height: 1.05; letter-spacing: -0.02em; }"
      + "#" + POPUP_ID + " .hep-copy { margin: 0 0 14px; color: rgba(242,237,230,0.72); font-size: 14px; line-height: 1.5; }"
      + "#" + POPUP_ID + " .hep-form { display: flex; gap: 8px; }"
      + "#" + POPUP_ID + " .hep-input { flex: 1; min-height: 44px; border-radius: 12px; border: 1px solid rgba(242,237,230,0.18); background: rgba(242,237,230,0.04); color: #f2ede6; padding: 0 12px; font-size: 14px; outline: none; }"
      + "#" + POPUP_ID + " .hep-input:focus { border-color: rgba(242,237,230,0.42); }"
      + "#" + POPUP_ID + " .hep-submit { min-height: 44px; border-radius: 12px; border: 1px solid rgba(242,237,230,0.2); background: #f2ede6; color: #000; font-weight: 700; padding: 0 14px; cursor: pointer; }"
      + "#" + POPUP_ID + " .hep-submit[disabled] { opacity: 0.7; cursor: wait; }"
      + "#" + POPUP_ID + " .hep-meta { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }"
      + "#" + POPUP_ID + " .hep-note { font-size: 11px; color: rgba(242,237,230,0.45); }"
      + "#" + POPUP_ID + " .hep-dismiss { background: transparent; border: 0; color: rgba(242,237,230,0.58); text-decoration: underline; cursor: pointer; font-size: 12px; }"
      + "#" + POPUP_ID + " .hep-status { margin-top: 10px; min-height: 18px; font-size: 12px; color: rgba(242,237,230,0.78); }"
      + "@media (max-width: 560px) {"
      + "  #" + POPUP_ID + " .hep-form { flex-direction: column; }"
      + "  #" + POPUP_ID + " .hep-submit { width: 100%; }"
      + "}";

    document.head.appendChild(style);
  }

  function buildPopup() {
    var existing = document.getElementById(POPUP_ID);
    if (existing) return existing;

    var root = document.createElement("div");
    root.id = POPUP_ID;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = ""
      + '<div class="hep-backdrop" data-hep-close="1"></div>'
      + '<div class="hep-modal" role="dialog" aria-modal="true" aria-labelledby="hepTitle">'
      + '  <button class="hep-close" type="button" aria-label="Close" data-hep-close="1">×</button>'
      + '  <div class="hep-eyebrow">Hunters Weekly</div>'
      + '  <h3 class="hep-title" id="hepTitle">Get first access to new cafes and events.</h3>'
      + '  <p class="hep-copy">One short email each week. No spam. No sharing your data.</p>'
      + '  <form class="hep-form" id="hepForm">'
      + '    <input class="hep-input" id="hepEmail" type="email" placeholder="you@example.com" required />'
      + '    <button class="hep-submit" id="hepSubmit" type="submit">Join</button>'
      + '  </form>'
      + '  <div class="hep-meta">'
      + '    <span class="hep-note">You can unsubscribe anytime.</span>'
      + '    <button class="hep-dismiss" type="button" data-hep-dismiss="1">Maybe later</button>'
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

  async function submitEmail(email) {
    var backend = global.HuntersBackend;
    if (!(backend && typeof backend.submitEmailSubscription === "function" && backend.isConfigured())) {
      return false;
    }

    var result = await backend.submitEmailSubscription({
      email: email,
      source_page: global.location ? global.location.pathname : "unknown",
      source_context: "email_popup"
    });
    return !!result.ok;
  }

  function wirePopup(root) {
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
        status.textContent = "Please enter a valid email address.";
        return;
      }

      status.textContent = "Submitting...";
      submitButton.disabled = true;

      try {
        var ok = await submitEmail(email);
        if (ok) {
          writeStorage(SUBSCRIBED_KEY, "1");
          status.textContent = "You are in. See you in your inbox.";
          global.setTimeout(function () {
            closePopup(root, 365);
          }, 900);
        } else {
          status.textContent = "Could not save right now. Please try again.";
        }
      } catch (error) {
        status.textContent = "Could not save right now. Please try again.";
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  function boot() {
    if (!canShowPopup()) return;
    ensureStyles();
    var root = buildPopup();
    wirePopup(root);
    global.setTimeout(function () {
      if (canShowPopup()) {
        openPopup(root);
      }
    }, DELAY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
