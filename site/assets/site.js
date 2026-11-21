// Shared by every page: the theme switch, the Orlando clock (home page only)
// and the image viewer that makes every project image expandable.
(function () {
  var root = document.documentElement;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ---- Theme switch ----
  var button = document.querySelector(".mode");
  if (button) {
    var dark = window.matchMedia("(prefers-color-scheme: dark)");
    var current = function () { return root.dataset.theme || (dark.matches ? "dark" : "light"); };
    var label = function () {
      button.setAttribute("aria-label", "Switch to " + (current() === "dark" ? "light" : "dark") + " theme");
    };
    button.hidden = false;
    label();
    dark.addEventListener("change", label);
    button.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      function apply() {
        root.dataset.theme = next;
        try { localStorage.setItem("theme", next); } catch (e) {}
        label();
      }
      if (!document.startViewTransition || still.matches) { apply(); return; }
      // The new theme spreads out from the button as a circle.
      var r = button.getBoundingClientRect();
      root.style.setProperty("--vt-x", (r.left + r.width / 2) + "px");
      root.style.setProperty("--vt-y", (r.top + r.height / 2) + "px");
      document.startViewTransition(apply);
    });
  }

  // ---- Local time in Orlando, so visitors know when a reply is likely ----
  var clock = document.querySelector(".clock");
  if (clock) {
    try {
      var time = clock.querySelector("time");
      var fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
      var tick = function () { time.textContent = fmt.format(new Date()); };
      tick();
      clock.hidden = false;
      setInterval(tick, 30000);
    } catch (e) {}
  }

  // ---- Image viewer ----
  // Every image in the page content opens full size. The small previews in a
  // closed work row are the exception: clicking those opens the row instead,
  // and the full-size images inside it then open here.
  var images = Array.prototype.slice.call(document.querySelectorAll("main img")).filter(function (img) {
    return !img.closest(".thumbs") && !img.closest("[data-no-zoom]");
  });
  if (!images.length || typeof HTMLDialogElement !== "function") return;

  var box = document.createElement("dialog");
  box.className = "viewer";
  box.setAttribute("aria-label", "Image viewer");
  box.innerHTML =
    '<figure class="viewer-figure"><img class="viewer-img" alt=""><figcaption class="viewer-cap"></figcaption></figure>' +
    '<p class="viewer-count" aria-live="polite"></p>' +
    '<button type="button" class="viewer-btn viewer-close" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<button type="button" class="viewer-btn viewer-prev" aria-label="Previous image">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
    '<button type="button" class="viewer-btn viewer-next" aria-label="Next image">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>';
  document.body.appendChild(box);
  var big = box.querySelector(".viewer-img");
  var cap = box.querySelector(".viewer-cap");
  var count = box.querySelector(".viewer-count");
  var prev = box.querySelector(".viewer-prev");
  var next = box.querySelector(".viewer-next");
  var group = [], at = 0;

  // The largest file an image offers: the widest srcset candidate, else src.
  function largest(img) {
    var best = img.currentSrc || img.src, bestW = 0;
    (img.getAttribute("srcset") || "").split(",").forEach(function (part) {
      var bits = part.trim().split(/\s+/), w = parseInt(bits[1], 10) || 0;
      if (bits[0] && w > bestW) { bestW = w; best = new URL(bits[0], document.baseURI).href; }
    });
    return best;
  }
  function show(i) {
    at = (i + group.length) % group.length;
    var img = group[at];
    big.src = largest(img);
    big.alt = img.alt;
    cap.textContent = img.alt;
    var many = group.length > 1;
    prev.hidden = next.hidden = count.hidden = !many;
    count.textContent = many ? (at + 1) + " of " + group.length : "";
  }
  function open(img) {
    var holder = img.closest("figure, [data-gallery]");
    group = holder ? images.filter(function (x) { return holder.contains(x); }) : [img];
    show(group.indexOf(img));
    box.showModal();
    box.querySelector(".viewer-close").focus();
  }

  images.forEach(function (img) {
    img.classList.add("zoomable");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-haspopup", "dialog");
    img.setAttribute("aria-label", "Enlarge image: " + (img.alt || "untitled"));
    img.addEventListener("click", function () { open(img); });
    img.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(img); }
    });
  });
  box.querySelector(".viewer-close").addEventListener("click", function () { box.close(); });
  prev.addEventListener("click", function () { show(at - 1); });
  next.addEventListener("click", function () { show(at + 1); });
  box.addEventListener("keydown", function (e) {
    if (group.length < 2) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
  });
  // A click on the dark backdrop, outside the picture and the buttons, closes it.
  box.addEventListener("click", function (e) {
    if (e.target === box || e.target.classList.contains("viewer-figure")) box.close();
  });
  // Swipe sideways on a phone to move through a set.
  var x0 = null;
  box.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", function (e) {
    if (x0 === null || group.length < 2) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
