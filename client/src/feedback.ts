let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, gain = 0.15) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const vibrate = (pattern: number | number[]) => navigator.vibrate?.(pattern);

/** Short non-verbal cues so the user always knows what TAVI is doing. */
export const earcon = {
  unlock: () => audio(),
  listening: () => {
    tone(660, 0, 0.12);
    tone(880, 0.12, 0.15);
    vibrate(30);
  },
  thinking: () => {
    tone(523, 0, 0.1, 0.08);
    vibrate(15);
  },
  error: () => {
    tone(330, 0, 0.2);
    tone(220, 0.2, 0.3);
    vibrate([60, 40, 60]);
  },
  toggleOn: () => {
    tone(523, 0, 0.1);
    tone(784, 0.1, 0.15);
  },
  toggleOff: () => {
    tone(784, 0, 0.1);
    tone(523, 0.1, 0.15);
  },
};
