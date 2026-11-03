/* ============================================================
   TOP MAN LAUNDRY — BUILT-IN CLOUD CONFIG  (SINGLE SOURCE OF TRUTH)
   ------------------------------------------------------------
   This file is loaded by EVERY page:
     index.html (POS)  •  portal.html  •  live.html  •  reviews.html

   Because the values live in code, a brand-new computer / browser / phone
   connects to Firebase automatically — nobody has to paste the API key or
   Shop ID again.

   To change project later: edit ONLY this file (one place) and hard-refresh.
   A key saved manually in Settings → Cloud Sync still takes priority on that
   particular browser, so you can override it per device if ever needed.

   NOTE: a Firebase *web* apiKey identifies the project; it is not a secret.
   Real access control comes from your Firestore security rules.
   ============================================================ */

window.CLOUD_AUTO_CONFIG = {
  apiKey:            "AIzaSyDaa5TASQ5egiD3qFXZAxNDxSeyOn4QC-c",
  authDomain:        "topmanlaundry-fc6c6.firebaseapp.com",
  databaseURL:       "https://topmanlaundry-fc6c6-default-rtdb.firebaseio.com",
  projectId:         "topmanlaundry-fc6c6",
  storageBucket:     "topmanlaundry-fc6c6.firebasestorage.app",
  messagingSenderId: "1040258597984",
  appId:             "1:1040258597984:web:70a9551e264c7f3d15ef05",
  measurementId:     "G-MWMGQK45F6"
};

/* Must be IDENTICAL on every device, otherwise each device syncs to its own
   separate database. */
window.CLOUD_AUTO_SHOP_ID = "topman_laundry";

/* Turn Cloud Sync ON automatically on a fresh browser. An explicit choice
   made in Settings (Pause / Remove Key) still overrides this. */
window.CLOUD_AUTO_ENABLE = true;

/* Friendly aliases used by portal.html / live.html. */
window.TOPMAN_FIREBASE_CONFIG = window.CLOUD_AUTO_CONFIG;
window.TOPMAN_SHOP_ID = window.CLOUD_AUTO_SHOP_ID;
