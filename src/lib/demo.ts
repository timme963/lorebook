import type { ChapterFile } from './schema';
import { getLang } from './i18n';
import { db, slug } from './db';

/** Beispielkapitel, damit man die App ohne eigenes PDF ausprobieren kann. Quelle: Hilfeseite von Lorebook. */
export const DEMO_CHAPTER: ChapterFile = {
  lorebook: 1,
  course: { title: 'Demo: Wie Lernen hängen bleibt', source: 'Lorebook-Hilfe (kein PDF)' },
  verified: true,
  verificationNotes: ['Demo-Inhalt, von Hand geprüft'],
  chapter: {
    number: 1,
    title: 'Die vier Werkzeuge des Gedächtnisses',
    pages: [1, 1],
    objectives: [
      {
        id: 'o1',
        text: 'Vorabfragen (Pretesting) verbessern das spätere Lernen, auch wenn man falsch rät.',
        source: { page: 1, quote: 'Wer vor dem Lernen Fragen beantwortet, behält den Stoff danach besser – selbst wenn die Antworten falsch waren.' },
      },
      {
        id: 'o2',
        text: 'Aktives Abrufen (Active Recall) festigt Wissen stärker als erneutes Lesen.',
        source: { page: 1, quote: 'Sich aktiv an etwas zu erinnern, festigt es stärker als es noch einmal zu lesen.' },
      },
      {
        id: 'o3',
        text: 'Verteilte Wiederholung (Spaced Repetition) mit wachsenden Abständen nutzt das Vergessen gezielt aus.',
        source: { page: 1, quote: 'Wiederholungen wirken am besten, wenn sie kurz vor dem Vergessen stattfinden und die Abstände dabei wachsen.' },
      },
      {
        id: 'o4',
        text: 'Interessante, aber irrelevante Details (Seductive Details) verschlechtern das Lernen.',
        source: { page: 1, quote: 'Interessante Details, die mit dem Lernziel nichts zu tun haben, lenken ab und verschlechtern das Behalten.' },
      },
    ],
    pretest: [
      {
        id: 'q1', objective: 'o1', level: 'understand', type: 'mc',
        prompt: 'Du beantwortest Fragen zu einem Thema, bevor du es gelernt hast, und liegst meistens falsch. Was passiert mit deinem späteren Lernerfolg?',
        options: ['Er sinkt, weil sich die falschen Antworten einprägen', 'Er steigt, weil das Raten den Stoff vorbereitet', 'Er bleibt gleich', 'Er steigt nur, wenn man mindestens die Hälfte richtig hat'],
        correct: 1,
        explanation: 'Der Pretesting-Effekt wirkt auch bei falschen Antworten: Das Gehirn wird auf die Lücken aufmerksam und speichert die richtige Antwort später besser.',
        source: { page: 1, quote: 'Wer vor dem Lernen Fragen beantwortet, behält den Stoff danach besser – selbst wenn die Antworten falsch waren.' },
      },
      {
        id: 'q2', objective: 'o2', level: 'remember', type: 'mc',
        prompt: 'Welche Lernmethode festigt Wissen am stärksten?',
        options: ['Text zweimal lesen', 'Wichtiges markieren', 'Sich ohne Vorlage an den Inhalt erinnern', 'Eine Zusammenfassung abschreiben'],
        correct: 2,
        explanation: 'Aktives Abrufen ohne Vorlage ist wirksamer als passives Wiederlesen, Markieren oder Abschreiben.',
        source: { page: 1, quote: 'Sich aktiv an etwas zu erinnern, festigt es stärker als es noch einmal zu lesen.' },
      },
      {
        id: 'q3', objective: 'o3', level: 'remember', type: 'cloze',
        prompt: 'Bei der verteilten Wiederholung werden die Abstände zwischen den Wiederholungen immer ___.',
        answers: ['größer', 'länger', 'grösser'],
        explanation: 'Mit jeder erfolgreichen Wiederholung hält das Wissen länger, deshalb wachsen die Abstände.',
        source: { page: 1, quote: 'Wiederholungen wirken am besten, wenn sie kurz vor dem Vergessen stattfinden und die Abstände dabei wachsen.' },
      },
    ],
    story: {
      title: 'Die Archivarin von Kessel',
      setting: 'Mira ist neue Archivarin in der Hafenstadt Kessel. In sieben Tagen kommt der Rat, um das Wissen der Archivare zu prüfen. Wer durchfällt, verliert seinen Schlüssel zum Archiv.',
      scenes: [
        {
          objective: 'o1', title: 'Das Rätsel am Tor',
          text: 'Am ersten Morgen hält der alte Archivar Bento Mira eine Tafel mit zehn Fragen hin, bevor sie auch nur ein Buch aufschlagen darf. „Ich weiß doch noch gar nichts!“, protestiert sie. „Genau deshalb“, sagt Bento. Mira rät, kritzelt Antworten hin, liegt bei fast allen daneben. Doch als sie am Nachmittag die Bücher liest, springen ihr genau die Stellen ins Auge, an denen sie morgens gescheitert war. Jede Lücke von heute früh ist jetzt ein Haken, an dem das neue Wissen hängen bleibt. Bento grinst: „Das Raten war keine Prüfung. Es war die Vorbereitung.“',
          concept: 'Pretesting: Fragen vor dem Lernen zu beantworten verbessert das spätere Behalten, auch wenn die Antworten falsch sind. Das Raten lenkt die Aufmerksamkeit beim anschließenden Lernen gezielt auf die Wissenslücken.',
        },
        {
          objective: 'o2', title: 'Die verschlossenen Bücher',
          text: 'Am dritten Tag liest Mira die Hafenchronik zum vierten Mal. Alles fühlt sich vertraut an. Bento klappt das Buch zu: „Erzähl mir, wann der Leuchtturm gebaut wurde.“ Stille. Das Vertraute war nur Wiedererkennen, kein Wissen. Ab jetzt arbeitet Mira anders: ein Kapitel lesen, Buch zu, alles aus dem Kopf aufschreiben, dann vergleichen. Es ist anstrengender, und genau das ist der Punkt. Jedes Mal, wenn sie sich mühsam erinnert, wird die Spur im Gedächtnis tiefer.',
          concept: 'Active Recall: Sich aktiv und ohne Vorlage an Inhalte zu erinnern festigt sie stärker als wiederholtes Lesen. Wiederlesen erzeugt ein trügerisches Gefühl von Vertrautheit, ohne dass man den Inhalt selbst abrufen kann.',
        },
        {
          objective: 'o3', title: 'Der Kalender der Gezeiten',
          text: 'Mira will jetzt alles jeden Abend wiederholen, doch die Liste wird zu lang. Bento zeigt ihr seinen Gezeitenkalender: Was sie heute sicher weiß, kommt in drei Tagen wieder, dann in einer Woche, dann in einem Monat. Was sie vergessen hat, kommt morgen zurück. „Du wiederholst kurz bevor das Wasser das Wissen wegspült“, sagt er. Mira merkt: Die Abstände wachsen, und trotzdem vergisst sie weniger. Sie lernt nicht mehr, sondern im richtigen Moment.',
          concept: 'Spaced Repetition: Wiederholungen sind am wirksamsten, wenn sie kurz vor dem Vergessen erfolgen. Nach jeder erfolgreichen Wiederholung werden die Abstände größer; Vergessenes wird bald erneut wiederholt.',
        },
        {
          objective: 'o4', title: 'Die Seeschlange im Inhaltsverzeichnis',
          text: 'Am sechsten Tag findet Mira ein wunderschön illustriertes Buch über Seeschlangen, die angeblich im Hafen gelebt haben. Sie liest es fasziniert in einer Nacht. Am Morgen fragt Bento nach den Handelsrouten, die auf denselben Seiten standen. Mira erinnert sich an jede Schlange, aber an keine Route. „Spannend ist nur gut, wenn es zum Thema gehört“, sagt Bento. Mira streicht die Schlangen und malt sich stattdessen die Routen als Geschichte aus, in der jede Station etwas über den Handel verrät.',
          concept: 'Seductive Details: Interessante, aber für das Lernziel irrelevante Details ziehen Aufmerksamkeit ab und verschlechtern das Behalten des eigentlichen Stoffs. Anschauliche Elemente helfen nur, wenn sie das Lernziel selbst transportieren.',
        },
      ],
      ending: 'Am siebten Tag tritt der Rat zusammen. Mira beantwortet jede Frage, nicht weil sie am meisten gelesen hat, sondern weil sie geraten, abgerufen, im richtigen Rhythmus wiederholt und sich nicht von Seeschlangen hat ablenken lassen. Bento überreicht ihr den Schlüssel.',
    },
    posttest: [
      {
        id: 'q4', objective: 'o1', level: 'apply', type: 'mc',
        prompt: 'Eine Lehrerin will den Lernerfolg ihrer Klasse beim neuen Thema „Vulkane“ steigern, ohne mehr Unterrichtszeit zu verwenden. Was empfiehlt sich nach dem Pretesting-Effekt?',
        options: ['Am Ende der Einheit einen Test schreiben', 'Zu Beginn ein paar Fragen zum Thema stellen, bevor sie erklärt', 'Die Fragen erst stellen, wenn alle sicher richtig antworten', 'Den Schülern die Fragen samt Lösungen vorab austeilen'],
        correct: 1,
        explanation: 'Vorabfragen vor der Erklärung lenken die Aufmerksamkeit auf die Lücken. Fragen mit Lösungen vorab wären kein Abrufversuch.',
        source: { page: 1, quote: 'Wer vor dem Lernen Fragen beantwortet, behält den Stoff danach besser – selbst wenn die Antworten falsch waren.' },
      },
      {
        id: 'q5', objective: 'o2', level: 'understand', type: 'open',
        prompt: 'Warum fühlt sich wiederholtes Lesen oft wirksamer an, als es ist?',
        modelAnswer: 'Beim Wiederlesen erkennt man den Text wieder und hält dieses Gefühl der Vertrautheit für Wissen. Ob man den Inhalt selbst abrufen kann, wird dabei nicht geprüft.',
        rubric: ['Vertrautheit bzw. Wiedererkennen wird mit Wissen verwechselt', 'Abrufen wird beim Lesen nicht geübt'],
        explanation: 'Wiedererkennen ist leichter als Abrufen. Erst der Abrufversuch zeigt, ob das Wissen wirklich verfügbar ist.',
        source: { page: 1, quote: 'Sich aktiv an etwas zu erinnern, festigt es stärker als es noch einmal zu lesen.' },
      },
      {
        id: 'q6', objective: 'o3', level: 'apply', type: 'mc',
        prompt: 'Du hast eine Vokabel heute sicher gewusst, gestern auch und vor vier Tagen auch. Wann sollte sie nach dem Prinzip der verteilten Wiederholung als Nächstes drankommen?',
        options: ['Morgen', 'In etwa einer bis zwei Wochen', 'Heute Abend noch einmal', 'Nie wieder'],
        correct: 1,
        explanation: 'Nach mehreren erfolgreichen Wiederholungen wächst der Abstand deutlich. Nie wieder ist falsch, weil auch gut Gelerntes langfristig verblasst.',
        source: { page: 1, quote: 'Wiederholungen wirken am besten, wenn sie kurz vor dem Vergessen stattfinden und die Abstände dabei wachsen.' },
      },
      {
        id: 'q7', objective: 'o4', level: 'transfer', type: 'open',
        prompt: 'Ein Erklärvideo über Zinseszins beginnt mit einer zweiminütigen, witzigen Anekdote über einen Lottogewinner, der alles verprasst hat. Danach folgt die Formel. Was spricht aus lernpsychologischer Sicht dagegen, und wie könnte man die Anekdote retten?',
        modelAnswer: 'Die Anekdote ist unterhaltsam, transportiert aber nicht das Konzept Zinseszins. Sie ist ein Seductive Detail, das Aufmerksamkeit bindet und das Behalten der Formel verschlechtert. Retten lässt sie sich, wenn die Geschichte selbst den Zinseszins zeigt, z. B. was aus dem Gewinn bei Anlage über Jahre geworden wäre.',
        rubric: ['Erkennt die Anekdote als irrelevantes Detail ohne Bezug zum Lernziel', 'Nennt die Folge: Ablenkung, schlechteres Behalten', 'Schlägt vor, die Geschichte am Konzept auszurichten'],
        explanation: 'Anschaulichkeit hilft nur, wenn sie das Lernziel trägt.',
        source: { page: 1, quote: 'Interessante Details, die mit dem Lernziel nichts zu tun haben, lenken ab und verschlechtern das Behalten.' },
      },
    ],
    review: [
      {
        id: 'q8', objective: 'o1', level: 'remember', type: 'cloze',
        prompt: 'Der Effekt, dass Fragen vor dem Lernen das Behalten verbessern, heißt ___-Effekt.',
        answers: ['Pretesting', 'Pretest', 'Vortest'],
        explanation: 'Pretesting = Testen vor dem Lernen.',
        source: { page: 1, quote: 'Wer vor dem Lernen Fragen beantwortet, behält den Stoff danach besser – selbst wenn die Antworten falsch waren.' },
      },
      {
        id: 'q9', objective: 'o2', level: 'transfer', type: 'mc',
        prompt: 'Ein Sanitäter will sich die Reihenfolge der Erste-Hilfe-Schritte einprägen. Welches Vorgehen passt am besten zu Active Recall?',
        options: ['Das Plakat jeden Tag einmal anschauen', 'Die Schritte aus dem Kopf aufsagen und danach mit dem Plakat vergleichen', 'Das Plakat abfotografieren', 'Die Schritte farbig markieren'],
        correct: 1,
        explanation: 'Nur das Aufsagen aus dem Kopf ist ein Abrufversuch, der Vergleich danach liefert Feedback.',
        source: { page: 1, quote: 'Sich aktiv an etwas zu erinnern, festigt es stärker als es noch einmal zu lesen.' },
      },
      {
        id: 'q10', objective: 'o3', level: 'understand', type: 'mc',
        prompt: 'Warum kommt eine vergessene Karte bei verteilter Wiederholung schon bald wieder?',
        options: ['Zur Strafe', 'Weil das Wissen offenbar noch nicht stabil ist und die Abstände neu klein beginnen', 'Weil alle Karten täglich kommen', 'Damit die Statistik besser aussieht'],
        correct: 1,
        explanation: 'Vergessen zeigt, dass der Abstand zu groß war. Die Wiederholung beginnt mit kurzen Abständen neu.',
        source: { page: 1, quote: 'Wiederholungen wirken am besten, wenn sie kurz vor dem Vergessen stattfinden und die Abstände dabei wachsen.' },
      },
      {
        id: 'q11', objective: 'o3', level: 'apply', type: 'open',
        prompt: 'Du hast 20 Tage bis zur Klausur und 4 Stunden Lernzeit für ein Kapitel. Wie verteilst du die Zeit nach dem Prinzip der verteilten Wiederholung, und warum nicht alles am Tag vor der Klausur?',
        modelAnswer: 'Ein großer erster Lernblock, danach kurze Wiederholungen mit wachsenden Abständen, z. B. nach 1, 3, 7 und 14 Tagen. Alles am Vortag zu lernen hilft kurzfristig, wird aber schnell vergessen, weil keine Wiederholung kurz vor dem Vergessen stattfindet.',
        rubric: ['Verteilt die Zeit auf mehrere Termine', 'Abstände wachsen', 'Begründet, warum Pauken am Vortag schlechter behalten wird'],
        explanation: 'Verteilte Wiederholung schlägt massiertes Lernen bei gleicher Gesamtzeit.',
        source: { page: 1, quote: 'Wiederholungen wirken am besten, wenn sie kurz vor dem Vergessen stattfinden und die Abstände dabei wachsen.' },
      },
      {
        id: 'q12', objective: 'o4', level: 'understand', type: 'cloze',
        prompt: 'Interessante, aber für das Lernziel irrelevante Details nennt man Seductive ___.',
        answers: ['Details', 'Detail'],
        explanation: 'Seductive = verführerisch: Die Details verführen die Aufmerksamkeit weg vom Lernziel.',
        source: { page: 1, quote: 'Interessante Details, die mit dem Lernziel nichts zu tun haben, lenken ab und verschlechtern das Behalten.' },
      },
      {
        id: 'q13', objective: 'o4', level: 'transfer', type: 'mc',
        prompt: 'Eine Firma gestaltet eine Sicherheitsschulung als Spiel. Welches Element unterstützt das Lernen am ehesten?',
        options: ['Lustige Katzenvideos zwischen den Kapiteln', 'Ein Rätsel, das man nur mit der richtigen Sicherheitsregel lösen kann', 'Eine aufwendige Hintergrundmusik', 'Zufällige Bonuspunkte'],
        correct: 1,
        explanation: 'Das Rätsel transportiert das Lernziel selbst. Die anderen Elemente sind unterhaltsam, aber ohne Bezug zum Stoff.',
        source: { page: 1, quote: 'Interessante Details, die mit dem Lernziel nichts zu tun haben, lenken ab und verschlechtern das Behalten.' },
      },
      {
        id: 'q14', objective: 'o2', level: 'understand', type: 'mc',
        prompt: 'Welche dieser Lernmethoden sind aktives Abrufen?',
        options: ['Karteikarten abfragen, ohne vorher auf die Rückseite zu schauen', 'Wichtige Stellen farbig markieren', 'Ein leeres Blatt nehmen und alles aus dem Kopf aufschreiben', 'Die Zusammenfassung ein zweites Mal lesen'],
        correct: [0, 2],
        explanation: 'Bei A und C holst du das Wissen ohne Vorlage aus dem Gedächtnis – das ist aktives Abrufen. Markieren (B) und Wiederlesen (D) sind passiv: Der Inhalt liegt vor dir.',
        source: { page: 1, quote: 'Sich aktiv an etwas zu erinnern, festigt es stärker als es noch einmal zu lesen.' },
      },
    ],
  },
};

