import './styles.css';
import { ApiError, describe, health } from './api';
import { Camera } from './camera';
import { Action, classifyCommand, HELP_TEXT, Mode, parseUtterance } from './commands';
import { earcon } from './feedback';
import { loadSettings, saveSettings } from './settings';
import { Listener, Speaker } from './speech';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  start: $<HTMLButtonElement>('start'),
  startScreen: $<HTMLElement>('start-screen'),
  app: $<HTMLElement>('app'),
  video: $<HTMLVideoElement>('video'),
  viewfinder: $<HTMLButtonElement>('viewfinder'),
  status: $<HTMLElement>('status'),
  response: $<HTMLElement>('response'),
  provider: $<HTMLElement>('provider'),
  guide: $<HTMLButtonElement>('btn-guide'),
  handsFree: $<HTMLButtonElement>('btn-handsfree'),
  ask: $<HTMLButtonElement>('btn-ask'),
  rate: $<HTMLInputElement>('rate'),
  rateValue: $<HTMLOutputElement>('rate-value'),
  interval: $<HTMLSelectElement>('interval'),
  voiceOutput: $<HTMLInputElement>('voice-output'),
};

const LOW_LIGHT = 18;
const FOLLOW_UP_MS = 8000;
const GREETING = 'Tavi is ready. Say "Hey Tavi" and ask me anything, or tap the screen to hear what\'s in front of you.';

const settings = loadSettings();
const camera = new Camera(els.video);
const speaker = new Speaker();
const listener = new Listener(onTranscript, (reason) => {
  setHandsFree(false);
  void say(`${reason} Hands-free mode is off. You can still use the buttons.`, true);
});

let inFlight: AbortController | null = null;
let lastAnswer = '';
let lastGuideAnswer = '';
let awaitingUntil = 0;
let guideTimer: ReturnType<typeof setInterval> | undefined;
let oneShotListen = false;
const history: { q: string; a: string }[] = [];

function setStatus(text: string) {
  els.status.textContent = text;
}

async function say(text: string, isError = false): Promise<void> {
  els.response.textContent = text;
  els.response.classList.toggle('error', isError);
  if (isError) earcon.error();
  if (settings.voiceOutput) await speaker.speak(text);
}

const MODE_LABEL: Record<Mode, string> = {
  describe: 'Looking around',
  read: 'Reading',
  navigate: 'Checking the path',
  ask: 'Thinking',
};

