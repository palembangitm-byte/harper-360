const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Helper untuk memeriksa apakah file ada
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper untuk membaca file JSON
async function readJson(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

// Konfigurasi Firebase
const firebaseConfig = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

async function migrate() {
  console.log("Memulai migrasi ke Firebase...");

  try {
    // Inisialisasi Firebase
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig)
    });
    const db = admin.firestore();

    console.log("Firebase berhasil diinisialisasi");

    // Migrasi Users
    const usersPath = path.join(__dirname, 'users.json');
    if (await pathExists(usersPath)) {
      const usersData = await readJson(usersPath);
      console.log(`Migrasi ${usersData.users.length} users...`);
      
      const batch = db.batch();
      usersData.users.forEach(user => {
        const docRef = db.collection('users').doc(user.id);
        batch.set(docRef, user);
      });
      await batch.commit();
      console.log("✅ Users berhasil dimigrasikan");
    }

    // Migrasi Config
    const configPath = path.join(__dirname, 'config.json');
    if (await pathExists(configPath)) {
      const configData = await readJson(configPath);
      console.log("Migrasi config...");
      await db.collection('config').doc('main').set(configData);
      console.log("✅ Config berhasil dimigrasikan");
    }

    console.log("\n✅ Migrasi selesai!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Gagal migrasi:", error);
    process.exit(1);
  }
}

migrate();
