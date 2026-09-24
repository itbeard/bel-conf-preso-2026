/** Transient detector for 10 ms high-pass audio frames. No samples are retained. */
export class ClapDetector {
  constructor({ sensitivity = 3 } = {}) {
    this.sensitivity = sensitivity;
    this.calibrate(0);
  }
  calibrate(now) {
    this.noise = 0.002;
    this.previous = 0.002;
    this.readyAt = now + 2000;
    this.ready = false;
    this.first = null;
    this.candidate = null;
    this.refractoryUntil = 0;
    this.cooldownUntil = 0;
    this.lastLoud = now;
  }
  resetPair() {
    this.first = null;
    this.candidate = null;
  }
  setSensitivity(value) {
    this.sensitivity = Math.max(1, Math.min(5, Number(value) || 3));
    this.resetPair();
  }
  get threshold() {
    return Math.max(
      [0, 0.07, 0.045, 0.026, 0.015, 0.009][this.sensitivity],
      this.noise * 5,
    );
  }
  frame(now, rms, peak) {
    const events = [];
    if (
      !Number.isFinite(rms) ||
      !Number.isFinite(peak) ||
      !Number.isFinite(now)
    )
      return events;
    if (!this.ready) {
      // The calibration prompt asks for silence; bounded adaptation resists one accidental bang.
      this.noise += 0.025 * (Math.min(rms, 0.08) - this.noise);
      this.previous = rms;
      if (now >= this.readyAt) {
        this.ready = true;
        events.push("ready");
      }
      return events;
    }
    const threshold = this.threshold;
    if (rms >= threshold * 0.55) this.lastLoud = now;
    if (this.first !== null && now - this.first > 700) {
      this.first = null;
      events.push("expired");
    }
    if (this.cooldownUntil) {
      this.previous = rms;
      // Require quiet after a double, so sustained applause cannot advance the whole deck.
      if (now >= this.cooldownUntil && now - this.lastLoud >= 300)
        this.cooldownUntil = 0;
      else return events;
    }
    if (this.candidate) {
      const duration = now - this.candidate.start;
      if (duration > 140) this.candidate.invalid = true;
      if (rms < this.candidate.threshold * 0.55) {
        const c = this.candidate;
        this.candidate = null;
        this.refractoryUntil = now + 160;
        if (!c.invalid && duration >= 10 && duration <= 140) {
          const gap = this.first === null ? Infinity : c.start - this.first;
          if (gap >= 220 && gap <= 700) {
            this.first = null;
            this.cooldownUntil = now + 1800;
            events.push("double");
          } else if (gap >= 220) {
            this.first = c.start;
            events.push("clap");
          }
        }
      }
    } else if (
      now >= this.refractoryUntil &&
      rms >= threshold &&
      rms > Math.max(this.previous, 0.001) * 2.4 &&
      peak >= threshold * 1.6
    ) {
      this.candidate = { start: now, threshold, invalid: false };
    } else if (rms < threshold * 0.55) {
      this.noise += 0.015 * (rms - this.noise);
    }
    this.previous = rms;
    return events;
  }
}
