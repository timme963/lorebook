// Writes THIRD-PARTY-NOTICES.md for what Lorebook ships: the runtime npm packages (with their transitive
// dependencies) from package-lock.json and the native Android libraries bundled into the APK.
// `--check` fails when the file is outdated or a license is not allowed. Needs `npm install` first.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('THIRD-PARTY-NOTICES.md', ROOT);

/** Permissive licenses that are compatible with distributing Lorebook under the AGPL-3.0. */
const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'Unlicense',
  'Zlib',
]);

/** Native Android libraries linked into the APK; versions come from the Gradle files named in `versionFrom`. */
const ANDROID_LIBRARIES = [
  {
    name: 'androidx.activity:activity',
    variable: 'androidxActivityVersion',
    source: 'https://developer.android.com/jetpack/androidx/releases/activity',
  },
  {
    name: 'androidx.appcompat:appcompat',
    variable: 'androidxAppCompatVersion',
    source: 'https://developer.android.com/jetpack/androidx/releases/appcompat',
  },
  {
    name: 'androidx.coordinatorlayout:coordinatorlayout',
    variable: 'androidxCoordinatorLayoutVersion',
    source: 'https://developer.android.com/jetpack/androidx/releases/coordinatorlayout',
  },
  {
    name: 'androidx.core:core',
    variable: 'androidxCoreVersion',
    source: 'https://developer.android.com/jetpack/androidx/releases/core',
  },
  {
    name: 'androidx.core:core-splashscreen',
    variable: 'coreSplashScreenVersion',
    source: 'https://developer.android.com/jetpack/androidx/releases/core',
  },
  {
    name: 'androidx.fragment:fragment',
    variable: 'androidxFragmentVersion',
    source: 'https://developer.android.com/jetpack/androidx/releases/fragment',
  },
  {
    name: 'androidx.webkit:webkit',
    variable: 'androidxWebkitVersion',
    source: 'https://developer.android.com/jetpack/androidx/releases/webkit',
  },
  {
    name: 'org.apache.cordova:framework',
    variable: 'cordovaAndroidVersion',
    source: 'https://github.com/apache/cordova-android',
  },
  {
    name: 'org.jetbrains.kotlinx:kotlinx-coroutines-core',
    variable: 'kotlinxCoroutinesVersion',
    versionFrom: 'node_modules/@capacitor/filesystem/android/build.gradle',
    source: 'https://github.com/Kotlin/kotlinx.coroutines',
  },
  {
    name: 'io.ionic.libs:ionfilesystem-android',
    pattern: /ionfilesystem-android:([\d.]+)/,
    versionFrom: 'node_modules/@capacitor/filesystem/android/build.gradle',
    source: 'https://github.com/ionic-team/ion-android-filesystem',
  },
];

function read(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

/** Version of an Android library: `name = '1.2.3'` in variables.gradle, or the fallback default in a plugin's build.gradle. */
function androidVersion(library) {
  const text = read(library.versionFrom ?? 'android/variables.gradle');
  const pattern = library.pattern ?? new RegExp(`${library.variable}\\s*=[^\\n]*'([\\d.]+)'`);
  const version = pattern.exec(text)?.[1];
  if (!version)
    throw new Error(`licenses: no version for ${library.name} in ${library.versionFrom ?? 'android/variables.gradle'}`);
  return version;
}

/** The repository as https URL; package.json allows git URLs and `owner/repo` shorthands. */
function repositoryUrl(manifest) {
  const raw = manifest?.repository?.url ?? manifest?.repository;
  if (!raw) return undefined;
  const url = String(raw)
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^github:/, 'https://github.com/')
    .replace(/^(?![a-z]+:)([\w.-]+\/[\w.-]+)$/i, 'https://github.com/$1')
    .replace(/\.git$/, '');
  return url.startsWith('https://') ? url : undefined;
}

