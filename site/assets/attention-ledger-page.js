// The interactive examples on the Attention Ledger page. All data here is an
// invented sample week, generated the same way on every visit; nothing typed
// into these examples leaves the browser.
(function () {
  var AL = window.ALedger;
  if (!AL || !document.querySelector(".al-page")) return;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ====================== 01  Where the week went ======================
  // A seeded generator, so the week is the same on every visit.
  function rng(seed) {
    return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function weighted(r, list) {
    var total = list.reduce(function (a, x) { return a + x[1]; }, 0), t = r() * total;
    for (var i = 0; i < list.length; i++) { t -= list[i][1]; if (t <= 0) return list[i][0]; }
    return list[list.length - 1][0];
  }
  function between(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }

  var PROFILES = [
    { name: "Monday", date: "2026-11-09", seed: 7, drift: 0.12, comm: 0.08, other: 0.06, len: [12, 45],
      focus: [["VS Code · inventory-app", 6], ["github.com", 2], ["docs.google.com", 2], ["Slack", 2], ["Terminal", 1]] },
    { name: "Tuesday", date: "2026-11-10", seed: 21, drift: 0.07, comm: 0.1, other: 0.05, len: [20, 55],
      focus: [["Teams", 5], ["Outlook", 3], ["docs.google.com", 2], ["VS Code · inventory-app", 3], ["Slack", 2]] },
    { name: "Wednesday", date: "2026-11-11", seed: 3, drift: 0.24, comm: 0.1, other: 0.08, len: [8, 30], phoneDrift: 0.55,
      focus: [["VS Code · portfolio-site", 4], ["stackoverflow.com", 2], ["github.com", 2], ["Postman", 1], ["Slack", 1]] },
    { name: "Thursday", date: "2026-11-12", seed: 42, drift: 0.05, comm: 0.05, other: 0.04, len: [25, 70],
      focus: [["VS Code · inventory-app", 7], ["Terminal", 2], ["github.com", 2]], pause: { s: 400, e: 430, scope: "all" } },
    { name: "Friday", date: "2026-11-13", seed: 15, drift: 0.15, comm: 0.08, other: 0.08, len: [12, 40],
      focus: [["VS Code · portfolio-site", 4], ["github.com", 2], ["mail.google.com", 2], ["Teams", 2], ["VS Code · inventory-app", 2]] }
  ];
  var SPAN = 510, LUNCH = { s: 210, e: 255 };   // 9:00 to 17:30, lunch 12:30 to 13:15

  function makeDay(p) {
    var r = rng(p.seed), segs = [], idle = [], t = 0, prev = null, anchor = true;  // each session opens on the day's main project
    var stops = [LUNCH].concat(p.pause ? [p.pause] : []);
    function nextStop(t) {
      var s = SPAN;
      stops.forEach(function (x) { if (x.s > t && x.s < s) s = x.s; });
      return s;
    }
    while (t < SPAN - 2) {
      var inStop = stops.filter(function (x) { return t >= x.s && t < x.e; })[0];
      if (inStop) { t = inStop.e; prev = null; anchor = true; continue; }
      var x = r(), label, len;
      if (x < p.drift && prev !== "drift") { label = weighted(r, [["youtube.com", 3], ["reddit.com", 2]]); len = between(r, 2, 12); prev = "drift"; }
      else if (x < p.drift + p.comm) { label = "web.whatsapp.com"; len = between(r, 2, 8); prev = "comm"; }
      else if (x < p.drift + p.comm + p.other) { label = weighted(r, [["amazon.com", 2], ["Spotify", 1], ["File Explorer", 1]]); len = between(r, 1, 5); prev = "other"; }
      else {
        if (anchor) { label = p.focus[0][0]; anchor = false; }
        else do { label = weighted(r, p.focus); } while (segs.length && segs[segs.length - 1][3] === label && p.focus.length > 1);
        len = between(r, p.len[0], p.len[1]); prev = "focus";
      }
      len = Math.min(len, nextStop(t) - t);
      if (len < 1) { t += 1; continue; }
      segs.push([t, len, "laptop", label]);
      t += len;
      if (r() < 0.08 && t < SPAN - 15) { var g = between(r, 4, 9); idle.push({ s: t, e: t + g }); t += g; prev = null; anchor = true; }
    }
    // The phone: picked up every half hour or so, more often at lunch.
    var pt = between(r, 10, 35);
    while (pt < SPAN - 3) {
      var paused = p.pause && pt >= p.pause.s && pt < p.pause.e;
      var lunch = pt >= LUNCH.s && pt < LUNCH.e;
      if (!paused) {
        var app, plen;
        if (lunch) { app = weighted(r, [["Instagram", 3], ["YouTube", 2], ["Messages", 2], ["Photos", 1]]); plen = between(r, 4, 14); }
        else if (r() < (p.phoneDrift || 0.3)) { app = weighted(r, [["Instagram", 3], ["Reddit", 1], ["YouTube", 1]]); plen = between(r, 2, 9); }
        else { app = weighted(r, [["Messages", 3], ["WhatsApp", 2], ["Slack", 1], ["Clock", 1], ["Weather", 1]]); plen = between(r, 1, 4); }
        plen = Math.min(plen, SPAN - pt);
        segs.push([pt, plen, "phone", app]);
        pt += plen;
      }
      pt += lunch ? between(r, 3, 10) : between(r, 22, 65);
    }
    return { date: p.date, start: 9 * 60, span: SPAN, segs: segs, idle: idle, lock: [LUNCH], pause: p.pause || null };
  }
  var WEEK = PROFILES.map(makeDay);

  var DEFAULT_CONFIG = clone(AL.CONFIG);
  var cfg = clone(DEFAULT_CONFIG);
  var selected = 0;
  var UN = AL.UNASSIGNED;

  var explorerEl = document.getElementById("al-explorer");
  var explorer = AL.mount(explorerEl, { day: WEEK[0], config: cfg });
  var dayTitle = document.getElementById("al-day-title");

  function weekStats() {
    var days = WEEK.map(function (d) { return AL.analyse(AL.prepare(d), cfg); });
    var total = {}, sum = 0, eps = 0, dist = 0, checks = 0, best = { len: 0 };
    days.forEach(function (a, i) {
      Object.keys(a.perProject).forEach(function (p) { total[p] = (total[p] || 0) + a.perProject[p].min; sum += a.perProject[p].min; });
      eps += a.episodes.length; dist += a.distractions; checks += a.checks;
      if (a.longest.len > best.len) best = { len: a.longest.len, p: a.longest.p, day: PROFILES[i].name };
    });
    return { days: days, total: total, sum: sum, eps: eps, dist: dist, checks: checks, best: best,
      names: cfg.projects.map(function (p) { return p.name; }) };
  }

  function selectDay(i, scroll) {
    selected = i;
    explorer.setDay(WEEK[i]);
    dayTitle.textContent = "Attention Ledger · " + PROFILES[i].name + ", sample data";
    explorerEl.querySelector('input[name="al-day"][value="' + i + '"]').checked = true;
    drawWeek();
    if (scroll) explorerEl.scrollIntoView({ behavior: still.matches ? "auto" : "smooth", block: "start" });
  }
  explorerEl.querySelectorAll('input[name="al-day"]').forEach(function (inp) {
    inp.addEventListener("change", function () { if (inp.checked) selectDay(+inp.value); });
  });

  // One stacked bar per day, a segment per project, in the same fixed colours as everywhere else.
  var weekEl = document.getElementById("al-weekbars");
  var weekTip = el("div", "al-tip");
  weekTip.hidden = true;
  weekEl.appendChild(weekTip);
  function tipAt(node, value, name) {
    weekTip.textContent = "";
    weekTip.appendChild(el("strong", null, value));
    weekTip.appendChild(el("span", null, name));
    weekTip.hidden = false;
    var box = weekEl.getBoundingClientRect(), rc = node.getBoundingClientRect(), w = weekTip.offsetWidth;
    var x = Math.max(w / 2 + 4, Math.min(box.width - w / 2 - 4, rc.left + rc.width / 2 - box.left));
    weekTip.style.left = x + "px";
    weekTip.style.top = (rc.top - box.top - weekTip.offsetHeight - 6) + "px";
  }
  function drawWeek() {
    var st = weekStats();
    Array.prototype.slice.call(weekEl.children).forEach(function (c) { if (c !== weekTip) c.remove(); });
    var order = st.names.concat([UN]);
    var max = Math.max.apply(null, st.days.map(function (a) { return a.tracked; }).concat([1]));
    var list = el("ol", "al-week-list");
    st.days.forEach(function (a, i) {
      var li = el("li", "al-week-row" + (i === selected ? " is-on" : ""));
      var name = el("button", "al-week-day", PROFILES[i].name.slice(0, 3));
      name.type = "button";
      name.setAttribute("aria-pressed", i === selected ? "true" : "false");
      name.setAttribute("aria-label", "Open " + PROFILES[i].name);
      name.addEventListener("click", function () { selectDay(i, true); });
      li.appendChild(name);
      var track = el("span", "al-week-track");
      var stack = el("span", "al-week-stack");
      stack.style.width = (a.tracked / max * 100) + "%";
      order.forEach(function (p) {
        var x = a.perProject[p];
        if (!x || x.min < 1) return;
        var seg = el("span", "al-week-seg al-c-" + AL.roleOf(p, st.names));
        seg.style.flexGrow = x.min;
        var label = p + ", " + PROFILES[i].name;
        seg.tabIndex = 0;
        seg.setAttribute("aria-label", label + ": " + AL.hm(x.min));
        seg.addEventListener("pointerenter", function () { tipAt(seg, AL.hm(x.min), label); });
        seg.addEventListener("focus", function () { tipAt(seg, AL.hm(x.min), label); });
        seg.addEventListener("pointerleave", function () { weekTip.hidden = true; });
        seg.addEventListener("blur", function () { weekTip.hidden = true; });
        seg.addEventListener("click", function () { selectDay(i, true); });
        stack.appendChild(seg);
      });
      track.appendChild(stack);
      li.appendChild(track);
      li.appendChild(el("span", "al-week-total", AL.hm(a.tracked)));
      list.appendChild(li);
    });
    weekEl.insertBefore(list, weekTip);
    var legend = el("ul", "al-legend");
    order.forEach(function (p) {
      if (!st.total[p]) return;
      var k = el("li");
      k.appendChild(el("span", "al-key al-c-" + AL.roleOf(p, st.names)));
      k.appendChild(document.createTextNode(p === UN ? "Unassigned work" : p));
      legend.appendChild(k);
    });
    weekEl.insertBefore(legend, weekTip);

    var tiles = document.getElementById("al-week-tiles");
    tiles.textContent = "";
    var top = st.names.slice().sort(function (x, y) { return (st.total[y] || 0) - (st.total[x] || 0); })[0];
    [["Tracked this week", AL.hm(st.sum), "no timers, no entries"],
      ["Most time on", top || "–", top ? AL.hm(st.total[top]) + " · " + Math.round(st.total[top] / st.sum * 100) + "%" : ""],
      ["Longest stretch", AL.hm(st.best.len), st.best.len ? st.best.p + ", " + st.best.day : ""],
      ["Interruptions", String(st.eps), st.dist + " distractions · " + st.checks + " phone checks"]]
      .forEach(function (t) {
        var d = el("div", "al-tile");
        d.appendChild(el("span", "al-tile-label", t[0]));
        d.appendChild(el("span", "al-tile-value", t[1]));
        if (t[2]) d.appendChild(el("span", "al-tile-sub", t[2]));
        tiles.appendChild(d);
      });
    drawGuess(st);
  }

  // ====================== 02  Is it what I thought? ======================
  // The guesses are the visitor's own. They start where a typical guess lands:
  // deep work overestimated, meetings and email underestimated.
  var guessEl = document.getElementById("al-guess"), guessSum = document.getElementById("al-guess-sum");
  var GUESS_BIAS = [1.45, 1.1, 0.55];
  var guesses = null;
  function half(h) { return Math.max(0, Math.round(h * 2) / 2); }
  function hours(h) { return (h % 1 ? h.toFixed(1) : String(h)) + "h"; }
  function drawGuess(st) {
    var names = st.names.filter(function (n) { return st.total[n]; });
    if (!guesses) {
      guesses = {};
      names.forEach(function (n, i) { guesses[n] = half(st.total[n] / 60 * (GUESS_BIAS[i] || 1)); });
    }
    guessEl.textContent = "";
    // A fixed scale per week: twice the biggest real total, so any guess fits.
    var top = Math.ceil(Math.max.apply(null, names.map(function (n) { return st.total[n] / 60; }).concat([1])) * 2);
    var rows = [];
    function summary() {
      var worst = null;
      rows.forEach(function (r) { if (!worst || Math.abs(r.diff) > Math.abs(worst.diff)) worst = r; });
      guessSum.textContent = worst && Math.abs(worst.diff) >= 15
        ? "Biggest gap: " + worst.n + ", off by " + AL.hm(Math.abs(worst.diff)) + "."
        : "Your guesses are close this week.";
    }
    names.forEach(function (n, i) {
      if (guesses[n] == null) guesses[n] = half(st.total[n] / 60);
      var actual = st.total[n];
      var row = el("div", "al-guess-row");
      var id = "al-guess-" + i;
      var lab = el("label", "al-guess-name", n);
      lab.htmlFor = id;
      var slider = el("input");
      slider.type = "range"; slider.min = "0"; slider.max = String(top); slider.step = "0.5"; slider.id = id;
      var out = el("output", "al-guess-out");
      out.htmlFor = id;
      var track = el("span", "al-guess-track");
      var bar = el("span", "al-guess-bar al-c-" + AL.roleOf(n, st.names));
      bar.style.width = (actual / 60 / top * 100) + "%";
      var mark = el("span", "al-guess-mark");
      track.appendChild(bar);
      track.appendChild(mark);
      var diffEl = el("span", "al-guess-diff");
      var rec = { n: n, diff: 0 };
      rows.push(rec);
      function update() {
        var g = guesses[n];
        slider.value = String(g);
        slider.setAttribute("aria-valuetext", "My guess: " + hours(g));
        out.textContent = "Guess " + hours(g);
        mark.style.width = Math.min(100, g / top * 100) + "%";
        rec.diff = actual - g * 60;
        diffEl.textContent = "Actually " + AL.hm(actual) + ", " + (Math.abs(rec.diff) < 15 ? "about what I'd have guessed"
          : AL.hm(Math.abs(rec.diff)) + (rec.diff < 0 ? " less" : " more") + " than I'd have guessed");
      }
      slider.addEventListener("input", function () { guesses[n] = +slider.value; update(); summary(); });
      [lab, slider, out, track, diffEl].forEach(function (x) { row.appendChild(x); });
      guessEl.appendChild(row);
      update();
    });
    summary();
  }

  // ====================== 03  Your projects, your rules ======================
  var labels = {};
  WEEK.forEach(function (d) { d.segs.forEach(function (s) { labels[s[3]] = (labels[s[3]] || 0) + s[1]; }); });
  var labelList = Object.keys(labels).filter(function (l) {
    var c = cfg.map[l] || cfg.map[l.split(" · ")[0]];
    return c === "work" || c === "career";
  }).sort(function (a, b) { return labels[b] - labels[a]; });
  var catList = document.getElementById("al-cat-list");
  var carry = document.getElementById("al-carry");
  function projectOf(label) {
    var p = cfg.projects.filter(function (x) { return x.match.indexOf(label) >= 0; })[0];
    return p ? p.name : "";
  }
  function applyConfig() {
    explorer.setConfig(cfg);
    drawWeek();
  }
  function drawRules() {
    catList.textContent = "";
    carry.checked = cfg.carry > 0;
    labelList.forEach(function (name, i) {
      var row = el("div", "al-cat-row");
      var id = "al-rule-" + i;
      var lab = el("label", "al-cat-name", name);
      lab.htmlFor = id;
      var sel = el("select");
      sel.id = id;
      cfg.projects.map(function (p) { return p.name; }).concat([""]).forEach(function (p) {
        var o = el("option", null, p || "No project");
        o.value = p;
        sel.appendChild(o);
      });
      sel.value = projectOf(name);
      sel.addEventListener("change", function () {
        cfg.projects.forEach(function (p) { p.match = p.match.filter(function (m) { return m !== name; }); });
        if (sel.value) cfg.projects.filter(function (p) { return p.name === sel.value; })[0].match.push(name);
        applyConfig();
      });
      row.appendChild(lab);
      row.appendChild(el("span", "al-cat-time", AL.hm(labels[name])));
      row.appendChild(sel);
      catList.appendChild(row);
    });
  }
  carry.addEventListener("change", function () { cfg.carry = carry.checked ? 10 : 0; applyConfig(); });
  document.getElementById("al-cat-reset").addEventListener("click", function () {
    cfg = clone(DEFAULT_CONFIG);
    guesses = null;
    drawRules();
    applyConfig();
  });
  drawRules();
  selectDay(0);

  // ====================== 04  What actually gets stored ======================
  var TWO_PART = ["co", "com", "org", "net", "ac", "gov", "edu"];
  function registrable(host) {
    var parts = host.replace(/^www\./, "").split(".");
    if (parts.length <= 2) return parts.join(".");
    var keep = parts[parts.length - 1].length === 2 && TWO_PART.indexOf(parts[parts.length - 2]) >= 0 ? 3 : 2;
    return parts.slice(-keep).join(".");
  }
  function cleanTitle(raw, steps) {
    var t = raw, cut = t.indexOf(" - ");
    if (cut >= 0) { steps.push(["Kept only the part before the first \" - \"", t.slice(cut)]); t = t.slice(0, cut); }
    [
      [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "Removed an email address"],
      [/\b(?:https?:\/\/|www\.)\S+/gi, "Removed a web address"],
      [/(?:[A-Za-z]:\\|\\\\)[^\s]*|(?:\/[\w.-]+){2,}\/?/g, "Removed a file path"],
      [/\+?\d[\d\s().-]{7,}\d/g, "Removed a phone number"],
      [/\d{5,}/g, "Removed a long run of digits"]
    ].forEach(function (rule) {
      t = t.replace(rule[0], function (m) { steps.push([rule[1], m]); return ""; });
    });
    t = t.replace(/\s{2,}/g, " ").trim();
    if (t.length > 200) { steps.push(["Cut to 200 characters", t.slice(200)]); t = t.slice(0, 200); }
    return t;
  }
  var NOW = "2026-11-09T10:15:00-05:00";
  var filter = document.getElementById("al-filter");
  var fApp = document.getElementById("al-f-app"), fTitle = document.getElementById("al-f-title");
  var fUrl = document.getElementById("al-f-url"), fPhone = document.getElementById("al-f-phone");
  var fBlock = document.getElementById("al-f-block");
  var fSteps = document.getElementById("al-f-steps"), fOut = document.getElementById("al-f-out");
  function source() { return filter.querySelector('input[name="al-src"]:checked').value; }
  function runFilter() {
    var src = source(), steps = [], out = null;
    filter.querySelectorAll(".al-field[data-for]").forEach(function (f) { f.hidden = f.dataset.for !== src; });
    var blocked = fBlock.checked;
    if (src === "laptop") {
      var opt = fApp.selectedOptions[0];
      if (blocked) {
        steps.push(["App is on my block list: name, title and everything else dropped", fApp.value + " · " + fTitle.value]);
        out = { event: "span", app: "Private", private: true, duration_s: 240 };
      } else if (opt.dataset.allow) {
        var title = cleanTitle(fTitle.value, steps);
        out = { event: "span", app: fApp.value, duration_s: 240 };
        if (title) out.title = title;
        else steps.push(["Nothing safe was left of the title, so none is kept", ""]);
      } else {
        steps.push(["App isn't on the title allowlist: the whole title is dropped", fTitle.value]);
        out = { event: "span", app: fApp.value, duration_s: 240 };
      }
      out = Object.assign({ schema_version: 1, ts: NOW, device: "laptop", source: "desktop-agent" }, out);
    } else if (src === "browser") {
      var u;
      try { u = new URL(fUrl.value.trim()); } catch (e) { u = null; }
      if (!u) {
        steps.push(["Not an address it can read: nothing is written", fUrl.value]);
      } else if (!/^https?:$/.test(u.protocol)) {
        steps.push(["A browser or file page: skipped entirely", fUrl.value]);
      } else if (u.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.indexOf(":") >= 0) {
        steps.push(["A local address: skipped entirely", fUrl.value]);
      } else {
        var dom = registrable(u.hostname.toLowerCase());
        if (u.hostname.replace(/^www\./, "") !== dom) steps.push(["Kept only the registrable domain", u.hostname.slice(0, u.hostname.length - dom.length)]);
        if (u.pathname && u.pathname !== "/") steps.push(["Dropped the path", u.pathname]);
        if (u.search) steps.push(["Dropped the query", u.search]);
        if (u.hash) steps.push(["Dropped the fragment", u.hash]);
        steps.push(["Never read: the page's title and contents", ""]);
        if (blocked) {
          steps.push(["Site is on my block list: the domain is dropped too", dom]);
          out = { event: "span", app: "Private", private: true, duration_s: 240 };
        } else out = { event: "span", app: "msedge.exe", domain: dom, duration_s: 240 };
        out = Object.assign({ schema_version: 1, ts: NOW, device: "laptop", source: "browser-extension" }, out);
      }
    } else {
      var name = fPhone.value.replace(/^My (\w+) app \(blocked\)$/, "$1 app");
      steps.push(["Only that it opened, and when. Nothing inside the app is visible to it", ""]);
      if (blocked) {
        steps.push(["App is on my block list: logged without its name", name]);
        out = { event: "open", app: "Private", private: true };
      } else out = { event: "open", app: fPhone.value };
      out = Object.assign({ schema_version: 1, ts: NOW, device: "phone", source: "ios-shortcuts" }, out);
    }
    fSteps.textContent = "";
    if (!steps.length) steps.push(["Nothing needed removing", ""]);
    steps.forEach(function (s) {
      var li = el("li");
      li.appendChild(el("span", null, s[0]));
      if (s[1]) li.appendChild(el("del", null, s[1]));
      fSteps.appendChild(li);
    });
    fOut.textContent = out ? JSON.stringify(out, null, 2) : "(nothing)";
  }
  filter.querySelectorAll('input[name="al-src"]').forEach(function (i) {
    i.addEventListener("change", function () {
      var src = source();
      fBlock.checked = src === "laptop" ? !!fApp.selectedOptions[0].dataset.block : src === "phone" ? !!fPhone.selectedOptions[0].dataset.block : false;
      runFilter();
    });
  });
  fApp.addEventListener("change", function () { fBlock.checked = !!fApp.selectedOptions[0].dataset.block; runFilter(); });
  fPhone.addEventListener("change", function () { fBlock.checked = !!fPhone.selectedOptions[0].dataset.block; runFilter(); });
  [fTitle, fUrl].forEach(function (i) { i.addEventListener("input", runFilter); });
  fBlock.addEventListener("change", runFilter);
  filter.querySelectorAll("[data-url]").forEach(function (b) {
    b.addEventListener("click", function () { fUrl.value = b.dataset.url; fBlock.checked = !!b.dataset.block; runFilter(); });
  });
  runFilter();

  // ====================== 05  What counts as an interruption? ======================
  var rWhat = document.getElementById("al-r-what"), rSecs = document.getElementById("al-r-secs");
  var rOut = document.getElementById("al-r-secs-out"), rStrip = document.getElementById("al-r-strip");
  var rVerdict = document.getElementById("al-r-verdict"), rWhy = document.getElementById("al-r-why");
  function secsText(s) {
    if (s < 60) return s + (s === 1 ? " second" : " seconds");
    var m = Math.floor(s / 60), r = s % 60;
    return m + " min" + (r ? " " + r + " s" : "");
  }
  function runRules() {
    var parts = rWhat.value.split("|"), what = parts[0], cat = parts[1];
    var dev = document.querySelector('input[name="al-r-dev"]:checked').value;
    var s = +rSecs.value;
    rOut.textContent = secsText(s);
    var verdict, why, cls;
    if (dev === "laptop" && s < 3) {
      verdict = "Passing through"; cls = "pass";
      why = "Anything in front for under 3 seconds is folded into what came before, so this is just more time on the inventory app.";
    } else if (cat === "distraction" && s < 10) {
      verdict = "Too short to count"; cls = "pass";
      why = "A distraction has to last 10 seconds or more. A glance doesn't count.";
    } else if (cat === "distraction") {
      verdict = "Distraction"; cls = "drift";
      why = (dev === "phone" ? "Picking up the phone for " : "Leaving the inventory app for ") + what + ", which is in my distraction category, for 10 seconds or more. It counts against the inventory app as an interruption and a distraction, with what I came back to.";
    } else if (dev === "phone") {
      verdict = "Phone check"; cls = "check";
      why = "Picking up the phone during project work for anything else counts as a phone check: an interruption to the inventory app, but not a distraction.";
    } else if (s < 60) {
      verdict = "Not counted"; cls = "pass";
      why = "A quick detour on the laptop under a minute, like a search, isn't counted. And coming back within 2 minutes still counts as being on the task.";
    } else {
      verdict = "Detour"; cls = "check";
      why = "A minute or more on the laptop on something that isn't project work. It counts against the inventory app as an interruption, but not as a distraction.";
    }
    rVerdict.textContent = verdict;
    rVerdict.className = "al-verdict al-verdict-" + cls;
    rWhy.textContent = why;
    // A little strip: task, the excursion to scale, back to the task.
    rStrip.textContent = "";
    var w = Math.max(1.5, Math.min(60, s / 600 * 60));
    [["p1", 20 + (60 - w) / 2, "VS Code"], [cls === "pass" && dev === "laptop" ? "focus-faint" : cat === "distraction" ? "drift" : "other", w, what],
      ["p1", 20 + (60 - w) / 2, "VS Code"]].forEach(function (b) {
      var seg = el("span", "al-strip-seg al-c-" + b[0]);
      seg.style.flexBasis = b[1] + "%";
      rStrip.appendChild(seg);
    });
  }
  rWhat.addEventListener("change", runRules);
  rSecs.addEventListener("input", runRules);
  document.querySelectorAll('input[name="al-r-dev"]').forEach(function (i) { i.addEventListener("change", runRules); });
  runRules();

  // ====================== 06  The format says no ======================
  var EX = {
    ok: { schema_version: 1, ts: "2026-11-09T09:25:30-05:00", device: "laptop", source: "browser-extension", event: "span", app: "msedge.exe", domain: "github.com", duration_s: 240 },
    url: { schema_version: 1, ts: "2026-11-09T09:25:30-05:00", device: "laptop", source: "browser-extension", event: "span", app: "msedge.exe", domain: "github.com", url: "https://github.com/me/private-repo", duration_s: 240 },
    path: { schema_version: 1, ts: "2026-11-09T09:25:30-05:00", device: "laptop", source: "browser-extension", event: "span", app: "msedge.exe", domain: "github.com/me/private-repo", duration_s: 240 },
    private: { schema_version: 1, ts: "2026-11-09T09:41:00-05:00", device: "laptop", source: "desktop-agent", event: "span", app: "Private", private: true, title: "Statement March", duration_s: 95 },
    tz: { schema_version: 1, ts: "2026-11-09T09:31:12", device: "phone", source: "ios-shortcuts", event: "open", app: "Instagram" }
  };
  var FIELDS = ["schema_version", "ts", "device", "source", "event", "app", "domain", "title", "duration_s", "paused", "private", "label", "until", "scope", "value"];
  var EVENTS = ["span", "media", "open", "close", "lock", "unlock", "idle_start", "idle_end", "pause", "resume", "label", "context"];
  var SOURCES = ["desktop-agent", "browser-extension", "ios-shortcuts", "ios-app"];
  var TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
  function check(text) {
    var o, errs = [];
    try { o = JSON.parse(text); } catch (e) { return ["Not valid JSON: " + e.message.replace(/^JSON\.parse: /, "")]; }
    if (!o || typeof o !== "object" || Array.isArray(o)) return ["A line must be one JSON object"];
    Object.keys(o).forEach(function (k) { if (FIELDS.indexOf(k) < 0) errs.push("\"" + k + "\" isn't a field the format allows, so it can never be stored"); });
    if (o.schema_version !== 1) errs.push("\"schema_version\" must be 1");
    if (typeof o.ts !== "string" || !TS.test(o.ts)) errs.push("\"ts\" must be an ISO time with its UTC offset, like 2026-11-09T09:00:10-05:00");
    if (o.device !== "laptop" && o.device !== "phone") errs.push("\"device\" must be laptop or phone");
    if (SOURCES.indexOf(o.source) < 0) errs.push("\"source\" must be one of " + SOURCES.join(", "));
    if (EVENTS.indexOf(o.event) < 0) errs.push("\"event\" must be one of the known event types");
    if ((o.event === "span" || o.event === "media") && (typeof o.duration_s !== "number" || o.duration_s < 0 || o.duration_s > 86400))
      errs.push("A " + o.event + " needs \"duration_s\" between 0 and 86400 seconds");
    if (o.event === "span" && !o.app && !o.domain) errs.push("A span needs an app or a domain");
    if ((o.event === "open" || o.event === "close") && !o.app) errs.push("An " + o.event + " needs the app's name");
    if (o.domain != null && (typeof o.domain !== "string" || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(o.domain)))
      errs.push("\"domain\" must be a bare lowercase domain, never a path, query or full address");
    if (o.title != null && (typeof o.title !== "string" || o.title.length > 200)) errs.push("\"title\" must be text of at most 200 characters");
    if (o.private === true) {
      if (o.app !== "Private") errs.push("A private record must have \"app\": \"Private\"");
      if (o.title != null || o.domain != null) errs.push("A private record can't carry a title or a domain");
    }
    if ((o.event === "label" || o.event === "context") && !o.label) errs.push("A " + o.event + " event needs a \"label\"");
    return errs;
  }
  var sIn = document.getElementById("al-s-in"), sVerdict = document.getElementById("al-s-verdict"), sErrs = document.getElementById("al-s-errors");
  function runSchema() {
    var errs = check(sIn.value);
    sVerdict.textContent = errs.length ? "Rejected" : "Valid: this line would be accepted";
    sVerdict.className = "al-verdict " + (errs.length ? "al-verdict-drift" : "al-verdict-ok");
    sErrs.textContent = "";
    errs.forEach(function (e) { sErrs.appendChild(el("li", null, e)); });
  }
  function loadEx(k) { sIn.value = JSON.stringify(EX[k], null, 2); runSchema(); }
  document.querySelectorAll("#al-schema [data-ex]").forEach(function (b) { b.addEventListener("click", function () { loadEx(b.dataset.ex); }); });
  sIn.addEventListener("input", runSchema);
  loadEx("ok");

  // ====================== 07  Pause one, or all ======================
  var pFrom = document.getElementById("al-p-from"), pGo = document.getElementById("al-p-go");
  var pSteps = document.getElementById("al-p-steps"), pDevices = document.getElementById("al-p-devices");
  var paused = false, timers = [];
  function devState(dev, text, on) {
    var d = pDevices.querySelector('[data-dev="' + dev + '"]');
    d.querySelector(".al-dev-state").textContent = text;
    d.classList.toggle("is-paused", !!on);
  }
  function resetDevices() {
    ["laptop", "browser", "phone"].forEach(function (d) { devState(d, "Tracking", false); });
    devState("cloud", "Switch: off", false);
  }
  function plan(from, scope, mins) {
    var len = mins ? "for " + (mins === 60 ? "1 hour" : mins + " minutes") : "until resumed";
    var names = { phone: "iPhone", laptop: "Laptop agent", browser: "Browser" };
    var s = [];
    s.push({ dev: from, text: names[from] + " pauses itself " + len + " and writes one pause line" });
    if (from === "browser" && scope === "device") return s.concat([{ note: "The laptop agent and the phone keep tracking. Other browsers keep tracking too." }]);
    if (scope === "device") return s.concat([{ note: "Every other device keeps tracking." }]);
    if (from === "browser") s.push({ dev: "laptop", text: "Laptop agent hears it from the extension, over the laptop's own loopback address" });
    if (from === "laptop") s.push({ dev: "browser", text: "Every browser hears it from the laptop agent and shows \"Paused: all devices\"" });
    s.push({ dev: "cloud", text: (from === "phone" ? "iPhone" : "Laptop agent") + " flips the switch file in my iCloud Drive folder" });
    if (from === "phone") {
      s.push({ dev: "laptop", text: "Once iCloud syncs it, usually within a minute, the laptop agent notices within 5 seconds" });
      s.push({ dev: "browser", text: "Every browser hears it from the laptop agent" });
    } else {
      s.push({ dev: "phone", text: "Once iCloud syncs it, the iPhone's next automation sees the switch and logs nothing" });
    }
    s.push({ note: "While paused, each device's log holds one pause line and one resume line, and nothing in between." + (mins ? " A timed pause ends on its own." : "") });
    return s;
  }
  function run() {
    timers.forEach(clearTimeout); timers = [];
    if (paused) {
      paused = false;
      pGo.textContent = "Pause";
      resetDevices();
      pSteps.textContent = "";
      pSteps.appendChild(el("li", "al-p-note", "Resumed. Each paused device writes one resume line and carries on."));
      return;
    }
    paused = true;
    pGo.textContent = "Resume";
    resetDevices();
    pSteps.textContent = "";
    var scope = document.querySelector('input[name="al-p-scope"]:checked').value;
    var mins = +document.querySelector('input[name="al-p-for"]:checked').value;
    var gap = still.matches ? 0 : 650;
    plan(pFrom.value, scope, mins).forEach(function (st, i) {
      timers.push(setTimeout(function () {
        if (st.dev === "cloud") devState("cloud", "Switch: paused", true);
        else if (st.dev) devState(st.dev, "Paused", true);
        var li = el("li", st.note ? "al-p-note" : null, st.note || st.text);
        pSteps.appendChild(li);
      }, i * gap));
    });
  }
  pGo.addEventListener("click", run);
  [pFrom].concat(Array.prototype.slice.call(document.querySelectorAll('input[name="al-p-scope"], input[name="al-p-for"]'))).forEach(function (i) {
    i.addEventListener("change", function () {
      if (paused) { paused = false; pGo.textContent = "Pause"; }
      timers.forEach(clearTimeout); timers = [];
      resetDevices();
      pSteps.textContent = "";
    });
  });
})();
