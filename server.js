const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
let admin = null;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.log("⚠️ firebase-admin tidak terinstall, menggunakan file JSON saja");
}
require('dotenv').config();

// Helper untuk memastikan direktori ada
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Helper untuk membaca file JSON
async function readJson(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

// Helper untuk menulis file JSON
async function writeJson(filePath, data, options = {}) {
  const spaces = options.spaces || 2;
  await fs.writeFile(filePath, JSON.stringify(data, null, spaces), 'utf8');
}

// Helper untuk memeriksa apakah file ada
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Inisialisasi Firebase Admin
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

let db = null;
let useFirebase = false;

// Initialize Firebase (wrapped in Promise to avoid race condition
let firebaseInitPromise = (async function initFirebase() {
    try {
        if (admin && firebaseConfig.project_id && firebaseConfig.private_key) {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseConfig)
            });
            db = admin.firestore();
            useFirebase = true;
            console.log("🔥 Firebase berhasil diinisialisasi");
            
            // One-time migration from old config path to new path
            const oldDoc = await db.collection('config').doc('main').get();
            const newDoc = await db.collection('settings').doc('config').get();
            if (oldDoc.exists && !newDoc.exists) {
                await db.collection('settings').doc('config').set(oldDoc.data());
                console.log("🔄 Config migrated from config/main to settings/config");
            }
        } else if (!admin) {
            console.log("⚠️ firebase-admin tidak tersedia, menggunakan file JSON sebagai fallback");
        } else {
            console.log("⚠️ Firebase tidak dikonfigurasi, menggunakan file JSON sebagai fallback");
        }
    } catch (error) {
        console.error("❌ Gagal inisialisasi Firebase:", error);
        console.log("⚠️ Menggunakan file JSON sebagai fallback");
    }
})();

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dn9ulmxic',
  api_key: process.env.CLOUDINARY_API_KEY || '766525765543389',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'eeBelnE50teVvGZ6cFidWBoIfpY'
});

// Konfigurasi Multer untuk menyimpan file sementara di memory sebelum diupload ke Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Only ensure upload directories exist if we're not using Firebase (local development only)
// (Commented out to avoid top‑level async issues)
/*
if (!useFirebase || !db) {
  ensureDir(path.join(__dirname, 'foto')).catch(e => console.log('Could not create foto dir:', e));
  ensureDir(path.join(__dirname, 'music')).catch(e => console.log('Could not create music dir:', e));
}
*/

// Path to users file (fallback)
const USERS_FILE = path.join(__dirname, 'users.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Helper to read users
async function readUsers() {
    try {
        if (useFirebase && db) {
            const snapshot = await db.collection('users').get();
            const users = [];
            snapshot.forEach(doc => {
                users.push(doc.data());
            });
            return { users };
        } else {
            if (await pathExists(USERS_FILE)) {
                return await readJson(USERS_FILE);
            }
            return { users: [] };
        }
    } catch (e) {
        console.error("Error reading users:", e);
        return { users: [] };
    }
}

// Helper to write users
async function writeUsers(usersData) {
    try {
        if (useFirebase && db) {
            // Hapus semua dokumen lama
            const snapshot = await db.collection('users').get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Tambahkan semua pengguna baru
            usersData.users.forEach(user => {
                const docRef = db.collection('users').doc(user.id);
                batch.set(docRef, user);
            });
            
            await batch.commit();
        } else {
            // Skip local file writes to avoid EROFS errors on Vercel
            console.log("Firebase not configured, skipping local users write.");
        }
    } catch (e) {
        console.error("Error writing users:", e);
        throw e;
    }
}

// Helper to read config
async function readConfig() {
    try {
        if (useFirebase && db) {
            const doc = await db.collection('settings').doc('config').get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } else {
            if (await pathExists(CONFIG_FILE)) {
                return await readJson(CONFIG_FILE);
            }
            return null;
        }
    } catch (e) {
        console.error("Error reading config:", e);
        return null;
    }
}

// Helper to write config
async function writeConfig(configData) {
    try {
        if (useFirebase && db) {
            await db.collection('settings').doc('config').set(configData);
        } else {
            // Skip local file writes to avoid EROFS errors on Vercel
            console.log("Firebase not configured, skipping local config write.");
        }
    } catch (e) {
        console.error("Error writing config:", e);
        throw e;
    }
}

// Error Handling Global agar server tidak crash
process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toLocaleString()}] Uncaught Exception:`, err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toLocaleString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
});

app.use(cors());
app.use(async (req, res, next) => {
    await firebaseInitPromise;
    next();
});
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url} | useFirebase=${useFirebase}`);
    next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// API to check server status
