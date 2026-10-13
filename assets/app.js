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
    notes: "Payment due within 14 days. Thank you for your business."
  };
  try {
    var pe = $("preset");
    if (pe) {
      var p = JSON.parse(pe.textContent);
      ["type", "from", "fromAddr", "to", "toAddr", "num", "tax", "method", "notes"].forEach(function (k) { if (p[k] != null) st[k] = p[k]; });
      if (p.items) st.items = p.items.map(function (i) { return { d: i.d, q: i.q, r: i.r }; });
    }
  } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function renderItems() {
    var box = $("items"); box.innerHTML = "";
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
    var t = P.totals(st), rc = st.type === "receipt";
    var rows = st.items.map(function (i) {
      var q = +i.q || 0, r = +i.r || 0;
      return "<tr><td>" + esc(i.d || "Item") + "</td><td>" + q + "</td><td>" + P.money(r) + "</td><td>" + P.money(q * r) + "</td></tr>";
    }).join("");
    $("sheet").innerHTML =
      '<div class="stamp"' + (rc ? "" : " hidden") + ">PAID</div>" +
      '<div class="sh"><div><div class="kind">' + (rc ? "Receipt" : "Invoice") + "</div></div>" +
      '<div class="num"><div><span>No.</span> ' + esc(st.num) + "</div><div><span>Date</span> " + esc(P.fdate(st.date)) + "</div>" +
      (rc ? "<div><span>Paid by</span> " + esc(st.method) + "</div>" : "<div><span>Due</span> " + esc(P.fdate(st.due)) + "</div>") + "</div></div>" +
      '<div class="parties"><div><b>From</b>' + esc(st.from) + "<br>" + esc(st.fromAddr) + "</div><div><b>" + (rc ? "Received from" : "Bill to") + "</b>" + esc(st.to) + "<br>" + esc(st.toAddr) + "</div></div>" +
      '<div class="tbl"><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="totals"><div><span>Subtotal</span><span>' + P.money(t.sub) + "</span></div>" +
      ((+st.tax) ? "<div><span>Tax (" + (+st.tax) + "%)</span><span>" + P.money(t.tax) + "</span></div>" : "") +
      '<div class="grand"><span>' + (rc ? "Total paid" : "Total due") + "</span><span>" + P.money(t.total) + "</span></div></div>" +
      (st.notes ? '<div class="notes">' + esc(st.notes) + "</div>" : "") +
      '<div class="mark"><span>billingreceipts.com</span><span>Created with BillingReceipts</span></div>';
  }

  function syncForm() {
    $("f-from").value = st.from; $("f-fromAddr").value = st.fromAddr; $("f-to").value = st.to; $("f-toAddr").value = st.toAddr;
    $("f-num").value = st.num; $("f-date").value = st.date; $("f-due").value = st.due; $("f-method").value = st.method;
    $("f-tax").value = st.tax; $("f-notes").value = st.notes;
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
  function say(s) { msg.textContent = s; }

  function plain() {
    var t = P.totals(st), rc = st.type === "receipt", L = [];
    L.push((rc ? "RECEIPT " : "INVOICE ") + st.num);
    L.push("Date: " + P.fdate(st.date));
    L.push(rc ? "Paid by: " + st.method : "Due: " + P.fdate(st.due));
    L.push(""); L.push("From: " + st.from + (st.fromAddr ? ", " + st.fromAddr : ""));
    L.push((rc ? "Received from: " : "Bill to: ") + st.to + (st.toAddr ? ", " + st.toAddr : ""));
    L.push("");
    st.items.forEach(function (i) { var q = +i.q || 0, r = +i.r || 0; L.push((i.d || "Item") + " | " + q + " x " + P.money(r) + " = " + P.money(q * r)); });
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
      P.buildPdf(doc, st);
      var name = (st.type + "-" + (st.num || "document")).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") + ".pdf";
      doc.save(name);
      say("Downloaded " + name + ".");
    } catch (e) {
      say("Could not build the PDF. Use Print, then choose Save as PDF.");
    }
  });

  syncForm(); renderItems(); renderSheet();
})();
