import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

/**
 * The Firebase web config. These are not secrets: a browser app cannot hold a
 * secret. The reCAPTCHA secret key, and the App Check debug token, live in
 * .env.local and are never committed or shipped.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let appCheckStarted = false;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(config);
  return app;
}

/**
 * App Check is enforced for AI Logic, so it has to be running before the first
 * model call. The debug token lets a local build pass App Check without a
 * registered reCAPTCHA Enterprise host. It is a development-only affordance:
 * `npm run build` compiles the branch out, so the deployed bundle never
 * carries it.
 */
export function startAppCheck(): void {
  if (appCheckStarted) return;

  const debugToken =
    process.env.NODE_ENV !== "production"
      ? process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN
      : undefined;
  if (debugToken) {
    (globalThis as unknown as Record<string, string>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken;
  }

  // In debug mode the provider is never called, and its constructor does not
  // validate the key, so a placeholder is enough to get past initialisation.
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "debug-placeholder-site-key";
  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !debugToken) return;

  initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });

  appCheckStarted = true;
}