function collectPackages() {
  const lock = JSON.parse(read('package-lock.json'));
  const packages = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    // optional packages are Node-only extras (e.g. the canvas backend of pdfjs-dist) and never reach the browser bundle
    if (!path || entry.dev || entry.devOptional || entry.optional || entry.link) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const id = `${name}@${entry.version}`;
    if (packages.has(id)) continue;
    // platform builds (os/cpu) exist only on their platform, so they always get the registry link
    const platformBuild = Boolean(entry.os || entry.cpu);
    const manifestUrl = new URL(`${path}/package.json`, ROOT);
    if (!platformBuild && !existsSync(manifestUrl)) {
      console.error(`licenses: ${name} is not installed, run npm install first`);
      process.exit(1);
    }
    const manifest = platformBuild ? undefined : JSON.parse(readFileSync(manifestUrl, 'utf8'));
    packages.set(id, {
      name,
      version: entry.version,
      license: typeof entry.license === 'string' ? entry.license : 'UNKNOWN',
      source: repositoryUrl(manifest) ?? `https://www.npmjs.com/package/${name}`,
    });
  }
  return [...packages.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** SPDX expression check: every part of an AND, at least one of an OR. */
function allowed(license) {
  if (ALLOWED.has(license)) return true;
  const inner = license.replace(/^\((.*)\)$/, '$1');
  if (inner.includes(' OR ')) return inner.split(' OR ').some((part) => allowed(part.trim()));
  if (inner.includes(' AND ')) return inner.split(' AND ').every((part) => allowed(part.trim()));
  return false;
}

const packages = collectPackages();
const libraries = ANDROID_LIBRARIES.map((library) => ({
  ...library,
  version: androidVersion(library),
  license: 'Apache-2.0',
}));

const violations = packages
  .filter((pkg) => !allowed(pkg.license))
  .map((pkg) => `${pkg.name}@${pkg.version} ${pkg.license}`);
if (violations.length) {
  console.error(`licenses: not allowed by the policy in scripts/licenses.mjs:\n  - ${violations.join('\n  - ')}`);
  process.exit(1);
}

const packageRows = packages.map((pkg) => `| ${pkg.name} | ${pkg.version} | ${pkg.license} | <${pkg.source}> |`);
const libraryRows = libraries.map((lib) => `| ${lib.name} | ${lib.version} | ${lib.license} | <${lib.source}> |`);

const notices = `# Third-Party-Notices

Lorebook verwendet die folgenden Fremdbibliotheken: die npm-Pakete, die in der Web-App und der Android-App landen (samt ihrer transitiven Abhängigkeiten, ohne optionale Node-Erweiterungen, die nie im Browser-Bundle landen), und die nativen Android-Bibliotheken in der APK. Werkzeuge für Entwicklung, Build und Tests (\`devDependencies\`) werden nicht ausgeliefert und stehen deshalb nicht hier. Die Lizenztexte stehen in den verlinkten Quellen bzw. im jeweiligen Paket.

Erzeugt von \`npm run licenses\` aus \`package-lock.json\` und den Gradle-Dateien; nicht von Hand bearbeiten. \`npm run check\` prüft, dass die Datei aktuell ist und jede Lizenz mit der AGPL-3.0 von Lorebook vereinbar ist.

## npm-Pakete

| Paket | Version | Lizenz | Quelle |
| --- | --- | --- | --- |
${packageRows.join('\n')}

## Android-Bibliotheken in der APK

| Bibliothek | Version | Lizenz | Quelle |
| --- | --- | --- | --- |
${libraryRows.join('\n')}
`;

if (process.argv.includes('--check')) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== notices) {
    console.error('licenses: THIRD-PARTY-NOTICES.md is outdated, run npm run licenses and commit it');
    process.exit(1);
  }
  console.log(
    `licenses: ${packages.length} packages and ${libraries.length} Android libraries, all allowed, THIRD-PARTY-NOTICES.md is current`,
  );
} else {
  writeFileSync(OUTPUT, notices);
  console.log(
    `licenses: ${packages.length} packages and ${libraries.length} Android libraries written to THIRD-PARTY-NOTICES.md`,
  );
}
