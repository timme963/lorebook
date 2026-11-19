#!/usr/bin/env bash
# One-off: creates the Android signing key and stores it as GitHub secrets.
# Key and password end up in ~/.lorebook (do NOT delete – without it updates can no longer be installed).
set -euo pipefail
D="$HOME/.lorebook"; mkdir -p "$D"
REPO=timme963/lorebook
GH="${GH_BIN:-/c/Program Files/GitHub CLI/gh.exe}"; command -v gh >/dev/null && GH=gh
KT="${KEYTOOL:-/c/Program Files/AdoptOpenJDK/jdk-11.0.11.9-hotspot/bin/keytool}"; command -v keytool >/dev/null && KT=keytool

if [ ! -f "$D/release.jks" ]; then
  PW=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
  "$KT" -genkeypair -keystore "$D/release.jks" -storetype PKCS12 -alias lorebook -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$PW" -keypass "$PW" -dname "CN=Lorebook" >/dev/null
  printf "storeFile=%s\nstorePassword=%s\nkeyAlias=lorebook\nkeyPassword=%s\n" "$(cygpath -m "$D/release.jks" 2>/dev/null || echo "$D/release.jks")" "$PW" "$PW" > "$D/keystore.properties"
  echo "Schlüssel erzeugt: $D/release.jks"
fi
PW=$(sed -n 's/^storePassword=//p' "$D/keystore.properties")

base64 -w0 "$D/release.jks" | "$GH" secret set ANDROID_KEYSTORE_BASE64 -R $REPO
printf %s "$PW" | "$GH" secret set ANDROID_KEYSTORE_PASSWORD -R $REPO
printf %s "$PW" | "$GH" secret set ANDROID_KEY_PASSWORD -R $REPO
printf %s lorebook | "$GH" secret set ANDROID_KEY_ALIAS -R $REPO
echo "Secrets gesetzt:"; "$GH" secret list -R $REPO
