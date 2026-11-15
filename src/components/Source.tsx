import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import type { Source } from '../lib/schema';

async function renderPage(blob: Blob, pageNo: number, canvas: HTMLCanvasElement, width: number): Promise<number> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const page = await doc.getPage(Math.min(Math.max(1, pageNo), doc.numPages));
  const base = page.getViewport({ scale: 1 });
  const scale = (width / base.width) * (window.devicePixelRatio || 1);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = '100%';
  await page.render({ canvas, viewport }).promise;
  return doc.numPages;
}

function PdfModal({ courseId, source, onClose }: { courseId: string; source: Source; onClose: () => void }) {
  const pdf = useLiveQuery(async () => (await db.pdfs.get(courseId)) ?? null, [courseId]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(source.page);
  const [total, setTotal] = useState<number>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    setError(undefined);
    const width = Math.min(820, window.innerWidth - 48);
    renderPage(pdf.blob, page, canvasRef.current, width)
      .then(setTotal)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [pdf, page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quelle">
        <div className="modal-head">
          <strong>Quelle · Seite {page}{total ? ` / ${total}` : ''}</strong>
          <button className="btn ghost" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <blockquote className="quote">„{source.quote}“</blockquote>
        {pdf === undefined ? null : pdf === null ? (
          <p className="muted">Für diesen Kurs ist kein PDF hinterlegt. Auf der Kursseite kannst du das PDF hinzufügen, dann siehst du hier die Originalseite.</p>
        ) : (
          <>
            <div className="row gap">
              <button className="btn small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Seite</button>
              <button className="btn small" disabled={!!total && page >= total} onClick={() => setPage((p) => p + 1)}>Seite →</button>
              {page !== source.page && <button className="btn small ghost" onClick={() => setPage(source.page)}>zur Quellseite</button>}
            </div>
            {error && <p className="error">PDF konnte nicht angezeigt werden: {error}</p>}
            <div className="pdf-frame"><canvas ref={canvasRef} /></div>
          </>
        )}
      </div>
    </div>
  );
}

export function SourceButton({ courseId, source, label }: { courseId: string; source: Source; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn small ghost" onClick={() => setOpen(true)}>
        📖 {label ?? `Quelle S. ${source.page}`}
      </button>
      {open && <PdfModal courseId={courseId} source={source} onClose={() => setOpen(false)} />}
    </>
  );
}
