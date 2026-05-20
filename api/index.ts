import express from 'express';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin (Self-contained)
let adminApp: admin.app.App;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const rootFiles = fs.readdirSync(process.cwd());
    
    let serviceAccount: any = null;

    // 1. Try to load from Environment Variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log(`[Admin Init] Initializing with service account from Environment Variable.`);
      } catch (e) {
        console.error(`[Admin Init] Failed to parse FIREBASE_SERVICE_ACCOUNT env var:`, e);
      }
    }

    // 2. Try to find a local file
    if (!serviceAccount) {
      const serviceAccountFile = rootFiles.find(f => 
        (f.startsWith('gen-lang-client') || f.startsWith('firebase-adminsdk')) && f.endsWith('.json')
      );

      if (serviceAccountFile) {
        const serviceAccountPath = path.resolve(process.cwd(), serviceAccountFile);
        console.log(`[Admin Init] Found local service account: ${serviceAccountFile}`);
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      }
    }

    if (serviceAccount) {
      if (!admin.apps.length) {
        adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: firebaseConfig.projectId
        });
        console.log(`[Admin Init] Firebase Admin initialized with Service Account.`);
      } else {
        adminApp = admin.app();
      }
    } else {
      console.warn("[Admin Init] No service account found. Falling back to ADC.");
      if (!admin.apps.length) {
        adminApp = admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
      } else {
        adminApp = admin.app();
      }
    }
  } else {
    console.warn(`[Admin Init] firebase-applet-config.json not found.`);
  }
} catch (error) {
  console.error("[Admin Init] Error:", error);
}

// ROOT LOGGER
app.use((req, res, next) => {
  console.log(`[Vercel ROOT] ${req.method} ${req.url}`);
  next();
});

// API Router
const apiRouter = express.Router();

apiRouter.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

apiRouter.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    env: process.env.NODE_ENV,
    adminInitialized: admin.apps.length > 0 
  });
});

