"use strict";
const $ = (id) => document.getElementById(id);
const slides = [...document.querySelectorAll(".slide")];
let current = 0,
  allSources = false,
  timerRunning = false,
  timerElapsed = 0,
  timerStarted = 0,
  toastTimeout;
const fmt = (s) => {
  const a = Math.abs(s);
  return (
    (s < 0 ? "−" : "") +
    String(Math.floor(a / 60)).padStart(2, "0") +
    ":" +
    String(a % 60).padStart(2, "0")
  );
};
const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const timings = DECK.slides.map((s, i) => ({
  start: DECK.slides.slice(0, i).reduce((a, b) => a + b.duration, 0),
  end: DECK.slides.slice(0, i + 1).reduce((a, b) => a + b.duration, 0),
}));
function fit() {
  if (matchMedia("(max-width:700px) and (orientation:portrait)").matches)
    return;
  const r = $("viewport").getBoundingClientRect(),
    scale = Math.max(
      0.1,
      Math.min((r.width - 40) / 1600, (r.height - 14) / 900),
    );
  document.documentElement.style.setProperty("--scale", scale);
  document.documentElement.style.setProperty("--sw", 1600 * scale + "px");
  document.documentElement.style.setProperty("--sh", 900 * scale + "px");
}
function go(index, updateHash = true) {
  current = Math.max(0, Math.min(slides.length - 1, index));
  slides.forEach((s, i) => {
    const active = i === current;
    s.classList.toggle("active", active);
    s.setAttribute("aria-hidden", String(!active));
    s.inert = !active;
  });
  $("counter").textContent = String(current + 1).padStart(2, "0") + " / 11";
  $("progress").style.width = ((current + 1) / 11) * 100 + "%";
  $("prev").disabled = current === 0;
  $("next").disabled = current === 10;
  $("announcement").textContent =
    "Слайд " + (current + 1) + " з 11. " + DECK.slides[current].title;
  document.title = DECK.slides[current].title + " · Аляксей Картыннік";
  if (updateHash) {
    try {
      history.replaceState(null, "", "#slide-" + (current + 1));
    } catch (e) {}
  }
  if ($("notes-dialog").open) renderNotes();
  if ($("sources-dialog").open) renderSources(allSources);
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showDialog(id) {
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  $(id).showModal();
}
function renderNotes() {
  const s = DECK.slides[current],
    t = timings[current];
  $("notes-title").textContent =
    String(current + 1).padStart(2, "0") + " · " + s.title;
  $("notes-meta").innerHTML =
    "<span>" +
    fmt(t.start) +
    "–" +
    fmt(t.end) +
    "</span><span>·</span><span>" +
    s.duration +
    " с на слайд</span>";
  $("notes-copy").innerHTML = s.notes
    .map((p) => "<p>" + escapeHTML(p) + "</p>")
    .join("");
  $("notes-prev").disabled = current === 0;
  $("notes-next").disabled = current === 10;
  $("notes-dialog").scrollTop = 0;
}
function openNotes() {
  renderNotes();
  showDialog("notes-dialog");
}
function renderSources(all = false) {
  allSources = all;
  $("sources-current").setAttribute("aria-pressed", String(!all));
  $("sources-all").setAttribute("aria-pressed", String(all));
  const refs = all
    ? DECK.sources
    : DECK.sources.filter((s) => DECK.slides[current].refs.includes(s.id));
  $("source-list").innerHTML = refs
    .map(
      (s) =>
        '<li class="source-item"><span class="source-id">[' +
        s.id +
        ']</span><div><div class="source-author">' +
        escapeHTML(s.author) +
        '</div><a class="source-title" target="_blank" rel="noopener noreferrer" href="' +
        escapeHTML(s.url) +
        '">' +
        escapeHTML(s.title) +
        ' ↗</a><p class="source-note">' +
        escapeHTML(s.note) +
        "</p></div></li>",
    )
    .join("");
  $("sources-dialog").scrollTop = 0;
}
function openSources(all = false) {
  renderSources(all);
  showDialog("sources-dialog");
}
function openOverview() {
  $("overview-grid").innerHTML = DECK.slides
    .map(
      (s, i) =>
        '<button class="overview-item ' +
        (i === current ? "current" : "") +
        '" data-go="' +
        i +
        '" ' +
        (i === current ? 'aria-current="true"' : "") +
        "><span>" +
        String(i + 1).padStart(2, "0") +
        " / 11</span><strong>" +
        escapeHTML(s.title) +
        "</strong><small>" +
        fmt(timings[i].start) +
        "–" +
        fmt(timings[i].end) +
        "</small></button>",
    )
    .join("");
  showDialog("overview-dialog");
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $("toast").classList.remove("visible"), 3200);
}
async function fullScreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("Поўны экран даступны праз меню браўзера.");
  } catch (e) {
    toast("Адкрыйце файл у асобнай укладцы або выкарыстоўвайце F11.");
  }
}
function toggleTimer() {
  if (timerRunning) {
    timerElapsed += Date.now() - timerStarted;
    timerRunning = false;
  } else {
    timerStarted = Date.now();
    timerRunning = true;
  }
  updateTimer();
  $("timer").setAttribute("aria-pressed", String(timerRunning));
  $("timer").setAttribute(
    "aria-label",
    timerRunning ? "Прыпыніць таймер" : "Запусціць таймер",
  );
  toast(timerRunning ? "Таймер запушчаны" : "Таймер прыпынены");
}
function updateTimer() {
  const elapsed = timerElapsed + (timerRunning ? Date.now() - timerStarted : 0),
    left = 900 - Math.floor(elapsed / 1000);
  $("timer").textContent = fmt(left);
  $("timer").classList.toggle("over", left < 0);
}
function resetTimer() {
  timerElapsed = 0;
  timerRunning = false;
  timerStarted = 0;
  $("timer").setAttribute("aria-pressed", "false");
  $("timer").setAttribute("aria-label", "Запусціць таймер на 15 хвілін");
  updateTimer();
  toast("Таймер скінуты: 15 хвілін");
}
$("prev").addEventListener("click", () => go(current - 1));
$("next").addEventListener("click", () => go(current + 1));
$("notes-prev").addEventListener("click", () => go(current - 1));
$("notes-next").addEventListener("click", () => go(current + 1));
$("notes-btn").addEventListener("click", openNotes);
$("sources-btn").addEventListener("click", () => openSources());
$("overview-btn").addEventListener("click", openOverview);
$("fullscreen").addEventListener("click", fullScreen);
$("help-btn").addEventListener("click", () => showDialog("help-dialog"));
$("timer").addEventListener("click", toggleTimer);
$("timer-reset").addEventListener("click", resetTimer);
$("sources-current").addEventListener("click", () => renderSources(false));
$("sources-all").addEventListener("click", () => renderSources(true));
document
  .querySelectorAll("[data-sources]")
  .forEach((b) => b.addEventListener("click", () => openSources()));
