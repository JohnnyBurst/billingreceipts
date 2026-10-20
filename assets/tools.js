(function () {
  var root = document.querySelector("[data-tool]");
  if (!root) return;
  var tool = root.getAttribute("data-tool");
  var $ = function (id) { return document.getElementById(id); };
  var out = $("out");
  function n(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : 0; }
  function money(x) { return "$" + (isFinite(x) ? x : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rows(list, grand) {
    out.innerHTML = list.map(function (r, i) { return '<div class="rr' + (grand && i === list.length - 1 ? " grand" : "") + '"><span>' + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></div>"; }).join("");
  }
  function ev(name, p) { try { if (window.gtag) window.gtag("event", name, p || {}); } catch (e) {} }
  var used = false;
  function touched() { if (!used) { used = true; ev("tool_used", { tool: tool }); } }

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parse(v) { var p = String(v).split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2], 12) : null; }
  function fmt(d) { return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }

  var calc = {
    "late-fee-calculator": function () {
      var amt = n("amount"), rate = n("rate"), type = $("type").value, late = Math.max(0, n("days") - n("grace")), fee = 0;
      if (late <= 0) fee = 0;
      else if (type === "flat") fee = rate;
      else if (type === "once") fee = amt * rate / 100;
      else fee = amt * (rate / 100) * (late / 30);
      var list = [["Invoice amount", money(amt)], ["Days charged (after grace)", String(late)], ["Late fee", money(fee)]];
      if (type === "monthly" && late > 0) list.push(["Approx. fee per day", money(amt * (rate / 100) / 30)]);
      list.push(["New total due", money(amt + fee)]);
      rows(list, true);
    },
    "invoice-due-date-calculator": function () {
      var s = parse($("start").value); if (!s) { out.innerHTML = "<p>Pick an invoice date.</p>"; return; }
      var t = $("terms").value, days = t === "custom" ? Math.max(0, Math.round(n("custom"))) : +t;
      $("custom").parentNode.hidden = t !== "custom";
      var base = new Date(s.getTime());
      if ($("eom").value === "eom") base = new Date(s.getFullYear(), s.getMonth() + 1, 0, 12);
      var due = new Date(base.getTime()); due.setDate(due.getDate() + days);
      var note = "";
      if ($("bday").checked) { var wd = due.getDay(); if (wd === 6) { due.setDate(due.getDate() + 2); note = "Moved from Saturday to Monday"; } else if (wd === 0) { due.setDate(due.getDate() + 1); note = "Moved from Sunday to Monday"; } }
      var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
      var diff = Math.round((due - today) / 864e5);
      var list = [["Due date", fmt(due)], ["Terms", (days === 0 ? "Due on receipt" : "Net " + days) + ($("eom").value === "eom" ? " EOM" : "")]];
      if (note) list.push(["Weekend rule", note]);
      list.push(["From today", diff === 0 ? "Due today" : diff > 0 ? diff + " days left" : Math.abs(diff) + " days overdue"]);
      rows(list, false);
    },
    "invoice-number-generator": function () {
      var prefix = $("prefix").value.trim(), start = Math.max(0, Math.round(n("startNum"))), count = Math.min(200, Math.max(1, Math.round(n("count")))), pad = +$("pad").value, sep = $("sep").value, df = $("datefmt").value;
      var d = new Date(), mid = df === "year" ? String(d.getFullYear()) : df === "ym" ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") : "";
      var list = [];
      for (var i = 0; i < count; i++) {
        var num = String(start + i); if (pad) num = num.padStart(pad, "0");
        list.push([prefix, mid, num].filter(function (x) { return x !== ""; }).join(sep));
      }
      out.innerHTML = '<textarea id="numlist" rows="' + Math.min(12, count + 1) + '" readonly aria-label="Generated invoice numbers">' + esc(list.join("\n")) + '</textarea><p><button type="button" class="btn" id="copyNums">Copy list</button> <span id="copied" role="status"></span></p>';
      $("copyNums").addEventListener("click", function () {
        var t = list.join("\n"), done = function () { $("copied").textContent = "Copied."; };
        try { navigator.clipboard.writeText(t).then(done, function () { $("numlist").select(); document.execCommand("copy"); done(); }); } catch (e) { $("numlist").select(); try { document.execCommand("copy"); done(); } catch (e2) {} }
      });
    },
    "invoice-total-calculator": function () {
      var sub = n("subtotal"), disc = n("discount"), dv = $("dtype").value === "pct" ? sub * disc / 100 : disc;
      dv = Math.min(sub, Math.max(0, dv));
      var taxable = sub - dv, tax = taxable * n("tax") / 100, ship = n("shipping"), total = taxable + tax + ship, dep = n("deposit");
      var list = [["Subtotal", money(sub)]];
      if (dv) list.push(["Discount", "-" + money(dv)]);
      list.push(["Sales tax (" + n("tax") + "%)", money(tax)]);
      if (ship) list.push(["Shipping or fees", money(ship)]);
      list.push(["Total", money(total)]);
      if (dep) list.push(["Deposit paid", "-" + money(dep)]);
      list.push([dep ? "Balance due" : "Total due", money(Math.max(0, total - dep))]);
      rows(list, true);
    }
  };

  if (tool === "invoice-due-date-calculator" && !$("start").value) $("start").value = iso(new Date());
  function run() { if (calc[tool]) calc[tool](); }
  root.addEventListener("input", function () { touched(); run(); });
  root.addEventListener("change", function () { touched(); run(); });
  run();
})();
