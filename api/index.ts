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

// Final mount
app.use('/api', apiRouter);

// Handler for Vercel
export default app;
