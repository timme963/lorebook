# Third-Party-Notices

Lorebook verwendet die folgenden Fremdbibliotheken: die npm-Pakete, die in der Web-App und der Android-App landen (samt ihrer transitiven Abhängigkeiten, ohne optionale Node-Erweiterungen, die nie im Browser-Bundle landen), und die nativen Android-Bibliotheken in der APK. Werkzeuge für Entwicklung, Build und Tests (`devDependencies`) werden nicht ausgeliefert und stehen deshalb nicht hier. Die Lizenztexte stehen in den verlinkten Quellen bzw. im jeweiligen Paket.

Erzeugt von `npm run licenses` aus `package-lock.json` und den Gradle-Dateien; nicht von Hand bearbeiten. `npm run check` prüft, dass die Datei aktuell ist und jede Lizenz mit der AGPL-3.0 von Lorebook vereinbar ist.

## npm-Pakete

| Paket | Version | Lizenz | Quelle |
| --- | --- | --- | --- |
| @capacitor-community/speech-recognition | 7.0.1 | MIT | <https://github.com/capacitor-community/speech-recognition> |
| @capacitor-community/text-to-speech | 8.0.2 | MIT | <https://github.com/capacitor-community/text-to-speech> |
| @capacitor/app | 8.1.2 | MIT | <https://github.com/ionic-team/capacitor-plugins> |
| @capacitor/core | 8.6.2 | MIT | <https://github.com/ionic-team/capacitor> |
| @capacitor/filesystem | 8.1.5 | MIT | <https://github.com/ionic-team/capacitor-filesystem> |
| @capacitor/local-notifications | 8.3.1 | MIT | <https://github.com/ionic-team/capacitor-local-notifications> |
| @capacitor/share | 8.0.3 | MIT | <https://github.com/ionic-team/capacitor-plugins> |
| @capacitor/synapse | 1.0.4 | ISC | <https://www.npmjs.com/package/@capacitor/synapse> |
| @open-spaced-repetition/srs-kit | 1.0.0 | BSD-3-Clause | <https://github.com/open-spaced-repetition/ts-fsrs> |
| @supabase/auth-js | 2.119.2 | MIT | <https://github.com/supabase/supabase-js> |
| @supabase/functions-js | 2.119.2 | MIT | <https://github.com/supabase/supabase-js> |
| @supabase/phoenix | 0.4.5 | MIT | <https://github.com/supabase/phoenix> |
| @supabase/postgrest-js | 2.119.2 | MIT | <https://github.com/supabase/supabase-js> |
| @supabase/realtime-js | 2.119.2 | MIT | <https://github.com/supabase/supabase-js> |
| @supabase/storage-js | 2.119.2 | MIT | <https://github.com/supabase/supabase-js> |
| @supabase/supabase-js | 2.119.2 | MIT | <https://github.com/supabase/supabase-js> |
| commander | 15.1.0 | MIT | <https://github.com/tj/commander.js> |
| dexie | 4.4.7 | Apache-2.0 | <https://github.com/dexie/Dexie.js> |
| dexie-react-hooks | 4.4.0 | Apache-2.0 | <https://github.com/dexie/Dexie.js> |
| iceberg-js | 0.8.1 | MIT | <https://github.com/supabase/iceberg-js> |
| katex | 0.19.1 | MIT | <https://github.com/KaTeX/KaTeX> |
| pdfjs-dist | 6.5.438 | Apache-2.0 | <https://github.com/mozilla/pdf.js> |
| react | 19.3.1 | MIT | <https://github.com/react/react> |
| react-dom | 19.3.1 | MIT | <https://github.com/react/react> |
| scheduler | 0.28.0 | MIT | <https://github.com/react/react> |
| ts-fsrs | 6.0.0 | MIT | <https://github.com/open-spaced-repetition/ts-fsrs> |
| tslib | 2.8.1 | 0BSD | <https://github.com/Microsoft/tslib> |
| tslib | 2.9.1 | 0BSD | <https://github.com/Microsoft/tslib> |
| zod | 4.6.7 | MIT | <https://github.com/colinhacks/zod> |

## Android-Bibliotheken in der APK

| Bibliothek | Version | Lizenz | Quelle |
| --- | --- | --- | --- |
| androidx.activity:activity | 1.11.0 | Apache-2.0 | <https://developer.android.com/jetpack/androidx/releases/activity> |
| androidx.appcompat:appcompat | 1.7.1 | Apache-2.0 | <https://developer.android.com/jetpack/androidx/releases/appcompat> |
| androidx.coordinatorlayout:coordinatorlayout | 1.3.0 | Apache-2.0 | <https://developer.android.com/jetpack/androidx/releases/coordinatorlayout> |
| androidx.core:core | 1.17.0 | Apache-2.0 | <https://developer.android.com/jetpack/androidx/releases/core> |
| androidx.core:core-splashscreen | 1.2.0 | Apache-2.0 | <https://developer.android.com/jetpack/androidx/releases/core> |
| androidx.fragment:fragment | 1.8.9 | Apache-2.0 | <https://developer.android.com/jetpack/androidx/releases/fragment> |
| androidx.webkit:webkit | 1.14.0 | Apache-2.0 | <https://developer.android.com/jetpack/androidx/releases/webkit> |
| org.apache.cordova:framework | 14.0.1 | Apache-2.0 | <https://github.com/apache/cordova-android> |
| org.jetbrains.kotlinx:kotlinx-coroutines-core | 1.10.2 | Apache-2.0 | <https://github.com/Kotlin/kotlinx.coroutines> |
| io.ionic.libs:ionfilesystem-android | 1.1.1 | Apache-2.0 | <https://github.com/ionic-team/ion-android-filesystem> |
