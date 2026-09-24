"use strict";
const $ = (id) => document.getElementById(id);
const slides = [...document.querySelectorAll(".slide")];
let current = 0,
  allSources = false;
const countdown = new PresenterCore.Countdown();
let reminderContext = null,
  reminderNodes = [],
  reminderGeneration = 0,
  reminderTimeout,
  reminderPlaying = false,
  inputsBlockedUntil = 0,
  lastHandsfree = -Infinity;
let toastTimeout,
  autoTimer,
  autoStep = 0;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let motionEnabled = !reduceMotion.matches;
const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function fit() {
  const toolbarHeight = document
    .querySelector(".toolbar")
    .getBoundingClientRect().height;
  document.documentElement.style.setProperty(
    "--toolbar-height",
    toolbarHeight + "px",
  );
  if (matchMedia("(max-width:700px) and (orientation:portrait)").matches)
    return;
  const viewport = $("viewport");
  const r = viewport.getBoundingClientRect();
  const padding = getComputedStyle(viewport);
  const width =
    r.width -
    parseFloat(padding.paddingLeft) -
    parseFloat(padding.paddingRight);
  const height =
    r.height -
    parseFloat(padding.paddingTop) -
    parseFloat(padding.paddingBottom);
  const scale = Math.max(0, Math.min(width / 1600, height / 900));
  document.documentElement.style.setProperty("--scale", scale);
  document.documentElement.style.setProperty("--sw", 1600 * scale + "px");
  document.documentElement.style.setProperty("--sh", 900 * scale + "px");
}
function toast(message) {
  clearTimeout(toastTimeout);
  $("toast").textContent = message;
  $("toast").classList.add("show");
  toastTimeout = setTimeout(() => $("toast").classList.remove("show"), 2600);
}
function go(index, updateHash = true) {
  if (!Number.isFinite(index)) return;
  current = Math.max(0, Math.min(slides.length - 1, Math.trunc(index)));
  slides.forEach((s, i) => {
    const active = i === current;
    s.classList.toggle("active", active);
    s.setAttribute("aria-hidden", String(!active));
    s.inert = !active;
  });
  $("counter").textContent =
    String(current + 1).padStart(2, "0") + " / " + slides.length;
  $("progress").style.width = ((current + 1) / slides.length) * 100 + "%";
  $("prev").disabled = $("notes-prev").disabled = current === 0;
  $("next").disabled = $("notes-next").disabled = current === slides.length - 1;
  $("announcement").textContent =
    `Слайд ${current + 1} з ${slides.length}. ${DECK.slides[current].title}`;
  document.title = DECK.slides[current].title + " · Аляксей Картыннік";
  if (updateHash) history.replaceState(null, "", "#slide-" + (current + 1));
  if ($("notes-dialog").open) renderNotes();
  if ($("sources-dialog").open) renderSources(allSources);
  if (clapNode) clapNode.port.postMessage({ type: "reset-pair" });
  startAnimation();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showDialog(id) {
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  if (clapNode) clapNode.port.postMessage({ type: "reset-pair" });
  $(id).showModal();
}
function renderNotes() {
  $("notes-title").textContent =
    String(current + 1).padStart(2, "0") + ". " + DECK.slides[current].title;
  $("notes-copy").innerHTML = DECK.slides[current].notes
    .map((p) => "<p>" + escapeHTML(p) + "</p>")
    .join("");
}
function renderSources(all = false) {
  allSources = all;
  $("sources-current").setAttribute("aria-pressed", String(!all));
  $("sources-all").setAttribute("aria-pressed", String(all));
  const ids = all ? Object.keys(DECK.sources) : DECK.slides[current].refs;
  $("source-list").innerHTML = ids.length
    ? ids
        .map((id) => {
          const s = DECK.sources[id];
          return (
            "<li>" +
            (s.url
              ? '<a target="_blank" rel="noopener noreferrer" href="' +
                escapeHTML(s.url) +
                '">' +
                escapeHTML(s.title) +
                " ↗</a>"
              : "<b>" + escapeHTML(s.title) + "</b>") +
            "<p>" +
            escapeHTML(s.note) +
            "</p></li>"
          );
        })
        .join("")
    : "<li>Спасылка і QR-код вядуць да гэтай прэзентацыі.</li>";
}
function openSources() {
  renderSources(false);
  showDialog("sources-dialog");
}
function openOverview() {
  $("overview-grid").innerHTML = DECK.slides
    .map(
      (s, i) =>
        `<button data-go="${i}" aria-current="${i === current}"><b>${String(i + 1).padStart(2, "0")}</b><span>${escapeHTML(s.title)}</span></button>`,
    )
    .join("");
  showDialog("overview-dialog");
}
async function fullScreen() {
  if (!countdown.started) startPresentation();
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("Выкарыстайце поўны экран у меню браўзера.");
  } catch {
    toast("Поўны экран недаступны. Выкарыстайце меню браўзера.");
  }
}
function toggleTimer() {
  if (countdown.running) {
    updateTimer();
    countdown.pause();
  } else if (countdown.remaining() > 0) {
    primeReminder();
    countdown.start();
  }
  updateTimer();
}
function startPresentation() {
  if (countdown.started) return;
  primeReminder();
  countdown.start();
  updateTimer();
  toast("Выступ пачаўся · 15 хвілін");
}
function updateTimer() {
  const state = countdown.tick();
  const label = PresenterCore.formatTime(state.remaining);
  $("timer").textContent = state.started ? label : "Пачаць · 15:00";
  $("timer").setAttribute("aria-pressed", String(state.running));
  $("timer").classList.toggle(
    "ending",
    state.started && state.remaining <= 60000,
  );
  $("timer").title = state.started
    ? `Засталося ${label}${state.running ? "" : " · паўза"}. Налады таймера (T — паўза).`
    : "Пачаць выступ · 15 хвілін (T)";
  $("timer-readout").textContent = label;
  $("timer-toggle").textContent = state.running
    ? "Прыпыніць"
    : state.started
      ? "Працягнуць"
      : "Пачаць выступ";
  $("timer-toggle").disabled = state.remaining === 0;
  if (state.remaining === 0) $("timer-toggle").textContent = "Час скончыўся";
  if (state.warn) {
    $("time-warning").hidden = false;
    playReminder();
  }
}
// The three tones are generated locally; no recording or speech service is used.
async function primeReminder() {
  try {
    if (!reminderContext || reminderContext.state === "closed") {
      const Context = window.AudioContext || window.webkitAudioContext;
      reminderContext = new Context();
    }
    if (reminderContext.state !== "running") await reminderContext.resume();
    return reminderContext;
  } catch {
    $("timer-audio-status").textContent =
      "Гук недаступны. Праверце дазволы браўзера; візуальны напамін працуе.";
    return null;
  }
}
function finishReminder() {
  clearTimeout(reminderTimeout);
  reminderPlaying = false;
  inputsBlockedUntil = Date.now() + 1400;
  clapNode?.port.postMessage({ type: "reset-pair" });
}
function stopReminder() {
  ++reminderGeneration;
  for (const { oscillator, gain } of reminderNodes) {
    oscillator.onended = null;
    try {
      oscillator.stop();
    } catch {
      /* Already stopped. */
    }
    oscillator.disconnect();
    gain.disconnect();
  }
  reminderNodes = [];
  finishReminder();
}
async function playReminder() {
  stopReminder();
  const generation = reminderGeneration;
  reminderPlaying = true;
  clapNode?.port.postMessage({ type: "reset-pair" });
  reminderTimeout = setTimeout(() => {
    if (generation === reminderGeneration) stopReminder();
  }, 3000);
  try {
    const context = await primeReminder();
    if (generation !== reminderGeneration) return;
    if (!context || context.state !== "running")
      throw new Error("Audio unavailable");
    const start = context.currentTime + 0.04;
    for (let i = 0; i < 3; i++) {
      const at = start + i * 0.34;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      reminderNodes.push({ oscillator, gain });
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.25, at + 0.01);
      gain.gain.setValueAtTime(0.25, at + 0.15);
      gain.gain.linearRampToValueAtTime(0, at + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        if (i === 2 && generation === reminderGeneration) {
          reminderNodes = [];
          finishReminder();
        }
      };
      oscillator.start(at);
      oscillator.stop(at + 0.19);
    }
    $("timer-audio-status").textContent =
      "Прагучалі тры кароткія пікі. Калі іх не чуваць, праверце гучнасць ноўтбука.";
  } catch {
    if (generation !== reminderGeneration) return;
    stopReminder();
    $("timer-audio-status").textContent =
      "Гук недаступны. Праверце гучнасць і дазволы браўзера; візуальны напамін працуе.";
  }
}
function advanceOnClap() {
  const now = Date.now();
  if (
    document.hidden ||
    reminderPlaying ||
    now < inputsBlockedUntil ||
    now - lastHandsfree < 1400
  )
    return;
  if (document.querySelector("dialog[open]")) return;
  const next = Math.min(slides.length - 1, current + 1);
  if (next === current) return;
  lastHandsfree = now;
  go(next);
}
function animationFrame() {
  if (document.hidden) return;
  if (slides[current].querySelector('[data-auto="tokens"]')) {
    const tokens = [...document.querySelectorAll(".token-strip span")];
    const p = autoStep % 14;
    tokens.forEach((t, i) =>
      t.classList.toggle("lit", p < 6 ? i === p : false),
    );
    const words = [
      "Яна",
      "Яна гучыць",
      "Яна гучыць у",
      "Яна гучыць у нашых",
      "Яна гучыць у нашых размовах.",
    ];
    $("generated-text").textContent = words[p < 6 ? 0 : Math.min(p - 6, 4)];
    const caret = document.createElement("span");
    caret.className = "caret";
    $("generated-text").append(caret);
  } else if (slides[current].querySelector('[data-auto="attention"]')) {
    const flour = Math.floor(autoStep / 5) % 2 === 0;
    $("context-clue").textContent = $("attention-source").textContent = flour
      ? "пшанічная"
      : "невыносная";
    $("context-result").textContent = flour
      ? "мука́ · прадукт"
      : "му́ка · пакута";
  }
  autoStep++;
}
function startAnimation() {
  clearInterval(autoTimer);
  autoStep = 0;
  document.body.classList.toggle(
    "motion-paused",
    !motionEnabled || document.hidden,
  );
  $("motion").textContent = motionEnabled
    ? "Анімацыя: укл."
    : "Анімацыя: паўза";
  $("motion").setAttribute("aria-pressed", String(motionEnabled));
  animationFrame();
  if (
    motionEnabled &&
    !document.hidden &&
    slides[current].querySelector("[data-auto]")
  )
    autoTimer = setInterval(animationFrame, 1000);
}
$("motion").addEventListener("click", () => {
  motionEnabled = !motionEnabled;
  startAnimation();
});
reduceMotion.addEventListener("change", (e) => {
  motionEnabled = !e.matches;
  startAnimation();
});
$("prev").onclick = () => go(current - 1);
$("next").onclick = () => go(current + 1);
$("notes-prev").onclick = () => go(current - 1);
$("notes-next").onclick = () => go(current + 1);
$("notes").onclick = () => {
  renderNotes();
  showDialog("notes-dialog");
};
$("sources").onclick = openSources;
$("overview").onclick = openOverview;
$("fullscreen").onclick = fullScreen;
$("timer").onclick = () => {
  if (!countdown.started) startPresentation();
  else {
    updateTimer();
    showDialog("timer-dialog");
  }
};
$("timer-toggle").onclick = toggleTimer;
$("timer-reset").onclick = () => {
  countdown.reset();
  stopReminder();
  $("time-warning").hidden = true;
  updateTimer();
};
$("timer-test").onclick = playReminder;
$("timer-settings").onclick = () => {
  updateTimer();
  showDialog("timer-dialog");
};
$("dismiss-time-warning").onclick = () => {
  $("time-warning").hidden = true;
};
$("help").onclick = () => showDialog("help-dialog");
$("sources-current").onclick = () => renderSources(false);
$("sources-all").onclick = () => renderSources(true);
$("overview-grid").onclick = (e) => {
  const b = e.target.closest("[data-go]");
  if (b) {
    $("overview-dialog").close();
    go(Number(b.dataset.go));
  }
};
for (const b of document.querySelectorAll("[data-sources]"))
  b.onclick = openSources;
