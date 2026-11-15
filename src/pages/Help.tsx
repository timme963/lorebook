import { href } from '../router';

export default function HelpPage() {
  return (
    <div className="stack prose">
      <h1>So funktioniert Lorebook</h1>

      <section className="card stack">
        <h3>Der Ablauf pro Kapitel</h3>
        <ol>
          <li><strong>Was weißt du schon?</strong> Ein paar Fragen, bevor du etwas liest. Rate ruhig.</li>
          <li><strong>Story:</strong> Jede Szene erklärt genau ein Lernziel. Danach zeigt „Was steckt dahinter?“ das Konzept in Fachsprache, mit Seitenverweis.</li>
          <li><strong>Was weißt du jetzt?</strong> Neue Fragen zu denselben Lernzielen, mit Auflösung. Danach siehst du deinen Lernzuwachs.</li>
          <li><strong>Wiederholung:</strong> Alle Fragen kommen in einen Wiederholungsplan (FSRS). Was du sicher weißt, kommt seltener. Was du vergisst, kommt bald wieder.</li>
          <li><strong>Boss-Fight:</strong> Wenn alle Kapitel eines Kurses gemeistert sind, gibt es gemischte Fragen aus allen Kapiteln, mit Schwerpunkt auf Anwendung und Transfer.</li>
        </ol>
      </section>

      <section className="card stack">
        <h3>Warum so?</h3>
        <p>Die vier Prinzipien dahinter (das ist auch der Quelltext des Demo-Kapitels, „Seite 1“):</p>
        <blockquote className="quote">
          Wer vor dem Lernen Fragen beantwortet, behält den Stoff danach besser – selbst wenn die Antworten falsch waren. Sich aktiv an etwas zu
          erinnern, festigt es stärker als es noch einmal zu lesen. Wiederholungen wirken am besten, wenn sie kurz vor dem Vergessen stattfinden
          und die Abstände dabei wachsen. Interessante Details, die mit dem Lernziel nichts zu tun haben, lenken ab und verschlechtern das
          Behalten.
        </blockquote>
        <p>Die Story ist die Verpackung. Wirken tun Vorabfragen, aktives Abrufen und verteilte Wiederholung. Darum gibt es XP vor allem fürs Wiederholen.</p>
      </section>

      <section className="card stack">
        <h3>Woher kommen die Inhalte?</h3>
        <p>
          Lorebook erzeugt selbst nichts und ruft keine KI auf. Du nutzt dein eigenes Claude, ChatGPT oder Gemini. Lade dein PDF dort hoch und
          füge den fertigen Prompt aus dem <a href={href({ name: 'import' })}>Import</a> dazu. Die Antwort (JSON) fügst du wieder ein.
        </p>
        <ul>
          <li><strong>Ein Kapitel pro Durchlauf</strong>, sonst wird die Antwort abgeschnitten.</li>
          <li><strong>Prompt B immer nutzen:</strong> Ein zweiter, neuer Chat prüft jede Frage gegen das PDF. Das ist dein Schutz gegen erfundene Inhalte.</li>
          <li>Bei Zweifeln: <strong>📖 Quelle</strong> zeigt das Zitat und, wenn du das PDF auf der Kursseite hinterlegt hast, die Originalseite.</li>
          <li>Falsche Frage in der Wiederholung? <strong>⚑ melden</strong>, dann ist sie aus dem Plan genommen.</li>
        </ul>
      </section>

      <section className="card stack">
        <h3>Datenschutz</h3>
        <p>
          Alles bleibt in deinem Browser: Kurse, PDFs, Fortschritt. Kein Account, kein Server, kein Tracking. Für den Gerätewechsel gibt es{' '}
          <a href={href({ name: 'data' })}>Export und Import</a>.
        </p>
        <p className="muted small">
          Hinweis: Kursmaterialien sind meist urheberrechtlich geschützt. Die erzeugten Dateien enthalten Zitate daraus, also gib sie nicht weiter.
        </p>
      </section>

      <section className="card stack">
        <h3>Als App installieren</h3>
        <p>Im Browser-Menü „Zum Startbildschirm hinzufügen“ bzw. „App installieren“ wählen. Wiederholungen funktionieren dann auch offline.</p>
      </section>
    </div>
  );
}
