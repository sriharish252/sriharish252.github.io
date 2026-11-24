// Attention Ledger previews. One renderer draws the preview window on the home
// page's work row and on the project page. Every view (projects, timeline,
// interruptions, raw log) comes from the same invented sample data and follows
// the same rules as the real report, so the numbers always agree. No real
// tracking data is ever on this site.
window.ALedger = (function () {
  var CAT_NAMES = {
    work: "Work", career: "Career", communication: "Communication", distraction: "Distraction",
    music: "Music", personal: "Personal", utility: "Utility", other: "Other", private: "Private"
  };
  var CAT_ORDER = ["work", "career", "communication", "distraction", "music", "personal", "utility", "other", "private"];
  var UNASSIGNED = "Unassigned";
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
  function appOf(label) { return label.split(" · ")[0]; }
  function isDomain(label) { return label.indexOf(".") > 0 && label.indexOf(" · ") < 0; }

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

  // ---- The report's rules ----
  // cfg: { focus: [categories], map: {label or app: category},
  //        projects: [{ name, match: [labels] }], carry: minutes }
  // Each project gets a fixed colour slot by its place in the list, so a colour
  // always follows the same project.
  function analyse(day, cfg) {
    var names = cfg.projects.map(function (p) { return p.name; });
    function cat(r) {
      if (r.label === "Private") return "private";
      return cfg.map[r.label] || cfg.map[appOf(r.label)] || "other";
    }
    function rule(r) {
      if (r.label === "Private") return null;
      for (var i = 0; i < cfg.projects.length; i++) {
        if (cfg.projects[i].match.indexOf(r.label) >= 0) return cfg.projects[i].name;
      }
      return null;
    }
    var last = null;
    day.segs.forEach(function (r) {
      r.cat = cat(r);
      r.focus = cfg.focus.indexOf(r.cat) >= 0;
      var p = rule(r);
      if (!p && r.focus && r.dev === "laptop" && cfg.carry > 0 && last && r.s - last.e <= cfg.carry) p = last.p;
      if (!p && r.focus) p = UNASSIGNED;
      r.project = p;
      if (p && p !== UNASSIGNED && r.dev === "laptop") last = { p: p, e: r.e };
      var slot = names.indexOf(p);
      r.role = p === UNASSIGNED ? "unassigned" : slot >= 0 ? "p" + (slot + 1)
        : r.cat === "private" ? "private" : r.cat === "distraction" ? "drift" : "other";
    });

    var laptop = day.segs.filter(function (r) { return r.dev === "laptop"; });
    var phone = day.segs.filter(function (r) { return r.dev === "phone"; });
    // The phone beats the laptop: while a phone app is open, the window behind it isn't what you're looking at.
    function minutes(r) {
      if (r.dev === "phone") return r.d;
      var m = r.d;
      phone.forEach(function (p) { m -= overlap(r, p); });
      return Math.max(0, m);
    }
    var byProject = {};
    day.segs.forEach(function (r) {
      if (!r.project) return;
      byProject[r.project] = (byProject[r.project] || 0) + minutes(r);
    });
    var tracked = Object.keys(byProject).reduce(function (a, k) { return a + byProject[k]; }, 0);

    // Longest unbroken stretch on each project: the phone, another project,
    // anything else, a pause, going idle or a gap ends it.
    var stretch = {};
    var breaks = phone.concat(day.idle, day.lock, day.pause ? [day.pause] : []);
    var run = null;
    function close() {
      if (run && run.e - run.s > (stretch[run.p] ? stretch[run.p].len : 0)) stretch[run.p] = { len: run.e - run.s, s: run.s, e: run.e };
    }
    laptop.forEach(function (r) {
      var pieces = r.project ? [{ s: r.s, e: r.e }] : [];
      breaks.forEach(function (b) {
        pieces = pieces.reduce(function (out, x) {
          if (overlap(x, b) === 0) { out.push(x); return out; }
          if (b.s > x.s) out.push({ s: x.s, e: b.s });
          if (b.e < x.e) out.push({ s: b.e, e: x.e });
          return out;
        }, []);
      });
      if (!pieces.length) { close(); run = null; return; }
      pieces.forEach(function (x) {
        var broken = run && breaks.some(function (b) { return b.s < x.s && b.e > run.e; });
        if (run && run.p === r.project && x.s - run.e <= 2 && !broken) run.e = x.e;
        else { close(); run = { p: r.project, s: x.s, e: x.e }; }
      });
    });
    close();

    // Interruptions: every time something pulled me off focus work, and the project I was on.
    var focusSegs = laptop.filter(function (r) { return r.focus; });
    function focusAt(m) { return focusSegs.some(function (r) { return r.s <= m && m < r.e + 2; }); }
    var episodes = [];
    day.segs.forEach(function (r) {
      if (r.focus || r.cat === "private" || !focusAt(r.s)) return;
      if (r.dev === "phone" && laptop.some(function (l) { return !l.focus && l.s <= r.s && r.s < l.e; })) return;
      var left = focusSegs.filter(function (f) { return f.s <= r.s; }).pop();
      if (!left) return;
      var back = focusSegs.filter(function (f) { return f.s >= r.e - 1 && f !== left; })[0];
      var stillOn = r.dev === "phone" && left.e > r.e;
      var kind = r.cat === "distraction" ? "Distraction" : r.dev === "phone" ? "Phone check" : "Detour";
      episodes.push({ r: r, kind: kind, left: left, project: left.project,
        back: stillOn ? left.label : back ? back.label : "Didn't go back" });
    });

    var perProject = {};
    Object.keys(byProject).forEach(function (p) {
      var eps = episodes.filter(function (e) { return e.project === p; });
      var pulls = {};
      eps.forEach(function (e) {
        var k = e.r.label + (e.r.dev === "phone" ? " (phone)" : "");
        pulls[k] = (pulls[k] || 0) + 1;
      });
      var top = Object.keys(pulls).sort(function (a, b) { return pulls[b] - pulls[a]; })[0] || "–";
      perProject[p] = {
        name: p, min: byProject[p], share: tracked ? byProject[p] / tracked : 0,
        stretch: stretch[p] ? stretch[p].len : 0, interruptions: eps.length,
        distractions: eps.filter(function (e) { return e.kind === "Distraction"; }).length, top: top
      };
    });
    var order = Object.keys(perProject).sort(function (a, b) {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      return byProject[b] - byProject[a];
    });
    var best = { len: 0 };
    Object.keys(stretch).forEach(function (p) { if (stretch[p].len > best.len) best = Object.assign({ p: p }, stretch[p]); });

    var n = 0;
    for (var i = 1; i < day.segs.length; i++) if (day.segs[i].label !== day.segs[i - 1].label) n++;

    return {
      day: day, laptop: laptop, phone: phone, tracked: tracked, perProject: perProject, order: order,
      longest: best, episodes: episodes, minutes: minutes, names: names,
      switches: n / (day.span / 60),
      distractions: episodes.filter(function (e) { return e.kind === "Distraction"; }).length,
      checks: episodes.filter(function (e) { return e.kind === "Phone check"; }).length
    };
  }
  function roleOf(name, names) {
    if (name === UNASSIGNED) return "unassigned";
    var i = names.indexOf(name);
    return i >= 0 ? "p" + (i + 1) : "other";
  }

  // ---- One preview window ----
  function mount(scope, opts) {
    var win = scope.querySelector(".al-window");
    var day = prepare(opts.day), cfg = opts.config;
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
    var groupBy = "project";

    function draw() {
      var a = analyse(day, cfg), clock = clockOf(day), iso = isoOf(day);
      hideTip();

      var tiles = pick("tiles");
      if (tiles) {
        tiles.textContent = "";
        var topName = a.order.filter(function (p) { return p !== UNASSIGNED; })[0];
        var top = topName ? a.perProject[topName] : null;
        [
          ["Tracked work", hm(a.tracked), "no timers, no entries"],
          ["Most time on", top ? top.name : "–", top ? hm(top.min) + " · " + Math.round(top.share * 100) + "%" : ""],
          ["Longest stretch", hm(a.longest.len), a.longest.len ? a.longest.p + ", " + clock(a.longest.s) : ""],
          ["Interruptions", String(a.episodes.length), a.distractions + " distraction" + (a.distractions === 1 ? "" : "s") + " · " + a.checks + " phone check" + (a.checks === 1 ? "" : "s")]
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
            hoverable(b, hm(r.d), r.label + " · " + (r.project || CAT_NAMES[r.cat]) + " · " + clock(r.s) + " to " + clock(r.e));
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
        var present = {};
        day.segs.forEach(function (r) { present[r.role] = true; });
        var keys = a.names.map(function (n, i) { return ["p" + (i + 1), n]; })
          .concat([["unassigned", "Unassigned work"], ["drift", "Distraction"], ["other", "Not project time"], ["private", "Private"]])
          .filter(function (k) { return present[k[0]]; });
        if (day.pause) keys.push(["paused", "Paused"]);
        if (day.lock.length) keys.push(["locked", "Locked"]);
        keys.forEach(function (k) {
          var li = el("li");
          li.appendChild(el("span", "al-key " + (k[0] === "paused" ? "al-paused" : k[0] === "locked" ? "al-locked" : "al-c-" + k[0])));
          li.appendChild(document.createTextNode(k[1]));
          legend.appendChild(li);
        });
      }

      var bars = pick("bars");
      if (bars) {
        bars.textContent = "";
        var head = scope.querySelector('[data-al="bars-head"]');
        if (groupBy === "project") {
          if (head) head.hidden = false;
          bars.classList.add("al-bars-projects");
          var maxP = Math.max.apply(null, a.order.map(function (p) { return a.perProject[p].min; }).concat([1]));
          a.order.forEach(function (p) {
            var x = a.perProject[p];
            var li = el("li", "al-bar-row al-proj-row");
            li.appendChild(el("span", "al-bar-name", x.name));
            var track = el("span", "al-bar-track");
            var bar = el("span", "al-bar al-c-" + roleOf(p, a.names));
            bar.style.width = (x.min / maxP * 100) + "%";
            track.appendChild(bar);
            li.appendChild(track);
            li.appendChild(el("span", "al-bar-value", hm(x.min) + " · " + Math.round(x.share * 100) + "%"));
            var facts = el("span", "al-proj-facts");
            [["Longest stretch", hm(x.stretch)], ["Interruptions", String(x.interruptions) + (x.distractions ? " (" + x.distractions + " distraction" + (x.distractions === 1 ? "" : "s") + ")" : "")],
              ["Pulled off most by", x.top]].forEach(function (f) {
              var s = el("span");
              s.appendChild(el("b", null, f[0] + " "));
              s.appendChild(document.createTextNode(f[1]));
              facts.appendChild(s);
            });
            li.appendChild(facts);
            bars.appendChild(li);
          });
        } else {
          if (head) head.hidden = true;
          bars.classList.remove("al-bars-projects");
          var map = {};
          day.segs.forEach(function (r) {
            var key = groupBy === "category" ? r.cat : groupBy === "device" ? r.dev : r.label;
            if (!map[key]) map[key] = { key: key, min: 0, role: r.role };
            map[key].min += a.minutes(r);
          });
          var g = Object.keys(map).map(function (k) { return map[k]; }).filter(function (x) { return x.min > 0; });
          g.sort(function (x, y) { return y.min - x.min; });
          if (groupBy === "category") g.sort(function (x, y) { return CAT_ORDER.indexOf(x.key) - CAT_ORDER.indexOf(y.key); });
          if (groupBy === "label") g = g.slice(0, 10);
          var max = Math.max.apply(null, g.map(function (x) { return x.min; }));
          g.forEach(function (x) {
            var name = groupBy === "category" ? CAT_NAMES[x.key] : groupBy === "device" ? (x.key === "laptop" ? "Laptop" : "iPhone") : x.key;
            var li = el("li", "al-bar-row");
            li.appendChild(el("span", "al-bar-name", name));
            var track = el("span", "al-bar-track");
            var bar = el("span", "al-bar " + (groupBy === "label" ? "al-c-" + x.role : "al-c-device"));
            bar.style.width = (x.min / max * 100) + "%";
            track.appendChild(bar);
            li.appendChild(track);
            li.appendChild(el("span", "al-bar-value", hm(x.min)));
            bars.appendChild(li);
          });
        }
      }

      var drift = pick("drift");
      if (drift) {
        var body = drift.querySelector("tbody");
        body.textContent = "";
        if (!a.episodes.length) {
          var tr0 = el("tr"), td0 = el("td", null, "Nothing pulled me away.");
          td0.colSpan = 8;
          tr0.appendChild(td0);
          body.appendChild(tr0);
        }
        a.episodes.forEach(function (e) {
          var tr = el("tr");
          [clock(e.r.s), e.kind, e.project || "–", e.left.label, e.r.label, e.r.dev === "phone" ? "iPhone" : "Laptop", hm(e.r.d), e.back].forEach(function (v, i) {
            var td = el("td", i === 6 ? "num" : null);
            if (i === 1) td.appendChild(el("span", "al-kind" + (e.kind === "Distraction" ? " al-kind-drift" : ""), v));
            else if (i === 2) {
              td.appendChild(el("span", "al-key al-c-" + roleOf(v, a.names)));
              td.appendChild(document.createTextNode(" " + v));
            } else td.textContent = v;
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
            var o = { event: "span", app: EXE[appOf(r.label)] || appOf(r.label) + ".exe", duration_s: r.d * 60 };
            if (r.label.indexOf(" · ") > 0) o.title = r.label.split(" · ")[1];
            line(r.s, "laptop", "desktop-agent", o);
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

      var thumb = scope.querySelector(".al-thumb");
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
      setConfig: function (c) { cfg = c; draw(); }
    };
  }

  // ---- The home page's sample morning ----
  var MONDAY = {
    date: "2026-11-09", start: 9 * 60, span: 240,
    segs: [
      [0, 25, "laptop", "VS Code · inventory-app"], [25, 4, "laptop", "github.com"], [31, 9, "phone", "Instagram"],
      [41, 2, "laptop", "Private"], [58, 37, "laptop", "VS Code · inventory-app"], [78, 2, "phone", "Messages"],
      [95, 8, "laptop", "youtube.com"], [103, 15, "laptop", "docs.google.com"], [118, 22, "laptop", "Teams"],
      [120, 1, "phone", "Clock"], [140, 12, "laptop", "web.whatsapp.com"], [141, 7, "phone", "WhatsApp"],
      [152, 38, "laptop", "VS Code · portfolio-site"], [170, 8, "phone", "Instagram"], [190, 6, "laptop", "amazon.com"],
      [196, 39, "laptop", "VS Code · portfolio-site"]
    ],
    pause: { s: 43, e: 58, scope: "all" },
    idle: [{ s: 29, e: 41 }],
    lock: [{ s: 235, e: 240 }]
  };
  // My projects and categories, as projects.toml and categories.toml would hold them.
  var CONFIG = {
    focus: ["work", "career"],
    carry: 10,
    projects: [
      { name: "Inventory app", match: ["VS Code · inventory-app", "inventory.example.com"] },
      { name: "Portfolio site", match: ["VS Code · portfolio-site", "sriharish252.github.io"] },
      { name: "Meetings and email", match: ["Teams", "Outlook", "Slack", "mail.google.com", "calendar.google.com", "Zoom"] }
    ],
    map: {
      "VS Code": "work", "github.com": "work", "docs.google.com": "work", Slack: "work", Outlook: "work",
      Teams: "work", Terminal: "work", Postman: "work", "stackoverflow.com": "work", "mail.google.com": "work",
      "calendar.google.com": "work", Zoom: "work", "linkedin.com": "career",
      "youtube.com": "distraction", "reddit.com": "distraction", Instagram: "distraction", YouTube: "distraction", Reddit: "distraction",
      Messages: "communication", WhatsApp: "communication", "web.whatsapp.com": "communication",
      Spotify: "music", "amazon.com": "personal", Amazon: "personal", Photos: "personal",
      Clock: "utility", Weather: "utility", "File Explorer": "utility"
    }
  };

  return { mount: mount, analyse: analyse, prepare: prepare, hm: hm, roleOf: roleOf, UNASSIGNED: UNASSIGNED,
    CAT_NAMES: CAT_NAMES, CAT_ORDER: CAT_ORDER, MONDAY: MONDAY, CONFIG: CONFIG };
})();

(function () {
  var row = document.getElementById("attention-ledger");
  if (row) window.ALedger.mount(row, { day: window.ALedger.MONDAY, config: window.ALedger.CONFIG });
})();
