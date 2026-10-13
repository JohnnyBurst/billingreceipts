/* PDF layout for invoices and receipts. Works with a jsPDF document (window.jspdf.jsPDF). */
(function (root) {
  function clean(s) {
    return String(s == null ? "" : s)
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-").replace(/•/g, "-")
      .replace(/[^\x20-\x7E -ÿ\n]/g, "?");
  }
  function money(n) {
    n = isFinite(n) ? n : 0;
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function totals(st) {
    var sub = 0;
    st.items.forEach(function (i) { sub += (+i.q || 0) * (+i.r || 0); });
    var tax = sub * ((+st.tax || 0) / 100);
    return { sub: sub, tax: tax, total: sub + tax };
  }
  function fdate(v) {
    if (!v) return "";
    var p = String(v).split("-");
    if (p.length < 3) return v;
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function buildPdf(doc, st) {
    var W = 612, H = 792, M = 54, R = W - M;
    var INK = [20, 32, 46], MUTE = [107, 120, 134], LINE = [217, 222, 228], GREEN = [11, 110, 79];
    var rc = st.type === "receipt";
    var t = totals(st);
    var y;

    function txt(s, x, yy, opt) { doc.text(clean(s), x, yy, opt); }
    function label(s, x, yy) {
      doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(MUTE[0], MUTE[1], MUTE[2]);
      txt(String(s).toUpperCase(), x, yy);
    }
    function tableHeader(yy) {
      label("Description", M, yy);
      doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(MUTE[0], MUTE[1], MUTE[2]);
      txt("QTY", 400, yy, { align: "right" }); txt("RATE", 478, yy, { align: "right" }); txt("AMOUNT", R, yy, { align: "right" });
      doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(1);
      doc.line(M, yy + 6, R, yy + 6);
      return yy + 22;
    }

    // Title and meta
    doc.setFont("helvetica", "bold"); doc.setFontSize(28); doc.setTextColor(INK[0], INK[1], INK[2]);
    txt(rc ? "Receipt" : "Invoice", M, 84);
    if (rc) {
      doc.setFontSize(22); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
      txt("PAID", M + 150, 86, { angle: 8 });
    }
    doc.setFont("courier", "normal"); doc.setFontSize(9.5); doc.setTextColor(INK[0], INK[1], INK[2]);
    txt("No. " + st.num, R, 66, { align: "right" });
    txt("Date: " + fdate(st.date), R, 80, { align: "right" });
    txt(rc ? "Paid by: " + st.method : "Due: " + fdate(st.due), R, 94, { align: "right" });

    // Parties
    y = 140;
    var colB = M + 280, maxY = y;
    [[M, "From", st.from, st.fromAddr], [colB, rc ? "Received from" : "Bill to", st.to, st.toAddr]].forEach(function (c) {
      var yy = y; label(c[1], c[0], yy); yy += 15;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.splitTextToSize(clean(c[2] || ""), 230).forEach(function (l) { doc.text(l, c[0], yy); yy += 14; });
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.splitTextToSize(clean(c[3] || ""), 230).forEach(function (l) { doc.text(l, c[0], yy); yy += 13; });
      if (yy > maxY) maxY = yy;
    });

    // Table
    y = tableHeader(maxY + 26);
    st.items.forEach(function (it) {
      var q = +it.q || 0, r = +it.r || 0;
      var lines = doc.splitTextToSize(clean(it.d || "Item"), 290);
      var rowH = lines.length * 13 + 10;
      if (y + rowH > H - 130) { doc.addPage(); y = tableHeader(M + 20); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(INK[0], INK[1], INK[2]);
      lines.forEach(function (l, i) { doc.text(l, M, y + i * 13); });
      txt(String(q), 400, y, { align: "right" });
      txt(money(r), 478, y, { align: "right" });
      txt(money(q * r), R, y, { align: "right" });
      y += rowH - 4;
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.5);
      doc.line(M, y, R, y);
      y += 14;
    });

    // Totals
    if (y + 90 > H - 60) { doc.addPage(); y = M + 20; }
    y += 6;
    var lx = R - 170;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(INK[0], INK[1], INK[2]);
    txt("Subtotal", lx, y); txt(money(t.sub), R, y, { align: "right" }); y += 16;
    if (+st.tax) { txt("Tax (" + (+st.tax) + "%)", lx, y); txt(money(t.tax), R, y, { align: "right" }); y += 16; }
    doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(1);
    doc.line(lx, y - 6, R, y - 6);
    y += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    txt(rc ? "Total paid" : "Total due", lx, y); txt(money(t.total), R, y, { align: "right" });
    y += 34;

    // Notes
    if (st.notes) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(68, 81, 95);
      doc.splitTextToSize(clean(st.notes), W - 2 * M).forEach(function (l) {
        if (y > H - 60) { doc.addPage(); y = M + 20; }
        doc.text(l, M, y); y += 12.5;
      });
    }

    // Footer on every page
    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(MUTE[0], MUTE[1], MUTE[2]);
      doc.text("Created with BillingReceipts - billingreceipts.com", M, H - 36);
      doc.text("Page " + p + " of " + n, R, H - 36, { align: "right" });
    }
    return doc;
  }

  var api = { buildPdf: buildPdf, totals: totals, money: money, fdate: fdate, clean: clean };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BRPdf = api;
})(typeof window !== "undefined" ? window : globalThis);