for (const b of document.querySelectorAll("[data-close]"))
  b.onclick = () => b.closest("dialog").close();
for (const d of document.querySelectorAll("dialog")) {
  d.addEventListener("close", () => {
    if (clapNode) clapNode.port.postMessage({ type: "reset-pair" });
  });
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
  });
}
document.addEventListener("keydown", (e) => {
  const shortcut = e.code?.startsWith("Key")
    ? e.code.slice(3).toLowerCase()
    : e.key.toLowerCase();
  if (shortcut === "m" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    stopMicrophone();
    return;
  }
  if (
    document.querySelector("dialog[open]") ||
    e.target.matches('input,textarea,select,[contenteditable="true"]') ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (e.repeat) return;
  const key = e.key.toLowerCase();
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
    go(slides.length - 1);
  } else if (shortcut === "f") fullScreen();
  else if (shortcut === "o") openOverview();
  else if (shortcut === "n") {
    renderNotes();
    showDialog("notes-dialog");
  } else if (shortcut === "s") openSources();
  else if (shortcut === "t") toggleTimer();
  else if (shortcut === "m") showDialog("mic-dialog");
  else if (key === "?") showDialog("help-dialog");
});
let swipeStart = null;
$("viewport").addEventListener(
  "touchstart",
  (e) => {
    swipeStart =
      e.touches.length === 1 && !e.target.closest("button,input,a")
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : null;
  },
  { passive: true },
);
$("viewport").addEventListener(
  "touchend",
  (e) => {
    if (!swipeStart || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - swipeStart.x,
      dy = e.changedTouches[0].clientY - swipeStart.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5)
      go(current + (dx < 0 ? 1 : -1));
    swipeStart = null;
  },
  { passive: true },
);
window.addEventListener("resize", fit);
document.addEventListener("fullscreenchange", fit);
window.visualViewport?.addEventListener("resize", fit);
if (window.ResizeObserver) {
  const layoutObserver = new ResizeObserver(fit);
  layoutObserver.observe($("viewport"));
  layoutObserver.observe(document.querySelector(".toolbar"));
}
window.addEventListener("hashchange", () => {
  const n = Number(location.hash.match(/^#slide-(\d+)$/)?.[1]);
  if (n >= 1 && n <= slides.length) go(n - 1, false);
});
// Microphone access is requested only in response to the explicit Start button.
let micStream = null,
  audioContext = null,
  clapNode = null,
  micPending = false,
  micGeneration = 0;
let clapCount = 0;
function microphoneUI(on) {
  $("mic").classList.toggle("listening", on);
  $("mic").textContent = on ? "Мікрафон: укл." : "Мікрафон";
  $("mic-start").disabled = on || micPending;
  $("mic-stop").disabled = !on && !micPending;
  $("mic-recalibrate").disabled = !on;
}
function resetCalibration() {
  if (!clapNode) return;
  clapNode.port.postMessage({ type: "calibrate" });
  $("mic-status").textContent = "Каліброўка: 2 секунды цішыні…";
  $("clap-preview").textContent = "Праверка: чакаем завяршэння каліброўкі.";
}
async function startMicrophone() {
  if (micPending || micStream) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    $("mic-status").textContent =
      "Для мікрафона патрэбны HTTPS або localhost і браўзер з падтрымкай аўдыя.";
    return;
  }
  micPending = true;
  const generation = ++micGeneration;
  microphoneUI(false);
  $("mic-status").textContent = "Чакаем дазволу на мікрафон…";
  let stream, context;
  try {
    context = new (window.AudioContext || window.webkitAudioContext)();
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    if (generation !== micGeneration) {
      stream.getTracks().forEach((t) => t.stop());
      await context.close();
      return;
    }
    if (!context.audioWorklet) throw new Error("unsupported");
    await context.audioWorklet.addModule(
      new URL("js/clap-worklet.js", document.baseURI).href,
    );
    if (generation !== micGeneration) {
      stream.getTracks().forEach((t) => t.stop());
      await context.close();
      return;
    }
    const source = context.createMediaStreamSource(stream);
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 900;
    const node = new AudioWorkletNode(context, "clap-processor", {
      processorOptions: { sensitivity: Number($("sensitivity").value) },
    });
    const silent = context.createGain();
    silent.gain.value = 0;
    source
      .connect(highpass)
      .connect(node)
      .connect(silent)
      .connect(context.destination);
    micStream = stream;
    audioContext = context;
    clapNode = node;
    clapCount = 0;
    node.port.onmessage = ({ data }) => {
      if (node !== clapNode) return;
      if (data.type === "level")
        $("mic-meter").style.width = Math.min(100, data.level * 500) + "%";
      if (data.type === "ready")
        $("mic-status").textContent =
          "Гатова. Плясніце двойчы з паўзай 0,22–0,70 секунды.";
      if (data.type === "clap")
        $("clap-preview").textContent = "Адно плясканне. Чакаем другое…";
      if (data.type === "expired")
        $("clap-preview").textContent =
          "Другое плясканне не прагучала своечасова. Паспрабуйце яшчэ.";
      if (data.type === "double") {
        if (
          document.hidden ||
          reminderPlaying ||
          Date.now() < inputsBlockedUntil
        )
          return;
        if (document.querySelector("dialog[open]")) {
          clapCount++;
          $("clap-preview").textContent =
            `Распазнана падвойнае плясканне (${clapCount}). Зачыніце акно, каб кіраваць слайдамі.`;
        } else advanceOnClap();
      }
    };
    node.onprocessorerror = () => {
      stopMicrophone();
      $("mic-status").textContent =
        "Апрацоўка гуку спынілася. Уключыце мікрафон зноў.";
    };
    stream.getAudioTracks().forEach((t) =>
      t.addEventListener("ended", () => {
        if (micStream === stream) {
          stopMicrophone();
          $("mic-status").textContent =
            "Мікрафон адключаны. Можна ўключыць зноў.";
        }
      }),
    );
    micPending = false;
    microphoneUI(true);
    resetCalibration();
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    if (context && context.state !== "closed")
      await context.close().catch(() => {});
    if (generation !== micGeneration) return;
    micPending = false;
    micStream = null;
    audioContext = null;
    clapNode = null;
    microphoneUI(false);
    const messages = {
      NotAllowedError:
        "Доступ да мікрафона забаронены. Дазвольце яго ў наладах сайта і паспрабуйце зноў.",
      NotFoundError:
        "Мікрафон не знойдзены. Падключыце мікрафон і паспрабуйце зноў.",
      NotReadableError:
        "Мікрафон заняты або недаступны. Праверце яго падключэнне.",
    };
    $("mic-status").textContent =
      messages[e.name] ||
      "Не ўдалося запусціць мікрафон. Адкрыйце прэзентацыю праз HTTPS у сучасным браўзеры.";
  }
}
function stopMicrophone() {
  ++micGeneration;
  micPending = false;
  const stream = micStream,
    context = audioContext,
    node = clapNode;
  micStream = null;
  audioContext = null;
  clapNode = null;
  if (node) {
    node.port.onmessage = null;
    node.disconnect();
    node.port.close();
  }
  stream?.getTracks().forEach((t) => t.stop());
  if (context && context.state !== "closed") context.close().catch(() => {});
  microphoneUI(false);
  $("mic-status").textContent = "Кіраванне плясканнямі выключанае.";
  $("mic-meter").style.width = "0%";
  $("clap-preview").textContent = "Праверка: пакуль няма плясканняў.";
}
$("mic").onclick = () => showDialog("mic-dialog");
$("mic-start").onclick = startMicrophone;
$("mic-stop").onclick = stopMicrophone;
$("mic-recalibrate").onclick = resetCalibration;
$("sensitivity").oninput = (e) => {
  $("sensitivity-value").textContent = e.target.value + " / 5";
  clapNode?.port.postMessage({
    type: "sensitivity",
    value: Number(e.target.value),
  });
};
document.addEventListener("visibilitychange", () => {
  if (clapNode) clapNode.port.postMessage({ type: "reset-pair" });
  if (!document.hidden) updateTimer();
  startAnimation();
});
window.addEventListener("pagehide", () => {
  stopMicrophone();
  stopReminder();
  if (reminderContext && reminderContext.state !== "closed")
    reminderContext.close().catch(() => {});
  reminderContext = null;
});
fit();
const initial = Number(location.hash.match(/^#slide-(\d+)$/)?.[1]);
go(initial >= 1 && initial <= slides.length ? initial - 1 : 0, false);
updateTimer();
setInterval(updateTimer, 500);
