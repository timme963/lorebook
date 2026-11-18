import { useEffect, useRef, useState } from 'react';
import { tr } from '../lib/i18n';
import {
  detectLang,
  dictationSupported,
  listVoices,
  setSpeechSettings,
  speak,
  startDictation,
  ttsSupported,
  useSpeakingId,
  useSpeechSettings,
  type Dictation,
  type SpeechLang,
  type VoiceOption,
} from '../lib/speech';

/** 🔊 Vorlesen / ■ Stopp */
export function SpeakButton({ text, id, label, className = 'btn small ghost' }: { text: string; id?: string; label?: string; className?: string }) {
  const speaking = useSpeakingId();
  if (!ttsSupported()) return null;
  const key = id ?? text;
  const on = speaking === key;
  return (
    <button
      type="button"
      className={`${className} speak-btn ${on ? 'on' : ''}`}
      onClick={() => void speak(text, key)}
      title={on ? tr('Vorlesen stoppen', 'Stop reading') : tr('Vorlesen', 'Read aloud')}
      aria-label={on ? tr('Vorlesen stoppen', 'Stop reading') : tr('Vorlesen', 'Read aloud')}
    >
      {on ? '■' : '🔊'}
      {label && <span> {on ? tr('Stopp', 'Stop') : label}</span>}
    </button>
  );
}

/**
 * 🎤 Antwort einsprechen. Hängt das Gesprochene an den vorhandenen Text an.
 * langHint: Text, aus dem die Sprache der Erkennung abgeleitet wird (z. B. die Frage).
 */
export function DictateButton({ value, onChange, langHint, disabled }: { value: string; onChange: (v: string) => void; langHint: string; disabled?: boolean }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string>();
  const rec = useRef<Dictation | undefined>(undefined);
  const base = useRef('');

  useEffect(() => () => rec.current?.stop(), []);

  if (!dictationSupported()) return null;

  async function toggle() {
    if (active) {
      rec.current?.stop();
      return;
    }
    setError(undefined);
    base.current = value.trim();
    setActive(true);
    rec.current = await startDictation(
      detectLang(langHint),
      (text) => onChange(base.current ? `${base.current} ${text}` : text),
      (err) => {
        setActive(false);
        if (err === 'denied' || err === 'not-allowed') setError(tr('Mikrofon nicht erlaubt.', 'Microphone not allowed.'));
        else if (err === 'unsupported') setError(tr('Spracheingabe wird hier nicht unterstützt.', 'Voice input is not supported here.'));
        else if (err) setError(tr('Spracheingabe fehlgeschlagen.', 'Voice input failed.') + ` (${err})`);
      },
    );
  }

  return (
    <>
      <button
        type="button"
        className={`btn mic-btn ${active ? 'on' : 'ghost'}`}
        disabled={disabled}
        onClick={toggle}
        title={active ? tr('Aufnahme beenden', 'Stop recording') : tr('Antwort einsprechen', 'Speak your answer')}
        aria-label={active ? tr('Aufnahme beenden', 'Stop recording') : tr('Antwort einsprechen', 'Speak your answer')}
      >
        {active ? '● ' + tr('Hört zu …', 'Listening …') : '🎤'}
      </button>
      {error && <span className="error small">{error}</span>}
    </>
  );
}

function VoiceSelect({ lang }: { lang: SpeechLang }) {
  const s = useSpeechSettings();
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  useEffect(() => {
    listVoices(lang).then(setVoices);
  }, [lang]);
  if (voices.length === 0) return null;
  return (
    <label>
      {lang === 'de' ? tr('Stimme Deutsch', 'German voice') : tr('Stimme Englisch', 'English voice')}
      <select className="input" value={s.voice[lang]} onChange={(e) => setSpeechSettings({ voice: { ...s.voice, [lang]: e.target.value } })}>
        <option value="">{tr('Automatisch (natürlichste)', 'Automatic (most natural)')}</option>
        {voices.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
    </label>
  );
}

/** Einstellungen: Geschwindigkeit, Stimme, Story automatisch vorlesen */
export function SpeechSettingsCard() {
  const s = useSpeechSettings();
  if (!ttsSupported() && !dictationSupported()) return null;
  const sample = tr(
    'So klingt Lorebook beim Vorlesen. Die Geschwindigkeit kannst du hier anpassen.',
    'This is how Lorebook sounds when reading aloud. You can adjust the speed here.',
  );
  return (
    <section className="card stack">
      <h3>{tr('Vorlesen & Spracheingabe', 'Read aloud & voice input')}</h3>
      <p className="muted small">
        {tr(
          'Mit 🔊 liest Lorebook Story, Fragen und Erklärungen vor, mit 🎤 sprichst du Antworten ein. Wie natürlich die Stimme klingt, hängt vom Gerät ab: Am besten sind die „Natural“-Stimmen in Edge und die Google-Stimmen in Chrome bzw. auf Android.',
          'With 🔊 Lorebook reads the story, questions and explanations aloud; with 🎤 you speak your answers. How natural the voice sounds depends on the device: the "Natural" voices in Edge and the Google voices in Chrome or on Android are the best.',
        )}
      </p>
      {ttsSupported() && (
        <>
          <label>
            {tr('Geschwindigkeit', 'Speed')}: <strong>{s.rate.toFixed(1)}×</strong>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={s.rate}
              onChange={(e) => setSpeechSettings({ rate: Number(e.target.value) })}
              className="range"
            />
          </label>
          <div className="form-grid">
            <VoiceSelect lang="de" />
            <VoiceSelect lang="en" />
          </div>
          <label className="row gap">
            <input type="checkbox" checked={s.autoStory} onChange={(e) => setSpeechSettings({ autoStory: e.target.checked })} />
            <span>{tr('Story-Szenen automatisch vorlesen', 'Read story scenes aloud automatically')}</span>
          </label>
          <div className="row gap wrap">
            <SpeakButton text={sample} id="sample" label={tr('Probehören', 'Try it')} className="btn small" />
          </div>
        </>
      )}
      {!dictationSupported() && (
        <p className="muted small">{tr('Spracheingabe gibt es in diesem Browser nicht (z. B. Firefox). In Chrome, Edge, Safari und der Android-App geht es.', 'Voice input is not available in this browser (e.g. Firefox). It works in Chrome, Edge, Safari and the Android app.')}</p>
      )}
    </section>
  );
}