app.get('/api/status', (req, res) => {
  res.json({ success: true, status: 'online', firebase: useFirebase });
});

// API to get config (legacy, untuk backward compatibility)
app.get('/api/config', async (req, res) => {
    try {
        console.log(`📥 GET /api/config | useFirebase=${useFirebase}`);
        const configData = await readConfig();
        if (!configData) {
            return res.status(404).json({ success: false, message: 'Config not found' });
        }
        console.log(`✅ Mengirim config dengan ${Object.keys(configData.scenes || {}).length} scenes`);
        res.json(configData);
    } catch (error) {
        console.error('❌ Get config error:', error);
        res.status(500).json({ success: false, message: 'Gagal mendapatkan config' });
    }
});

// API to get scenes (from Firestore or JSON)
app.get('/api/scenes', async (req, res) => {
  try {
    const configData = await readConfig();
    if (!configData) {
      return res.status(404).json({ success: false, message: 'Config not found' });
    }
    res.json({ 
      success: true, 
      scenes: configData.scenes || {},
      default: configData.default || {},
      settings: configData.settings || {}
    });
  } catch (error) {
    console.error('Get scenes error:', error);
    res.status(500).json({ success: false, message: 'Gagal mendapatkan scenes' });
  }
});

// API: Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username dan password diperlukan' });
        }

        const usersData = await readUsers();
        const user = usersData.users.find(u => u.username === username && u.password === password);

        if (user) {
            res.json({ 
                success: true, 
                user: { id: user.id, username: user.username, role: user.role }
            });
        } else {
            res.status(401).json({ success: false, message: 'Username atau password salah' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Gagal login' });
    }
});

// API: Get all users (admin only)
app.get('/api/users', async (req, res) => {
    try {
        const { role } = req.headers;
        if (role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Akses ditolak' });
        }

        const usersData = await readUsers();
        res.json({ success: true, users: usersData.users.map(u => ({ id: u.id, username: u.username, role: u.role })) });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Gagal mendapatkan daftar pengguna' });
    }
});

// API: Create user (admin only)
app.post('/api/users', async (req, res) => {
    try {
        const { role: requesterRole } = req.headers;
        if (requesterRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Akses ditolak' });
        }

        const { username, password, role } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ success: false, message: 'Semua kolom harus diisi' });
        }

        const usersData = await readUsers();
        
        // Check if username exists
        if (usersData.users.find(u => u.username === username)) {
            return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
        }

        const newUser = {
            id: Date.now().toString(),
            username,
            password,
            role,
            createdAt: new Date().toISOString()
        };

        usersData.users.push(newUser);
        await writeUsers(usersData);

        res.json({ success: true, message: 'Pengguna berhasil dibuat', user: { id: newUser.id, username: newUser.username, role: newUser.role } });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Gagal membuat pengguna' });
    }
});

// API: Delete user (admin only)
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { role: requesterRole } = req.headers;
        if (requesterRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Akses ditolak' });
        }

        const { id } = req.params;
        const usersData = await readUsers();
        
        // Don't allow deleting the last admin
        const admins = usersData.users.filter(u => u.role === 'admin');
        const userToDelete = usersData.users.find(u => u.id === id);
        
        if (userToDelete && userToDelete.role === 'admin' && admins.length <= 1) {
            return res.status(400).json({ success: false, message: 'Tidak dapat menghapus admin terakhir' });
        }

        const filteredUsers = usersData.users.filter(u => u.id !== id);
        if (filteredUsers.length === usersData.users.length) {
            return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
        }

        usersData.users = filteredUsers;
        await writeUsers(usersData);

        res.json({ success: true, message: 'Pengguna berhasil dihapus' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus pengguna' });
    }
});

