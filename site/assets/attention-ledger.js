// Attention Ledger previews. One renderer draws the preview window on the home
// page's work row and on the project page. Every view (timeline, totals,
// distractions, raw log) comes from the same invented sample data, so the
// numbers always agree. No real tracking data is ever on this site.
window.ALedger = (function () {
  var CAT_NAMES = {
    work: "Work", career: "Career", communication: "Communication", distraction: "Distraction",
    music: "Music", personal: "Personal", utility: "Utility", other: "Other", private: "Private"
  };
  var CAT_ORDER = ["work", "career", "communication", "distraction", "music", "personal", "utility", "other", "private"];
  var EXE = { "VS Code": "Code.exe", Slack: "slack.exe", Outlook: "olk.exe", Teams: "ms-teams.exe",
    Spotify: "Spotify.exe", "File Explorer": "explorer.exe", Terminal: "WindowsTerminal.exe", Postman: "Postman.exe" };

  // ---- Small helpers ----
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function hm(min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + "h " + (m < 10 ? "0" : "") + m + "m" : m + "m";
  }
  function overlap(a, b) { return Math.max(0, Math.min(a.e, b.e) - Math.max(a.s, b.s)); }
  function isDomain(label) { return label.indexOf(".") > 0; }

  // A day: { date, start (minutes after midnight), span, segs: [[s, d, dev, label]],
  //          pause: {s, e, scope}, idle: [{s, e}], lock: [{s, e}] }
  function prepare(raw) {
    var day = Object.assign({ idle: [], lock: [], pause: null }, raw);
    day.segs = raw.segs.map(function (r) {
      return { s: r[0], d: r[1], e: r[0] + r[1], dev: r[2], label: r[3] };
    }).sort(function (a, b) { return a.s - b.s; });
    return day;
  }
  function clockOf(day) {
    return function (m) {
      var t = day.start + m, h = Math.floor(t / 60), mm = t % 60;
      return (h > 12 ? h - 12 : h) + ":" + (mm < 10 ? "0" : "") + mm;
    };
  }
  function isoOf(day) {
    return function (m) {
      var t = day.start + m, h = Math.floor(t / 60), mm = t % 60;
      return day.date + "T" + (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm + ":00-05:00";
    };
  }

  // ---- What the report works out, given categories and which ones count as focus ----
  // role: focus / drift / comm / other / private. Colour follows the role.
  function analyse(day, cats) {
    function cat(r) { return r.label === "Private" ? "private" : cats.map[r.label] || "other"; }
    function role(c) {
      if (c === "private") return "private";
      if (cats.focus.indexOf(c) >= 0) return "focus";
      if (c === "distraction") return "drift";
      if (c === "communication") return "comm";
      return "other";
    }
    day.segs.forEach(function (r) { r.cat = cat(r); r.role = role(r.cat); });
    var laptop = day.segs.filter(function (r) { return r.dev === "laptop"; });
    var phone = day.segs.filter(function (r) { return r.dev === "phone"; });
    var phoneDrift = phone.filter(function (r) { return r.role === "drift"; });
    var focus = laptop.filter(function (r) { return r.role === "focus"; });

    function focusAt(m) { return focus.some(function (r) { return r.s <= m && m < r.e + 2; }); }

    var lost = 0;
    focus.forEach(function (f) { phoneDrift.forEach(function (p) { lost += overlap(f, p); }); });
    var onTask = focus.reduce(function (a, r) { return a + r.d; }, 0) - lost;

    // Longest unbroken stretch of focus: anything off task on the laptop, a
    // distraction on the phone, a pause or going idle ends it.
    var best = { len: 0, s: 0, e: 0 }, cur = null;
    var breaks = laptop.filter(function (r) { return r.role !== "focus"; }).concat(phoneDrift, day.idle, day.lock, day.pause ? [day.pause] : []);
    laptop.forEach(function (r) {
      if (r.role !== "focus") { cur = null; return; }
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

    var episodes = [];
    day.segs.forEach(function (r) {
      if (r.role === "focus" || r.role === "private" || !focusAt(r.s)) return;
      // A phone pick-up while the laptop is already off task is part of that detour.
      if (r.dev === "phone" && laptop.some(function (l) { return l.role !== "focus" && l.s <= r.s && r.s < l.e; })) return;
      var left = focus.filter(function (f) { return f.s <= r.s; }).pop();
      if (!left) return;
      var back = focus.filter(function (f) { return f.s >= r.e - 1 && f !== left; })[0];
      var stillOn = r.dev === "phone" && left.e > r.e;
      var kind = r.role === "drift" ? "Distraction" : r.dev === "phone" ? "Phone check" : "Detour";
      episodes.push({ r: r, kind: kind, left: left.label, back: stillOn ? left.label : back ? back.label : "Stayed away" });
    });

    var n = 0;
    for (var i = 1; i < day.segs.length; i++) if (day.segs[i].label !== day.segs[i - 1].label) n++;

    return {
      day: day, laptop: laptop, phone: phone, onTask: onTask, longest: best, episodes: episodes,
      switches: n / (day.span / 60),
      distractions: episodes.filter(function (e) { return e.kind === "Distraction"; }).length,
      checks: episodes.filter(function (e) { return e.kind === "Phone check"; }).length
    };
  }

  // Focus minutes in each hour of a day, for the week heat map.
  function focusByHour(day, cats) {
    var a = analyse(day, cats), hours = [];
    var phoneDrift = a.phone.filter(function (r) { return r.role === "drift"; });
    for (var h = 0; h < Math.ceil(day.span / 60); h++) {
      var w = { s: h * 60, e: h * 60 + 60 }, m = 0;
      a.laptop.forEach(function (r) {
        if (r.role !== "focus") return;
        var o = { s: Math.max(r.s, w.s), e: Math.min(r.e, w.e) };
        if (o.e <= o.s) return;
        m += o.e - o.s;
        phoneDrift.forEach(function (p) { m -= overlap(o, p); });
      });
      hours.push(Math.max(0, m));
    }
    return hours;
  }

  // ---- One preview window ----
  function mount(scope, opts) {
    var win = scope.querySelector(".al-window");
    var day = prepare(opts.day), cats = opts.categories;
    var pick = function (name) { return scope.querySelector('[data-al="' + name + '"]'); };

    var tip = el("div", "al-tip");
    tip.setAttribute("role", "status");
    tip.hidden = true;
    win.appendChild(tip);
    function showTip(target, value, name) {
      tip.textContent = "";
      tip.appendChild(el("strong", null, value));
      tip.appendChild(el("span", null, name));
      tip.hidden = false;
      var box = win.getBoundingClientRect(), r = target.getBoundingClientRect();
      var w = tip.offsetWidth, x = r.left + r.width / 2 - box.left;
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
    function pct(m) { return (m / day.span * 100) + "%"; }
    function block(lane, s, e, cls, gap) {
      var b = el("span", "al-block " + cls);
      b.style.left = pct(s);
      b.style.width = "calc(" + pct(e - s) + " - " + (gap || 2) + "px)";
      lane.appendChild(b);
      return b;
    }
    function focusLabel() {
      return "Focus (" + cats.focus.map(function (c) { return CAT_NAMES[c].toLowerCase(); }).join(", ") + ")";
    }
    var groupBy = "category";

    function draw() {
      var a = analyse(day, cats), clock = clockOf(day), iso = isoOf(day);
      hideTip();

      var tiles = pick("tiles");
      if (tiles) {
        tiles.textContent = "";
        [
          ["On a task", hm(a.onTask)],
          ["Longest focus", hm(a.longest.len), a.longest.len ? clock(a.longest.s) + " to " + clock(a.longest.e) : ""],
          ["Switches per hour", a.switches.toFixed(1)],
          ["Distractions", String(a.distractions)],
          ["Phone checks", String(a.checks)]
        ].forEach(function (t) {
          var d = el("div", "al-tile");
          d.appendChild(el("span", "al-tile-label", t[0]));
          d.appendChild(el("span", "al-tile-value", t[1]));
          if (t[2]) d.appendChild(el("span", "al-tile-sub", t[2]));
          tiles.appendChild(d);
        });
      }

      var tl = pick("timeline");
      if (tl) {
        tl.textContent = "";
        [["laptop", "Laptop"], ["phone", "iPhone"]].forEach(function (dv) {
          var row = el("div", "al-lane-row");
          row.appendChild(el("span", "al-lane-name", dv[1]));
          var lane = el("div", "al-lane");
          if (day.pause && (day.pause.scope === "all" || dv[0] === "laptop")) {
            var p = block(lane, day.pause.s, day.pause.e, "al-paused");
            hoverable(p, hm(day.pause.e - day.pause.s),
              "Paused" + (day.pause.scope === "all" ? " on all devices" : "") + ", " + clock(day.pause.s) + " to " + clock(day.pause.e));
          }
          if (dv[0] === "laptop") day.lock.forEach(function (l) {
            var k = block(lane, l.s, l.e, "al-locked");
            hoverable(k, hm(l.e - l.s), "Laptop locked, " + clock(l.s) + " to " + clock(l.e));
          });
          day.segs.filter(function (r) { return r.dev === dv[0]; }).forEach(function (r) {
            var b = block(lane, r.s, r.e, "al-c-" + r.role);
            hoverable(b, hm(r.d), r.label + " · " + CAT_NAMES[r.cat] + " · " + clock(r.s) + " to " + clock(r.e));
          });
          row.appendChild(lane);
          tl.appendChild(row);
        });
        var axis = el("div", "al-axis");
        var hours = Math.floor(day.span / 60);
        for (var h = 0; h <= hours; h++) {
          var t = el("span", h % 2 && hours > 5 ? "al-tick-minor" : null, clock(h * 60));
          t.style.left = pct(h * 60);
          if (h === 0) t.classList.add("al-tick-first");
          if (h * 60 === day.span) t.classList.add("al-tick-last");
          axis.appendChild(t);
        }
        var axisRow = el("div", "al-lane-row al-axis-row");
        axisRow.appendChild(el("span", "al-lane-name"));
        axisRow.appendChild(axis);
        tl.appendChild(axisRow);
      }

      var legend = pick("legend");
      if (legend) {
        legend.textContent = "";
        [["focus", focusLabel()], ["comm", "Communication"], ["drift", "Distraction"], ["other", "Other"], ["private", "Private"], ["paused", "Paused"], ["locked", "Locked"]]
          .forEach(function (k) {
            if (k[0] === "locked" && !day.lock.length) return;
            if (k[0] === "paused" && !day.pause) return;
            var li = el("li");
            li.appendChild(el("span", "al-key " + (k[0] === "paused" ? "al-paused" : k[0] === "locked" ? "al-locked" : "al-c-" + k[0])));
            li.appendChild(document.createTextNode(k[1]));
            legend.appendChild(li);
          });
      }

      var bars = pick("bars");
      if (bars) {
        var map = {};
        day.segs.forEach(function (r) {
          var key = groupBy === "category" ? r.cat : groupBy === "device" ? r.dev : r.label;
          if (!map[key]) map[key] = { key: key, min: 0, role: r.role };
          map[key].min += r.d;
        });
        var g = Object.keys(map).map(function (k) { return map[k]; });
        g.sort(function (x, y) { return y.min - x.min; });
        if (groupBy === "category") g.sort(function (x, y) { return CAT_ORDER.indexOf(x.key) - CAT_ORDER.indexOf(y.key); });
        if (groupBy === "label") g = g.slice(0, 10);
        var max = Math.max.apply(null, g.map(function (x) { return x.min; }));
        bars.textContent = "";
        g.forEach(function (x) {
          var name = groupBy === "category" ? CAT_NAMES[x.key] : groupBy === "device" ? (x.key === "laptop" ? "Laptop" : "iPhone") : x.key;
          var li = el("li", "al-bar-row");
          li.appendChild(el("span", "al-bar-name", name));
          var track = el("span", "al-bar-track");
          var bar = el("span", "al-bar " + (groupBy === "device" ? "al-c-device" : "al-c-" + x.role));
          bar.style.width = (x.min / max * 100) + "%";
          track.appendChild(bar);
          li.appendChild(track);
          li.appendChild(el("span", "al-bar-value", hm(x.min)));
          bars.appendChild(li);
        });
      }

      var drift = pick("drift");
      if (drift) {
        var body = drift.querySelector("tbody");
        body.textContent = "";
        if (!a.episodes.length) {
          var tr0 = el("tr"), td0 = el("td", null, "Nothing pulled me away.");
          td0.colSpan = 7;
          tr0.appendChild(td0);
          body.appendChild(tr0);
        }
        a.episodes.forEach(function (e) {
          var tr = el("tr");
          [clock(e.r.s), e.kind, e.left, e.r.label, e.r.dev === "phone" ? "iPhone" : "Laptop", hm(e.r.d), e.back].forEach(function (v, i) {
            var td = el("td", i === 5 ? "num" : null);
            if (i === 1) td.appendChild(el("span", "al-kind" + (e.kind === "Distraction" ? " al-kind-drift" : ""), v));
            else td.textContent = v;
            tr.appendChild(td);
          });
          body.appendChild(tr);
        });
      }

      var log = pick("log");
      if (log) {
        var lines = [];
        var line = function (m, dev, src, obj) {
          var o = { schema_version: 1, ts: iso(m), device: dev, source: src };
          Object.keys(obj).forEach(function (k) { o[k] = obj[k]; });
          lines.push({ m: m, text: JSON.stringify(o) });
        };
        day.segs.forEach(function (r) {
          if (r.dev === "phone") {
            line(r.s, "phone", "ios-shortcuts", { event: "open", app: r.label });
            line(r.e, "phone", "ios-shortcuts", { event: "close", app: r.label });
          } else if (r.label === "Private") {
            line(r.s, "laptop", "desktop-agent", { event: "span", app: "Private", private: true, duration_s: r.d * 60 });
          } else if (isDomain(r.label)) {
            line(r.s, "laptop", "browser-extension", { event: "span", app: "msedge.exe", domain: r.label, duration_s: r.d * 60 });
          } else {
            line(r.s, "laptop", "desktop-agent", { event: "span", app: EXE[r.label] || r.label + ".exe", duration_s: r.d * 60 });
          }
        });
        day.idle.forEach(function (x) {
          line(x.s, "laptop", "desktop-agent", { event: "idle_start" });
          line(x.e, "laptop", "desktop-agent", { event: "idle_end" });
        });
        day.lock.forEach(function (x) {
          line(x.s, "laptop", "desktop-agent", { event: "lock" });
          line(x.e, "laptop", "desktop-agent", { event: "unlock" });
        });
        if (day.pause) {
          line(day.pause.s, "laptop", "desktop-agent", { event: "pause", scope: day.pause.scope, until: iso(day.pause.e), paused: true });
          line(day.pause.e, "laptop", "desktop-agent", { event: "resume", scope: day.pause.scope, paused: false });
        }
        lines.sort(function (x, y) { return x.m - y.m; });
        log.textContent = lines.map(function (l) { return l.text; }).join("\n");
      }

      var thumb = scope.querySelector(".al-thumb") || (opts.thumb || null);
      if (thumb) {
        thumb.textContent = "";
        var mini = el("span", "al-mini");
        ["laptop", "phone"].forEach(function (dv) {
          var lane = el("span", "al-lane");
          if (day.pause && (day.pause.scope === "all" || dv === "laptop")) block(lane, day.pause.s, day.pause.e, "al-paused", 1);
          day.segs.filter(function (r) { return r.dev === dv; }).forEach(function (r) { block(lane, r.s, r.e, "al-c-" + r.role); });
          mini.appendChild(lane);
        });
        thumb.appendChild(mini);
        thumb.hidden = false;
      }
      if (opts.onDraw) opts.onDraw(a);
    }

    scope.querySelectorAll('input[name="al-group"]').forEach(function (i) {
      i.addEventListener("change", function () { if (i.checked) { groupBy = i.value; draw(); } });
    });

    // The pause control on the Controls tab says what a pause would do.
    var pauseOut = pick("pause");
    if (pauseOut) {
      var say = function () {
        var scopeIn = scope.querySelector('input[name="al-scope"]:checked').value;
        var len = scope.querySelector('input[name="al-for"]:checked').value;
        var who = scopeIn === "all" ? "the laptop, every browser and the iPhone" : "only this device";
        pauseOut.textContent = "Pauses " + who + " " + (len === "until resumed" ? "until I resume" : "for " + len) +
          ". The log gets one pause line and one resume line, and nothing in between.";
      };
      scope.querySelectorAll('input[name="al-scope"], input[name="al-for"]').forEach(function (i) { i.addEventListener("change", say); });
      say();
    }

    // Tabs, with arrow-key movement between them.
    var list = scope.querySelector(".al-tabs");
    if (list) {
      var buttons = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
      var select = function (btn, focus) {
        buttons.forEach(function (b) {
          var on = b === btn;
          b.setAttribute("aria-selected", on ? "true" : "false");
          b.tabIndex = on ? 0 : -1;
          document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
        });
        hideTip();
        if (focus) btn.focus();
      };
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
    }

    draw();
    return {
      setDay: function (raw) { day = prepare(raw); draw(); },
      setCategories: function (c) { cats = c; draw(); }
    };
  }

  // ---- The home page's sample morning ----
  var MONDAY = {
    date: "2026-11-09", start: 9 * 60, span: 240,
    segs: [
      [0, 25, "laptop", "VS Code"], [25, 4, "laptop", "github.com"], [31, 9, "phone", "Instagram"],
      [41, 2, "laptop", "Private"], [58, 37, "laptop", "VS Code"], [78, 2, "phone", "Messages"],
      [95, 8, "laptop", "youtube.com"], [103, 37, "laptop", "docs.google.com"], [120, 1, "phone", "Clock"],
      [140, 12, "laptop", "web.whatsapp.com"], [141, 7, "phone", "WhatsApp"], [152, 38, "laptop", "linkedin.com"],
      [170, 8, "phone", "Instagram"], [190, 6, "laptop", "amazon.com"], [196, 39, "laptop", "VS Code"]
    ],
    pause: { s: 43, e: 58, scope: "all" },
    idle: [{ s: 29, e: 41 }],
    lock: [{ s: 235, e: 240 }]
  };
  var CATEGORIES = {
    focus: ["work", "career"],
    map: {
      "VS Code": "work", "github.com": "work", "docs.google.com": "work", Slack: "work", Outlook: "work",
      Teams: "work", Terminal: "work", Postman: "work", "stackoverflow.com": "work", "mail.google.com": "work",
      "linkedin.com": "career", "greenhouse.io": "career", "myworkdayjobs.com": "career", LinkedIn: "career",
      "youtube.com": "distraction", "reddit.com": "distraction", Instagram: "distraction", YouTube: "distraction", Reddit: "distraction",
      Messages: "communication", WhatsApp: "communication", "web.whatsapp.com": "communication",
      Spotify: "music", "amazon.com": "personal", Amazon: "personal", Photos: "personal",
      Clock: "utility", Weather: "utility", "File Explorer": "utility"
    }
  };

  return { mount: mount, analyse: analyse, focusByHour: focusByHour, prepare: prepare, hm: hm,
    CAT_NAMES: CAT_NAMES, CAT_ORDER: CAT_ORDER, MONDAY: MONDAY, CATEGORIES: CATEGORIES };
})();

(function () {
  var row = document.getElementById("attention-ledger");
  if (row) window.ALedger.mount(row, { day: window.ALedger.MONDAY, categories: window.ALedger.CATEGORIES });
})();
