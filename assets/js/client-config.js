/* ============================================================
   IT ADMIN: CLIENT CONFIGURATION FILE
   Is file ko aap naye client (B, C, D) ko software dene se 
   pehle edit kar sakte hain. Software automatically pehli dafa 
   yahan se details pick karega.
   ============================================================ */

const CLIENT_CONFIG = {
  // 1. Initial Shop / Brand Settings
  shopName: "Mr Laundry",                // Client ka shop naam
  tagline: "Quality Dry Cleaner Service", // Tagline

  // 2. Initial Admin Login (Pehli dafa login ke liye)
  adminUsername: "admin",                // Default User ID  (client ke chalte hue login se match)
  adminPassword: "admin123456",          // Default Password (fresh install + lock-out recovery)
  adminName: "Admin",                    // Display Name

  // 3. Trial & Subscription
  trialDays: 15,                         // Default trial days for new client

  // 4. Login screen details (client in Settings se bhi badal sakta hai)
  address:  "Shop 04, Gulistan E Zafar, SMCHS Block B, Karachi",
  phone:    "0334-3691210",
  facebook: "facebook.com/mrlaundrykhi",
  };