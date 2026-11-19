import { errorMessage } from './errors';
/**
 * Read-aloud (text-to-speech) and dictation (speech-to-text).
 *  - Browser: Web Speech API (speechSynthesis / SpeechRecognition)
 *  - Android app: Capacitor plugins (Android's speech output and recognition)
 * No own servers, no costs. Settings are stored per device in localStorage.
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
  /** Chosen voice per language ('' = best one automatically) */
  voice: Record<SpeechLang, string>;
  /** Read story scenes aloud automatically when turning pages */
  autoStory: boolean;
}

const KEY = 'lorebook-speech';
const DEFAULTS: SpeechSettings = { rate: 1, voice: { de: '', en: '' }, autoStory: false };

// ---------------------------------------------------------------- small store (settings + what is being spoken)

const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

function readSettings(): SpeechSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<SpeechSettings>;
      return { ...DEFAULTS, ...saved, voice: { ...DEFAULTS.voice, ...saved.voice } };
    }
  } catch {
    /* private mode */
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
    /* not critical */
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

// ---------------------------------------------------------------- detect the text's language

const DE_WORDS = /\b(der|die|das|und|ist|nicht|ein|eine|zu|den|mit|sich|auf|für|dass|wird|sie|er|es)\b/gi;
const EN_WORDS = /\b(the|and|is|not|a|an|to|of|with|for|that|will|she|he|it|you|are|was)\b/gi;

/** German or English? Study content is in the PDF's language, not necessarily the app language. */
export function detectLang(text: string): SpeechLang {
  const de = (text.match(DE_WORDS)?.length ?? 0) + (/[äöüß]/i.test(text) ? 3 : 0);
  const en = text.match(EN_WORDS)?.length ?? 0;
  if (de === en) return getLang();
  return de > en ? 'de' : 'en';
}

const BCP47: Record<SpeechLang, string> = { de: 'de-DE', en: 'en-US' };

// ---------------------------------------------------------------- voices

export interface VoiceOption {
  id: string;
  name: string;
}

let nativeVoices: { name: string; lang: string }[] | undefined;

function webVoices(): SpeechSynthesisVoice[] {
  return typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices();
}

/** The more natural, the higher: Edge "Online (Natural)", Google, premium/enhanced voices. */
function score(name: string, local: boolean, voiceLang = ''): number {
  let s = 0;
  // prefer the standard variant: German from Germany, English from the US/UK
  if (/^(de-DE|en-US|en-GB)$/i.test(voiceLang.replace('_', '-'))) s += 3;
  if (/natural|neural|online/i.test(name)) s += 4;
  if (/premium|enhanced|wavenet/i.test(name)) s += 3;
  if (/google/i.test(name)) s += 2;
  if (!local) s += 1;
  return s;
}

export async function listVoices(lang: SpeechLang): Promise<VoiceOption[]> {
  if (isNative) {
    if (!nativeVoices)
      nativeVoices = (await TextToSpeech.getSupportedVoices().catch(() => ({ voices: [] as SpeechSynthesisVoice[] })))
        .voices;
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

// ---------------------------------------------------------------- read-aloud

export const ttsSupported = () => isNative || typeof speechSynthesis !== 'undefined';

/** Splits text into chunks because Chrome cuts off long utterances after ~15 s. */
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

/** Reads aloud. A second call with the same id stops (toggle). true = read to the end. */
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
      await TextToSpeech.speak({
        text: clean,
        lang: BCP47[lang],
        rate: settings.rate,
        volume: 1,
        category: 'playback',
        ...(v ? { voice: Number(v) } : {}),
      });
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

// ---------------------------------------------------------------- dictation

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
  const w = window as unknown as {
    SpeechRecognition?: new () => WebRecognition;
    webkitSpeechRecognition?: new () => WebRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const dictationSupported = () => isNative || !!webRecognitionCtor();

export interface Dictation {
  stop: () => void;
}

/**
 * Starts dictation. onText continuously receives the text recognised so far (including interim results),
 * onEnd is called when recognition ends (silence, stop or error).
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
    SpeechRecognition.start({ language: BCP47[lang], partialResults: true, popup: false, maxResults: 1 }).catch(
      (e: unknown) => onEnd(errorMessage(e)),
    );
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
    for (const result of Array.from(e.results)) text += result[0]?.transcript ?? '';
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

// ---------------------------------------------------------------- hands-free: listen once

let currentListen: Dictation | undefined;

/** Listens until a pause (or timeoutMs) and returns the recognised text ('' = nothing understood). */
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
      .catch((e: unknown) => finish(errorMessage(e)));
  });
}

export function stopListening(): void {
  currentListen?.stop();
  currentListen = undefined;
}
