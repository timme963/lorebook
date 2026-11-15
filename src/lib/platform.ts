import { Capacitor } from '@capacitor/core';

/** true in der Android-App (Capacitor), false im Browser / als PWA */
export const isNative = Capacitor.isNativePlatform();

/** Öffentliche Adresse der Website. Die App braucht sie für Links nach außen und den Update-Check. */
export const PUBLIC_URL = 'https://lorebook-9yf.pages.dev';

/** Download der Android-App (wird beim Deploy aus dem letzten GitHub-Build kopiert) */
export const APK_URL = `${PUBLIC_URL}/lorebook.apk`;
