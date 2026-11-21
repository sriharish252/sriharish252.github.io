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

  // ====================== 01  A sample week ======================
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
      focus: [["VS Code", 6], ["github.com", 2], ["docs.google.com", 2], ["Slack", 2], ["Terminal", 1]] },
    { name: "Tuesday", date: "2026-11-10", seed: 21, drift: 0.07, comm: 0.1, other: 0.05, len: [20, 55],
      focus: [["Teams", 5], ["Outlook", 3], ["docs.google.com", 3], ["VS Code", 2], ["Slack", 2]] },
    { name: "Wednesday", date: "2026-11-11", seed: 3, drift: 0.24, comm: 0.1, other: 0.08, len: [8, 30], phoneDrift: 0.55,
      focus: [["VS Code", 4], ["stackoverflow.com", 2], ["github.com", 2], ["Postman", 2], ["Slack", 1]] },
    { name: "Thursday", date: "2026-11-12", seed: 42, drift: 0.05, comm: 0.05, other: 0.04, len: [25, 70],
      focus: [["VS Code", 7], ["Terminal", 2], ["github.com", 2]], pause: { s: 400, e: 430, scope: "all" } },
    { name: "Friday", date: "2026-11-13", seed: 15, drift: 0.15, comm: 0.08, other: 0.08, len: [12, 40],
      focus: [["linkedin.com", 4], ["greenhouse.io", 2], ["myworkdayjobs.com", 2], ["VS Code", 3], ["mail.google.com", 2]] }
  ];
  var SPAN = 510, LUNCH = { s: 210, e: 255 };   // 9:00 to 17:30, lunch 12:30 to 13:15

  function makeDay(p) {
    var r = rng(p.seed), segs = [], idle = [], t = 0, prev = null;
    var stops = [LUNCH].concat(p.pause ? [p.pause] : []);
    function nextStop(t) {
      var s = SPAN;
      stops.forEach(function (x) { if (x.s > t && x.s < s) s = x.s; });
      return s;
    }
    while (t < SPAN - 2) {
      var inStop = stops.filter(function (x) { return t >= x.s && t < x.e; })[0];
      if (inStop) { t = inStop.e; prev = null; continue; }
      var x = r(), label, len;
      if (x < p.drift && prev !== "drift") { label = weighted(r, [["youtube.com", 3], ["reddit.com", 2]]); len = between(r, 2, 12); prev = "drift"; }
      else if (x < p.drift + p.comm) { label = "web.whatsapp.com"; len = between(r, 2, 8); prev = "comm"; }
      else if (x < p.drift + p.comm + p.other) { label = weighted(r, [["amazon.com", 2], ["Spotify", 1], ["File Explorer", 1]]); len = between(r, 1, 5); prev = "other"; }
      else {
        do { label = weighted(r, p.focus); } while (segs.length && segs[segs.length - 1][3] === label && p.focus.length > 1);
        len = between(r, p.len[0], p.len[1]); prev = "focus";
      }
      len = Math.min(len, nextStop(t) - t);
      if (len < 1) { t += 1; continue; }
      segs.push([t, len, "laptop", label]);
      t += len;
      if (r() < 0.08 && t < SPAN - 15) { var g = between(r, 4, 9); idle.push({ s: t, e: t + g }); t += g; prev = null; }
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

  var DEFAULT_CATS = clone(AL.CATEGORIES);
  var cats = clone(DEFAULT_CATS);
  var selected = 0;

  var explorerEl = document.getElementById("al-explorer");
  var explorer = AL.mount(explorerEl, { day: WEEK[0], categories: cats });
  var dayTitle = document.getElementById("al-day-title");

  function selectDay(i, scroll) {
    selected = i;
    explorer.setDay(WEEK[i]);
    dayTitle.textContent = "Attention Ledger · " + PROFILES[i].name + ", sample day";
    explorerEl.querySelector('input[name="al-day"][value="' + i + '"]').checked = true;
    drawHeat();
    if (scroll) explorerEl.scrollIntoView({ behavior: still.matches ? "auto" : "smooth", block: "start" });
  }
  explorerEl.querySelectorAll('input[name="al-day"]').forEach(function (inp) {
    inp.addEventListener("change", function () { if (inp.checked) selectDay(+inp.value); });
  });

  // The heat map: focus minutes in each hour, one row per day, one blue hue.
  var heat = document.getElementById("al-heat");
  var heatTip = el("div", "al-tip");
  heatTip.hidden = true;
  heat.appendChild(heatTip);
  function drawHeat() {
    Array.prototype.slice.call(heat.children).forEach(function (c) { if (c !== heatTip) c.remove(); });
    var grid = el("div", "al-heat-grid");
    grid.appendChild(el("span", "al-heat-corner"));
    for (var h = 0; h < 9; h++) {
      var hr = 9 + h;
      grid.appendChild(el("span", "al-heat-hour", (hr > 12 ? hr - 12 : hr) + (hr < 12 ? "am" : "pm")));
    }
    WEEK.forEach(function (day, i) {
      var rowName = el("button", "al-heat-day" + (i === selected ? " is-on" : ""), PROFILES[i].name.slice(0, 3));
      rowName.type = "button";
      rowName.setAttribute("aria-pressed", i === selected ? "true" : "false");
      rowName.setAttribute("aria-label", "Open " + PROFILES[i].name);
      rowName.addEventListener("click", function () { selectDay(i, true); });
      grid.appendChild(rowName);
      var hours = AL.focusByHour(AL.prepare(day), cats);
      hours.forEach(function (m, h) {
        var cap = h === 8 ? 30 : 60;
        var share = Math.min(1, m / cap);
        var step = m === 0 ? 0 : share < 0.25 ? 1 : share < 0.5 ? 2 : share < 0.75 ? 3 : 4;
        var cell = el("button", "al-heat-cell al-heat-" + step + (i === selected ? " is-on" : ""), String(Math.round(m)));
        cell.type = "button";
        var hr = 9 + h, when = (hr > 12 ? hr - 12 : hr) + ":00";
        var label = PROFILES[i].name + " from " + when + ": " + Math.round(m) + " of " + cap + " minutes on a task";
        cell.setAttribute("aria-label", label + ". Open this day");
        function show() {
          heatTip.textContent = "";
          heatTip.appendChild(el("strong", null, Math.round(m) + " min focused"));
          heatTip.appendChild(el("span", null, PROFILES[i].name + ", " + when + (h === 8 ? " to 5:30" : " hour")));
          heatTip.hidden = false;
          var box = heat.getBoundingClientRect(), rc = cell.getBoundingClientRect(), w = heatTip.offsetWidth;
          var x = Math.max(w / 2 + 4, Math.min(box.width - w / 2 - 4, rc.left + rc.width / 2 - box.left));
          heatTip.style.left = x + "px";
          heatTip.style.top = (rc.top - box.top - heatTip.offsetHeight - 6) + "px";
        }
        cell.addEventListener("pointerenter", show);
        cell.addEventListener("focus", show);
        cell.addEventListener("pointerleave", function () { heatTip.hidden = true; });
        cell.addEventListener("blur", function () { heatTip.hidden = true; });
        cell.addEventListener("click", function () { selectDay(i, true); });
        grid.appendChild(cell);
      });
    });
    heat.insertBefore(grid, heatTip);
    var key = el("p", "al-heat-key");
    key.appendChild(el("span", null, "Minutes on a task per hour"));
    var ramp = el("span", "al-heat-ramp");
    ["0", "1–14", "15–29", "30–44", "45–60"].forEach(function (t, s) {
      var k = el("span", "al-heat-step");
      k.appendChild(el("i", "al-heat-" + s));
      k.appendChild(document.createTextNode(t));
      ramp.appendChild(k);
    });
    key.appendChild(ramp);
    heat.insertBefore(key, heatTip);
    drawWeekTiles();
  }

  function drawWeekTiles() {
    var box = document.getElementById("al-week-tiles");
    var on = 0, dis = 0, checks = 0, best = { len: 0 };
    WEEK.forEach(function (d, i) {
      var a = AL.analyse(AL.prepare(d), cats);
      on += a.onTask; dis += a.distractions; checks += a.checks;
      if (a.longest.len > best.len) best = { len: a.longest.len, day: PROFILES[i].name };
    });
    box.textContent = "";
    [["On a task this week", AL.hm(on)], ["Longest focus", AL.hm(best.len), best.day], ["Distractions", String(dis)], ["Phone checks", String(checks)]]
      .forEach(function (t) {
        var d = el("div", "al-tile");
        d.appendChild(el("span", "al-tile-label", t[0]));
        d.appendChild(el("span", "al-tile-value", t[1]));
        if (t[2]) d.appendChild(el("span", "al-tile-sub", t[2]));
        box.appendChild(d);
      });
  }

  // ====================== 02  Sort it your way ======================
  var FOCUSABLE = ["work", "career", "communication", "music", "personal", "utility"];
  var CHOICES = ["work", "career", "communication", "distraction", "music", "personal", "utility", "other"];
  var labels = {};
  WEEK.forEach(function (d) { d.segs.forEach(function (s) { labels[s[3]] = (labels[s[3]] || 0) + s[1]; }); });
  var labelList = Object.keys(labels).sort(function (a, b) { return labels[b] - labels[a]; });

  var focusBox = document.getElementById("al-focus-checks");
  var catList = document.getElementById("al-cat-list");
  function applyCats() {
    explorer.setCategories(cats);
    drawHeat();
  }
  function drawCatControls() {
    focusBox.textContent = "";
    FOCUSABLE.forEach(function (c) {
      var lab = el("label", "al-check");
      var box = el("input");
      box.type = "checkbox";
      box.checked = cats.focus.indexOf(c) >= 0;
      box.addEventListener("change", function () {
        cats.focus = FOCUSABLE.filter(function (k) {
          return k === c ? box.checked : cats.focus.indexOf(k) >= 0;
        });
        applyCats();
      });
      lab.appendChild(box);
      lab.appendChild(document.createTextNode(" " + AL.CAT_NAMES[c]));
      focusBox.appendChild(lab);
    });
    catList.textContent = "";
    labelList.forEach(function (name, i) {
      var row = el("div", "al-cat-row");
      var id = "al-cat-" + i;
      var lab = el("label", "al-cat-name", name);
      lab.htmlFor = id;
      var sel = el("select");
      sel.id = id;
      CHOICES.forEach(function (c) {
        var o = el("option", null, AL.CAT_NAMES[c]);
        o.value = c;
        sel.appendChild(o);
      });
      sel.value = cats.map[name] || "other";
      sel.addEventListener("change", function () { cats.map[name] = sel.value; applyCats(); });
      row.appendChild(lab);
      row.appendChild(el("span", "al-cat-time", AL.hm(labels[name])));
      row.appendChild(sel);
      catList.appendChild(row);
    });
  }
  document.getElementById("al-cat-reset").addEventListener("click", function () {
    cats = clone(DEFAULT_CATS);
    drawCatControls();
    applyCats();
  });
  drawCatControls();
  selectDay(0);

  // ====================== 03  What actually gets stored ======================
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

  // ====================== 04  Does that count? ======================
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
      why = "Anything in front for under 3 seconds is folded into what came before, so this is just more VS Code.";
    } else if (cat === "distraction" && s < 10) {
      verdict = "Too short to count"; cls = "pass";
      why = "A distraction has to last 10 seconds or more. A glance doesn't count.";
    } else if (cat === "distraction") {
      verdict = "Distraction"; cls = "drift";
      why = (dev === "phone" ? "Picking up the phone for " : "Leaving a task for ") + what + ", which is in my distraction category, for 10 seconds or more. It goes in the report with the task I left and what I came back to.";
    } else if (dev === "phone") {
      verdict = "Phone check"; cls = "check";
      why = "Picking up the phone during a task for anything else counts as a check, not a distraction. The day's total of checks is one of the report's numbers.";
    } else if (s < 60) {
      verdict = "Not counted"; cls = "pass";
      why = "A quick detour on the laptop under a minute, like a search, isn't counted. And coming back within 2 minutes still counts as being on the task.";
    } else {
      verdict = "Detour"; cls = "check";
      why = "A minute or more on the laptop on something outside my focus categories. It's listed, but it isn't a distraction.";
    }
    rVerdict.textContent = verdict;
    rVerdict.className = "al-verdict al-verdict-" + cls;
    rWhy.textContent = why;
    // A little strip: task, the excursion to scale, back to the task.
    rStrip.textContent = "";
    var w = Math.max(1.5, Math.min(60, s / 600 * 60));
    [["focus", 20 + (60 - w) / 2, "VS Code"], [cls === "pass" && dev === "laptop" ? "focus-faint" : cat === "distraction" ? "drift" : cat === "communication" ? "comm" : "other", w, what],
      ["focus", 20 + (60 - w) / 2, "VS Code"]].forEach(function (b) {
      var seg = el("span", "al-strip-seg al-c-" + b[0]);
      seg.style.flexBasis = b[1] + "%";
      rStrip.appendChild(seg);
    });
  }
  rWhat.addEventListener("change", runRules);
  rSecs.addEventListener("input", runRules);
  document.querySelectorAll('input[name="al-r-dev"]').forEach(function (i) { i.addEventListener("change", runRules); });
  runRules();

  // ====================== 05  The format says no ======================
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

  // ====================== 06  Pause one, or all ======================
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
