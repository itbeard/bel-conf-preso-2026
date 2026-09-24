import test from "node:test";
import assert from "node:assert/strict";
import { ClapDetector } from "../js/clap-detector.mjs";
function rig() {
  const d = new ClapDetector();
  let now = 0;
  const log = [];
  const run = (ms, rms = 0.002, peak = rms * 2) => {
    for (let n = 0; n < ms; n += 10) {
      now += 10;
      for (const type of d.frame(now, rms, peak)) log.push({ type, now });
    }
  };
  const clap = () => {
    run(20, 0.15, 0.45);
    run(30, 0.002);
  };
  run(2100);
  return {
    d,
    run,
    clap,
    log,
    events: () => log.filter((e) => e.type === "double"),
  };
}
test("quiet and a single clap do not advance", () => {
  const r = rig();
  r.run(1000);
  r.clap();
  r.run(1000);
  assert.equal(r.events().length, 0);
  assert(r.log.some((e) => e.type === "expired"));
});
test("two transients 400 ms apart advance exactly once", () => {
  const r = rig();
  r.clap();
  r.run(350);
  r.clap();
  r.run(500);
  assert.equal(r.events().length, 1);
});
test("echo and late second clap do not count as a pair", () => {
  for (const gap of [80, 180, 800, 1200]) {
    const r = rig();
    r.clap();
    r.run(gap - 50);
    r.clap();
    r.run(1000);
    assert.equal(r.events().length, 0, `gap=${gap}`);
  }
});
test("sustained loud sound and gradual speech-like envelopes are rejected", () => {
  const r = rig();
  r.run(600, 0.15, 0.3);
  r.run(300);
  r.run(600, 0.15, 0.3);
  r.run(1000);
  for (let n = 0; n < 5; n++) {
    for (let i = 1; i < 20; i++) r.run(10, 0.003 + i * 0.002);
    for (let i = 19; i > 0; i--) r.run(10, 0.003 + i * 0.002);
    r.run(50);
  }
  assert.equal(r.events().length, 0);
});
test("cooldown and quiet rearming prevent repeat advances during applause", () => {
  const r = rig();
  r.clap();
  r.run(350);
  r.clap();
  for (let i = 0; i < 15; i++) {
    r.run(200);
    r.clap();
  }
  assert.equal(r.events().length, 1);
  r.run(2200);
  r.clap();
  r.run(350);
  r.clap();
  assert.equal(r.events().length, 2);
});
test("manual navigation clears an incomplete pair", () => {
  const r = rig();
  r.clap();
  r.run(350);
  r.d.resetPair();
  r.clap();
  assert.equal(r.events().length, 0);
});
test("calibration never emits clap events", () => {
  const r = rig();
  r.d.calibrate(2100);
  r.clap();
  r.run(350);
  r.clap();
  assert.equal(r.events().length, 0);
});
