import { ClapDetector } from "./clap-detector.mjs";
class ClapProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.detector = new ClapDetector(options.processorOptions);
    this.detector.calibrate(currentTime * 1000);
    this.sum = 0;
    this.peak = 0;
    this.count = 0;
    this.frames = 0;
    this.frameSize = Math.max(1, Math.round(sampleRate * 0.01));
    this.port.onmessage = ({ data }) => {
      if (data.type === "calibrate")
        this.detector.calibrate(currentTime * 1000);
      if (data.type === "sensitivity") this.detector.setSensitivity(data.value);
      if (data.type === "reset-pair") this.detector.resetPair();
    };
  }
  process(inputs, outputs) {
    // Output remains silent, including if the main thread's zero-gain node is changed.
    for (const output of outputs) for (const channel of output) channel.fill(0);
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      this.sum += x * x;
      this.peak = Math.max(this.peak, Math.abs(x));
      this.count++;
      if (this.count >= this.frameSize) {
        const rms = Math.sqrt(this.sum / this.count);
        const now = (currentTime + i / sampleRate) * 1000;
        for (const type of this.detector.frame(now, rms, this.peak))
          this.port.postMessage({ type });
        if (++this.frames % 10 === 0)
          this.port.postMessage({ type: "level", level: rms });
        this.sum = 0;
        this.peak = 0;
        this.count = 0;
      }
    }
    return true;
  }
}
registerProcessor("clap-processor", ClapProcessor);
