export class Downsampler {
  constructor(inRate, outRate) { this.ratio = inRate / outRate; this.acc = 0; this.n = 0; this.t = 0; }
  process(input) {
    const out = new Float32Array(Math.ceil(input.length / this.ratio) + 1);
    let k = 0;
    for (let i = 0; i < input.length; i++) {
      this.acc += input[i]; this.n++; this.t++;
      if (this.t >= this.ratio) { out[k++] = this.acc / this.n; this.acc = 0; this.n = 0; this.t -= this.ratio; }
    }
    return out.subarray(0, k);
  }
}

export class Upsampler {
  constructor(inRate, outRate) { this.step = inRate / outRate; this.pos = 0; this.prev = 0; }
  process(input) {
    const n = input.length;
    if (!n) return new Float32Array(0);
    const out = new Float32Array(Math.ceil(n / this.step) + 2);
    const get = (i) => (i === 0 ? this.prev : input[i - 1]);
    let pos = this.pos, k = 0;
    while (pos < n) {
      const i = Math.floor(pos), f = pos - i;
      out[k++] = get(i) * (1 - f) + get(i + 1) * f;
      pos += this.step;
    }
    this.pos = pos - n;
    this.prev = input[n - 1];
    return out.subarray(0, k);
  }
}
