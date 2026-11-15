import { LEGAL } from '../legal';
import { href } from '../router';

const v = (s: string) => s.trim() || '[bitte ergänzen]';

function Address() {
  return (
    <p>
      {v(LEGAL.name)}
      <br />
      {v(LEGAL.street)}
      <br />
      {v(LEGAL.zipCity)}
      <br />
      {LEGAL.country}
      <br />
      E-Mail: <a href={`mailto:${LEGAL.email}`}>{v(LEGAL.email)}</a>
      {LEGAL.phone.trim() && (
        <>
          <br />
          Telefon: {LEGAL.phone}
        </>
      )}
    </p>
  );
}

export function ImpressumPage() {
  return (
    <div className="stack prose">
      <h1>Impressum</h1>
      <section className="card stack">
        <h3>Angaben gemäß § 5 DDG</h3>
        <Address />
        <h3>Verantwortlich für den Inhalt</h3>
        <p>{v(LEGAL.name)}, Anschrift wie oben.</p>
        <h3>Haftung für Inhalte</h3>
        <p>
          Lorebook ist ein privat betriebenes, kostenloses Lernwerkzeug. Die Lerninhalte (Storys, Fragen, Antworten) erzeugen die Nutzer selbst mit
          einer KI ihrer Wahl und importieren sie. Für deren Richtigkeit übernehme ich keine Gewähr. Maßgeblich ist immer das Original-Kursmaterial.
          Für Inhalte externer Links sind ausschließlich deren Betreiber verantwortlich.
        </p>
      </section>
    </div>
  );
}

export function DatenschutzPage() {
  return (
    <div className="stack prose">
      <h1>Datenschutzerklärung</h1>
      <p className="muted small">Stand: {LEGAL.updated}</p>

      <section className="card stack">
        <h3>1. Verantwortlicher</h3>
        <Address />
      </section>

      <section className="card stack">
        <h3>2. Grundprinzip: Deine Daten bleiben auf deinem Gerät</h3>
        <p>
          Lorebook speichert Kurse, Kapitel, Antworten und Lernfortschritt im Speicher deines Browsers (IndexedDB). Ohne Account verlassen diese Daten
          dein Gerät nicht. Es gibt kein Tracking, keine Analyse-Tools, keine Werbung und keine Cookies zu solchen Zwecken.
        </p>
        <p>
          <strong>PDFs</strong>, die du auf einer Kursseite hinterlegst, bleiben immer nur auf deinem Gerät. Sie werden nie hochgeladen, auch nicht mit
          Account.
        </p>
        <p>
          <strong>Lorebook ruft keine KI auf.</strong> Wenn du Inhalte mit Claude, ChatGPT, Gemini o. Ä. erzeugst, tust du das in deinem eigenen Konto
          bei diesem Anbieter. Dafür gelten dessen Datenschutzbestimmungen, Lorebook ist daran nicht beteiligt.
        </p>
      </section>

      <section className="card stack">
        <h3>3. Aufruf der Website</h3>
        <p>
          Die Website wird über <strong>Cloudflare Pages</strong> (Cloudflare, Inc., USA) ausgeliefert. Dabei verarbeitet Cloudflare technisch notwendige
          Verbindungsdaten wie IP-Adresse, Zeitpunkt, aufgerufene Datei und Browserkennung, um die Seite auszuliefern und vor Angriffen zu schützen
          (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse am sicheren Betrieb). Schriften und alle Programmteile kommen von dieser Website selbst.
          Es werden keine Inhalte von Google Fonts oder anderen Drittanbietern geladen.
        </p>
      </section>

      <section className="card stack">
        <h3>4. Account und Synchronisierung (freiwillig)</h3>
        <p>
          Wenn du einen Account anlegst, verarbeite ich zur Bereitstellung des Accounts und zum Abgleich zwischen deinen Geräten
          (Art. 6 Abs. 1 lit. b DSGVO):
        </p>
        <ul>
          <li><strong>Zugangsdaten:</strong> E-Mail-Adresse, Passwort (nur als Hash), Zeitpunkte von Registrierung und Anmeldung.</li>
          <li><strong>Technische Protokolle der Anmeldung:</strong> IP-Adresse und Browserkennung, zur Absicherung gegen Missbrauch, kurzzeitig gespeichert.</li>
          <li>
            <strong>Lerndaten:</strong> eine Kopie deiner Kurse und Kapitel (inkl. darin enthaltener Zitate aus deinem Kursmaterial), deiner Antworten,
            Wiederholungstermine, Bewertungen, XP und Lerntage.
          </li>
          <li><strong>E-Mails:</strong> Zur Bestätigung deiner Adresse bekommst du eine E-Mail.</li>
        </ul>
        <p>Die Lerndaten sind nur für deinen Account abrufbar. Es gibt keine Funktion zum Teilen und keine öffentlichen Profile.</p>
      </section>

      <section className="card stack">
        <h3>5. Dienstleister (Auftragsverarbeiter)</h3>
        <ul>
          <li>
            <strong>Supabase</strong> (Supabase, Inc., USA): Datenbank, Anmeldung und E-Mail-Versand für Accounts. Die Daten liegen in einem
            Rechenzentrum in der EU (Frankfurt am Main). Mit Supabase besteht ein Auftragsverarbeitungsvertrag. Mögliche Übermittlungen in die USA
            sind über die EU-Standardvertragsklauseln abgesichert.
          </li>
          <li>
            <strong>Cloudflare</strong> (Cloudflare, Inc., USA): Auslieferung der Website, siehe Abschnitt 3. Cloudflare ist unter dem
            EU-US Data Privacy Framework zertifiziert. Zusätzlich gelten die Standardvertragsklauseln aus dem Auftragsverarbeitungsvertrag von Cloudflare.
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h3>6. Speicherdauer und Löschung</h3>
        <p>
          Die Daten in der Cloud speichere ich, solange dein Account besteht. Unter <a href={href({ name: 'account' })}>Account &amp; Sync</a> kannst
          du deinen Account jederzeit selbst löschen. Dann werden Account und alle Cloud-Daten sofort endgültig gelöscht. Die Daten in deinem Browser
          löschst du unter <a href={href({ name: 'data' })}>Daten &amp; Sicherung</a> oder über die Browser-Einstellungen.
        </p>
      </section>

      <section className="card stack">
        <h3>7. Lokale Speicherung auf deinem Gerät</h3>
        <p>
          Lorebook nutzt IndexedDB und den lokalen Speicher (localStorage) deines Browsers für deine Lerndaten, die Einstellung „Hell/Dunkel“ und,
          wenn du angemeldet bist, die Anmeldesitzung. Das ist technisch notwendig, damit die App funktioniert (§ 25 Abs. 2 Nr. 2 TDDDG). Über den Service
          Worker funktioniert die App auch offline. Die Daten verlassen dein Gerät nur in den oben beschriebenen Fällen.
        </p>
      </section>

      <section className="card stack">
        <h3>8. Deine Rechte</h3>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit (die Sicherungsdatei unter
          „Daten &amp; Sicherung“ enthält alle deine Lerndaten) und Widerspruch. Wende dich dazu an die oben genannte E-Mail-Adresse. Außerdem kannst du
          dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel beim Hessischen Beauftragten für Datenschutz und Informationsfreiheit.
        </p>
      </section>
    </div>
  );
}