// API to partially update a scene (PATCH)
app.patch('/api/scenes/:sceneId', async (req, res) => {
    try {
        const { sceneId } = req.params;
        const updates = req.body;

        const configData = await readConfig();
        if (!configData) {
            return res.status(404).json({ success: false, message: 'Config not found' });
        }
        if (!configData.scenes || !configData.scenes[sceneId]) {
            return res.status(404).json({ success: false, message: 'Scene not found' });
        }

        // Apply the updates to the scene
        configData.scenes[sceneId] = { ...configData.scenes[sceneId], ...updates };

        // Save the updated config
        await writeConfig(configData);

        res.json({ success: true, message: 'Scene updated successfully', scene: configData.scenes[sceneId] });
    } catch (error) {
        console.error('Patch scene error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengupdate scene' });
    }
});

// Helper function to upload buffer to Cloudinary
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// Endpoint POST /upload (sesuai permintaan)
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'harper-360'
        });

        res.json({
            success: true,
            secure_url: result.secure_url,
            url: result.url,
            public_id: result.public_id
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengunggah file ke Cloudinary',
            error: error.message
        });
    }
});

// API to upload photo (diupdate untuk menggunakan Cloudinary)
app.post('/api/upload', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'harper-360/photos'
        });

        res.json({ 
            success: true, 
            message: 'File uploaded successfully', 
            filePath: result.secure_url,
            url: result.secure_url
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengunggah foto. Pastikan ukuran file tidak terlalu besar.',
            error: error.message 
        });
    }
});

// API to upload music (diupdate untuk menggunakan Cloudinary)
app.post('/api/upload-music', upload.single('music'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File musik belum dipilih' });
        }

        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'harper-360/music',
            resource_type: 'video'
        });

        res.json({ 
            success: true, 
            message: 'Musik berhasil diunggah', 
            filePath: result.secure_url,
            url: result.secure_url
        });
    } catch (error) {
        console.error('Music Upload Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengunggah musik. Pastikan format file adalah .mp3',
            error: error.message 
        });
    }
});

// API to upload custom logo (sesuai permintaan)
app.post('/api/upload-logo', upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File logo belum dipilih' });
        }

        // Upload logo ke Cloudinary
        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'harper-360/logos'
        });

        // Update logoUrl di Firestore (jika menggunakan Firebase)
        if (useFirebase && db) {
            const docRef = db.collection('settings').doc('config');
            const doc = await docRef.get();
            if (doc.exists) {
                await docRef.update({
                    'settings.logoUrl': result.secure_url
                });
            } else {
                await docRef.set({
                    scenes: {},
                    default: { firstScene: "", type: "equirectangular" },
                    settings: { 
                        logoUrl: result.secure_url, 
                        logo: "", 
                        music: { url: "", autoPlay: true }, 
                        footer: {} 
                    }
                });
            }
        }

        res.json({ 
            success: true, 
            message: 'Logo berhasil diunggah', 
            filePath: result.secure_url,
            url: result.secure_url
        });
    } catch (error) {
        console.error('Custom Logo Upload Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengunggah logo. Pastikan format file adalah gambar.',
            error: error.message 
        });
    }
});

// API to delete file
app.post('/api/delete-file', async (req, res) => {
    try {
        let { filePath } = req.body;
        if (!filePath) {
            return res.status(400).json({ success: false, message: 'Path file tidak ditemukan' });
        }

        // If using Firebase/Cloudinary, we don't need to delete local files
        // Just return success (or you could add Cloudinary delete logic here if needed)
        if (useFirebase && db) {
            res.json({ success: true, message: 'File tidak perlu dihapus dari server (menggunakan Cloudinary)' });
            return;
        }

        // Local file deletion (only for non-Firebase mode)
        const normalizedPath = filePath.replace(/\\/g, '/');
        const allowedFolders = ['foto/', 'music/'];
        const isAllowed = allowedFolders.some(folder => normalizedPath.startsWith(folder));
        
        if (!isAllowed) {
            return res.status(403).json({ success: false, message: 'Akses ditolak: Tidak diizinkan menghapus file di luar folder aset' });
        }

        const fullPath = path.join(__dirname, normalizedPath);
        if (await pathExists(fullPath)) {
            const fsSync = require('fs');
            fsSync.unlinkSync(fullPath);
            res.json({ success: true, message: 'File berhasil dihapus dari server' });
        } else {
            res.status(404).json({ success: false, message: 'File tidak ditemukan di server' });
        }
    } catch (error) {
        console.error('Delete Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menghapus file dari server',
            error: error.message 
        });
    }
});

