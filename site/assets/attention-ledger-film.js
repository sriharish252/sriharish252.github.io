// A 42-second film of how Attention Ledger works, drawn live on a 1080 x 1080
// stage. Every frame is a pure function of time (renderAt), so the same code
// plays on the project page and is filmed frame by frame for the video.
// The numbers are the project page's sample week, so the film and the page agree.
window.ALFilm = (function () {
  var W = 1080, LENGTH = 42;
  var AL = window.ALedger;

  // ---- The sample week (see the project page's "Where the week went") ----
  var WEEK = [
    { name: "Inventory app", min: 742, guess: 18, role: "p1" },
    { name: "Meetings and email", min: 645, guess: 6, role: "p3" },
    { name: "Portfolio site", min: 443, guess: 8, role: "p2" },
    { name: "Unassigned", min: 58, guess: null, role: "unassigned" }
  ];
  var TRACKED = 1888, INV = { interruptions: 22, distractions: 12, stretch: 55, top: "Instagram" };
  var SCALE_MIN = 18 * 60, BAR_W = 960;

  // ---- Easing and time helpers ----
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function prog(t, a, b) { return clamp((t - a) / (b - a)); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function inOut(t, a, b, fade) { return Math.min(prog(t, a, a + fade), 1 - prog(t, b - fade, b)); }
  function hm(min) { return AL ? AL.hm(min) : Math.floor(min / 60) + "h " + ("0" + Math.round(min % 60)).slice(-2) + "m"; }
  // The morning plays faster where nothing new happens, slower at the moments worth reading.
  var WARP = [[4.0, 0], [5.3, 20], [7.0, 27], [7.8, 60], [8.7, 95], [9.6, 103], [10.4, 118], [11.2, 152], [11.9, 168], [13.0, 178], [13.6, 230], [14.0, 240]];
  function simMinute(t) {
    if (t <= WARP[0][0]) return 0;
    for (var i = 1; i < WARP.length; i++) {
      if (t <= WARP[i][0]) {
        var a = WARP[i - 1], b = WARP[i];
        return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
      }
    }
    return 240;
  }
  function videoTime(m) {
    for (var i = 1; i < WARP.length; i++) {
      var a = WARP[i - 1], b = WARP[i];
      if (m <= b[1]) return a[0] + (b[0] - a[0]) * (m - a[1]) / ((b[1] - a[1]) || 1);
    }
    return WARP[WARP.length - 1][0];
  }

  // ---- Building the stage ----
  function el(tag, cls, text, style) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (style) Object.assign(n.style, style);
    return n;
  }
  function px(n) { return n + "px"; }
  function box(parent, cls, x, y, w, h, text, style) {
    var n = el("div", cls, text, Object.assign({ left: px(x), top: px(y), width: w == null ? "" : px(w), height: h == null ? "" : px(h) }, style || {}));
    parent.appendChild(n);
    return n;
  }

  function build(stage) {
    var R = {};
    stage.textContent = "";

    // Captions
    R.cap = box(stage, "alf-cap", 60, 56, 960, null);
    R.capTitle = el("span", "alf-cap-title");
    R.capSub = el("span", "alf-cap-sub");
    R.cap.appendChild(R.capTitle);
    R.cap.appendChild(R.capSub);

    // Scene 1: the question
    R.hook = box(stage, "alf-hook", 60, 250, 960, 600);
    R.hookLines = ["Where did", "my week", "actually go?"].map(function (t) {
      var line = el("span", "alf-hook-line");
      var inner = el("span", null, t);
      line.appendChild(inner);
      R.hook.appendChild(line);
      return inner;
    });

    // Scene 2: the devices and the morning filling in
    R.devices = box(stage, "alf-layer", 0, 0, W, W);
    R.zone = box(R.devices, "alf-zone", 60, 240, 960, 500);
    R.zoneLabel = box(R.devices, "alf-zone-label", 90, 222, null, null, "My devices and my own iCloud Drive");
    R.clock = box(R.devices, "alf-clock", 820, 222, 170, null, "9:00 am");
    R.screen = box(R.devices, "alf-screen", 110, 290, 590, 360);
    R.base = box(R.devices, "alf-base", 80, 656, 650, 22);
    R.scrApp = box(R.screen, "alf-scr-app", 26, 18, 400, null, "");
    R.scrBar = box(R.screen, "alf-scr-bar", 26, 62, 538, 52);
    R.urlDomain = box(R.scrBar, "alf-url", 18, 9, null, null, "");
    R.urlPath = box(R.scrBar, "alf-url alf-url-path", 0, 9, null, null, "");
    R.scrBig = box(R.screen, "alf-scr-big", 26, 150, 540, null, "");
    R.code = box(R.screen, "alf-code", 26, 140, 540, 120);
    [440, 320, 380, 250].forEach(function (w, i) { box(R.code, "alf-code-line", (i % 2) * 40, i * 30, w, 14); });
    R.chip = box(R.screen, "alf-chip", 26, 290, null, null, "");
    R.chipKey = el("i", "alf-chip-key");
    R.chipText = el("span");
    R.chip.appendChild(R.chipKey);
    R.chip.appendChild(R.chipText);
    R.phone = box(R.devices, "alf-phone", 790, 280, 190, 380);
    R.phoneApp = box(R.phone, "alf-phone-app", 0, 110, 190, null, "");
    R.phoneTile = box(R.phone, "alf-phone-tile", 55, 160, 80, 80);
    R.phoneTime = box(R.phone, "alf-phone-time", 0, 40, 190, null, "");
    R.phoneChip = box(R.phone, "alf-phone-chip", 0, 270, 190, null, "");

    R.lanes = box(stage, "alf-layer", 0, 0, W, W);
    R.laneLaptop = box(R.lanes, "alf-lane", 210, 790, 810, 58);
    R.lanePhone = box(R.lanes, "alf-lane", 210, 866, 810, 58);
    box(R.lanes, "alf-lane-name", 60, 803, 140, null, "Laptop");
    box(R.lanes, "alf-lane-name", 60, 879, 140, null, "iPhone");
    [["9:00", 0], ["11:00", 0.5], ["1:00", 1]].forEach(function (a) {
      box(R.lanes, "alf-axis" + (a[1] === 1 ? " alf-axis-end" : a[1] === 0 ? "" : " alf-axis-mid"), 210 + 810 * a[1], 938, null, null, a[0]);
    });
    R.laneLegend = box(R.lanes, "alf-legend", 60, 990, 960, null, "");
    [["p1", "Inventory app"], ["p3", "Meetings and email"], ["p2", "Portfolio site"], ["drift", "Distraction"], ["other", "Not project time"]].forEach(function (k) {
      var s = el("span");
      s.appendChild(el("i", "al-c-" + k[0]));
      s.appendChild(document.createTextNode(k[1]));
      R.laneLegend.appendChild(s);
    });
    R.blocks = [];
    if (AL) {
      var a = AL.analyse(AL.prepare(AL.MONDAY), AL.CONFIG);
      a.day.segs.forEach(function (s) {
        var lane = s.dev === "laptop" ? R.laneLaptop : R.lanePhone;
        var b = el("span", "alf-block al-c-" + s.role);
        lane.appendChild(b);
        R.blocks.push({ seg: s, el: b });
      });
      R.pauseBlocks = [R.laneLaptop, R.lanePhone].map(function (lane) {
        var b = el("span", "alf-block al-paused");
        lane.appendChild(b);
        return b;
      });
      R.monday = a.day;
    }

    // Scenes 3 to 5: the week by project, the guesses, the cuts
    R.week = box(stage, "alf-layer", 0, 0, W, W);
    R.rows = WEEK.map(function (p, i) {
      var y = 280 + i * 165;
      var row = {
        p: p, y: y,
        name: box(R.week, "alf-row-name", 60, y, 640, null, p.name),
        value: box(R.week, "alf-row-value", 620, y, 400, null, ""),
        track: box(R.week, "alf-row-track", 60, y + 58, BAR_W, 54)
      };
      row.bar = box(row.track, "alf-row-bar al-c-" + p.role, 0, 6, 0, 42);
      if (p.guess) {
        row.guess = box(row.track, "alf-row-guess", 0, 0, 0, 54);
        row.guessLabel = box(R.week, "alf-guess-label", 60, y + 122, 960, null, "");
      }
      return row;
    });
    var inv = R.rows[0];
    R.cuts = [];
    var seed = 11, spots = [];
    for (var c = 0; c < INV.interruptions; c++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      spots.push(0.03 + 0.94 * seed / 4294967296);
    }
    spots.sort();
    spots.forEach(function (x) {
      var cut = el("span", "alf-cut");
      cut.style.left = (x * 100) + "%";
      inv.bar.appendChild(cut);
      R.cuts.push(cut);
    });
    R.stats = [
      ["Interruptions", String(INV.interruptions), INV.distractions + " of them distractions"],
      ["Longest stretch", hm(INV.stretch), "in the whole week"],
      ["Pulled off most by", INV.top, "on my phone"]
    ].map(function (s, i) {
      var t = box(R.week, "alf-stat", 60 + i * 330, 520, 300, 220);
      t.appendChild(el("span", "alf-stat-label", s[0]));
      t.appendChild(el("span", "alf-stat-value", s[1]));
      t.appendChild(el("span", "alf-stat-sub", s[2]));
      return t;
    });

    // Scene 6: nothing leaves
    R.priv = box(stage, "alf-layer", 0, 0, W, W);
    R.privZone = box(R.priv, "alf-zone alf-zone-big", 90, 300, 900, 420);
    R.privLabel = box(R.priv, "alf-zone-label alf-zone-label-big", 120, 278, null, null, "Everything stays on my devices");
    R.privCards = [["Laptop", "alf-ico-laptop"], ["My iCloud Drive", "alf-ico-folder"], ["iPhone", "alf-ico-phone"]].map(function (c, i) {
      var card = box(R.priv, "alf-priv-card", 140 + i * 290, 400, 220, 230);
      card.appendChild(el("span", "alf-ico " + c[1]));
      card.appendChild(el("span", "alf-priv-name", c[0]));
      return card;
    });
    R.privLinks = [0, 1].map(function (i) { return box(R.priv, "alf-priv-link", 360 + i * 290, 512, 70, 4); });
    R.privNo = box(R.priv, "alf-no", 90, 780, 900, null, "");
    ["No servers", "No accounts", "No telemetry", "No third-party analytics"].forEach(function (t) { R.privNo.appendChild(el("span", null, t)); });

    // Scene 7: the end card
    R.end = box(stage, "alf-layer alf-end", 0, 0, W, W);
    R.endTitle = box(R.end, "alf-end-title", 60, 250, 960, null, "");
    ["Attention", "Ledger"].forEach(function (t) { R.endTitle.appendChild(el("span", null, t)); });
    R.endBar = box(R.end, "alf-end-bar", 60, 640, 0, 14);
    R.endLine = box(R.end, "alf-end-line", 60, 690, 960, null, "Time tracking I never have to start.");
    R.endUrl = box(R.end, "alf-end-url", 60, 780, 960, null, "sriharish252.github.io/attention-ledger");
    R.endBy = box(R.end, "alf-end-by", 60, 830, 960, null, "Sri Harish Jayaram");
    return R;
  }

  // ---- What each moment shows ----
  var CAPTIONS = [
    [4.3, 9.0, "No timers. No timesheets.", "It runs on my laptop, browsers and iPhone, and works out the rest."],
    [9.0, 13.8, "Sorted as it happens", "By VS Code workspace, site or app. GitHub follows along."],
    [14.2, 21.0, "Where the week went", hm(TRACKED) + " of work, sorted without tracking anything by hand."],
    [21.0, 27.0, "Is it what I thought?", "Dashed is what I'd have guessed. Solid is what actually happened."],
    [27.0, 34.0, "What keeps breaking it up?", "The inventory app, interrupted " + INV.interruptions + " times this week."],
    [34.5, 38.6, "Nothing leaves my devices", "The data and the reports are only ever for me."]
  ];
  function screenFor(m, day) {
    if (day.pause && m >= day.pause.s && m < day.pause.e) return { kind: "pause" };
    if (day.lock.some(function (l) { return m >= l.s && m <= l.e; })) return { kind: "idle", locked: true };
    var seg = day.segs.filter(function (s) { return s.dev === "laptop" && s.s <= m && m < s.e; })[0];
    if (!seg) return { kind: "idle" };
    return { kind: "seg", seg: seg };
  }
  var URLS = { "github.com": "/sri/inventory-app/pull/12", "docs.google.com": "/document/d/1Xq-specs/edit", "youtube.com": "/watch?v=x2Lk9", "amazon.com": "/gp/cart", "web.whatsapp.com": "/" };
  var ROLE_NAME = { p1: "Inventory app", p2: "Portfolio site", p3: "Meetings and email", unassigned: "Unassigned work", drift: "Distraction", other: "Not project time", private: "Private" };

  function renderAt(R, t, opts) {
    opts = opts || {};
    var vis = function (n, o, dy) {
      n.style.opacity = o;
      n.style.transform = dy ? "translateY(" + dy + "px)" : "";
      n.style.visibility = o <= 0.001 ? "hidden" : "visible";
    };

    // Captions
    var cap = CAPTIONS.filter(function (c) { return t >= c[0] && t < c[1]; })[0];
    if (cap) {
      var o = inOut(t, cap[0], cap[1], 0.45);
      R.capTitle.textContent = cap[2];
      R.capSub.textContent = cap[3];
      vis(R.capTitle, o, (1 - easeOut(prog(t, cap[0], cap[0] + 0.5))) * 24);
      vis(R.capSub, o, (1 - easeOut(prog(t, cap[0] + 0.1, cap[0] + 0.6))) * 24);
    } else { vis(R.capTitle, 0); vis(R.capSub, 0); }

    // Scene 1
    var hookOut = 1 - prog(t, 3.5, 4.0);
    vis(R.hook, hookOut);
    R.hookLines.forEach(function (line, i) {
      var p = easeOut(prog(t, 0.2 + i * 0.25, 0.9 + i * 0.25));
      line.style.transform = "translateY(" + ((1 - p) * 110) + "%)";
    });

    // Clock: runs through the morning in scene 2
    var m = simMinute(t);
    var tm = 9 * 60 + Math.floor(m), hh = Math.floor(tm / 60), mm = tm % 60;
    R.clock.textContent = (hh > 12 ? hh - 12 : hh) + ":" + ("0" + mm).slice(-2) + (hh >= 12 ? " pm" : " am");

    // Scene 2
    var dIn = inOut(t, 4.0, 14.4, 0.5);
    vis(R.devices, dIn, (1 - easeOut(prog(t, 4.0, 4.6))) * 30);
    vis(R.lanes, dIn, (1 - easeOut(prog(t, 4.1, 4.7))) * 30);
    var day = R.monday;
    if (day && dIn > 0) {
      var s = screenFor(m, day);
      var role = s.seg ? s.seg.role : null;
      var label = s.seg ? s.seg.label : "";
      var isCode = label.indexOf("VS Code") === 0, isUrl = label && label.indexOf(".") > 0 && !isCode;
      R.screen.className = "alf-screen" + (isCode ? " alf-scr-code" : isUrl ? " alf-scr-web" : s.kind === "pause" ? " alf-scr-paused" : s.kind === "idle" ? " alf-scr-idle" : " alf-scr-app-mode");
      R.scrApp.textContent = isCode ? "VS Code" : isUrl ? "Edge" : s.kind === "pause" ? "" : s.kind === "idle" ? "" : label;
      R.scrBar.style.display = isUrl ? "block" : "none";
      R.code.style.display = isCode || isUrl ? "block" : "none";
      R.code.style.top = isUrl ? "150px" : "140px";
      R.scrBig.textContent = isCode ? label.split(" · ")[1] : s.kind === "pause" ? "Paused on all devices" : s.kind === "idle" ? (s.locked ? "Locked" : "Idle") : isUrl ? "" : label === "Private" ? "A blocked app" : "Team call";
      R.scrBig.style.top = isCode ? "64px" : "150px";
      if (isUrl) {
        R.urlDomain.textContent = label;
        var path = URLS[label] || "";
        R.urlPath.textContent = path;
        R.urlPath.style.left = px(18 + R.urlDomain.offsetWidth);
        // The path is struck out and dropped a moment after the page opens.
        var segStart = videoTime(s.seg.s);
        var strike = prog(t, segStart + 0.35, segStart + 0.75), gone = prog(t, segStart + 0.8, segStart + 1.1);
        R.urlPath.style.setProperty("--strike", (strike * 100) + "%");
        R.urlPath.style.opacity = 1 - gone;
      }
      var showChip = !!role;
      R.chip.style.display = showChip ? "inline-flex" : "none";
      if (showChip) {
        R.chipKey.className = "alf-chip-key al-c-" + role;
        var carried = role === "p1" && isUrl;
        R.chipText.textContent = (ROLE_NAME[role] || "") + (carried ? " (carried on)" : "");
      }
      var ph = day.segs.filter(function (x) { return x.dev === "phone" && x.s <= m && m < x.e; })[0];
      var phPaused = day.pause && m >= day.pause.s && m < day.pause.e;
      R.phone.className = "alf-phone" + (ph ? " is-on" : phPaused ? " is-paused" : "");
      R.phoneApp.textContent = ph ? ph.label : phPaused ? "Paused" : "";
      R.phoneTile.className = "alf-phone-tile" + (ph ? " al-c-" + ph.role : "");
      R.phoneTile.style.display = ph ? "block" : "none";
      R.phoneTime.textContent = ph || phPaused ? "" : R.clock.textContent.replace(/ [ap]m/, "");
      R.phoneChip.textContent = ph ? ROLE_NAME[ph.role] : "";
      R.blocks.forEach(function (b) {
        var shown = Math.max(0, Math.min(b.seg.e, m) - b.seg.s);
        b.el.style.left = (b.seg.s / 240 * 100) + "%";
        b.el.style.width = shown > 0 ? "calc(" + (shown / 240 * 100) + "% - 2px)" : "0";
        b.el.style.display = shown > 0 ? "block" : "none";
      });
      R.pauseBlocks.forEach(function (b) {
        var shown = Math.max(0, Math.min(day.pause.e, m) - day.pause.s);
        b.style.left = (day.pause.s / 240 * 100) + "%";
        b.style.width = shown > 0 ? "calc(" + (shown / 240 * 100) + "% - 2px)" : "0";
        b.style.display = shown > 0 ? "block" : "none";
      });
    }

    // Scenes 3 to 5
    var wIn = inOut(t, 14.2, 34.5, 0.5);
    vis(R.week, wIn);
    var focus = prog(t, 27.0, 27.6);             // scene 5 isolates the inventory app
    R.rows.forEach(function (row, i) {
      var grow = easeOut(prog(t, 14.6 + i * 0.18, 16.4 + i * 0.18));
      var w = row.p.min / SCALE_MIN * BAR_W * grow;
      row.bar.style.width = px(w);
      row.value.textContent = hm(row.p.min * grow);
      var dim = i === 0 ? 1 : 1 - focus;
      vis(row.name, dim); vis(row.value, dim); vis(row.track, i === 0 ? 1 : dim);
      if (row.guess) {
        var gp = easeInOut(prog(t, 21.5 + i * 0.25, 22.5 + i * 0.25));
        row.guess.style.width = px(row.p.guess * 60 / SCALE_MIN * BAR_W * gp);
        var gOut = 1 - focus;
        row.guess.style.opacity = gp > 0 ? gOut : 0;
        var diff = row.p.min - row.p.guess * 60;
        var said = Math.abs(diff) < 60 ? "I'd have said " + row.p.guess + "h: about right"
          : "I'd have said " + row.p.guess + "h: " + hm(Math.abs(diff)) + (diff < 0 ? " less" : " more") + " than I thought";
        row.guessLabel.textContent = said;
        row.guessLabel.className = "alf-guess-label" + (Math.abs(diff) >= 60 ? " is-off" : "");
        vis(row.guessLabel, Math.min(prog(t, 22.6 + i * 0.3, 23.0 + i * 0.3), gOut));
      }
    });
    // The inventory app's bar gets cut by every interruption.
    var cutsShown = Math.floor(prog(t, 27.7, 30.0) * R.cuts.length + 0.0001);
    R.cuts.forEach(function (c, i) { c.style.opacity = i < cutsShown ? 1 : 0; });
    R.stats.forEach(function (st, i) {
      var o = prog(t, 30.2 + i * 0.55, 30.7 + i * 0.55);
      vis(st, o, (1 - easeOut(o)) * 24);
    });

    // Scene 6
    var pIn = inOut(t, 34.4, 38.7, 0.45);
    vis(R.priv, pIn);
    R.privCards.forEach(function (c, i) {
      var o = easeOut(prog(t, 34.7 + i * 0.2, 35.2 + i * 0.2));
      vis(c, o, (1 - o) * 30);
    });
    R.privLinks.forEach(function (l, i) { l.style.transform = "scaleX(" + easeOut(prog(t, 35.4 + i * 0.2, 35.9 + i * 0.2)) + ")"; });
    vis(R.privNo, prog(t, 36.2, 36.7));
    R.privNo.style.setProperty("--strike-n", easeOut(prog(t, 36.6, 37.3)));

    // Scene 7
    var eIn = prog(t, 38.6, 39.1);
    var eOut = opts.loop ? 1 - prog(t, 41.5, 42.0) : 1;
    vis(R.end, Math.min(eIn, eOut));
    Array.prototype.forEach.call(R.endTitle.children, function (line, i) {
      var p = easeOut(prog(t, 38.7 + i * 0.2, 39.4 + i * 0.2));
      line.style.transform = "translateY(" + ((1 - p) * 40) + "px)";
      line.style.opacity = p;
    });
    R.endBar.style.width = px(560 * easeOut(prog(t, 39.4, 40.2)));
    vis(R.endLine, prog(t, 39.8, 40.3));
    vis(R.endUrl, prog(t, 40.2, 40.7));
    vis(R.endBy, prog(t, 40.4, 40.9));
  }

  // ---- Playing it on a page ----
  function mount(container, opts) {
    opts = opts || {};
    var stage = el("div", "alf-stage");
    stage.setAttribute("aria-hidden", "true");
    container.appendChild(stage);
    var R = build(stage);
    var t = opts.start || 0, playing = false, last = null, raf = null;
    function fit() {
      if (opts.fixed) return;
      var s = container.clientWidth / W;
      stage.style.transform = "scale(" + s + ")";
      container.style.height = px(W * s);
    }
    function frame(now) {
      if (!playing) return;
      if (last != null) t = (t + (now - last) / 1000) % LENGTH;
      last = now;
      renderAt(R, t, { loop: true });
      if (opts.onTime) opts.onTime(t);
      raf = requestAnimationFrame(frame);
    }
    function play() { if (playing) return; playing = true; last = null; raf = requestAnimationFrame(frame); }
    function pause() { playing = false; if (raf) cancelAnimationFrame(raf); }
    fit();
    window.addEventListener("resize", fit);
    renderAt(R, t, { loop: true });
    return {
      play: play, pause: pause,
      playing: function () { return playing; },
      seek: function (x) { t = x; renderAt(R, t, { loop: !opts.fixed }); },
      length: LENGTH
    };
  }

  return { mount: mount, LENGTH: LENGTH, SIZE: W };
})();

// The project page: plays while on screen, never on its own for people who
// have asked for less motion, and can always be paused.
(function () {
  var fig = document.getElementById("al-film");
  if (!fig || !window.ALFilm) return;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var holder = fig.querySelector(".alf-holder");
  var btn = fig.querySelector(".alf-play");
  var bar = fig.querySelector(".alf-progress i");
  var film = window.ALFilm.mount(holder, {
    start: still ? 17 : 0,
    onTime: function (t) { bar.style.width = (t / window.ALFilm.LENGTH * 100) + "%"; }
  });
  var wanted = !still;
  function label() {
    var on = film.playing();
    btn.setAttribute("aria-label", on ? "Pause the film" : "Play the film");
    btn.classList.toggle("is-playing", on);
  }
  btn.hidden = false;
  btn.addEventListener("click", function () {
    if (film.playing()) { film.pause(); wanted = false; } else { film.play(); wanted = true; }
    label();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && wanted) film.play(); else film.pause();
        label();
      });
    }, { threshold: 0.35 }).observe(fig);
  } else if (wanted) { film.play(); }
  label();
})();