const Q1 = 'People who answer questions before studying remember the material better afterwards – even if their answers were wrong.';
const Q2 = 'Actively recalling something strengthens it more than reading it again.';
const Q3 = 'Reviews work best when they happen just before you forget and the intervals keep growing.';
const Q4 = 'Interesting details that have nothing to do with the learning goal distract and make retention worse.';

/** Englische Fassung des Demo-Kapitels */
export const DEMO_CHAPTER_EN: ChapterFile = {
  lorebook: 1,
  course: { title: 'Demo: How learning sticks', source: 'Lorebook help (no PDF)' },
  verified: true,
  verificationNotes: ['Demo content, checked by hand'],
  chapter: {
    number: 1,
    title: 'The four tools of memory',
    pages: [1, 1],
    objectives: [
      { id: 'o1', text: 'Pre-questions (pretesting) improve later learning, even when you guess wrong.', source: { page: 1, quote: Q1 } },
      { id: 'o2', text: 'Active recall strengthens knowledge more than re-reading.', source: { page: 1, quote: Q2 } },
      { id: 'o3', text: 'Spaced repetition with growing intervals makes deliberate use of forgetting.', source: { page: 1, quote: Q3 } },
      { id: 'o4', text: 'Interesting but irrelevant details (seductive details) impair learning.', source: { page: 1, quote: Q4 } },
    ],
    pretest: [
      {
        id: 'q1', objective: 'o1', level: 'understand', type: 'mc',
        prompt: 'You answer questions on a topic before you have studied it and get most of them wrong. What happens to how well you learn it later?',
        options: ['It drops, because the wrong answers stick', 'It rises, because guessing prepares you for the material', 'It stays the same', 'It only rises if you get at least half right'],
        correct: 1,
        explanation: 'The pretesting effect works even with wrong answers: your brain notices the gaps and stores the correct answer better later.',
        source: { page: 1, quote: Q1 },
      },
      {
        id: 'q2', objective: 'o2', level: 'remember', type: 'mc',
        prompt: 'Which study method strengthens knowledge the most?',
        options: ['Reading the text twice', 'Highlighting the important parts', 'Recalling the content without looking', 'Copying out a summary'],
        correct: 2,
        explanation: 'Active recall without notes is more effective than passive re-reading, highlighting or copying.',
        source: { page: 1, quote: Q2 },
      },
      {
        id: 'q3', objective: 'o3', level: 'remember', type: 'cloze',
        prompt: 'In spaced repetition, the intervals between reviews keep getting ___.',
        answers: ['longer', 'bigger', 'larger'],
        explanation: 'Each successful review makes the knowledge last longer, so the intervals grow.',
        source: { page: 1, quote: Q3 },
      },
    ],
    story: {
      title: 'The Archivist of Kessel',
      setting: 'Mira is the new archivist in the harbour town of Kessel. In seven days the council will come to test the archivists. Whoever fails loses their key to the archive.',
      scenes: [
        {
          objective: 'o1', title: 'The riddle at the gate',
          text: 'On the first morning, old archivist Bento hands Mira a slate with ten questions before she may even open a book. "But I don\'t know anything yet!" she protests. "That\'s exactly why," says Bento. Mira guesses, scribbles answers and gets almost all of them wrong. Yet when she reads the books that afternoon, the very passages she stumbled over that morning leap out at her. Every gap from the morning is now a hook for the new knowledge to hang on. Bento grins: "The guessing wasn\'t a test. It was the preparation."',
          concept: 'Pretesting: answering questions before studying improves later retention, even when the answers are wrong. Guessing directs your attention to the gaps in your knowledge while you study afterwards.',
        },
        {
          objective: 'o2', title: 'The closed books',
          text: 'On the third day, Mira reads the harbour chronicle for the fourth time. Everything feels familiar. Bento shuts the book: "Tell me when the lighthouse was built." Silence. The familiarity was only recognition, not knowledge. From now on Mira works differently: read a chapter, close the book, write down everything from memory, then compare. It is harder work, and that is the point. Every time she struggles to remember, the trace in her memory grows deeper.',
          concept: 'Active recall: actively retrieving content without notes strengthens it more than re-reading. Re-reading creates a deceptive feeling of familiarity without you being able to retrieve the content yourself.',
        },
        {
          objective: 'o3', title: 'The calendar of tides',
          text: 'Now Mira wants to review everything every evening, but the list grows too long. Bento shows her his tide calendar: what she knows well today comes back in three days, then in a week, then in a month. What she has forgotten comes back tomorrow. "You review just before the water washes the knowledge away," he says. Mira notices: the intervals grow, and yet she forgets less. She is not studying more, but at the right moment.',
          concept: 'Spaced repetition: reviews are most effective just before you forget. After each successful review the intervals grow; whatever was forgotten is reviewed again soon.',
        },
        {
          objective: 'o4', title: 'The sea serpent in the index',
          text: 'On the sixth day, Mira finds a beautifully illustrated book about sea serpents that supposedly lived in the harbour. She reads it in one night, spellbound. In the morning Bento asks about the trade routes printed on the same pages. Mira remembers every serpent but not a single route. "Exciting is only good if it belongs to the topic," says Bento. Mira crosses out the serpents and instead imagines the routes as a story in which every stop reveals something about the trade.',
          concept: 'Seductive details: interesting details that are irrelevant to the learning goal draw attention away and impair retention of the actual material. Vivid elements only help if they carry the learning goal itself.',
        },
      ],
      ending: 'On the seventh day the council convenes. Mira answers every question – not because she read the most, but because she guessed, recalled, reviewed at the right rhythm and did not let sea serpents distract her. Bento hands her the key.',
    },
    posttest: [
      {
        id: 'q4', objective: 'o1', level: 'apply', type: 'mc',
        prompt: 'A teacher wants to boost her class\'s learning on the new topic "volcanoes" without using more lesson time. What does the pretesting effect suggest?',
        options: ['Give a test at the end of the unit', 'Ask a few questions on the topic at the start, before explaining it', 'Only ask questions once everyone is sure to answer correctly', 'Hand out the questions with answers in advance'],
        correct: 1,
        explanation: 'Pre-questions before the explanation direct attention to the gaps. Questions handed out with answers would not be a retrieval attempt.',
        source: { page: 1, quote: Q1 },
      },
      {
        id: 'q5', objective: 'o2', level: 'understand', type: 'open',
        prompt: 'Why does re-reading often feel more effective than it is?',
        modelAnswer: 'When you re-read, you recognise the text and mistake that feeling of familiarity for knowledge. Whether you can retrieve the content yourself is never tested.',
        rubric: ['Familiarity or recognition is mistaken for knowledge', 'Reading does not practise retrieval'],
        explanation: 'Recognising is easier than recalling. Only a retrieval attempt shows whether the knowledge is really available.',
        source: { page: 1, quote: Q2 },
      },
      {
        id: 'q6', objective: 'o3', level: 'apply', type: 'mc',
        prompt: 'You knew a vocabulary word confidently today, yesterday and four days ago. According to spaced repetition, when should it come up next?',
        options: ['Tomorrow', 'In about one to two weeks', 'Once more tonight', 'Never again'],
        correct: 1,
        explanation: 'After several successful reviews the interval grows considerably. Never again is wrong, because even well-learned material fades in the long run.',
        source: { page: 1, quote: Q3 },
      },
      {
        id: 'q7', objective: 'o4', level: 'transfer', type: 'open',
        prompt: 'An explainer video on compound interest opens with a funny two-minute anecdote about a lottery winner who blew everything. Then comes the formula. What speaks against this from a learning-psychology perspective, and how could the anecdote be saved?',
        modelAnswer: 'The anecdote is entertaining but does not convey compound interest. It is a seductive detail that grabs attention and impairs retention of the formula. It can be saved if the story itself shows compound interest, e.g. what the winnings would have grown to if invested over the years.',
        rubric: ['Identifies the anecdote as an irrelevant detail unrelated to the learning goal', 'Names the consequence: distraction, worse retention', 'Suggests aligning the story with the concept'],
        explanation: 'Vividness only helps when it carries the learning goal.',
        source: { page: 1, quote: Q4 },
      },
    ],
    review: [
      {
        id: 'q8', objective: 'o1', level: 'remember', type: 'cloze',
        prompt: 'The effect that questions before studying improve retention is called the ___ effect.',
        answers: ['pretesting', 'pretest', 'pre-testing'],
        explanation: 'Pretesting = testing before learning.',
        source: { page: 1, quote: Q1 },
      },
      {
        id: 'q9', objective: 'o2', level: 'transfer', type: 'mc',
        prompt: 'A paramedic wants to memorise the order of first-aid steps. Which approach fits active recall best?',
        options: ['Look at the poster once a day', 'Recite the steps from memory and then compare with the poster', 'Take a photo of the poster', 'Highlight the steps in colour'],
        correct: 1,
        explanation: 'Only reciting from memory is a retrieval attempt; comparing afterwards provides feedback.',
        source: { page: 1, quote: Q2 },
      },
      {
        id: 'q10', objective: 'o3', level: 'understand', type: 'mc',
        prompt: 'In spaced repetition, why does a forgotten card come back soon?',
        options: ['As a punishment', 'Because the knowledge is evidently not yet stable, so the intervals start small again', 'Because all cards come every day', 'To make the statistics look better'],
        correct: 1,
        explanation: 'Forgetting shows that the interval was too long. Reviewing starts over with short intervals.',
        source: { page: 1, quote: Q3 },
      },
      {
        id: 'q11', objective: 'o3', level: 'apply', type: 'open',
        prompt: 'You have 20 days until the exam and 4 hours of study time for one chapter. How do you distribute the time according to spaced repetition, and why not do it all the day before the exam?',
        modelAnswer: 'One large first study block, then short reviews at growing intervals, e.g. after 1, 3, 7 and 14 days. Cramming the day before helps in the short term but is forgotten quickly, because no review happens just before forgetting.',
        rubric: ['Spreads the time over several sessions', 'Intervals grow', 'Explains why cramming the day before is retained worse'],
        explanation: 'Spaced repetition beats massed learning for the same total time.',
        source: { page: 1, quote: Q3 },
      },
      {
        id: 'q12', objective: 'o4', level: 'understand', type: 'cloze',
        prompt: 'Interesting details that are irrelevant to the learning goal are called seductive ___.',
        answers: ['details', 'detail'],
        explanation: 'Seductive: the details lure your attention away from the learning goal.',
        source: { page: 1, quote: Q4 },
      },
      {
        id: 'q13', objective: 'o4', level: 'transfer', type: 'mc',
        prompt: 'A company designs a safety training as a game. Which element is most likely to support learning?',
        options: ['Funny cat videos between chapters', 'A puzzle that can only be solved with the correct safety rule', 'An elaborate soundtrack', 'Random bonus points'],
        correct: 1,
        explanation: 'The puzzle carries the learning goal itself. The other elements are entertaining but unrelated to the material.',
        source: { page: 1, quote: Q4 },
      },
      {
        id: 'q14', objective: 'o2', level: 'understand', type: 'mc',
        prompt: 'Which of these study methods are active recall?',
        options: ['Quizzing yourself with flashcards before looking at the back', 'Highlighting important passages', 'Taking a blank sheet and writing down everything from memory', 'Reading the summary a second time'],
        correct: [0, 2],
        explanation: 'In A and C you retrieve the knowledge from memory without notes – that is active recall. Highlighting (B) and re-reading (D) are passive: the content is right in front of you.',
        source: { page: 1, quote: Q2 },
      },
    ],
  },
};

