import { href } from '../router';
import { APK_URL } from '../lib/platform';
import { useLang } from '../lib/i18n';

function HelpDe() {
  return (
    <div className="stack prose">
      <h1>So funktioniert Lorebook</h1>

      <section className="card stack">
        <h3>Der Ablauf pro Kapitel</h3>
        <ol>
          <li>
            <strong>Was weißt du schon?</strong> Ein paar Fragen, bevor du etwas liest. Rate ruhig.
          </li>
          <li>
            <strong>Story:</strong> Jede Szene erklärt genau ein Lernziel. Danach zeigt „Was steckt dahinter?“ das
            Konzept in Fachsprache, mit Seitenverweis.
          </li>
          <li>
            <strong>Was weißt du jetzt?</strong> Neue Fragen zu denselben Lernzielen, mit Auflösung. Danach siehst du
            deinen Lernzuwachs.
          </li>
          <li>
            <strong>Wiederholung:</strong> Alle Fragen kommen in einen Wiederholungsplan (FSRS). Was du sicher weißt,
            kommt seltener. Was du vergisst, kommt bald wieder.
          </li>
          <li>
            <strong>Boss-Fight:</strong> Wenn alle Kapitel eines Kurses gemeistert sind, gibt es gemischte Fragen aus
            allen Kapiteln, mit Schwerpunkt auf Anwendung und Transfer.
          </li>
        </ol>
      </section>

      <section className="card stack">
        <h3>Warum so?</h3>
        <p>Die vier Prinzipien dahinter (das ist auch der Quelltext des Demo-Kapitels, „Seite 1“):</p>
        <blockquote className="quote">
          Wer vor dem Lernen Fragen beantwortet, behält den Stoff danach besser – selbst wenn die Antworten falsch
          waren. Sich aktiv an etwas zu erinnern, festigt es stärker als es noch einmal zu lesen. Wiederholungen wirken
          am besten, wenn sie kurz vor dem Vergessen stattfinden und die Abstände dabei wachsen. Interessante Details,
          die mit dem Lernziel nichts zu tun haben, lenken ab und verschlechtern das Behalten.
        </blockquote>
        <p>
          Die Story ist die Verpackung. Wirken tun Vorabfragen, aktives Abrufen und verteilte Wiederholung. Darum gibt
          es XP vor allem fürs Wiederholen.
        </p>
      </section>

      <section className="card stack">
        <h3>Woher kommen die Inhalte?</h3>
        <p>
          Lorebook erzeugt selbst nichts und ruft keine KI auf. Du nutzt dein eigenes Claude, ChatGPT oder Gemini. Lade
          dein PDF dort hoch und füge den fertigen Prompt aus dem <a href={href({ name: 'import' })}>Import</a> dazu.
          Die Antwort (JSON) fügst du wieder ein.
        </p>
        <ul>
          <li>
            <strong>Ein Kapitel pro Durchlauf</strong>, sonst wird die Antwort abgeschnitten.
          </li>
          <li>
            <strong>Story-Stil:</strong> „Passend zum Stoff“ lässt die KI das Genre wählen. Die Vorschläge zeigen, wofür
            sie sich eignen, z. B. Start-up für BWL oder Gerichtsdrama für Jura. Ein eigener Stil geht immer.
          </li>
          <li>
            <strong>Prompt B immer nutzen:</strong> Ein zweiter, neuer Chat prüft jede Frage gegen das PDF. Das ist dein
            Schutz gegen erfundene Inhalte.
          </li>
          <li>
            Bei Zweifeln: <strong>📖 Quelle</strong> zeigt das Zitat und, wenn du das PDF auf der Kursseite hinterlegt
            hast, die Originalseite.
          </li>
          <li>
            Falsche Frage in der Wiederholung? <strong>⚑ melden</strong>, dann ist sie aus dem Plan genommen.
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h3>Unterwegs und gezielt lernen</h3>
        <ul>
          <li>
            <strong>🔊 Vorlesen / 🎤 Einsprechen:</strong> Story, Fragen und Erklärungen vorlesen lassen, Antworten
            einsprechen. Geschwindigkeit und Stimme unter „Account &amp; Daten“.
          </li>
          <li>
            <strong>🎧 Story anhören:</strong> Die ganze Story läuft wie ein Hörbuch durch, Szene für Szene mit „Was
            steckt dahinter?“.
          </li>
          <li>
            <strong>🎧 Freihändig wiederholen:</strong> In der Wiederholung liest Lorebook jede Frage vor, du antwortest
            per Stimme („B“, „die zweite“, das Wort oder „weiß ich nicht“), hörst die Auflösung, und es geht automatisch
            weiter. „Stopp“ beendet.
          </li>
          <li>
            <strong>🎯 Schwachstellen:</strong> Auf der Kursseite siehst du pro Lernziel, wie sicher es gerade sitzt.
            „Schwachstellen trainieren“ fragt gezielt die unsichersten ab.
          </li>
          <li>
            <strong>Formeln</strong> werden sauber dargestellt (LaTeX), wenn das Kursmaterial welche enthält.
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h3>Datenschutz</h3>
        <p>
          Ohne Account bleibt alles in deinem Browser. Mit <a href={href({ name: 'account' })}>Account</a> werden Kurse
          und Fortschritt in der Cloud gesichert (Supabase, Frankfurt) und zwischen deinen Geräten abgeglichen. PDFs
          bleiben immer nur auf dem Gerät. Kein Tracking.
        </p>
        <p className="muted small">
          Hinweis: Kursmaterialien sind meist urheberrechtlich geschützt. Die erzeugten Dateien enthalten Zitate daraus,
          also gib sie nicht weiter.
        </p>
      </section>

      <section className="card stack">
        <h3>Als App installieren</h3>
        <ul>
          <li>
            <strong>Android:</strong> <a href={APK_URL}>Lorebook-App herunterladen</a> (APK) und öffnen. Beim ersten Mal
            fragt Android, ob der Browser Apps installieren darf: erlauben. Die App erinnert dich täglich an fällige
            Wiederholungen (einstellbar unter „Account &amp; Daten“) und meldet sich, wenn es ein Update gibt.
          </li>
          <li>
            <strong>iPhone (Safari):</strong> Teilen-Symbol → „Zum Home-Bildschirm“.
          </li>
          <li>
            <strong>PC (Chrome/Edge):</strong> Installieren-Symbol rechts in der Adressleiste oder Menü → „Apps“ →
            „Lorebook installieren“.
          </li>
        </ul>
        <p className="muted small">
          Kurse und Wiederholungen funktionieren auch offline. Mit Account sind App und Website auf demselben Stand.
        </p>
      </section>
    </div>
  );
}

