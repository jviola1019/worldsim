/**
 * Binary min-heap keyed by float priority, storing integer payloads.
 * Backed by growable typed arrays; ties are broken by insertion order so that
 * algorithms built on it (A*, priority-flood) are fully deterministic.
 */
export class MinHeap {
  private pri: Float64Array;
  private val: Int32Array;
  private seq: Float64Array;
  private counter = 0;
  size = 0;

  constructor(capacity = 1024) {
    this.pri = new Float64Array(capacity);
    this.val = new Int32Array(capacity);
    this.seq = new Float64Array(capacity);
  }

  clear(): void {
    this.size = 0;
    this.counter = 0;
  }

  private grow(): void {
    const n = this.pri.length * 2;
    const p = new Float64Array(n);
    p.set(this.pri);
    const v = new Int32Array(n);
    v.set(this.val);
    const s = new Float64Array(n);
    s.set(this.seq);
    this.pri = p;
    this.val = v;
    this.seq = s;
  }

  private less(i: number, j: number): boolean {
    return this.pri[i] < this.pri[j] || (this.pri[i] === this.pri[j] && this.seq[i] < this.seq[j]);
  }

  private swap(i: number, j: number): void {
    const p = this.pri[i];
    this.pri[i] = this.pri[j];
    this.pri[j] = p;
    const v = this.val[i];
    this.val[i] = this.val[j];
    this.val[j] = v;
    const s = this.seq[i];
    this.seq[i] = this.seq[j];
    this.seq[j] = s;
  }

  push(value: number, priority: number): void {
    if (this.size >= this.pri.length) this.grow();
    let i = this.size++;
    this.pri[i] = priority;
    this.val[i] = value;
    this.seq[i] = this.counter++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  peekPriority(): number {
    return this.pri[0];
  }

  /** Remove and return the payload with the smallest priority (undefined behavior if empty). */
  pop(): number {
    const top = this.val[0];
    this.size--;
    if (this.size > 0) {
      this.pri[0] = this.pri[this.size];
      this.val[0] = this.val[this.size];
      this.seq[0] = this.seq[this.size];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.size && this.less(l, m)) m = l;
        if (r < this.size && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
}