async function query(mode: Mode, question?: string, opts: { auto?: boolean } = {}): Promise<void> {
  if (!camera.active) {
    await say('The camera is off. Tap start to turn it on.', true);
    return;
  }
  if (opts.auto && (inFlight || speaker.speaking)) return;
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  let frame: { dataUrl: string; brightness: number };
  try {
    frame = camera.capture();
  } catch {
    inFlight = null;
    if (!opts.auto) await say('The camera is still starting. Try again in a second.', true);
    return;
  }
  if (frame.brightness < LOW_LIGHT) {
    inFlight = null;
    if (!opts.auto) await say("It's very dark. The camera may be covered, or you may need more light.", true);
    return;
  }

  if (!opts.auto) {
    speaker.cancel();
    earcon.thinking();
  }
  setStatus(`${MODE_LABEL[mode]}…`);
  document.body.dataset.busy = 'true';

  try {
    const res = await describe(
      {
        image: frame.dataUrl,
        mode,
        question,
        previous: opts.auto ? lastGuideAnswer || undefined : undefined,
        history: mode === 'ask' ? history.slice(-3) : undefined,
      },
      controller.signal,
    );
    if (controller !== inFlight) return;
    inFlight = null;
    setStatus(statusIdle());
    if (els.provider.dataset.state === 'offline') void refreshProvider();
    if (res.unchanged) return;
    if (opts.auto) lastGuideAnswer = res.text;
    lastAnswer = res.text;
    history.push({ q: question ?? mode, a: res.text });
    if (history.length > 10) history.shift();
    await say(res.text);
  } catch (err) {
    if (controller !== inFlight) return;
    inFlight = null;
    setStatus(statusIdle());
    if ((err as Error).name === 'AbortError') return;
    void refreshProvider();
    await say(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.', true);
  } finally {
    if (!inFlight) delete document.body.dataset.busy;
  }
}

function statusIdle(): string {
  if (guideTimer) return 'Guiding: watching the path';
  if (settings.handsFree && listener.listening) return 'Listening for "Hey Tavi"';
  return 'Ready';
}

function stopAll() {
  inFlight?.abort();
  inFlight = null;
  delete document.body.dataset.busy;
  speaker.cancel();
  setStatus(statusIdle());
}

function setGuide(on: boolean) {
  clearInterval(guideTimer);
  guideTimer = undefined;
  lastGuideAnswer = '';
  els.guide.setAttribute('aria-pressed', String(on));
  if (on) {
    guideTimer = setInterval(() => void query('navigate', undefined, { auto: true }), settings.guideIntervalSec * 1000);
    earcon.toggleOn();
    setStatus(statusIdle());
    void say('Guide mode on. I\'ll tell you about obstacles as you walk. Say "Hey Tavi, stop guiding" to end.').then(
      () => query('navigate', undefined, { auto: true }),
    );
  } else {
    earcon.toggleOff();
    setStatus(statusIdle());
    void say('Guide mode off.');
  }
}

function setHandsFree(on: boolean) {
  settings.handsFree = on && Listener.supported;
  saveSettings(settings);
  els.handsFree.setAttribute('aria-pressed', String(settings.handsFree));
  if (settings.handsFree) listener.start();
  else if (!oneShotListen) listener.stop();
  setStatus(statusIdle());
}

function listenOnce() {
  if (!Listener.supported) {
    void say("Voice questions aren't supported in this browser. Try Chrome or Safari.", true);
    return;
  }
  speaker.cancel();
  awaitingUntil = Date.now() + FOLLOW_UP_MS;
  if (!listener.listening) {
    oneShotListen = true;
    listener.start();
  }
  earcon.listening();
  setStatus('Listening… ask your question');
}

function endOneShot() {
  if (oneShotListen && !settings.handsFree) listener.stop();
  oneShotListen = false;
}

function onTranscript(transcript: string) {
  const { wake, command } = parseUtterance(transcript);
  // Ignore our own voice leaking into the mic unless the user explicitly says the wake word.
  if (speaker.speaking && !wake) return;

  if (wake) {
    speaker.cancel();
    if (!command) {
      awaitingUntil = Date.now() + FOLLOW_UP_MS;
      earcon.listening();
      setStatus('Listening…');
      return;
    }
    awaitingUntil = 0;
    endOneShot();
    run(classifyCommand(command));
    return;
  }

  if (Date.now() < awaitingUntil) {
    awaitingUntil = 0;
    endOneShot();
    run(classifyCommand(transcript));
  }
}

function run(action: Action) {
  switch (action.type) {
    case 'query':
      void query(action.mode, action.question);
      break;
    case 'guide':
      setGuide(action.on);
      break;
    case 'stop':
      stopAll();
      break;
    case 'repeat':
      void say(lastAnswer || "I haven't said anything yet.");
      break;
    case 'help':
      void say(HELP_TEXT);
      break;
  }
}

function bindUi() {
  els.viewfinder.addEventListener('click', () => void query('describe'));
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
    btn.addEventListener('click', () => void query(btn.dataset.mode as Mode)),
  );
  els.ask.addEventListener('click', listenOnce);
  els.guide.addEventListener('click', () => setGuide(!guideTimer));
  els.handsFree.addEventListener('click', () => setHandsFree(!settings.handsFree));
  $('btn-repeat').addEventListener('click', () => run({ type: 'repeat' }));
  $('btn-stop').addEventListener('click', () => {
    stopAll();
    if (guideTimer) setGuide(false);
  });
  $('btn-help').addEventListener('click', () => run({ type: 'help' }));

  els.rate.value = String(settings.speechRate);
  els.rateValue.value = `${settings.speechRate.toFixed(2)}×`;
  els.rate.addEventListener('input', () => {
    settings.speechRate = Number(els.rate.value);
    speaker.rate = settings.speechRate;
    els.rateValue.value = `${settings.speechRate.toFixed(2)}×`;
    saveSettings(settings);
  });
  els.interval.value = String(settings.guideIntervalSec);
  els.interval.addEventListener('change', () => {
    settings.guideIntervalSec = Number(els.interval.value);
    saveSettings(settings);
    if (guideTimer) {
      clearInterval(guideTimer);
      guideTimer = setInterval(
        () => void query('navigate', undefined, { auto: true }),
        settings.guideIntervalSec * 1000,
      );
    }
  });
  els.voiceOutput.checked = settings.voiceOutput;
  els.voiceOutput.addEventListener('change', () => {
    settings.voiceOutput = els.voiceOutput.checked;
    speaker.enabled = settings.voiceOutput;
    els.response.setAttribute('aria-live', settings.voiceOutput ? 'off' : 'assertive');
    saveSettings(settings);
  });
  els.response.setAttribute('aria-live', settings.voiceOutput ? 'off' : 'assertive');

  document.addEventListener('keydown', (e) => {
    if (els.app.hidden || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const keys: Record<string, () => void> = {
      d: () => void query('describe'),
      r: () => void query('read'),
      p: () => void query('navigate'),
      a: listenOnce,
      g: () => setGuide(!guideTimer),
      Escape: () => stopAll(),
    };
    const fn = keys[e.key];
    if (fn && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      fn();
    }
  });
}

async function start() {
  els.start.disabled = true;
  earcon.unlock();
  speaker.unlock();
  speaker.rate = settings.speechRate;
  speaker.enabled = settings.voiceOutput;
  try {
    await camera.start();
  } catch (err) {
    els.start.disabled = false;
    const denied = (err as DOMException).name === 'NotAllowedError';
    const msg = denied
      ? 'TAVI needs camera access to see for you. Please allow the camera in your browser settings and try again.'
      : "I couldn't open the camera. Make sure no other app is using it and try again.";
    $('start-error').textContent = msg;
    void speaker.speak(msg);
    return;
  }
  els.startScreen.hidden = true;
  els.app.hidden = false;
  if (!Listener.supported) {
    els.handsFree.disabled = true;
    els.handsFree.title = 'Speech recognition is not supported in this browser';
  }
  setHandsFree(settings.handsFree);
  els.viewfinder.focus();
  await say(GREETING);
}

bindUi();
els.start.addEventListener('click', () => void start());

async function refreshProvider() {
  const h = await health();
  const providerName = h ? h.provider.charAt(0).toUpperCase() + h.provider.slice(1) : '';
  els.provider.textContent = h ? (h.provider === 'mock' ? 'Demo mode' : `${providerName} · live`) : 'Server offline';
  els.provider.dataset.state = !h ? 'offline' : h.provider === 'mock' ? 'demo' : 'live';
  const chain = h ? (h.provider === 'mock' ? 'Demo mode (no API key)' : `${providerName}: ${h.model}`) : 'Server offline';
  els.provider.title = chain;
  $('model-chain').textContent = chain;
}

void refreshProvider();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register('/sw.js');
}