// Admin API Routes
apiRouter.get('/admin/list-users', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
    if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) return res.status(403).json({ error: 'Forbidden' });

    const listUsersResult = await admin.auth().listUsers(1000);
    const authUsers = listUsersResult.users;

    let firestoreData: Record<string, any> = {};
    try {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? firebaseConfig.firestoreDatabaseId
        : undefined;
      const db = admin.firestore(dbId);
      const snapshot = await db.collection('users').get();
      snapshot.forEach(doc => { firestoreData[doc.id] = doc.data(); });
    } catch (fsError) {}

    const allUids = new Set([...authUsers.map(u => u.uid), ...Object.keys(firestoreData)]);
    const mergedUsers = Array.from(allUids).map(uid => {
      const authUser = authUsers.find(u => u.uid === uid);
      const profile = firestoreData[uid] || {};
      return {
        id: uid,
        uid: uid,
        email: authUser?.email || profile.email || 'No Email',
        displayName: authUser?.displayName || profile.displayName || (authUser?.email || profile.email)?.split('@')[0] || 'Unknown User',
        photoURL: authUser?.photoURL || profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.email || profile.email || 'U')}&background=random`,
        createdAt: authUser?.metadata.creationTime || profile.createdAt || null,
        lastSignInTime: authUser?.metadata.lastSignInTime || profile.lastSignInTime || null,
        ...profile
      };
    });

    res.json({ users: mergedUsers });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

apiRouter.post('/admin/delete-user', async (req, res) => {
  try {
    const { uid, idToken } = req.body;
    if (!uid || !idToken) return res.status(400).json({ error: 'Missing parameters' });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
    if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) return res.status(403).json({ error: `Unauthorized` });

    await admin.auth().deleteUser(uid);
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
    const db = admin.firestore(dbId);
    await db.collection('users').doc(uid).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.post('/admin/seed-dummy-data', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
    if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) return res.status(403).json({ error: 'Forbidden' });

    const categories = ['football', 'basketball', 'tennis', 'f1', 'boxing', 'golf', 'esports', 'kabaddi', 'hockey'];
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? firebaseConfig.firestoreDatabaseId
      : undefined;
    const db = admin.firestore(dbId);
    
    const batch = db.batch();
    const now = new Date().toISOString();

    let totalAdded = 0;
    categories.forEach(cat => {
      // 15 items per category to keep it fast but substantial
      for (let i = 1; i <= 15; i++) {
        const id = `${cat}-dummy-${i}-${Math.random().toString(36).substring(7)}`;
        const docRef = db.collection('content').doc(id);
        batch.set(docRef, {
          id,
          title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Global League: Match ${i}`,
          description: `Enjoy the best of ${cat} with this exclusive match coverage. Experience high-definition streaming and expert commentary.`,
          category: cat,
          type: i % 3 === 0 ? 'live' : (i % 2 === 0 ? 'replay' : 'highlight'),
          videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          thumbnailUrl: `https://picsum.photos/seed/${id}/800/450`,
          isPremium: i % 5 === 0,
          viewCount: Math.floor(Math.random() * 5000) + 100,
          likes: Math.floor(Math.random() * 500),
          createdAt: now,
          status: i % 7 === 0 ? 'live' : (i % 5 === 0 ? 'scheduled' : 'ended'),
          tags: [cat, 'tournament', '2024', 'pro']
        });
        totalAdded++;
      }
    });

    // Seed premium vertical sport shorts
    const shortsData = [
      {
        id: 'short-bkey-1',
        title: 'Steph Curry Pregame Shooting routine',
        description: 'Witness the pure excellence of Curry as he warms up for the big game with non-stop swishes!',
        category: 'basketball',
        type: 'short',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-basketball-player-dribbling-the-ball-34444-large.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=800',
        isPremium: false,
        viewCount: 14500,
        likes: 1243,
        createdAt: now,
        status: 'ended',
        tags: ['basketball', 'speed', 'pro']
      },
      {
        id: 'short-soccer-2',
        title: 'Top Bin Practice Goal of the Week',
        description: 'Perfect curled shot into the absolute top corner of the net during sunset practice.',
        category: 'football',
        type: 'short',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-ball-in-stadium-1549-large.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800',
        isPremium: false,
        viewCount: 22400,
        likes: 3105,
        createdAt: now,
        status: 'ended',
        tags: ['football', 'goal', 'skills']
      },
      {
        id: 'short-boxing-3',
        title: 'Rapid Fire Punch Combos',
        description: 'Unbelievable speed and precision combos training session under intense coaches directions.',
        category: 'boxing',
        type: 'short',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-boxing-glove-hitting-air-4876-large.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800',
        isPremium: true,
        viewCount: 8900,
        likes: 721,
        createdAt: now,
        status: 'ended',
        tags: ['boxing', 'training', 'speed']
      },
      {
        id: 'short-tennis-4',
        title: 'Perfect Forehand Stroke Slow-Mo',
        description: 'Deconstruct the flawless forehand technique under advanced high-speed action camera.',
        category: 'tennis',
        type: 'short',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tennis-player-hitting-ball-with-racket-1550-large.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1622279457486-62dcc4a4bd1d?q=80&w=800',
        isPremium: false,
        viewCount: 12000,
        likes: 914,
        createdAt: now,
        status: 'ended',
        tags: ['tennis', 'pro', 'skills']
      }
    ];

    shortsData.forEach(short => {
      const docRef = db.collection('content').doc(short.id);
      batch.set(docRef, short);
      totalAdded++;
    });

    await batch.commit();
    res.json({ success: true, message: `Successfully seeded ${totalAdded} items including vertical Sport Shots (Excluding Cricket).` });
  } catch (error: any) {
    console.error('[Seed Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// Final mount
app.use('/api', apiRouter);

// Handler for Vercel
export default app;
