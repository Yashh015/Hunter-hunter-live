(function (global) {
  var STORAGE_KEY = "hunters_device_token_v1";
  var RSVP_STORAGE_KEY = "hunters_event_rsvps_v1";
  var MY_RSVP_STORAGE_KEY = "hunters_user_rsvps_v1";
  var DROP_STORAGE_KEY = "hunters_event_drops_v1";
  var ACTIVITY_STORAGE_KEY = "hunters_event_activity_v1";
  var METRICS_STORAGE_KEY = "hunters_event_metrics_v1";
  var DEFAULT_CONFIG = {
    url: "https://nbmgojeodosfosspdyhl.supabase.co",
    anonKey: ""
  };

  function getConfig() {
    var runtime = global.HUNTERS_SUPABASE_CONFIG || {};
    return {
      url: runtime.url || DEFAULT_CONFIG.url,
      anonKey: runtime.anonKey || DEFAULT_CONFIG.anonKey
    };
  }

  function hasCrypto() {
    return !!(global.crypto && global.crypto.getRandomValues);
  }

  function randomHex(length) {
    if (hasCrypto()) {
      var bytes = new Uint8Array(length / 2);
      global.crypto.getRandomValues(bytes);
      var hex = "";
      for (var i = 0; i < bytes.length; i += 1) {
        var part = bytes[i].toString(16);
        hex += part.length === 1 ? "0" + part : part;
      }
      return hex;
    }

    var fallback = "";
    var chars = "abcdef0123456789";
    for (var j = 0; j < length; j += 1) {
      fallback += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return fallback;
  }

  function readJson(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
      return fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // no-op
    }
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function readUserRsvpCollection(email) {
    var normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return [];
    var map = readJson(MY_RSVP_STORAGE_KEY, {});
    var rows = map[normalizedEmail];
    return Array.isArray(rows) ? rows.slice() : [];
  }

  function writeUserRsvpCollection(email, rows) {
    var normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;
    var map = readJson(MY_RSVP_STORAGE_KEY, {});
    map[normalizedEmail] = Array.isArray(rows) ? rows : [];
    writeJson(MY_RSVP_STORAGE_KEY, map);
  }

  function rememberUserRsvp(email, row) {
    var normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !row || typeof row !== "object") return;

    var rows = readUserRsvpCollection(normalizedEmail);
    var rowId = String(row.id || "");
    var replaced = false;

    for (var i = 0; i < rows.length; i += 1) {
      var existing = rows[i] || {};
      var existingId = String(existing.id || "");

      if (rowId && existingId && rowId === existingId) {
        rows[i] = row;
        replaced = true;
        break;
      }
    }

    if (!replaced) {
      rows.unshift(row);
    }

    writeUserRsvpCollection(normalizedEmail, rows.slice(0, 300));
  }

  function normalizeEventId(eventId) {
    var value = String(eventId || "default").trim();
    return value || "default";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function buildLocalId(prefix) {
    return prefix + "_" + randomHex(12);
  }

  function deriveUserDisplayName(user) {
    if (!user || typeof user !== "object") return null;

    var meta = user.user_metadata || {};
    var fromMeta = String(meta.full_name || meta.name || "").trim();
    if (fromMeta) return fromMeta;

    var email = normalizeEmail(user.email);
    if (!email) return null;
    return email.split("@")[0] || null;
  }

  function readEventCollection(storageKey, eventId) {
    var map = readJson(storageKey, {});
    var key = normalizeEventId(eventId);
    var rows = map[key];
    return Array.isArray(rows) ? rows.slice() : [];
  }

  function writeEventCollection(storageKey, eventId, rows) {
    var map = readJson(storageKey, {});
    map[normalizeEventId(eventId)] = Array.isArray(rows) ? rows : [];
    writeJson(storageKey, map);
  }

  function addEventRecord(storageKey, eventId, record) {
    var rows = readEventCollection(storageKey, eventId);
    rows.unshift(record);
    writeEventCollection(storageKey, eventId, rows);
    return record;
  }

  function removeEventRecord(storageKey, eventId, recordId) {
    var rows = readEventCollection(storageKey, eventId);
    var next = rows.filter(function (row) {
      return String(row.id || "") !== String(recordId || "");
    });
    writeEventCollection(storageKey, eventId, next);
    return next.length !== rows.length;
  }

  function readMetrics(eventId) {
    var map = readJson(METRICS_STORAGE_KEY, {});
    var key = normalizeEventId(eventId);
    var entry = map[key];
    if (!entry || typeof entry !== "object") {
      entry = {
        views: 0,
        shares: 0,
        share_breakdown: {
          whatsapp: 0,
          twitter: 0,
          link: 0,
          instagram: 0,
          email: 0
        },
        updated_at: null
      };
    }
    if (!entry.share_breakdown || typeof entry.share_breakdown !== "object") {
      entry.share_breakdown = {
        whatsapp: 0,
        twitter: 0,
        link: 0,
        instagram: 0,
        email: 0
      };
    }
    return entry;
  }

  function writeMetrics(eventId, metrics) {
    var map = readJson(METRICS_STORAGE_KEY, {});
    map[normalizeEventId(eventId)] = metrics;
    writeJson(METRICS_STORAGE_KEY, map);
  }

  function incrementViewMetric(eventId) {
    var metrics = readMetrics(eventId);
    metrics.views = Number(metrics.views || 0) + 1;
    metrics.updated_at = nowIso();
    writeMetrics(eventId, metrics);
    return metrics;
  }

  function incrementShareMetric(eventId, channel) {
    var metrics = readMetrics(eventId);
    var key = String(channel || "link").toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(metrics.share_breakdown, key)) {
      key = "link";
    }
    metrics.share_breakdown[key] = Number(metrics.share_breakdown[key] || 0) + 1;
    metrics.shares = Number(metrics.shares || 0) + 1;
    metrics.updated_at = nowIso();
    writeMetrics(eventId, metrics);
    return metrics;
  }

  function parseDateToDayKey(value) {
    var date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
  }

  function buildLast7DaySeries(rows) {
    var labels = [];
    var keys = [];
    var now = new Date();
    for (var i = 6; i >= 0; i -= 1) {
      var day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      keys.push(parseDateToDayKey(day.toISOString()));
      labels.push(day.toLocaleDateString("en-US", { weekday: "short" }));
    }

    var early = [];
    var premium = [];
    for (var j = 0; j < keys.length; j += 1) {
      var key = keys[j];
      var earlyCount = 0;
      var premiumCount = 0;
      for (var k = 0; k < rows.length; k += 1) {
        var row = rows[k] || {};
        var createdKey = parseDateToDayKey(row.created_at);
        if (createdKey !== key) continue;
        var ticketType = String(row.ticket_type || "").toLowerCase();
        if (ticketType.indexOf("premium") !== -1) premiumCount += 1;
        else earlyCount += 1;
      }
      early.push(earlyCount);
      premium.push(premiumCount);
    }

    return { labels: labels, early: early, premium: premium };
  }

  function formatActivityItem(icon, message, createdAt) {
    return {
      id: buildLocalId("act"),
      icon: icon,
      message: message,
      created_at: createdAt || nowIso()
    };
  }

  function addLocalActivity(eventId, icon, message) {
    var row = formatActivityItem(icon, message, nowIso());
    addEventRecord(ACTIVITY_STORAGE_KEY, eventId, row);
    return row;
  }

  function ensureDeviceToken() {
    try {
      var existing = global.localStorage.getItem(STORAGE_KEY);
      if (existing && existing.length >= 32) {
        return existing;
      }
      var next = randomHex(64);
      global.localStorage.setItem(STORAGE_KEY, next);
      return next;
    } catch (error) {
      return randomHex(64);
    }
  }

  function isConfigured() {
    var config = getConfig();
    return !!(global.supabase && config.url && config.anonKey);
  }

  function createClient(extraHeaders) {
    if (!isConfigured()) {
      return null;
    }

    var config = getConfig();
    var headers = {};
    var key;
    if (extraHeaders) {
      for (key in extraHeaders) {
        if (Object.prototype.hasOwnProperty.call(extraHeaders, key)) {
          headers[key] = extraHeaders[key];
        }
      }
    }

    return global.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: headers
      }
    });
  }

  function createVoteClient() {
    var token = ensureDeviceToken();
    return {
      token: token,
      client: createClient({ "x-device-token": token })
    };
  }

  async function resolveUser(client) {
    if (!client) return null;
    var response = await client.auth.getUser();
    if (!response || response.error) return null;
    if (!response.data || !response.data.user) return null;
    return response.data.user;
  }

  async function getCurrentUser() {
    var client = createClient(null);
    return resolveUser(client);
  }

  async function insertOne(table, payload, extraHeaders) {
    var client = createClient(extraHeaders);
    if (!client) {
      return { ok: false, reason: "not_configured", error: null };
    }

    var result = await client.from(table).insert([payload]);
    if (result.error) {
      return { ok: false, reason: "db_error", error: result.error };
    }

    return { ok: true, reason: null, error: null };
  }

  async function submitEventSubmission(payload) {
    return insertOne("event_submissions", payload, null);
  }

  async function submitCafeSubmission(payload) {
    return insertOne("cafe_submissions", payload, null);
  }

  async function submitEmailSubscription(payload) {
    var normalized = {
      email: String(payload.email || "").trim().toLowerCase(),
      source_page: payload.source_page || "unknown",
      source_context: payload.source_context || null
    };

    var result = await insertOne("email_subscribers", normalized, null);
    if (!result.ok && result.error && result.error.code === "23505") {
      return { ok: true, reason: "already_subscribed", error: null };
    }

    return result;
  }

  async function fetchSiteContent(contentKey) {
    var key = String(contentKey || "").trim().toLowerCase();
    if (!key) {
      return { ok: false, reason: "invalid_key", error: null, data: null, row: null };
    }

    var client = createClient(null);
    if (!client) {
      return { ok: false, reason: "not_configured", error: null, data: null, row: null };
    }

    var response = await client
      .from("site_content")
      .select("*")
      .eq("content_key", key)
      .limit(1)
      .maybeSingle();

    if (response.error) {
      if (response.error.code === "PGRST116") {
        return { ok: true, reason: null, error: null, data: null, row: null };
      }
      return { ok: false, reason: "db_error", error: response.error, data: null, row: null };
    }

    var row = response.data || null;
    var content = null;
    if (row && typeof row === "object") {
      if (row.content_json && typeof row.content_json === "object") content = row.content_json;
      else if (row.content && typeof row.content === "object") content = row.content;
      else if (row.payload && typeof row.payload === "object") content = row.payload;
    }

    return { ok: true, reason: null, error: null, data: content, row: row };
  }

  async function fetchEventPublicById(eventId) {
    if (!eventId) {
      return { ok: false, reason: "invalid_id", error: null, data: null };
    }

    var client = createClient(null);
    if (!client) {
      return { ok: false, reason: "not_configured", error: null, data: null };
    }

    var response = await client
      .from("events_public")
      .select("*")
      .eq("id", eventId)
      .limit(1)
      .maybeSingle();

    if (response.error) {
      if (response.error.code === "PGRST116") {
        return { ok: true, reason: null, error: null, data: null };
      }
      return { ok: false, reason: "db_error", error: response.error, data: null };
    }

    return { ok: true, reason: null, error: null, data: response.data || null };
  }

  async function fetchEventPublicByName(name) {
    if (!name) {
      return { ok: false, reason: "invalid_name", error: null, data: null };
    }

    var client = createClient(null);
    if (!client) {
      return { ok: false, reason: "not_configured", error: null, data: null };
    }

    var response = await client
      .from("events_public")
      .select("*")
      .ilike("name", "%" + String(name).trim() + "%")
      .limit(1)
      .maybeSingle();

    if (response.error) {
      if (response.error.code === "PGRST116") {
        return { ok: true, reason: null, error: null, data: null };
      }
      return { ok: false, reason: "db_error", error: response.error, data: null };
    }

    return { ok: true, reason: null, error: null, data: response.data || null };
  }

  async function fetchEventRsvps(eventId) {
    var key = normalizeEventId(eventId);
    var localRows = readEventCollection(RSVP_STORAGE_KEY, key);
    var client = createClient(null);
    if (!client || key === "default") {
      return { ok: true, reason: null, error: null, source: "local", data: localRows };
    }

    var response = await client
      .from("event_rsvps")
      .select("*")
      .eq("event_id", key)
      .order("created_at", { ascending: false });

    if (response.error) {
      return {
        ok: true,
        reason: "fallback_local",
        error: response.error,
        source: "local",
        data: localRows
      };
    }

    return { ok: true, reason: null, error: null, source: "db", data: response.data || [] };
  }

  async function submitEventRsvp(payload) {
    var key = normalizeEventId(payload && payload.event_id);
    var cleanPayload = {
      event_id: key,
      ticket_type: (payload && payload.ticket_type) || "Early Bird",
      attendee_name: (payload && payload.attendee_name) || null,
      attendee_email: normalizeEmail((payload && payload.attendee_email) || null),
      checked_in: false,
      status: "confirmed",
      source_page: (payload && payload.source_page) || "event-detail.html"
    };

    var client = createClient(null);
    var currentUser = await resolveUser(client);

    if (!cleanPayload.attendee_email && currentUser && currentUser.email) {
      cleanPayload.attendee_email = normalizeEmail(currentUser.email);
    }

    if (!cleanPayload.attendee_name && currentUser) {
      cleanPayload.attendee_name = deriveUserDisplayName(currentUser);
    }

    if (client && key !== "default") {
      var dbInsert = await client
        .from("event_rsvps")
        .insert([cleanPayload])
        .select("*")
        .limit(1)
        .maybeSingle();

      if (!dbInsert.error) {
        if (cleanPayload.attendee_email) {
          rememberUserRsvp(cleanPayload.attendee_email, dbInsert.data || cleanPayload);
        }
        addLocalActivity(key, "🎟", "New RSVP confirmed");
        return {
          ok: true,
          reason: null,
          error: null,
          source: "db",
          data: dbInsert.data || cleanPayload
        };
      }
    }

    var localRow = {
      id: buildLocalId("rsvp"),
      event_id: key,
      ticket_type: cleanPayload.ticket_type,
      attendee_name: cleanPayload.attendee_name,
      attendee_email: cleanPayload.attendee_email,
      checked_in: false,
      status: "confirmed",
      source_page: cleanPayload.source_page,
      created_at: nowIso()
    };

    addEventRecord(RSVP_STORAGE_KEY, key, localRow);
    if (cleanPayload.attendee_email) {
      rememberUserRsvp(cleanPayload.attendee_email, localRow);
    }
    addLocalActivity(key, "🎟", "New RSVP confirmed");

    return { ok: true, reason: "stored_local", error: null, source: "local", data: localRow };
  }

  async function fetchMyEventHistory() {
    var client = createClient(null);
    var user = await resolveUser(client);

    if (!user || !user.email) {
      return {
        ok: false,
        reason: "not_authenticated",
        error: null,
        source: "none",
        data: [],
        user: null
      };
    }

    var email = normalizeEmail(user.email);
    var localRows = readUserRsvpCollection(email);

    if (!client) {
      return {
        ok: true,
        reason: "fallback_local",
        error: null,
        source: "local",
        data: localRows,
        user: user
      };
    }

    var response = await client
      .from("event_rsvps")
      .select("id,event_id,ticket_type,status,checked_in,created_at,attendee_name,attendee_email")
      .ilike("attendee_email", email)
      .order("created_at", { ascending: false });

    if (response.error) {
      return {
        ok: true,
        reason: "fallback_local",
        error: response.error,
        source: "local",
        data: localRows,
        user: user
      };
    }

    var rows = Array.isArray(response.data) ? response.data : [];
    writeUserRsvpCollection(email, rows);

    return {
      ok: true,
      reason: null,
      error: null,
      source: "db",
      data: rows,
      user: user
    };
  }

  async function fetchEventPhotoDrops(eventId) {
    var key = normalizeEventId(eventId);
    var localRows = readEventCollection(DROP_STORAGE_KEY, key);
    var client = createClient(null);
    if (!client || key === "default") {
      return { ok: true, reason: null, error: null, source: "local", data: localRows };
    }

    var response = await client
      .from("event_photo_drops")
      .select("*")
      .eq("event_id", key)
      .order("created_at", { ascending: false });

    if (response.error) {
      return {
        ok: true,
        reason: "fallback_local",
        error: response.error,
        source: "local",
        data: localRows
      };
    }

    return { ok: true, reason: null, error: null, source: "db", data: response.data || [] };
  }

  async function createEventPhotoDrop(payload) {
    var key = normalizeEventId(payload && payload.event_id);
    var cleanPayload = {
      event_id: key,
      image_url: (payload && payload.image_url) || null,
      caption: (payload && payload.caption) || null,
      posted_by: (payload && payload.posted_by) || "host",
      source_page: (payload && payload.source_page) || "event-detail.html"
    };

    var client = createClient(null);
    if (client && key !== "default") {
      var dbInsert = await client
        .from("event_photo_drops")
        .insert([cleanPayload])
        .select("*")
        .limit(1)
        .maybeSingle();

      if (!dbInsert.error) {
        addLocalActivity(key, "📸", "Host shared a new photo drop");
        return {
          ok: true,
          reason: null,
          error: null,
          source: "db",
          data: dbInsert.data || cleanPayload
        };
      }
    }

    var localRow = {
      id: buildLocalId("drop"),
      event_id: key,
      image_url: cleanPayload.image_url,
      caption: cleanPayload.caption,
      posted_by: cleanPayload.posted_by,
      source_page: cleanPayload.source_page,
      created_at: nowIso()
    };

    addEventRecord(DROP_STORAGE_KEY, key, localRow);
    addLocalActivity(key, "📸", "Host shared a new photo drop");

    return { ok: true, reason: "stored_local", error: null, source: "local", data: localRow };
  }

  async function deleteEventPhotoDrop(eventId, dropId) {
    var key = normalizeEventId(eventId);
    var removedFromLocal = removeEventRecord(DROP_STORAGE_KEY, key, dropId);
    var client = createClient(null);

    if (client && key !== "default" && dropId) {
      var dbDelete = await client.from("event_photo_drops").delete().eq("id", dropId);
      if (!dbDelete.error) {
        addLocalActivity(key, "🗑", "A photo drop was removed");
        return { ok: true, reason: null, error: null, source: "db" };
      }
      if (!removedFromLocal) {
        return { ok: false, reason: "db_error", error: dbDelete.error, source: "db" };
      }
    }

    if (removedFromLocal) {
      addLocalActivity(key, "🗑", "A photo drop was removed");
      return { ok: true, reason: "removed_local", error: null, source: "local" };
    }

    return { ok: false, reason: "not_found", error: null, source: "local" };
  }

  async function fetchEventActivity(eventId) {
    var key = normalizeEventId(eventId);
    var localRows = readEventCollection(ACTIVITY_STORAGE_KEY, key);
    return { ok: true, reason: null, error: null, source: "local", data: localRows };
  }

  function recordEventView(eventId, pageName) {
    var key = normalizeEventId(eventId);
    var metrics = incrementViewMetric(key);
    addLocalActivity(key, "👁", "Viewed on " + String(pageName || "event page"));
    return { ok: true, reason: null, error: null, data: metrics };
  }

  function recordEventShare(eventId, channel) {
    var key = normalizeEventId(eventId);
    var metrics = incrementShareMetric(key, channel);
    addLocalActivity(key, "📤", "Shared via " + String(channel || "link"));
    return { ok: true, reason: null, error: null, data: metrics };
  }

  async function fetchEventDashboardSnapshot(eventId) {
    var key = normalizeEventId(eventId);

    var eventData = null;
    var byId = await fetchEventPublicById(key);
    if (byId.ok && byId.data) eventData = byId.data;
    if (!eventData) {
      var list = await fetchEventsPublic();
      if (list.ok && Array.isArray(list.data) && list.data.length > 0) {
        eventData = list.data[0];
        key = normalizeEventId(eventData.id || key);
      }
    }

    var rsvpResult = await fetchEventRsvps(key);
    var dropResult = await fetchEventPhotoDrops(key);
    var activityResult = await fetchEventActivity(key);
    var metrics = incrementViewMetric(key);

    var rsvps = Array.isArray(rsvpResult.data) ? rsvpResult.data : [];
    var drops = Array.isArray(dropResult.data) ? dropResult.data : [];
    var activity = Array.isArray(activityResult.data) ? activityResult.data : [];

    var earlyCount = 0;
    var premiumCount = 0;
    for (var i = 0; i < rsvps.length; i += 1) {
      var ticketType = String((rsvps[i] && rsvps[i].ticket_type) || "").toLowerCase();
      if (ticketType.indexOf("premium") !== -1) premiumCount += 1;
      else earlyCount += 1;
    }

    var capacity = Number((eventData && eventData.capacity) || 80);
    if (!Number.isFinite(capacity) || capacity <= 0) capacity = 80;

    var totalRsvps = rsvps.length;
    var spotsLeft = Math.max(0, capacity - totalRsvps);

    var earlyPrice = Number((eventData && eventData.early_bird_price) || (eventData && eventData.price_early) || 599);
    var premiumPrice = Number((eventData && eventData.premium_price) || (eventData && eventData.price_premium) || 999);
    if (!Number.isFinite(earlyPrice)) earlyPrice = 599;
    if (!Number.isFinite(premiumPrice)) premiumPrice = 999;

    var grossRevenue = earlyCount * earlyPrice + premiumCount * premiumPrice;
    var platformFee = Math.round(grossRevenue * 0.05);
    var paymentFee = Math.round(grossRevenue * 0.02);
    var netRevenue = Math.max(0, grossRevenue - platformFee - paymentFee);

    var upvotes = Number((eventData && eventData.upvotes) || 0);
    if (!Number.isFinite(upvotes)) upvotes = 0;

    var views = Number(metrics.views || 0);
    var shares = Number(metrics.shares || 0);
    var series = buildLast7DaySeries(rsvps);

    var shareBreakdown = metrics.share_breakdown || {};
    var sources = [
      { name: "Instagram", count: Number(shareBreakdown.instagram || 0), pct: 0, color: "#c4a0ff" },
      { name: "Direct / Link", count: Number(shareBreakdown.link || 0), pct: 0, color: "var(--accent)" },
      { name: "WhatsApp", count: Number(shareBreakdown.whatsapp || 0), pct: 0, color: "#4ade80" },
      { name: "Twitter / X", count: Number(shareBreakdown.twitter || 0), pct: 0, color: "#80c0ff" },
      { name: "Email", count: Number(shareBreakdown.email || 0), pct: 0, color: "#ff9966" }
    ];
    var sourceTotal = 0;
    for (var s = 0; s < sources.length; s += 1) sourceTotal += Number(sources[s].count || 0);
    for (var p = 0; p < sources.length; p += 1) {
      sources[p].pct = sourceTotal > 0 ? Math.round((sources[p].count / sourceTotal) * 100) : 0;
    }

    return {
      ok: true,
      reason: null,
      error: null,
      data: {
        event_id: key,
        event: eventData,
        attendees: rsvps,
        drops: drops,
        activity: activity,
        metrics: {
          views: views,
          shares: shares,
          upvotes: upvotes,
          confirmed_rsvps: totalRsvps,
          early_count: earlyCount,
          premium_count: premiumCount,
          capacity: capacity,
          spots_left: spotsLeft,
          fill_percent: Math.round((totalRsvps / capacity) * 100),
          gross_revenue: grossRevenue,
          platform_fee: platformFee,
          payment_fee: paymentFee,
          net_revenue: netRevenue
        },
        series: series,
        sources: sources,
        share_breakdown: shareBreakdown
      }
    };
  }

  async function fetchCafesPublic() {
    var client = createClient(null);
    if (!client) {
      return { ok: false, reason: "not_configured", error: null, data: [] };
    }

    var response = await client
      .from("cafes_public")
      .select("*")
      .order("curated_group", { ascending: true })
      .order("upvotes", { ascending: false })
      .order("curated_rank", { ascending: true });

    if (response.error) {
      return { ok: false, reason: "db_error", error: response.error, data: [] };
    }

    return { ok: true, reason: null, error: null, data: response.data || [] };
  }

  async function fetchEventsPublic() {
    var client = createClient(null);
    if (!client) {
      return { ok: false, reason: "not_configured", error: null, data: [] };
    }

    var response = await client
      .from("events_public")
      .select("*")
      .order("curated_group", { ascending: true })
      .order("upvotes", { ascending: false })
      .order("curated_rank", { ascending: true });

    if (response.error) {
      return { ok: false, reason: "db_error", error: response.error, data: [] };
    }

    return { ok: true, reason: null, error: null, data: response.data || [] };
  }

  async function getOwnVoteIds(kind, itemIds) {
    var field = kind === "cafe" ? "cafe_id" : "event_id";
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return { ok: true, reason: null, error: null, ids: [] };
    }

    var voteClient = createVoteClient();
    var client = voteClient.client;
    if (!client) {
      return { ok: false, reason: "not_configured", error: null, ids: [] };
    }

    var user = await resolveUser(client);
    var query = client.from("votes").select(field).in(field, itemIds);

    if (user && user.id) {
      query = query.eq("user_id", user.id);
    } else {
      query = query.eq("anon_device_token", voteClient.token);
    }

    var response = await query;
    if (response.error) {
      return { ok: false, reason: "db_error", error: response.error, ids: [] };
    }

    var ids = (response.data || [])
      .map(function (row) { return row[field]; })
      .filter(Boolean);

    return { ok: true, reason: null, error: null, ids: ids };
  }

  async function toggleVote(kind, itemId) {
    var field = kind === "cafe" ? "cafe_id" : "event_id";
    var voteClient = createVoteClient();
    var client = voteClient.client;
    if (!client) {
      return { ok: false, reason: "not_configured", error: null, voted: false };
    }

    var user = await resolveUser(client);
    var lookup = client.from("votes").select("id").eq(field, itemId).limit(1);

    if (user && user.id) {
      lookup = lookup.eq("user_id", user.id);
    } else {
      lookup = lookup.eq("anon_device_token", voteClient.token);
    }

    var existing = await lookup.maybeSingle();
    if (existing.error) {
      return { ok: false, reason: "db_error", error: existing.error, voted: false };
    }

    if (existing.data && existing.data.id) {
      var removeResult = await client.from("votes").delete().eq("id", existing.data.id);
      if (removeResult.error) {
        return { ok: false, reason: "db_error", error: removeResult.error, voted: true };
      }
      return { ok: true, reason: null, error: null, voted: false };
    }

    var payload = {};
    payload[field] = itemId;
    if (user && user.id) {
      payload.user_id = user.id;
      payload.anon_device_token = null;
    } else {
      payload.user_id = null;
      payload.anon_device_token = voteClient.token;
    }

    var insertResult = await client.from("votes").insert([payload]);
    if (insertResult.error) {
      return { ok: false, reason: "db_error", error: insertResult.error, voted: false };
    }

    return { ok: true, reason: null, error: null, voted: true };
  }

  global.HuntersBackend = {
    getConfig: getConfig,
    isConfigured: isConfigured,
    ensureDeviceToken: ensureDeviceToken,
    createClient: createClient,
    getCurrentUser: getCurrentUser,
    fetchEventPublicById: fetchEventPublicById,
    fetchEventPublicByName: fetchEventPublicByName,
    fetchCafesPublic: fetchCafesPublic,
    fetchEventsPublic: fetchEventsPublic,
    fetchMyEventHistory: fetchMyEventHistory,
    fetchEventRsvps: fetchEventRsvps,
    submitEventRsvp: submitEventRsvp,
    fetchEventPhotoDrops: fetchEventPhotoDrops,
    createEventPhotoDrop: createEventPhotoDrop,
    deleteEventPhotoDrop: deleteEventPhotoDrop,
    fetchEventActivity: fetchEventActivity,
    fetchEventDashboardSnapshot: fetchEventDashboardSnapshot,
    recordEventView: recordEventView,
    recordEventShare: recordEventShare,
    getOwnVoteIds: getOwnVoteIds,
    toggleVote: toggleVote,
    submitEventSubmission: submitEventSubmission,
    submitCafeSubmission: submitCafeSubmission,
    submitEmailSubscription: submitEmailSubscription,
    fetchSiteContent: fetchSiteContent
  };
})(window);
