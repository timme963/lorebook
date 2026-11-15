import { useState } from 'react';

export default function CopyButton({ text, label = 'Kopieren', className = 'btn' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button type="button" className={className} onClick={copy}>
      {done ? '✓ Kopiert' : label}
    </button>
  );
}
