/* Optional sign-in (email magic link) and cloud-saved documents via Supabase REST. Falls back to browser-only saving. */
(function (root) {
  var URL_ = "https://vbhcpaidilscgrhhbpno.supabase.co";
  var KEY = "sb_publishable_F7J1zBCig49ylQWYBrMmsg_GtZ4A1RT"; // publishable key, safe to expose
  var SK = "br.session.v1";
  var session = null;

  function rd() { try { return JSON.parse(localStorage.getItem(SK) || "null"); } catch (e) { return null; } }
  function wr(s) { try { if (s) localStorage.setItem(SK, JSON.stringify(s)); else localStorage.removeItem(SK); } catch (e) {} }

  function hdr(auth) {
    var h = { apikey: KEY, "Content-Type": "application/json" };
    h.Authorization = "Bearer " + (auth && session ? session.access_token : KEY);
    return h;
  }
  function fx(path, opt, auth) {
    opt = opt || {}; opt.headers = Object.assign(hdr(auth), opt.headers || {});
    return fetch(URL_ + path, opt).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var err = new Error((j && (j.msg || j.message || j.error_description || j.error)) || ("HTTP " + r.status)); err.status = r.status; throw err; }
        return j;
      });
    });
  }

  function fn(name, body) {
    return fetch(URL_ + "/functions/v1/" + name, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + (session ? session.access_token : ""), "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.url) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }

  function setFrom(j) {
    session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (+j.expires_in || 3600)), email: (j.user && j.user.email) || (session && session.email) || "" };
    wr(session);
  }

  // Pick up a magic-link return: #access_token=...&refresh_token=...
  function fromHash() {
    var h = location.hash || "";
    if (h.indexOf("access_token=") < 0) return Promise.resolve();
    var p = new URLSearchParams(h.replace(/^#/, ""));
    var at = p.get("access_token"), rt = p.get("refresh_token");
    history.replaceState(null, "", location.pathname + location.search);
    if (!at || !rt) return Promise.resolve();
    session = { access_token: at, refresh_token: rt, expires_at: +p.get("expires_at") || (Math.floor(Date.now() / 1000) + (+p.get("expires_in") || 3600)), email: "" };
    return fx("/auth/v1/user", {}, true).then(function (u) { session.email = u.email || ""; wr(session); }).catch(function () { session = null; wr(null); });
  }

  function refresh() {
    if (!session) return Promise.resolve(false);
    if (session.expires_at - 60 > Date.now() / 1000) return Promise.resolve(true);
    return fx("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) })
      .then(function (j) { setFrom(j); return true; })
      .catch(function (e) { if (e.status === 400 || e.status === 401) { session = null; wr(null); } return false; });
  }

  var api = {
    init: function () { session = rd(); return fromHash().then(refresh).then(function () { return api.email(); }); },
    email: function () { return session ? (session.email || "Signed in") : null; },
    signedIn: function () { return !!session; },
    sendLink: function (email) {
      var back = location.origin + location.pathname;
      return fx("/auth/v1/otp?redirect_to=" + encodeURIComponent(back), { method: "POST", body: JSON.stringify({ email: email, create_user: true }) });
    },
    signOut: function () {
      var s = session; session = null; wr(null);
      if (s) fetch(URL_ + "/auth/v1/logout", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + s.access_token } }).catch(function () {});
    },
    list: function () {
      return refresh().then(function () { return fx("/rest/v1/documents?select=id,data,updated_at&order=updated_at.desc", {}, true); });
    },
    save: function (id, data) {
      return refresh().then(function () {
        return fx("/rest/v1/documents?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: id, data: data, updated_at: new Date().toISOString() }) }, true);
      });
    },
    checkout: function (interval) {
      return refresh().then(function () { return fn("create-checkout", { interval: interval }); }).then(function (r) { return r.url; });
    },
    portal: function () {
      return refresh().then(function () { return fn("billing-portal", {}); }).then(function (r) { return r.url; });
    },
    plan: function () {
      return refresh().then(function () { return fx("/rest/v1/profiles?select=plan", {}, true); }).then(function (r) { return (r && r[0] && r[0].plan) || "free"; });
    },
    clients: function () {
      return refresh().then(function () { return fx("/rest/v1/clients?select=id,data&order=updated_at.desc", {}, true); });
    },
    saveClient: function (id, data) {
      return refresh().then(function () { return fx("/rest/v1/clients?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: id, data: data, updated_at: new Date().toISOString() }) }, true); });
    },
    removeClient: function (id) {
      return refresh().then(function () { return fx("/rest/v1/clients?id=eq." + encodeURIComponent(id), { method: "DELETE" }, true); });
    },
    remove: function (id) {
      return refresh().then(function () { return fx("/rest/v1/documents?id=eq." + encodeURIComponent(id), { method: "DELETE" }, true); });
    }
  };
  root.BRCloud = api;
})(window);