document
  .querySelectorAll("[data-all-sources]")
  .forEach((b) => b.addEventListener("click", () => openSources(true)));
document
  .querySelectorAll("[data-close]")
  .forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()),
  );
document.querySelectorAll("dialog").forEach((d) =>
  d.addEventListener("click", (e) => {
    const r = d.getBoundingClientRect();
    if (
      e.target === d &&
      (e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom)
    )
      d.close();
  }),
);
$("overview-grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]");
  if (b) {
    $("overview-dialog").close();
    go(Number(b.dataset.go));
  }
});
document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return;
  if (e.target.matches('input,textarea,select,[contenteditable="true"]'))
    return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  const shortcut =
    e.code && e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : key;
  if ((key === " " || key === "enter") && e.target.closest("button,a")) return;
  if (["arrowright", "arrowdown", "pagedown", " "].includes(key)) {
    e.preventDefault();
    go(current + 1);
  } else if (["arrowleft", "arrowup", "pageup"].includes(key)) {
    e.preventDefault();
    go(current - 1);
  } else if (key === "home") {
    e.preventDefault();
    go(0);
  } else if (key === "end") {
    e.preventDefault();
    go(10);
  } else if (shortcut === "f") fullScreen();
  else if (shortcut === "n") openNotes();
  else if (shortcut === "s") openSources();
  else if (shortcut === "o") openOverview();
  else if (shortcut === "t") toggleTimer();
  else if (key === "?") showDialog("help-dialog");
});
$("file-count").addEventListener("input", (e) => {
  const n = Number(e.target.value),
    m = n % 10,
    h = n % 100,
    word =
      m === 1 && h !== 11
        ? "файл"
        : m >= 2 && m <= 4 && (h < 12 || h > 14)
          ? "файлы"
          : "файлаў";
  $("plural-result").textContent = n + " " + word;
});
const terms = {
  branch: [
    "branch",
    "галіна · адгалінаванне · галіна Git",
    "Якое паняцце маецца на ўвазе: структура даных, шлях выканання ці галіна Git?",
  ],
  llm: [
    "large language model",
    "вялікая моўная мадэль",
    "Дадаць азначэнне паняцця, прыклад ужывання і дапушчальныя скарачэнні.",
  ],
  token: [
    "token",
    "маркёр · пазнака Samsung",
    "Ці супадае гэты сэнс з паняццем токена ў LLM? Адпаведнік патрабуе праверкі кантэксту.",
  ],
};
document.querySelectorAll("[data-term]").forEach((b) =>
  b.addEventListener("click", () => {
    document
      .querySelectorAll("[data-term]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const t = terms[b.dataset.term];
    $("term-en").textContent = t[0];
    $("term-be").textContent = t[1];
    $("term-question").textContent = t[2];
  }),
);
const rag = {
  none: [
    "Без дадатковага матэрыялу",
    "Правяраем, што мадэль можа адказаць сама і ці прызнае недахоп ведаў.",
  ],
  search: [
    "Пошук + адказ мадэлі · RAG",
    "Ці знойдзены патрэбны тэкст і ці сапраўды ён падтрымлівае адказ?",
  ],
  expert: [
    "Патрэбны ўрывак выбраў эксперт",
    "Правяраем інтэрпрэтацыю пры наяўнасці патрэбнай крыніцы. Аддзяляем яе ад якасці пошуку.",
  ],
};
document.querySelectorAll("[data-rag]").forEach((b) =>
  b.addEventListener("click", () => {
    document
      .querySelectorAll("[data-rag]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const r = rag[b.dataset.rag];
    $("rag-title").textContent = r[0];
    $("rag-text").textContent = r[1];
  }),
);
const chartRows = [
  ["NLLB-200", "3.3B", 29.23, 31.22],
  ["Gemma-4", "12B-IT", 27.78, 31.4],
  ["TranslateGemma", "12B-IT", 28.25, 32.63],
];
const chartX = 278,
  chartW = 675,
  chartY = 21,
  chartBottom = 352;
let chartMarkup = "";
for (let tick = 0; tick <= 35; tick += 5) {
  const x = chartX + (tick / 35) * chartW;
  chartMarkup +=
    '<line x1="' +
    x +
    '" y1="' +
    chartY +
    '" x2="' +
    x +
    '" y2="' +
    chartBottom +
    '" stroke="' +
    (tick === 0 ? "#bab8b2" : "#e7e4e0") +
    '" stroke-width="1"/><text x="' +
    x +
    '" y="390" text-anchor="middle" font-size="19" fill="#6b6a70">' +
    tick +
    "</text>";
}
chartRows.forEach((r, i) => {
  const y = 43 + i * 112;
  chartMarkup +=
    '<text x="0" y="' +
    (y + 19) +
    '" font-size="27" font-weight="600" fill="#19191c">' +
    r[0] +
    '</text><text x="0" y="' +
    (y + 50) +
    '" font-size="22" fill="#64646b">' +
    r[1] +
    "</text>";
  [r[2], r[3]].forEach((v, j) => {
    const width = (v / 35) * chartW,
      by = y + j * 37;
    chartMarkup +=
      '<rect fill="' +
      (j ? "#cc203c" : "#aaabb1") +
      '" class="' +
      (j ? "bar-after" : "bar-before") +
      '" x="' +
      chartX +
      '" y="' +
      by +
      '" width="' +
      width +
      '" height="26" rx="3"/><text class="' +
      (j ? "after-value" : "before-value") +
      '" x="' +
      (chartX + width + 11) +
      '" y="' +
      (by + 22) +
      '" font-size="23" font-weight="600" fill="' +
      (j ? "#cc203c" : "#626269") +
      '">' +
      v.toFixed(2).replace(".", ",") +
      "</text>";
  });
});
$("remova-plot").innerHTML = chartMarkup;
document.querySelectorAll("[data-chart]").forEach((b) =>
  b.addEventListener("click", () => {
    document
      .querySelectorAll("[data-chart]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("remova-chart").classList.toggle(
      "baseline-only",
      b.dataset.chart === "before",
    );
  }),
);
let swipeStart = null;
$("viewport").addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 1 && !e.target.closest("button,input,a"))
      swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    else swipeStart = null;
  },
  { passive: true },
);
$("viewport").addEventListener(
  "touchend",
  (e) => {
    if (!swipeStart) return;
    const dx = e.changedTouches[0].clientX - swipeStart.x,
      dy = e.changedTouches[0].clientY - swipeStart.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5)
      go(current + (dx < 0 ? 1 : -1));
    swipeStart = null;
  },
  { passive: true },
);
window.addEventListener("resize", fit);
document.addEventListener("fullscreenchange", () => {
  fit();
  $("fullscreen").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Выйсці з поўнага экрана" : "Поўны экран",
  );
});
window.addEventListener("hashchange", () => {
  const n = Number(location.hash.match(/^#slide-(\d+)$/)?.[1]);
  if (n >= 1 && n <= 11) go(n - 1, false);
});
fit();
const initial = Number(location.hash.match(/^#slide-(\d+)$/)?.[1]);
go(initial >= 1 && initial <= 11 ? initial - 1 : 0, false);
setInterval(updateTimer, 250);
