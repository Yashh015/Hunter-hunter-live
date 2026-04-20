(function (global) {
  var PRETTY_ROUTE_MAP = {
    "/": "/index.html",
    "/index": "/index.html",
    "/pricing": "/pricing.html",
    "/login": "/login.html",
    "/dashboard": "/dashboard.html",
    "/cafes": "/cafes.html",
    "/event": "/event.html",
    "/event-detail": "/event-detail.html",
    "/event-dashboard": "/event-dashboard.html",
    "/events": "/events.html",
    "/host-event": "/events.html"
  };

  function getBackend() {
    return global.HuntersBackend || null;
  }

  function getClient() {
    var backend = getBackend();
    if (!backend || typeof backend.createClient !== "function" || !backend.isConfigured()) {
      return null;
    }
    return backend.createClient(null);
  }

  function resolvePath(path) {
    var raw = String(path || "").trim();
    if (!raw) return "/dashboard.html";

    if (raw.indexOf("http://") === 0 || raw.indexOf("https://") === 0 || raw.indexOf("//") === 0) {
      return "/dashboard.html";
    }

    var normalized = raw.charAt(0) === "/" ? raw : "/" + raw;
    var key = normalized.toLowerCase();

    if (Object.prototype.hasOwnProperty.call(PRETTY_ROUTE_MAP, key)) {
      return PRETTY_ROUTE_MAP[key];
    }

    return normalized;
  }

  function normalizeNextPath(nextPath) {
    var raw = String(nextPath || "").trim();
    if (!raw) return "dashboard.html";

    var hashIndex = raw.indexOf("#");
    var hash = hashIndex >= 0 ? raw.slice(hashIndex) : "";
    var noHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;

    var queryIndex = noHash.indexOf("?");
    var query = queryIndex >= 0 ? noHash.slice(queryIndex) : "";
    var path = queryIndex >= 0 ? noHash.slice(0, queryIndex) : noHash;

    var resolved = resolvePath(path);
    if (resolved.charAt(0) === "/") {
      resolved = resolved.slice(1);
    }

    return resolved + query + hash;
  }

  function buildLoginPath(nextPath) {
    var next = normalizeNextPath(nextPath);
    return "login.html?next=" + encodeURIComponent(next);
  }

  function getCurrentPath() {
    var path = String(global.location.pathname || "/index.html");
    var query = String(global.location.search || "");
    return path + query;
  }

  async function getCurrentUser() {
    var backend = getBackend();
    if (backend && typeof backend.getCurrentUser === "function") {
      return backend.getCurrentUser();
    }

    var client = getClient();
    if (!client || !client.auth || typeof client.auth.getUser !== "function") {
      return null;
    }

    var response = await client.auth.getUser();
    if (!response || response.error || !response.data || !response.data.user) {
      return null;
    }

    return response.data.user;
  }

  async function requireAuth(nextPath) {
    var user = await getCurrentUser();
    if (user) {
      return { ok: true, user: user };
    }

    var target = normalizeNextPath(nextPath || getCurrentPath());
    global.location.href = buildLoginPath(target);
    return { ok: false, user: null };
  }

  async function redirectIfAuthenticated(targetPath) {
    var user = await getCurrentUser();
    if (!user) return false;

    global.location.href = normalizeNextPath(targetPath || "dashboard.html");
    return true;
  }

  async function signInWithMagicLink(email, nextPath) {
    var client = getClient();
    if (!client || !client.auth || typeof client.auth.signInWithOtp !== "function") {
      return { ok: false, reason: "not_configured", error: null };
    }

    var cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return { ok: false, reason: "invalid_email", error: null };
    }

    var next = normalizeNextPath(nextPath || "dashboard.html");
    var redirectTo = String(global.location.origin || "") + "/login.html?next=" + encodeURIComponent(next);

    var response = await client.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (response && response.error) {
      return { ok: false, reason: "auth_error", error: response.error };
    }

    return { ok: true, reason: null, error: null };
  }

  async function signOut(nextPath) {
    var client = getClient();
    if (client && client.auth && typeof client.auth.signOut === "function") {
      await client.auth.signOut();
    }

    global.location.href = normalizeNextPath(nextPath || "index.html");
    return { ok: true };
  }

  function getDisplayName(user) {
    if (!user || typeof user !== "object") return "Hunter";
    var meta = user.user_metadata || {};
    var fromMeta = String(meta.full_name || meta.name || "").trim();
    if (fromMeta) return fromMeta;

    var email = String(user.email || "").trim();
    if (!email) return "Hunter";
    return email.split("@")[0] || "Hunter";
  }

  global.HuntersAuth = {
    normalizeNextPath: normalizeNextPath,
    buildLoginPath: buildLoginPath,
    getCurrentUser: getCurrentUser,
    requireAuth: requireAuth,
    redirectIfAuthenticated: redirectIfAuthenticated,
    signInWithMagicLink: signInWithMagicLink,
    signOut: signOut,
    getDisplayName: getDisplayName
  };
})(window);
