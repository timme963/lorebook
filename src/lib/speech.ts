/**
 * Vorlesen (Text-to-Speech) und Spracheingabe (Speech-to-Text).
 *  - Browser: Web Speech API (speechSynthesis / SpeechRecognition)
 *  - Android-App: Capacitor-Plugins (Sprachausgabe und Spracherkennung von Android)
 * Keine eigenen Server, keine Kosten. Einstellungen liegen pro Gerät in localStorage.
 */
import { useSyncExternalStore } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { getLang } from './i18n';
import { isNative } from './platform';
import { stripMath } from './math';

export type SpeechLang = 'de' | 'en';

export interface SpeechSettings {
  /** 0.5 … 2.5, 1 = normal */
  rate: number;
  /** gewählte Stimme je Sprache ('' = automatisch die beste) */
  voice: Record<SpeechLang, string>;
  /** Story-Szenen beim Umblättern automatisch vorlesen */
  autoStory: boolean;
}

const KEY = 'lorebook-speech';
const DEFAULTS: SpeechSettings = { rate: 1, voice: { de: '', en: '' }, autoStory: false };

// ---------------------------------------------------------------- kleiner Store (Einstellungen + was gerade gesprochen wird)

const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

function readSettings(): SpeechSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw), voice: { ...DEFAULTS.voice, ...JSON.parse(raw).voice } };
  } catch {
    /* privater Modus */
  }
  return DEFAULTS;
}

const clampRate = (r: unknown) => Math.min(2.5, Math.max(0.5, Number(r) || 1));
let settings = { ...readSettings(), rate: clampRate(readSettings().rate) };
let speakingId: string | null = null;

export const getSpeechSettings = () => settings;
export function setSpeechSettings(patch: Partial<SpeechSettings>): void {
  settings = { ...settings, ...patch, rate: clampRate(patch.rate ?? settings.rate) };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* egal */
  }
  emit();
}
export const useSpeechSettings = () => useSyncExternalStore(subscribe, getSpeechSettings, getSpeechSettings);
const getSpeaking = () => speakingId;
export const useSpeakingId = () => useSyncExternalStore(subscribe, getSpeaking, getSpeaking);

function setSpeaking(id: string | null) {
  speakingId = id;
  emit();
}

// ---------------------------------------------------------------- Sprache des Textes erkennen

const DE_WORDS = /\b(der|die|das|und|ist|nicht|ein|eine|zu|den|mit|sich|auf|für|dass|wird|sie|er|es)\b/gi;
const EN_WORDS = /\b(the|and|is|not|a|an|to|of|with|for|that|will|she|he|it|you|are|was)\b/gi;

/** Deutsch oder Englisch? Lerninhalte sind in der Sprache des PDFs, nicht unbedingt in der App-Sprache. */
export function detectLang(text: string): SpeechLang {
  const de = (text.match(DE_WORDS)?.length ?? 0) + (/[äöüß]/i.test(text) ? 3 : 0);
  const en = text.match(EN_WORDS)?.length ?? 0;
  if (de === en) return getLang();
  return de > en ? 'de' : 'en';
}

const BCP47: Record<SpeechLang, string> = { de: 'de-DE', en: 'en-US' };

// ---------------------------------------------------------------- Stimmen

export interface VoiceOption {
  id: string;
  name: string;
}

let nativeVoices: { name: string; lang: string }[] | undefined;

function webVoices(): SpeechSynthesisVoice[] {
  return typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices();
}

/** Je natürlicher, desto weiter oben: Edge „Online (Natural)“, Google-, Premium-/Enhanced-Stimmen. */
function score(name: string, local: boolean, voiceLang = ''): number {
  let s = 0;
  // Standardsprache bevorzugen: Deutsch aus Deutschland, Englisch aus USA/UK
  if (/^(de-DE|en-US|en-GB)$/i.test(voiceLang.replace('_', '-'))) s += 3;
  if (/natural|neural|online/i.test(name)) s += 4;
  if (/premium|enhanced|wavenet/i.test(name)) s += 3;
  if (/google/i.test(name)) s += 2;
  if (!local) s += 1;
  return s;
}

export async function listVoices(lang: SpeechLang): Promise<VoiceOption[]> {
  if (isNative) {
    if (!nativeVoices) nativeVoices = (await TextToSpeech.getSupportedVoices().catch(() => ({ voices: [] as SpeechSynthesisVoice[] }))).voices;
    return (nativeVoices ?? [])
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.lang?.toLowerCase().startsWith(lang))
      .map(({ v, i }) => ({ id: String(i), name: `${v.name} (${v.lang})` }));
  }
  await voicesReady();
  return webVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(lang))
    .sort((a, b) => score(b.name, b.localService, b.lang) - score(a.name, a.localService, a.lang))
    .map((v) => ({ id: v.voiceURI, name: `${v.name} (${v.lang})` }));
}

