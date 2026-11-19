import { Capacitor } from '@capacitor/core';

/** true in the Android app (Capacitor), false in the browser / as PWA */
export const isNative = Capacitor.isNativePlatform();

/** Public address of the website. The app needs it for outgoing links and the update check. */
export const PUBLIC_URL = 'https://lorebook-9yf.pages.dev';

/** Android app download (copied from the latest GitHub build on deploy) */
export const APK_URL = `${PUBLIC_URL}/lorebook.apk`;