function HelpEn() {
  return (
    <div className="stack prose">
      <h1>How Lorebook works</h1>

      <section className="card stack">
        <h3>The flow for each chapter</h3>
        <ol>
          <li>
            <strong>What do you know already?</strong> A few questions before you read anything. Just guess.
          </li>
          <li>
            <strong>Story:</strong> Each scene explains exactly one objective. Then "What's behind it?" shows the
            concept in technical terms, with a page reference.
          </li>
          <li>
            <strong>What do you know now?</strong> New questions on the same objectives, with answers. Then you see how
            much you gained.
          </li>
          <li>
            <strong>Review:</strong> All questions go into a review schedule (FSRS). What you know well comes back less
            often. What you forget comes back soon.
          </li>
          <li>
            <strong>Boss fight:</strong> Once all chapters of a course are mastered, you get mixed questions from all
            chapters, focused on application and transfer.
          </li>
        </ol>
      </section>

      <section className="card stack">
        <h3>Why this way?</h3>
        <p>The four principles behind it (this is also the source text of the demo chapter, "page 1"):</p>
        <blockquote className="quote">
          People who answer questions before studying remember the material better afterwards – even if their answers
          were wrong. Actively recalling something strengthens it more than reading it again. Reviews work best when
          they happen just before you forget and the intervals keep growing. Interesting details that have nothing to do
          with the learning goal distract and make retention worse.
        </blockquote>
        <p>
          The story is the packaging. What works is pre-questions, active recall and spaced repetition. That's why most
          XP comes from reviewing.
        </p>
      </section>

      <section className="card stack">
        <h3>Where does the content come from?</h3>
        <p>
          Lorebook generates nothing itself and calls no AI. You use your own Claude, ChatGPT or Gemini. Upload your PDF
          there and add the ready-made prompt from <a href={href({ name: 'import' })}>Import</a>. Then paste the answer
          (JSON) back in.
        </p>
        <ul>
          <li>
            <strong>One chapter per run</strong>, otherwise the answer gets cut off.
          </li>
          <li>
            <strong>Story style:</strong> "Fits the material" lets the AI choose the genre. The suggestions show what
            they suit, e.g. start-up for business or courtroom drama for law. You can always enter your own.
          </li>
          <li>
            <strong>Always use Prompt B:</strong> a second, new chat checks every question against the PDF. This is your
            protection against invented content.
          </li>
          <li>
            When in doubt: <strong>📖 Source</strong> shows the quote and, if you attached the PDF on the course page,
            the original page.
          </li>
          <li>
            Wrong question in review? <strong>⚑ Report</strong> it and it's removed from the schedule.
          </li>
        </ul>
        <p className="muted small">
          The content is written in the language of your PDF. The prompts follow the app language.
        </p>
      </section>

      <section className="card stack">
        <h3>Learning on the go, and where it counts</h3>
        <ul>
          <li>
            <strong>🔊 Read aloud / 🎤 Speak:</strong> have the story, questions and explanations read aloud, and speak
            your answers. Speed and voice under "Account &amp; data".
          </li>
          <li>
            <strong>🎧 Listen to the story:</strong> the whole story plays like an audiobook, scene by scene with
            "What's behind it?".
          </li>
          <li>
            <strong>🎧 Hands-free review:</strong> Lorebook reads each question aloud, you answer by voice ("B", "the
            second one", the word or "don't know"), hear the answer and it moves on automatically. "Stop" ends.
          </li>
          <li>
            <strong>🎯 Weak spots:</strong> the course page shows how well each objective sticks right now. "Train weak
            spots" quizzes the shakiest ones.
          </li>
          <li>
            <strong>Formulas</strong> are rendered properly (LaTeX) if the course material contains any.
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h3>Privacy</h3>
        <p>
          Without an account, everything stays in your browser. With an <a href={href({ name: 'account' })}>account</a>,
          courses and progress are backed up to the cloud (Supabase, Frankfurt) and synced between your devices. PDFs
          always stay on the device. No tracking.
        </p>
        <p className="muted small">
          Note: course materials are usually copyrighted. The generated files contain quotes from them, so don't share
          them.
        </p>
      </section>

      <section className="card stack">
        <h3>Install as an app</h3>
        <ul>
          <li>
            <strong>Android:</strong> <a href={APK_URL}>download the Lorebook app</a> (APK) and open it. The first time,
            Android asks whether the browser may install apps: allow it. The app reminds you daily of due reviews (set
            it under "Account &amp; data") and tells you when an update is available.
          </li>
          <li>
            <strong>iPhone (Safari):</strong> Share icon → "Add to Home Screen".
          </li>
          <li>
            <strong>PC (Chrome/Edge):</strong> install icon on the right of the address bar, or menu → "Apps" → "Install
            Lorebook".
          </li>
        </ul>
        <p className="muted small">
          Courses and reviews work offline too. With an account, the app and the website stay in sync.
        </p>
      </section>
    </div>
  );
}

export default function HelpPage() {
  return useLang() === 'en' ? <HelpEn /> : <HelpDe />;
}
