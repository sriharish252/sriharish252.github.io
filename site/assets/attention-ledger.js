// The Attention Ledger preview on the work row. Every view (timeline, totals,
// distractions, raw log) is drawn from the one invented sample day below, so
// the numbers always agree with each other. No real data is ever on this page.
(function () {
  var root = document.getElementById("attention-ledger");
  if (!root) return;

  var START = 9 * 60;          // the sample day runs 9:00 to 13:00
  var SPAN = 4 * 60;
  var CATS = {
    focus: { name: "Focus", note: "work and career" },
    comm: { name: "Messages" },
    drift: { name: "Distraction" },
    other: { name: "Other" },
    private: { name: "Private" }
  };

  // [start minute, length in minutes, device, app or site, category]
  var DAY = [
    [0, 25, "laptop", "VS Code", "focus"],
    [25, 4, "laptop", "github.com", "focus"],
    [31, 9, "phone", "Instagram", "drift"],
    [41, 2, "laptop", "Private", "private"],
    [58, 37, "laptop", "VS Code", "focus"],
    [78, 2, "phone", "Messages", "comm"],
    [95, 8, "laptop", "youtube.com", "drift"],
    [103, 37, "laptop", "docs.google.com", "focus"],
    [120, 1, "phone", "Clock", "other"],
    [140, 12, "laptop", "web.whatsapp.com", "comm"],
    [141, 7, "phone", "WhatsApp", "comm"],
    [152, 38, "laptop", "linkedin.com", "focus"],
    [170, 8, "phone", "Instagram", "drift"],
    [190, 6, "laptop", "amazon.com", "other"],
    [196, 39, "laptop", "VS Code", "focus"]
  ].map(function (r) { return { s: r[0], d: r[1], e: r[0] + r[1], dev: r[2], label: r[3], cat: r[4] }; });
  var PAUSE = { s: 43, e: 58 };     // paused on all devices
  var IDLE = { s: 29, e: 41 };      // laptop idle
  var LOCK = { s: 235, e: 240 };    // laptop locked

  function clock(m) {
    var t = START + m, h = Math.floor(t / 60), mm = t % 60;
    return (h > 12 ? h - 12 : h) + ":" + (mm < 10 ? "0" : "") + mm;
  }
  function iso(m) {
    var t = START + m, h = Math.floor(t / 60), mm = t % 60;
    return "2026-11-09T" + (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm + ":00-05:00";
  }
  function hm(min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + "h " + (m < 10 ? "0" : "") + m + "m" : m + "m";
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pick(name) { return root.querySelector('[data-al="' + name + '"]'); }
  function sum(list) { return list.reduce(function (a, r) { return a + r.d; }, 0); }
  function overlap(a, b) { return Math.max(0, Math.min(a.e, b.e) - Math.max(a.s, b.s)); }

  var laptop = DAY.filter(function (r) { return r.dev === "laptop"; });
  var phone = DAY.filter(function (r) { return r.dev === "phone"; });
  var phoneDrift = phone.filter(function (r) { return r.cat === "drift"; });

  // ---- The numbers the report gives ----
  function focusAt(m) {
    return laptop.some(function (r) { return r.cat === "focus" && r.s <= m && m < r.e + 2; });
  }
  function onTask() {
    var focus = laptop.filter(function (r) { return r.cat === "focus"; });
    var lost = 0;
    focus.forEach(function (f) { phoneDrift.forEach(function (p) { lost += overlap(f, p); }); });
    return sum(focus) - lost;
  }
  function longestFocus() {
    var best = { len: 0 }, cur = null;
    var breaks = laptop.filter(function (r) { return r.cat !== "focus"; }).concat(phoneDrift, [PAUSE, IDLE]);
    laptop.forEach(function (r) {
      if (r.cat !== "focus") { cur = null; return; }
      var pieces = [{ s: r.s, e: r.e }];
      breaks.forEach(function (b) {
        pieces = pieces.reduce(function (out, p) {
          if (overlap(p, b) === 0) { out.push(p); return out; }
          if (b.s > p.s) out.push({ s: p.s, e: b.s });
          if (b.e < p.e) out.push({ s: b.e, e: p.e });
          return out;
        }, []);
      });
      pieces.forEach(function (p) {
        if (cur && p.s - cur.e <= 2) cur.e = p.e; else cur = { s: p.s, e: p.e };
        if (cur.e - cur.s > best.len) best = { len: cur.e - cur.s, s: cur.s, e: cur.e };
      });
    });
    return best;
  }
  function episodes() {
    var out = [];
    DAY.forEach(function (r) {
      if (r.cat === "focus" || r.cat === "private") return;
      if (!focusAt(r.s)) return;
      // A phone pick-up while the laptop is already off task is part of that detour.
      if (r.dev === "phone" && laptop.some(function (l) { return l.cat !== "focus" && l.s <= r.s && r.s < l.e; })) return;
      var left = laptop.filter(function (f) { return f.cat === "focus" && f.s <= r.s; }).pop();
      var back = laptop.filter(function (f) { return f.cat === "focus" && f.s >= r.e - 1 && f !== left; })[0];
      var stillOn = r.dev === "phone" && left.e > r.e;
      var kind = r.cat === "drift" ? "Distraction" : r.dev === "phone" ? "Phone check" : "Detour";
      if (kind === "Detour" && r.d < 1) return;
      out.push({ r: r, kind: kind, left: left.label, back: stillOn ? left.label : back ? back.label : "Stayed away" });
    });
    return out;
  }
  function switches() {
    var seq = DAY.slice().sort(function (a, b) { return a.s - b.s; }), n = 0;
    for (var i = 1; i < seq.length; i++) if (seq[i].label !== seq[i - 1].label) n++;
    return n / (SPAN / 60);
  }

  // ---- Tooltip, shared by the timeline and the bars ----
  var tip = el("div", "al-tip");
  tip.setAttribute("role", "status");
  tip.hidden = true;
  root.querySelector(".al-window").appendChild(tip);
  function showTip(target, value, name) {
    tip.textContent = "";
    tip.appendChild(el("strong", null, value));
    tip.appendChild(el("span", null, name));
    tip.hidden = false;
    var box = root.querySelector(".al-window").getBoundingClientRect();
    var r = target.getBoundingClientRect();
    var x = r.left + r.width / 2 - box.left;
    var w = tip.offsetWidth;
    x = Math.max(w / 2 + 6, Math.min(box.width - w / 2 - 6, x));
    tip.style.left = x + "px";
    tip.style.top = (r.top - box.top - tip.offsetHeight - 8) + "px";
  }
  function hideTip() { tip.hidden = true; }
  function hoverable(node, value, name) {
    node.tabIndex = 0;
    node.setAttribute("aria-label", name + ", " + value);
    node.addEventListener("pointerenter", function () { showTip(node, value, name); });
    node.addEventListener("pointerleave", hideTip);
    node.addEventListener("focus", function () { showTip(node, value, name); });
    node.addEventListener("blur", hideTip);
  }

  // ---- Stat tiles ----
  (function tiles() {
    var box = pick("tiles"), lf = longestFocus(), eps = episodes();
    [
      ["On a task", hm(onTask())],
      ["Longest focus", hm(lf.len), clock(lf.s) + " to " + clock(lf.e)],
      ["Switches per hour", switches().toFixed(1)],
      ["Distractions", String(eps.filter(function (e) { return e.kind === "Distraction"; }).length)],
      ["Phone checks", String(eps.filter(function (e) { return e.kind === "Phone check"; }).length)]
    ].forEach(function (t) {
      var d = el("div", "al-tile");
      d.appendChild(el("span", "al-tile-label", t[0]));
      d.appendChild(el("span", "al-tile-value", t[1]));
      if (t[2]) d.appendChild(el("span", "al-tile-sub", t[2]));
      box.appendChild(d);
    });
  })();

  // ---- Timeline: one lane per device ----
  function pct(m) { return (m / SPAN * 100) + "%"; }
  function block(lane, r) {
    var b = el("span", "al-block al-c-" + r.cat);
    b.style.left = pct(r.s);
    b.style.width = "calc(" + pct(r.d) + " - 2px)";
    lane.appendChild(b);
    return b;
  }
  (function timeline() {
    var box = pick("timeline");
    var axis = el("div", "al-axis");
    for (var h = 0; h <= 4; h++) {
      var t = el("span", null, clock(h * 60));
      t.style.left = pct(h * 60);
      axis.appendChild(t);
    }
    [["laptop", "Laptop"], ["phone", "iPhone"]].forEach(function (dv) {
      var row = el("div", "al-lane-row");
      row.appendChild(el("span", "al-lane-name", dv[1]));
      var lane = el("div", "al-lane");
      var p = el("span", "al-block al-paused");
      p.style.left = pct(PAUSE.s);
      p.style.width = "calc(" + pct(PAUSE.e - PAUSE.s) + " - 2px)";
      lane.appendChild(p);
      hoverable(p, hm(PAUSE.e - PAUSE.s), "Paused on all devices, " + clock(PAUSE.s) + " to " + clock(PAUSE.e));
      DAY.filter(function (r) { return r.dev === dv[0]; }).forEach(function (r) {
        var b = block(lane, r);
        var cat = CATS[r.cat].name;
        hoverable(b, hm(r.d), r.label + " · " + cat + " · " + clock(r.s) + " to " + clock(r.e));
      });
      row.appendChild(lane);
      box.appendChild(row);
    });
    var axisRow = el("div", "al-lane-row al-axis-row");
    axisRow.appendChild(el("span", "al-lane-name"));
    axisRow.appendChild(axis);
    box.appendChild(axisRow);

    var legend = pick("legend");
    ["focus", "comm", "drift", "other", "private"].forEach(function (k) {
      var li = el("li");
      li.appendChild(el("span", "al-key al-c-" + k));
      li.appendChild(document.createTextNode(CATS[k].name + (CATS[k].note ? " (" + CATS[k].note + ")" : "")));
      legend.appendChild(li);
    });
    var li = el("li");
    li.appendChild(el("span", "al-key al-paused"));
    li.appendChild(document.createTextNode("Paused"));
    legend.appendChild(li);
  })();

  // ---- Closed-row thumbnail: the same day, in miniature ----
  (function thumb() {
    var t = root.querySelector(".al-thumb");
    var mini = el("span", "al-mini");
    ["laptop", "phone"].forEach(function (dv) {
      var lane = el("span", "al-lane");
      var p = el("span", "al-block al-paused");
      p.style.left = pct(PAUSE.s);
      p.style.width = "calc(" + pct(PAUSE.e - PAUSE.s) + " - 1px)";
      lane.appendChild(p);
      DAY.filter(function (r) { return r.dev === dv; }).forEach(function (r) { block(lane, r); });
      mini.appendChild(lane);
    });
    t.appendChild(mini);
    t.hidden = false;
  })();

  // ---- Group by: category, device or app ----
  (function grouped() {
    var list = pick("bars");
    var CAT_ORDER = ["focus", "comm", "drift", "other", "private"];
    function groups(by) {
      var map = {};
      DAY.forEach(function (r) {
        var key = by === "category" ? r.cat : by === "device" ? r.dev : r.label;
        if (!map[key]) map[key] = { key: key, min: 0, cat: r.cat };
        map[key].min += r.d;
      });
      var out = Object.keys(map).map(function (k) { return map[k]; });
      out.sort(function (a, b) { return b.min - a.min; });
      if (by === "category") out.sort(function (a, b) { return CAT_ORDER.indexOf(a.key) - CAT_ORDER.indexOf(b.key); });
      return out;
    }
    function draw(by) {
      list.textContent = "";
      var g = groups(by);
      var max = Math.max.apply(null, g.map(function (x) { return x.min; }));
      g.forEach(function (x) {
        var name = by === "category" ? CATS[x.key].name : by === "device" ? (x.key === "laptop" ? "Laptop" : "iPhone") : x.key;
        var li = el("li", "al-bar-row");
        li.appendChild(el("span", "al-bar-name", name));
        var track = el("span", "al-bar-track");
        var bar = el("span", "al-bar " + (by === "device" ? "al-c-device" : "al-c-" + x.cat));
        bar.style.width = (x.min / max * 100) + "%";
        track.appendChild(bar);
        li.appendChild(track);
        li.appendChild(el("span", "al-bar-value", hm(x.min)));
        list.appendChild(li);
      });
    }
    root.querySelectorAll('input[name="al-group"]').forEach(function (i) {
      i.addEventListener("change", function () { if (i.checked) draw(i.value); });
    });
    draw("category");
  })();

  // ---- Distractions table ----
  (function drift() {
    var body = pick("drift").querySelector("tbody");
    episodes().forEach(function (e) {
      var tr = el("tr");
      [clock(e.r.s), e.kind, e.left, e.r.label, e.r.dev === "phone" ? "iPhone" : "Laptop", hm(e.r.d), e.back].forEach(function (v, i) {
        var td = el("td", i === 5 ? "num" : null, v);
        if (i === 1) {
          td.textContent = "";
          var tag = el("span", "al-kind" + (e.kind === "Distraction" ? " al-kind-drift" : ""), v);
          td.appendChild(tag);
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  })();

  // ---- Raw log, as the collectors write it ----
  (function log() {
    var lines = [];
    function line(m, dev, src, obj) {
      var o = { schema_version: 1, ts: iso(m), device: dev, source: src };
      Object.keys(obj).forEach(function (k) { o[k] = obj[k]; });
      lines.push({ m: m, text: JSON.stringify(o) });
    }
    DAY.forEach(function (r) {
      if (r.dev === "phone") {
        line(r.s, "phone", "ios-shortcuts", { event: "open", app: r.label });
        line(r.e, "phone", "ios-shortcuts", { event: "close", app: r.label });
      } else if (r.cat === "private") {
        line(r.s, "laptop", "desktop-agent", { event: "span", app: "Private", private: true, duration_s: r.d * 60 });
      } else if (r.label.indexOf(".") > 0) {
        line(r.s, "laptop", "browser-extension", { event: "span", app: "msedge.exe", domain: r.label, duration_s: r.d * 60 });
      } else {
        line(r.s, "laptop", "desktop-agent", { event: "span", app: "Code.exe", duration_s: r.d * 60 });
      }
    });
    line(IDLE.s, "laptop", "desktop-agent", { event: "idle_start" });
    line(IDLE.e, "laptop", "desktop-agent", { event: "idle_end" });
    line(PAUSE.s, "laptop", "desktop-agent", { event: "pause", scope: "all", until: iso(PAUSE.e), paused: true });
    line(PAUSE.e, "laptop", "desktop-agent", { event: "resume", scope: "all", paused: false });
    line(LOCK.s, "laptop", "desktop-agent", { event: "lock" });
    lines.sort(function (a, b) { return a.m - b.m; });
    pick("log").textContent = lines.map(function (l) { return l.text; }).join("\n");
  })();

  // ---- Pause control: shows what a pause would do ----
  (function pause() {
    var out = pick("pause");
    function say() {
      var scope = root.querySelector('input[name="al-scope"]:checked').value;
      var len = root.querySelector('input[name="al-for"]:checked').value;
      var who = scope === "all" ? "the laptop, every browser and the iPhone" : "only this device";
      out.textContent = "Pauses " + who + " " + (len === "until resumed" ? "until I resume" : "for " + len) +
        ". The log gets one pause line and one resume line, and nothing in between.";
    }
    root.querySelectorAll('input[name="al-scope"], input[name="al-for"]').forEach(function (i) {
      i.addEventListener("change", say);
    });
    say();
  })();

  // ---- Tabs ----
  (function tabs() {
    var list = root.querySelector(".al-tabs");
    var buttons = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    function select(btn, focus) {
      buttons.forEach(function (b) {
        var on = b === btn;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
      });
      hideTip();
      if (focus) btn.focus();
    }
    buttons.forEach(function (b, i) {
      b.addEventListener("click", function () { select(b); });
      b.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (e.key === "Home") { select(buttons[0], true); e.preventDefault(); }
        else if (e.key === "End") { select(buttons[buttons.length - 1], true); e.preventDefault(); }
        else if (n) { select(buttons[(i + n + buttons.length) % buttons.length], true); e.preventDefault(); }
      });
    });
    list.hidden = false;
    select(buttons[0]);
  })();
})();
