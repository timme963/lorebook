// Downloads the APK from the latest successful GitHub Actions build into release/
// and copies it into dist/ so the web deployment offers it as /lorebook.apk.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const gh = process.env.GH_BIN || (process.platform === 'win32' ? 'C:/Program Files/GitHub CLI/gh.exe' : 'gh');
const repo = 'timme963/lorebook';
const run = (args) => execFileSync(gh, args, { encoding: 'utf8' }).trim();

const [runId, runNumber] = run(['run', 'list', '-R', repo, '-w', 'Android APK', '-s', 'success', '-L', '1', '--json', 'databaseId,number', '--jq', '.[0] | "\\(.databaseId) \\(.number)"']).split(' ');
if (!runId) throw new Error('No successful Android build found.');
rmSync('release', { recursive: true, force: true });
mkdirSync('release', { recursive: true });
run(['run', 'download', runId, '-R', repo, '-n', 'lorebook-apk', '-D', 'release']);
if (!existsSync('release/lorebook.apk')) throw new Error('APK missing in artifact.');
// the CI build sets versionCode = run number → the app compares against this
const version = { android: { versionCode: Number(runNumber), url: '/lorebook.apk' } };
writeFileSync('release/version.json', JSON.stringify(version));
if (existsSync('dist')) {
  copyFileSync('release/lorebook.apk', 'dist/lorebook.apk');
  copyFileSync('release/version.json', 'dist/version.json');
}
console.log(`APK from build ${runId} (versionCode ${runNumber}) ready.`);
