export class Speaker {
  rate = 1.05;
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;

  constructor(private readonly synth: SpeechSynthesis | undefined = globalThis.speechSynthesis) {
    if (!synth) return;
    const pick = () => {
      const voices = synth.getVoices();
      const lang = navigator.language.split('-')[0];
      this.voice =
        voices.find((v) => v.lang.startsWith(lang) && /natural|enhanced|premium|google/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith(lang)) ??
        null;
    };
    pick();
    synth.addEventListener?.('voiceschanged', pick);
  }

  get supported(): boolean {
    return !!this.synth;
  }

  get speaking(): boolean {
    return !!this.synth?.speaking;
  }

  /** iOS only allows speech after a user gesture; call this from one. */
  unlock(): void {
    if (!this.synth) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    this.synth.speak(u);
  }

  speak(text: string): Promise<void> {
    if (!this.synth || !this.enabled) return Promise.resolve();
    this.synth.cancel();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = this.rate;
      if (this.voice) u.voice = this.voice;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      this.synth!.speak(u);
    });
  }

  cancel(): void {
    this.synth?.cancel();
  }
}

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Keeps a speech recognizer running (it auto-stops on silence in most browsers) and reports final transcripts. */
export class Listener {
  private recognition: Recognition | null = null;
  private wanted = false;
  private restartTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly onTranscript: (text: string) => void,
    private readonly onFatal: (reason: string) => void,
  ) {}

  static get supported(): boolean {
    return !!getRecognitionCtor();
  }

  get listening(): boolean {
    return this.wanted;
  }

  start(): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor || this.wanted) return;
    this.wanted = true;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.onTranscript(r[0].transcript);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.stop();
        this.onFatal('Microphone permission was denied.');
      }
    };
    rec.onend = () => {
      if (this.wanted) this.restartTimer = setTimeout(() => this.safeStart(), 250);
    };
    this.recognition = rec;
    this.safeStart();
  }

  stop(): void {
    this.wanted = false;
    clearTimeout(this.restartTimer);
    this.recognition?.stop();
    this.recognition = null;
  }

  private safeStart(): void {
    try {
      this.recognition?.start();
    } catch {
      // Already started; ignore.
    }
  }
}