// Helper to recursively sanitize object (remove undefined, replace with null/empty)
const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) {
        return null;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
    }
    return obj;
};

// API to save config
app.post('/api/save-config', async (req, res) => {
    try {
        const auth = req.headers['x-cms-auth'];
        const role = req.headers['x-cms-role'];
        
        if (auth !== 'Hpalm123') {
            return res.status(403).json({ success: false, message: 'Akses ditolak: Token autentikasi salah' });
        }

        let configData = req.body;
        if (!configData || typeof configData !== 'object') {
            return res.status(400).json({ success: false, message: 'Data konfigurasi tidak valid' });
        }

        // Ensure config has all top-level sections (backward compatibility)
        if (!configData.scenes) configData.scenes = {};
        if (!configData.default) configData.default = { firstScene: "", type: "equirectangular" };
        if (!configData.settings) configData.settings = { logo: "", music: { url: "", autoPlay: true }, footer: {} };

        // ✅ CLEANUP: Remove all hotspots that target deleted scenes!
        const existingSceneIds = Object.keys(configData.scenes);
        let removedHotspotsCount = 0;
        for (const [sceneId, scene] of Object.entries(configData.scenes)) {
            if (scene.hotSpots && Array.isArray(scene.hotSpots)) {
                // Keep only hotspots whose target scene still exists
                scene.hotSpots = scene.hotSpots.filter(hs => {
                    const targetId = hs.sceneId || hs.targetScene;
                    if (!targetId || existingSceneIds.includes(targetId)) {
                        return true;
                    }
                    removedHotspotsCount++;
                    console.log(`🔥 Menghapus hotspot di scene ${sceneId} yang menunjuk ke scene ${targetId} (sudah dihapus)`);
                    return false;
                });
            }
        }
        if (removedHotspotsCount > 0) {
            console.log(`✅ Total ${removedHotspotsCount} hotspot mati dihapus!`);
        }

        // Process each scene to ensure it has all required fields (backward compatibility)
        let existingConfig = { scenes: {}, default: configData.default, settings: configData.settings };
        
        const currentConfig = await readConfig();
        if (currentConfig) {
            existingConfig = currentConfig;
        }

        let newSceneId = null;
        
        // Validate and normalize each scene
        for (const [sceneId, scene] of Object.entries(configData.scenes)) {
            // Check if this is a new scene
            if (!existingConfig.scenes || !existingConfig.scenes[sceneId]) {
                newSceneId = sceneId;
                if (!scene.title || !scene.title.trim()) {
                    return res.status(400).json({ success: false, message: `Scene "${sceneId}": Judul scene tidak boleh kosong!` });
                }
                if (!scene.panorama || !scene.panorama.trim()) {
                    return res.status(400).json({ success: false, message: `Scene "${sceneId}": Foto panorama tidak boleh kosong!` });
                }
            }

            configData.scenes[sceneId] = {
                title: scene.title || "Untitled Scene",
                type: scene.type || "equirectangular",
                panorama: scene.panorama || "",
                description: scene.description || "",
                previewImg: scene.previewImg || scene.panorama || "",
                hfov: typeof scene.hfov === 'number' ? scene.hfov : 100,
                pitch: typeof scene.pitch === 'number' ? scene.pitch : 0,
                yaw: typeof scene.yaw === 'number' ? scene.yaw : 0,
                hotSpots: Array.isArray(scene.hotSpots) ? scene.hotSpots : []
            };
        }

        // Sanitize entire config to remove undefined values (Firestore-safe)
        const sanitizedConfig = sanitizeObject(configData);
        
        console.log(`[${new Date().toLocaleString()}] Save Config Request from Role: ${role}`);
        
        // Save the config
        await writeConfig(sanitizedConfig);
        
        const response = { success: true, message: 'Konfigurasi berhasil disimpan secara permanen' };
        if (newSceneId) {
            response.newSceneId = newSceneId;
        }
        
        res.json(response);
    } catch (error) {
        console.error("ERROR SAAT SAVE CONFIG:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`  SERVER VIRTUAL TOUR RUNNING                   `);
    console.log(`================================================`);
    console.log(`  Main Tour : http://localhost:${PORT}`);
    console.log(`  Admin CMS : http://localhost:${PORT}/admin/index.html`);
    console.log(`================================================\n`);
});
