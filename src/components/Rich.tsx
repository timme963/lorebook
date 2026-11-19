import { useEffect, useState } from 'react';
import { hasMath, splitMath, texToPlain } from '../lib/math';

type Katex = { renderToString: (tex: string, opts: { displayMode: boolean; throwOnError: boolean }) => string };

let katex: Katex | undefined;
let loading: Promise<void> | undefined;

/** Loads KaTeX only once a text actually contains formulas. */
function loadKatex(): Promise<void> {
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => {
    katex = (m as unknown as { default: Katex }).default;
  });
  return loading;
}

/** Text with formulas (\( … \) and \[ … \]); without formulas just the text. */
export default function Rich({ text }: { text: string }) {
  const need = hasMath(text);
  const [, setReady] = useState(!!katex);

  useEffect(() => {
    if (need && !katex)
      loadKatex()
        .then(() => setReady(true))
        .catch(() => undefined);
  }, [need]);

  if (!need) return <>{text}</>;
  return (
    <>
      {splitMath(text).map((p, i) => {
        if (!p.math) return <span key={i}>{p.text}</span>;
        if (!katex)
          return (
            <span key={i} className="math-fallback">
              {texToPlain(p.tex)}
            </span>
          );
        return (
          <span
            key={i}
            className={p.display ? 'math-display' : 'math-inline'}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.tex, { displayMode: p.display, throwOnError: false }),
            }}
          />
        );
      })}
    </>
  );
}