function voicesReady(): Promise<void> {
  if (typeof speechSynthesis === 'undefined' || webVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

function pickWebVoice(lang: SpeechLang): SpeechSynthesisVoice | undefined {
  const all = webVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  const chosen = settings.voice[lang] && all.find((v) => v.voiceURI === settings.voice[lang]);
  if (chosen) return chosen;
  return [...all].sort((a, b) => score(b.name, b.localService, b.lang) - score(a.name, a.localService, a.lang))[0];
}

// ---------------------------------------------------------------- Vorlesen

export const ttsSupported = () => isNative || typeof speechSynthesis !== 'undefined';

/** Text in Häppchen, weil Chrome lange Äußerungen nach ~15 s abbricht. */
function chunks(text: string): string[] {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]*["“”»«]?\s*/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > 220 && cur) {
      out.push(cur.trim());
      cur = '';
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

let token = 0;

/** Liest vor. Ein zweiter Aufruf mit derselben id stoppt (Umschalter). true = bis zum Ende vorgelesen. */
export async function speak(text: string, id = text): Promise<boolean> {
  if (speakingId === id) {
    stopSpeaking();
    return false;
  }
  stopSpeaking();
  const clean = stripMath(text).trim();
  if (!clean) return true;
  const my = ++token;
  const lang = detectLang(clean);
  setSpeaking(id);
  try {
    if (isNative) {
      const v = settings.voice[lang];
      await TextToSpeech.speak({ text: clean, lang: BCP47[lang], rate: settings.rate, volume: 1, category: 'playback', ...(v ? { voice: Number(v) } : {}) });
    } else {
      await voicesReady();
      const voice = pickWebVoice(lang);
      for (const part of chunks(clean)) {
        if (my !== token) return false;
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(part);
          u.lang = voice?.lang ?? BCP47[lang];
          if (voice) u.voice = voice;
          u.rate = settings.rate;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          speechSynthesis.speak(u);
        });
      }
    }
  } catch (e) {
    console.error('[lorebook] Vorlesen', e);
  } finally {
    if (my === token) setSpeaking(null);
  }
  return my === token;
}

export function stopSpeaking(): void {
  token++;
  if (isNative) TextToSpeech.stop().catch(() => undefined);
  else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  if (speakingId !== null) setSpeaking(null);
}

// ---------------------------------------------------------------- Spracheingabe

type WebRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};

function webRecognitionCtor(): (new () => WebRecognition) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const dictationSupported = () => isNative || !!webRecognitionCtor();

export interface Dictation {
  stop: () => void;
}

/**
 * Startet die Spracheingabe. onText bekommt laufend den bisher erkannten Text (inkl. Zwischenstand),
 * onEnd wird aufgerufen, wenn die Erkennung endet (Stille, Stopp oder Fehler).
 */
export async function startDictation(
  lang: SpeechLang,
  onText: (text: string) => void,
  onEnd: (error?: string) => void,
  opts: { untilPause?: boolean } = {},
): Promise<Dictation> {
  stopSpeaking();
  if (isNative) {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') {
      onEnd('denied');
      return { stop: () => undefined };
    }
    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.addListener('partialResults', (d) => d.matches?.[0] && onText(d.matches[0]));
    await SpeechRecognition.addListener('listeningState', (d) => {
      if (d.status === 'stopped') {
        SpeechRecognition.removeAllListeners().catch(() => undefined);
        onEnd();
      }
    });
    SpeechRecognition.start({ language: BCP47[lang], partialResults: true, popup: false, maxResults: 1 }).catch((e) => onEnd(String(e?.message ?? e)));
    return { stop: () => void SpeechRecognition.stop().catch(() => undefined) };
  }

  const Ctor = webRecognitionCtor();
  if (!Ctor) {
    onEnd('unsupported');
    return { stop: () => undefined };
  }
  const rec = new Ctor();
  rec.lang = BCP47[lang];
  rec.continuous = !opts.untilPause;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    onText(text.trim());
  };
  let error: string | undefined;
  rec.onerror = (e) => {
    error = e.error;
  };
  rec.onend = () => onEnd(error === 'no-speech' || error === 'aborted' ? undefined : error);
  rec.start();
  return { stop: () => rec.stop() };
}

// ---------------------------------------------------------------- freihändig: einmal zuhören

let currentListen: Dictation | undefined;

/** Hört zu, bis eine Sprechpause kommt (oder nach timeoutMs), und liefert den erkannten Text ('' = nichts verstanden). */
export function listenOnce(lang: SpeechLang, timeoutMs = 15000): Promise<{ text: string; error?: string }> {
  return new Promise((resolve) => {
    let last = '';
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      currentListen = undefined;
      resolve({ text: last.trim(), error });
    };
    startDictation(lang, (t) => (last = t), finish, { untilPause: true })
      .then((d) => {
        currentListen = d;
        timer = setTimeout(() => {
          d.stop();
          setTimeout(() => finish(), 800);
        }, timeoutMs);
        if (done) d.stop();
      })
      .catch((e) => finish(String(e?.message ?? e)));
  });
}

export function stopListening(): void {
  currentListen?.stop();
  currentListen = undefined;
}