/** Demo-Kapitel in der aktuellen Sprache */
export const demoChapter = (): ChapterFile => (getLang() === 'en' ? DEMO_CHAPTER_EN : DEMO_CHAPTER);

/** Kurs-IDs des Demo-Kapitels (die ID kommt aus dem Titel, daher je Sprache eine) */
const DEMO_COURSE_IDS = [slug(DEMO_CHAPTER.course.title), slug(DEMO_CHAPTER_EN.course.title)];

/** ID des vorhandenen Demo-Kurses, falls schon geladen */
export async function findDemoCourse(): Promise<string | undefined> {
  for (const id of DEMO_COURSE_IDS) if (await db.courses.get(id)) return id;
  return undefined;
}

/**
 * Bringt ein bereits geladenes Demo-Kapitel in die aktuelle Sprache. Beide Fassungen haben dieselben
 * Lernziel- und Frage-IDs, deshalb bleiben Fortschritt und Wiederholungskarten erhalten. Eigene Kurse bleiben unberührt.
 */
export async function localizeDemo(): Promise<void> {
  const file = demoChapter();
  for (const id of DEMO_COURSE_IDS) {
    const course = await db.courses.get(id);
    if (!course) continue;
    if (course.title !== file.course.title) await db.courses.update(id, { title: file.course.title, source: file.course.source });
    const chapters = await db.chapters.where('courseId').equals(id).toArray();
    for (const ch of chapters) {
      if (ch.content.title !== file.chapter.title) {
        await db.chapters.update(ch.id, { content: file.chapter, verificationNotes: file.verificationNotes });
      }
    }
  }
}
