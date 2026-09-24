import test from "node:test";
import assert from "node:assert/strict";
import core from "../js/presenter-core.js";
const { Countdown, parseVoiceCommand, formatTime } = core;
function clock() {
  let now = 0;
  const timer = new Countdown(() => now);
  return {
    timer,
    advance: (ms) => {
      now += ms;
    },
  };
}
test("preparation takes no time; warning fires only once at 14 minutes", () => {
  const { timer, advance } = clock();
  advance(600000);
  assert.equal(timer.tick().remaining, 900000);
  assert.equal(timer.tick().warn, false);
  timer.start();
  advance(839999);
  assert.equal(timer.tick().warn, false);
  advance(1);
  assert.deepEqual(timer.tick(), {
    remaining: 60000,
    warn: true,
    running: true,
    started: true,
  });
  advance(1000);
  assert.equal(timer.tick().warn, false);
});
test("pause excludes elapsed time, resume does not restart the talk", () => {
  const { timer, advance } = clock();
  timer.start();
  advance(600000);
  timer.pause();
  advance(600000);
  assert.equal(timer.tick().remaining, 300000);
  assert.equal(timer.tick().warn, false);
  timer.start();
  timer.start();
  advance(240000);
  assert.equal(timer.tick().warn, true);
});
test("delayed background tick still warns and never produces negative time", () => {
  const { timer, advance } = clock();
  timer.start();
  advance(1000000);
  assert.deepEqual(timer.tick(), {
    remaining: 0,
    warn: true,
    running: false,
    started: true,
  });
  assert.equal(timer.tick().warn, false);
  timer.start();
  advance(10000);
  assert.equal(timer.tick().remaining, 0);
});
test("reset cancels a running timer and rearms the next talk's warning", () => {
  const { timer, advance } = clock();
  timer.start();
  advance(840000);
  assert.equal(timer.tick().warn, true);
  timer.reset();
  advance(900000);
  assert.deepEqual(timer.tick(), {
    remaining: 900000,
    warn: false,
    running: false,
    started: false,
  });
  timer.start();
  advance(840000);
  assert.equal(timer.tick().warn, true);
});
test("countdown rounds remaining fractions upward", () => {
  for (const [ms, label] of [
    [900000, "15:00"],
    [899999, "15:00"],
    [60000, "01:00"],
    [1, "00:01"],
    [0, "00:00"],
    [-5, "00:00"],
  ]) {
    assert.equal(formatTime(ms), label);
  }
});
test("isolated Belarusian commands work with punctuation and casing", () => {
  for (const command of ["далей", "Далей.", "  ДАЛЕЙ! ", "«далей»", "далее"])
    assert.equal(parseVoiceCommand(command), 1);
  for (const command of ["назад", "Назад!", "  НАЗАД.  "])
    assert.equal(parseVoiceCommand(command), -1);
});
test("ordinary speech mentioning a command does not advance", () => {
  for (const phrase of [
    "",
    "пайшлі далей",
    "год назад",
    "слова далей",
    "паглядзім, што далей",
    "далей назад",
    "Лёша, трэба сканчваць",
    "далейшыя планы",
  ])
    assert.equal(parseVoiceCommand(phrase), 0, phrase);
});
