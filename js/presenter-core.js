/* Small, independently testable presenter rules; no audio is captured here. */
(function (root) {
  "use strict";
  class Countdown {
    constructor(now = () => Date.now()) {
      this.now = now;
      this.duration = 15 * 60 * 1000;
      this.reset();
    }
    reset() {
      this.elapsed = 0;
      this.since = 0;
      this.started = false;
      this.running = false;
      this.warned = false;
    }
    start() {
      if (this.running || this.elapsed >= this.duration) return;
      this.started = true;
      this.running = true;
      this.since = this.now();
    }
    pause() {
      if (!this.running) return;
      this.elapsed = this.duration - this.remaining();
      this.running = false;
    }
    remaining() {
      const live = this.running ? Math.max(0, this.now() - this.since) : 0;
      return Math.max(0, this.duration - this.elapsed - live);
    }
    tick() {
      const remaining = this.remaining();
      const warn = this.running && !this.warned && remaining <= 60000;
      if (warn) this.warned = true;
      if (this.running && remaining === 0) {
        this.elapsed = this.duration;
        this.running = false;
      }
      return { remaining, warn, running: this.running, started: this.started };
    }
  }
  function parseVoiceCommand(transcript) {
    const text = String(transcript)
      .normalize("NFC")
      .toLocaleLowerCase("be")
      .replace(/[.,!?…:;«»“”"'’]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    if (text === "далей" || text === "далее") return 1;
    if (text === "назад") return -1;
    return 0;
  }
  function formatTime(remaining) {
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  const api = { Countdown, parseVoiceCommand, formatTime };
  root.PresenterCore = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
