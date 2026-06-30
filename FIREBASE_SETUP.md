# Panduan Setup Firebase

## Langkah 1: Buat Project Firebase

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Klik "Add project" atau pilih project yang sudah ada
3. Ikuti langkah-langkah pembuatan project

## Langkah 2: Aktifkan Firestore Database

1. Di Firebase Console, buka menu **Firestore Database**
2. Klik **Create Database**
3. Pilih **Start in test mode** (untuk development)
4. Pilih lokasi server terdekat
5. Klik **Enable**

## Langkah 3: Buat Service Account

1. Buka menu **Settings** ⚙️ → **Service accounts**
2. Klik **Generate new private key**
3. Simpan file JSON yang di-download
4. Buka file tersebut dan salin isinya

## Langkah 4: Konfigurasi Environment Variables

1. Copy file `.env.example` menjadi `.env`
2. Isi variabel Firebase dengan nilai dari file JSON service account:
   ```
   FIREBASE_TYPE=service_account
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY_ID=your-private-key-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
   FIREBASE_CLIENT_ID=your-client-id
   FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
   FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
   FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40your-project.iam.gserviceaccount.com
   ```

   **Penting**: Untuk `FIREBASE_PRIVATE_KEY`, ganti semua newline dengan `\n` dan bungkus dengan tanda kutip dua.

## Langkah 5: Install Dependencies

```bash
npm install
```

## Langkah 6: Migrasi Data ke Firebase

Jalankan script migrasi untuk memindahkan data dari file JSON ke Firebase:

```bash
node migrate-to-firebase.js
```

## Langkah 7: Konfigurasi Vercel (jika deploy ke Vercel)

1. Buka [Vercel Dashboard](https://vercel.com/)
2. Pilih project Anda
3. Buka **Settings** → **Environment Variables**
4. Tambahkan semua variabel dari `.env` ke Vercel
5. Redeploy project Anda

## Testing

Jalankan server secara lokal:

```bash
npm run dev
```

Coba login dengan kredensial:
- Username: `admin`
- Password: `Hpalm123`

## Catatan Penting

- Jangan commit file `.env` ke repository
- Untuk production, atur security rules Firestore dengan benar
- Backup data secara berkala
