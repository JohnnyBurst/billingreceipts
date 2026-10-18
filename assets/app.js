(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$("sheet")) return;
  var P = window.BRPdf;

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  var today = new Date(), due = new Date(today.getTime() + 14 * 864e5);

  var st = {
    type: "invoice", from: "Harbor Light Cleaning", fromAddr: "418 Marsh St, Austin, TX 78701 · (512) 555-0143",
    to: "Dana Whitfield", toAddr: "92 Linden Ave, Austin, TX 78704", num: "INV-0042",
    date: iso(today), due: iso(due), method: "Card", tax: 0,
    items: [{ d: "Deep clean, 3 bedroom house", q: 1, r: 240 }, { d: "Inside oven and fridge", q: 2, r: 35 }],
    notes: "Payment due within 14 days. Thank you for your business.",
    logo: "", logoW: 0, logoH: 0, noFoot: false
  };
  try {
    var pe = $("preset");
    if (pe) {
      var p = JSON.parse(pe.textContent);
      ["type", "from", "fromAddr", "to", "toAddr", "num", "tax", "method", "notes"].forEach(function (k) { if (p[k] != null) st[k] = p[k]; });
      if (p.items) st.items = p.items.map(function (i) { return { d: i.d, q: i.q, r: i.r }; });
      if (p.vehicle) { st.vehicle = { year: p.vehicle.year || "", make: p.vehicle.make || "", model: p.vehicle.model || "", vin: p.vehicle.vin || "", price: p.vehicle.price == null ? "" : p.vehicle.price }; vehItems(); }
    }
  } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var proOn = false;
  function logoOk() { return proOn && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(st.logo || "") && st.logoW > 0; }
  function pdfState() { var s = Object.assign({}, st); if (!logoOk()) s.logo = ""; s.noFoot = !!(proOn && st.noFoot); return s; }

  function vehItems() { st.items = [{ d: "Vehicle", q: 1, r: +st.vehicle.price || 0 }]; }
  var VEH = [["year", "Year", "text", "numeric"], ["make", "Make", "text", ""], ["model", "Model", "text", ""], ["vin", "VIN", "text", ""], ["price", "Price ($)", "number", "decimal"]];

  function renderItems() {
    var box = $("items"); box.innerHTML = "";
    var veh = !!st.vehicle;
    if ($("itemsHdr")) $("itemsHdr").hidden = veh;
    $("addItem").parentNode.hidden = veh;
    if ($("itemsLegend")) $("itemsLegend").textContent = veh ? "Vehicle" : "Line items";
    if (veh) {
      var g = document.createElement("div"); g.className = "grid2";
      VEH.forEach(function (f) {
        var l = document.createElement("label"); l.setAttribute("for", "v-" + f[0]); l.appendChild(document.createTextNode(f[1]));
        var inp = document.createElement("input"); inp.id = "v-" + f[0]; inp.type = f[2]; inp.autocomplete = "off"; inp.value = st.vehicle[f[0]];
        if (f[2] === "number") { inp.min = "0"; inp.step = "any"; }
        if (f[3]) inp.inputMode = f[3];
        if (f[0] === "vin") { inp.maxLength = 17; inp.style.textTransform = "uppercase"; }
        inp.addEventListener("input", function () { st.vehicle[f[0]] = f[0] === "vin" ? inp.value.toUpperCase() : inp.value; vehItems(); renderSheet(); });
        l.appendChild(inp); g.appendChild(l);
      });
      box.appendChild(g); return;
    }
    st.items.forEach(function (it, idx) {
      var row = document.createElement("div"); row.className = "item";
      row.innerHTML = '<input aria-label="Description, line ' + (idx + 1) + '" value="' + esc(it.d) + '" data-k="d">' +
        '<input aria-label="Quantity, line ' + (idx + 1) + '" type="number" min="0" step="any" inputmode="decimal" value="' + esc(it.q) + '" data-k="q">' +
        '<input aria-label="Rate, line ' + (idx + 1) + '" type="number" min="0" step="any" inputmode="decimal" value="' + esc(it.r) + '" data-k="r">' +
        '<button type="button" class="x" aria-label="Remove line ' + (idx + 1) + '">&times;</button>';
      row.querySelectorAll("input").forEach(function (inp) {
        inp.addEventListener("input", function () { it[inp.getAttribute("data-k")] = inp.value; renderSheet(); });
      });
      row.querySelector(".x").addEventListener("click", function () {
        if (st.items.length > 1) { st.items.splice(idx, 1); renderItems(); renderSheet(); }
      });
      box.appendChild(row);
    });
  }

  function renderSheet() {
    var t = P.totals(st), rc = st.type === "receipt", lg = logoOk();
    var rows = st.items.map(function (i) {
      var q = +i.q || 0, r = +i.r || 0;
      return "<tr><td>" + esc(i.d || "Item") + "</td><td>" + q + "</td><td>" + P.money(r) + "</td><td>" + P.money(q * r) + "</td></tr>";
    }).join("");
    var head = "<tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>";
    if (st.vehicle) {
      var v = st.vehicle;
      head = "<tr><th colspan=\"2\">Vehicle</th><th></th><th>Amount</th></tr>";
      rows = [["Year", v.year], ["Make", v.make], ["Model", v.model], ["VIN", v.vin]].map(function (x) { return '<tr><td colspan="3"><span style="opacity:.65">' + x[0] + "</span> &nbsp; " + esc(x[1] || "") + "</td><td></td></tr>"; }).join("") +
        '<tr><td colspan="3"><b>Price</b></td><td>' + P.money(+v.price || 0) + "</td></tr>";
    }
    $("sheet").innerHTML =
      '<div class="stamp"' + (rc ? "" : " hidden") + ">PAID</div>" +
      '<div class="sh"><div>' + (lg ? '<img class="logo" alt="" src="' + st.logo + '">' : "") + '<div class="kind">' + (rc ? "Receipt" : "Invoice") + "</div></div>" +
      '<div class="num"><div><span>No.</span> ' + esc(st.num) + "</div><div><span>Date</span> " + esc(P.fdate(st.date)) + "</div>" +
      (rc ? "<div><span>Paid by</span> " + esc(st.method) + "</div>" : "<div><span>Due</span> " + esc(P.fdate(st.due)) + "</div>") + "</div></div>" +
      '<div class="parties"><div><b>From</b>' + esc(st.from) + "<br>" + esc(st.fromAddr) + "</div><div><b>" + (rc ? "Received from" : "Bill to") + "</b>" + esc(st.to) + "<br>" + esc(st.toAddr) + "</div></div>" +
      '<div class="tbl"><table><thead>' + head + '</thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="totals"><div><span>Subtotal</span><span>' + P.money(t.sub) + "</span></div>" +
      ((+st.tax) ? "<div><span>Tax (" + (+st.tax) + "%)</span><span>" + P.money(t.tax) + "</span></div>" : "") +
      '<div class="grand"><span>' + (rc ? "Total paid" : "Total due") + "</span><span>" + P.money(t.total) + "</span></div></div>" +
      (st.notes ? '<div class="notes">' + esc(st.notes) + "</div>" : "") +
      (proOn && st.noFoot ? "" : '<div class="mark"><span>billingreceipts.com</span><span>Created with BillingReceipts</span></div>');
  }

  function syncForm() {
    $("f-from").value = st.from; $("f-fromAddr").value = st.fromAddr; $("f-to").value = st.to; $("f-toAddr").value = st.toAddr;
    $("f-num").value = st.num; $("f-date").value = st.date; $("f-due").value = st.due; $("f-method").value = st.method;
    $("f-tax").value = st.tax; $("f-notes").value = st.notes; $("f-nofoot").checked = !!st.noFoot;
    var rc = st.type === "receipt";
    $("t-invoice").setAttribute("aria-pressed", rc ? "false" : "true");
    $("t-receipt").setAttribute("aria-pressed", rc ? "true" : "false");
    $("w-due").hidden = rc; $("w-method").hidden = !rc;
    $("l-num").textContent = rc ? "Receipt number" : "Invoice number";
  }

  var map = { "f-from": "from", "f-fromAddr": "fromAddr", "f-to": "to", "f-toAddr": "toAddr", "f-num": "num", "f-date": "date", "f-due": "due", "f-method": "method", "f-tax": "tax", "f-notes": "notes" };
  Object.keys(map).forEach(function (id) {
    $(id).addEventListener(id === "f-method" ? "change" : "input", function () { st[map[id]] = $(id).value; renderSheet(); });
  });

  function setType(t) {
    st.type = t;
    if (t === "receipt" && /^INV/.test(st.num)) st.num = st.num.replace(/^INV/, "RCT");
    if (t === "invoice" && /^RCT/.test(st.num)) st.num = st.num.replace(/^RCT/, "INV");
    syncForm(); renderSheet();
  }
  $("t-invoice").addEventListener("click", function () { setType("invoice"); });
  $("t-receipt").addEventListener("click", function () { setType("receipt"); });
  $("addItem").addEventListener("click", function () {
    st.items.push({ d: "", q: 1, r: 0 }); renderItems(); renderSheet();
    var ins = $("items").querySelectorAll('input[data-k="d"]'); ins[ins.length - 1].focus();
  });

  var msg = $("copyMsg");
  function say(s, linkText) {
    msg.textContent = s;
    if (linkText) { msg.appendChild(document.createTextNode(" ")); var l = document.createElement("a"); l.href = "#howPro"; l.textContent = linkText; msg.appendChild(l); }
  }

  function plain() {
    var t = P.totals(st), rc = st.type === "receipt", L = [];
    L.push((rc ? "RECEIPT " : "INVOICE ") + st.num);
    L.push("Date: " + P.fdate(st.date));
    L.push(rc ? "Paid by: " + st.method : "Due: " + P.fdate(st.due));
    L.push(""); L.push("From: " + st.from + (st.fromAddr ? ", " + st.fromAddr : ""));
    L.push((rc ? "Received from: " : "Bill to: ") + st.to + (st.toAddr ? ", " + st.toAddr : ""));
    L.push("");
    if (st.vehicle) { var v = st.vehicle; L.push("Year: " + v.year); L.push("Make: " + v.make); L.push("Model: " + v.model); L.push("VIN: " + v.vin); L.push("Price: " + P.money(+v.price || 0)); }
    else st.items.forEach(function (i) { var q = +i.q || 0, r = +i.r || 0; L.push((i.d || "Item") + " | " + q + " x " + P.money(r) + " = " + P.money(q * r)); });
    L.push(""); L.push("Subtotal: " + P.money(t.sub));
    if (+st.tax) L.push("Tax (" + (+st.tax) + "%): " + P.money(t.tax));
    L.push((rc ? "Total paid: " : "Total due: ") + P.money(t.total));
    if (st.notes) { L.push(""); L.push(st.notes); }
    return L.join("\n");
  }

  $("copyBtn").addEventListener("click", function () {
    var text = plain();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      say(ok ? "Copied to your clipboard." : "Copy was blocked. Select the document and copy it manually.");
    }
    try { navigator.clipboard.writeText(text).then(function () { say("Copied to your clipboard."); }, fallback); } catch (e) { fallback(); }
  });

  $("printBtn").addEventListener("click", function () { window.print(); });

  $("pdfBtn").addEventListener("click", function () {
    var lib = window.jspdf && window.jspdf.jsPDF;
    if (!lib) { say("The PDF library did not load. Use Print, then choose Save as PDF."); return; }
    try {
      var doc = new lib({ unit: "pt", format: "letter" });
      P.buildPdf(doc, pdfState());
      var name = (st.type + "-" + (st.num || "document")).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") + ".pdf";
      doc.save(name);
      say("Downloaded " + name + ".");
    } catch (e) {
      say("Could not build the PDF. Use Print, then choose Save as PDF.");
    }
  });

  // Saved documents: browser-only by default, cloud when signed in
  var FREE_LIMIT = 10, KEY = "br.docs.v1", curId = null, cloud = window.BRCloud, cdocs = [], authMsg = "";
  function load() { try { var d = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(d) ? d : []; } catch (e) { return null; } }
  function store(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function online() { return cloud && cloud.signedIn(); }

  function fetchCloud() {
    return cloud.list().then(function (rows) {
      cdocs = rows.map(function (r) { return { id: r.id, saved: Date.parse(r.updated_at) || 0, st: r.data && r.data.st }; }).filter(function (d) { return d.st; });
    });
  }
  function docs() { return online() ? cdocs : (load() || []); }

  function renderAuth() {
    var bar = $("authBar"); if (!bar) return;
    var hs = $("hSign"); if (hs) hs.hidden = !cloud || online();
    if (!cloud) { bar.innerHTML = '<p class="hint">Saved in this browser only. Clearing site data removes them.</p>'; return; }
    if (online()) {
      bar.innerHTML = '<p class="hint">Synced to your account: <b>' + esc(cloud.email()) + '</b> <button type="button" class="link" id="outBtn">Sign out</button></p>';
      $("outBtn").addEventListener("click", function () { cloud.signOut(); cdocs = []; curId = null; renderAuth(); renderSaved(); refreshPro(); say("Signed out. Saved documents in your account are kept."); });
    } else {
      bar.innerHTML = '<p class="hint">Saved in this browser only. Sign in to keep them across devices. No password: we email you a link.</p>' +
        '<form id="authForm" class="authform"><input type="email" id="authEmail" required autocomplete="email" placeholder="you@example.com" aria-label="Email address"><button class="btn" type="submit">Email me a link</button></form>' +
        (authMsg ? '<p class="hint" role="status">' + esc(authMsg) + "</p>" : "");
      $("authForm").addEventListener("submit", function (e) {
        e.preventDefault(); var em = $("authEmail").value.trim(); if (!em) return;
        authMsg = "Sending..."; renderAuth();
        cloud.sendLink(em).then(function () { authMsg = "Check " + em + " for a sign-in link. It opens this page."; renderAuth(); },
          function (err) { authMsg = "Could not send the link: " + err.message; renderAuth(); });
      });
    }
  }

  function renderSaved() {
    var list = docs(), ul = $("savedList"); if (!ul) return;
    ul.innerHTML = "";
    if (!list.length) { ul.innerHTML = '<li class="empty">Nothing saved yet. Press Save above.</li>'; }
    list.slice().sort(function (a, b) { return b.saved - a.saved; }).forEach(function (d) {
      var t = P.totals(d.st), li = document.createElement("li");
      var title = (d.st.type === "receipt" ? "Receipt " : "Invoice ") + esc(d.st.num) + " · " + esc(d.st.to || "No client");
      li.innerHTML = '<div><b>' + title + '</b><span>' + P.money(t.total) + " · " + new Date(d.saved).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + '</span></div>' +
        '<div class="acts"><button type="button" class="btn sm" data-a="open">Open</button><button type="button" class="btn sm" data-a="dup">Duplicate</button><button type="button" class="btn sm" data-a="del" aria-label="Delete">Delete</button></div>';
      li.addEventListener("click", function (e) {
        var a = e.target.getAttribute && e.target.getAttribute("data-a"); if (!a) return;
        if (a === "open") { st = copy(d.st); curId = d.id; syncForm(); renderItems(); renderSheet(); say("Opened " + st.num + "."); window.scrollTo({ top: 0, behavior: "smooth" }); }
        if (a === "dup") { if (online() && cdocs.length >= FREE_LIMIT) { say("Free accounts sync up to " + FREE_LIMIT + " documents. Delete one first.", "How to get Pro"); return; }
          var c = copy(d.st); c.num = c.num + "-copy"; persist(uuid(), c, "Duplicated."); }
        if (a === "del") {
          if (online()) { cloud.remove(d.id).then(function () { cdocs = cdocs.filter(function (x) { return x.id !== d.id; }); if (curId === d.id) curId = null; renderSaved(); say("Deleted."); }, function (er) { say("Could not delete: " + er.message); }); }
          else { store((load() || []).filter(function (x) { return x.id !== d.id; })); if (curId === d.id) curId = null; renderSaved(); say("Deleted."); }
        }
      });
      ul.appendChild(li);
    });
  }

  function persist(id, snapshot, okMsg) {
    if (online()) {
      return cloud.save(id, { st: snapshot }).then(function () {
        var i = cdocs.findIndex(function (x) { return x.id === id; }), rec = { id: id, saved: Date.now(), st: snapshot };
        if (i >= 0) cdocs[i] = rec; else cdocs.push(rec);
        renderSaved(); say(okMsg || "Saved to your account.");
      }, function (er) { say("Could not save to your account: " + er.message); });
    }
    var list = load();
    if (list === null) { say("Saving is blocked in this browser."); return; }
    var rec2 = { id: id, saved: Date.now(), st: snapshot }, i2 = list.findIndex(function (x) { return x.id === id; });
    if (i2 >= 0) list[i2] = rec2; else list.push(rec2);
    say(store(list) ? (okMsg || "Saved in this browser. Sign in below to keep it across devices.") : "Could not save. Browser storage may be full or blocked.");
    renderSaved();
  }

  $("saveBtn").addEventListener("click", function () {
    var id = curId;
    if (online() && id && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id)) id = null;
    if (online() && !cdocs.some(function (x) { return x.id === id; }) && cdocs.length >= FREE_LIMIT) {
      say("Free accounts sync up to " + FREE_LIMIT + " documents. Delete one to save another, or get unlimited sync with Pro" + (PRO_PUBLIC ? "." : " (coming soon).") + "", "How to get Pro"); return;
    }
    if (!id) id = online() ? uuid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    curId = id; persist(id, copy(st));
  });

  // Move browser-saved documents into the account once, after sign-in
  function migrate() {
    var local = load() || []; if (!local.length) return Promise.resolve();
    return Promise.all(local.map(function (d) { return cloud.save(uuid(), { st: d.st }); })).then(function () {
      store([]); return fetchCloud().then(function () { say("Moved " + local.length + " saved document" + (local.length === 1 ? "" : "s") + " into your account."); });
    }, function () {});
  }

  // Pro tools: saved clients, logo, footer removal (unlocked by plan = pro)
  var clients = [], LK = "br.logo.v1";
  var PRO_PUBLIC = document.documentElement.getAttribute("data-pro") === "live"; // set by PRO_LIVE in build.js
  function testFlag() {
    try { if (/[?&]pro=1/.test(location.search)) localStorage.setItem("br.pro.test", "1"); return localStorage.getItem("br.pro.test") === "1"; }
    catch (e) { return /[?&]pro=1/.test(location.search); }
  }
  function setPro(on) {
    proOn = on;
    var showBuy = PRO_PUBLIC || testFlag();
    $("upRow").hidden = !(showBuy && online() && !on);
    $("mgRow").hidden = !(online() && on);
    var hp = $("howPro"); if (hp) {
      hp.hidden = on;
      $("howNote").textContent = showBuy ? (online() ? "You are signed in. Pick a plan below." : "Start with step 1.") : (PRO_PUBLIC ? "" : "Pro goes on sale soon. ") + "These are the steps.";
      $("hpRow").hidden = !(showBuy && online() && !on);
    }
    ["f-client", "saveClient", "delClient", "f-logo", "rmLogo", "f-nofoot"].forEach(function (id) { $(id).disabled = !on; });
    $("proBox").classList.toggle("locked", !on);
    $("proBox").classList.toggle("on", on);
    $("proBadge").textContent = on ? "Active" : "Locked";
    $("proNote").innerHTML = on ? "\u2713 Pro is active. These tools are ready to use." : (online() ? (PRO_PUBLIC ? "These unlock with a Pro plan. " : "These unlock with a Pro plan, coming soon. ") : (PRO_PUBLIC ? "Sign in and get Pro to use these. " : "Sign in to use these once Pro is available. ")) + '<a href="#howPro">How to get Pro</a>';
    renderClients(); renderSheet();
  }
  function renderClients() {
    var sel = $("f-client"), cur = sel.value;
    sel.innerHTML = '<option value="">Choose a saved client</option>' + clients.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.data.name) + "</option>"; }).join("");
    sel.value = cur;
  }
  function refreshPro() {
    if (!online()) { clients = []; setPro(false); return Promise.resolve(); }
    return cloud.plan().then(function (pl) {
      if (pl !== "pro") { setPro(false); return; }
      return cloud.clients().then(function (rows) { clients = rows.filter(function (r) { return r.data && r.data.name; }); }).then(function () {
        setPro(true);
        try { var lg = JSON.parse(localStorage.getItem(LK) || "null"); if (lg && !st.logo) { st.logo = lg.u; st.logoW = lg.w; st.logoH = lg.h; renderSheet(); } } catch (e) {}
      });
    }).catch(function () { setPro(false); });
  }
  $("f-client").addEventListener("change", function () {
    var c = clients.find(function (x) { return x.id === $("f-client").value; }); if (!c) return;
    st.to = c.data.name; st.toAddr = c.data.addr || ""; syncForm(); renderSheet();
  });
  $("saveClient").addEventListener("click", function () {
    if (!st.to.trim()) { say("Enter a client name first."); return; }
    var ex = clients.find(function (x) { return x.data.name.toLowerCase() === st.to.trim().toLowerCase(); });
    var id = ex ? ex.id : uuid(), data = { name: st.to.trim(), addr: st.toAddr };
    cloud.saveClient(id, data).then(function () {
      if (ex) ex.data = data; else clients.unshift({ id: id, data: data });
      renderClients(); $("f-client").value = id; say("Client saved.");
    }, function (e) { say("Could not save client: " + e.message); });
  });
  $("delClient").addEventListener("click", function () {
    var id = $("f-client").value; if (!id) { say("Choose a client to remove."); return; }
    cloud.removeClient(id).then(function () { clients = clients.filter(function (x) { return x.id !== id; }); renderClients(); say("Client removed."); }, function (e) { say("Could not remove: " + e.message); });
  });
  function go(p, msgText) { say(msgText); p.then(function (u) { location.href = u; }, function (e) { say("Could not open that page: " + e.message); }); }
  $("upM").addEventListener("click", function () { go(cloud.checkout("month"), "Opening secure checkout..."); });
  $("upY").addEventListener("click", function () { go(cloud.checkout("year"), "Opening secure checkout..."); });
  $("hpM").addEventListener("click", function () { go(cloud.checkout("month"), "Opening secure checkout..."); });
  $("hpY").addEventListener("click", function () { go(cloud.checkout("year"), "Opening secure checkout..."); });
  $("hpSign").addEventListener("click", function (e) { e.preventDefault(); if (online()) { say("You are already signed in."); return; } var b = $("authBar"); b.scrollIntoView({ behavior: "smooth", block: "center" }); var i = $("authEmail"); if (i) i.focus({ preventScroll: true }); });
  $("mgBtn").addEventListener("click", function () { go(cloud.portal(), "Opening your billing page..."); });
  $("f-nofoot").addEventListener("change", function () { st.noFoot = $("f-nofoot").checked; renderSheet(); });
  $("f-logo").addEventListener("change", function () {
    var f = $("f-logo").files && $("f-logo").files[0]; if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { say("Use a PNG or JPG image."); return; }
    if (f.size > 4e6) { say("That image is too large. Use one under 4 MB."); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, 360 / im.width, 120 / im.height), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
        var cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(im, 0, 0, w, h);
        st.logo = cv.toDataURL("image/png"); st.logoW = w; st.logoH = h;
        try { localStorage.setItem(LK, JSON.stringify({ u: st.logo, w: w, h: h })); } catch (e) {}
        renderSheet(); say("Logo added.");
      };
      im.onerror = function () { say("Could not read that image."); };
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  $("rmLogo").addEventListener("click", function () { st.logo = ""; st.logoW = st.logoH = 0; try { localStorage.removeItem(LK); } catch (e) {} $("f-logo").value = ""; renderSheet(); say("Logo removed."); });
  setPro(false);
  if (/[?&]upgraded=1/.test(location.search)) {
    say("Thanks! Activating your Pro plan...");
    var tries = 0;
    (function poll() {
      if (!online()) { if (tries++ < 10) setTimeout(poll, 1000); return; }
      refreshPro().then(function () { if (proOn) { say("You're on Pro. Your Pro tools are on."); history.replaceState(null, "", location.pathname); } else if (tries++ < 8) setTimeout(poll, 2500); else say("Payment received. Your plan may take a minute to appear. Refresh if it doesn't."); });
    })();
  }

  if ($("hSignLink")) $("hSignLink").addEventListener("click", function (e) { e.preventDefault(); var b = $("authBar"); b.scrollIntoView({ behavior: "smooth", block: "center" }); var i = $("authEmail"); if (i) i.focus({ preventScroll: true }); });
  renderAuth();
  if (cloud) cloud.init().then(function () {
    renderAuth();
    if (online()) return fetchCloud().then(migrate).then(renderSaved).then(refreshPro);
  }).catch(function () { renderAuth(); });

  syncForm(); renderItems(); renderSheet(); renderSaved();
})();
