import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';
import cors from 'cors';

// Initialize Firebase Admin
let adminApp: admin.app.App;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const rootFiles = fs.readdirSync(process.cwd());
    
    let serviceAccount: any = null;

    // 1. Try to load from Environment Variable first (Highly Recommended for Production/Vercel)
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
      console.warn("[Admin Init] No service account found. Falling back to ADC (Application Default Credentials).");
      if (!admin.apps.length) {
        adminApp = admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
      } else {
        adminApp = admin.app();
      }
    }
  } else {
    console.warn(`[Admin Init] firebase-applet-config.json not found at ${configPath}. Administrator features may be limited.`);
  }
} catch (error) {
  console.error("[Admin Init] Error:", error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

async function startServer() {
  console.log(`[Server Initialization] Starting... NODE_ENV=${process.env.NODE_ENV}`);
  const PORT = 3000;
  
  // Enable CORS for all routes
  app.use(cors());
  
  // Parse JSON bodies
  app.use(express.json());

  // ROOT LOGGER - Catch every single request
  app.use((req, res, next) => {
    console.log(`[ROOT] ${req.method} ${req.url} | Path: ${req.path}`);
    next();
  });
  
  // 1. DEDICATED API ROUTES
  const apiRouter = express.Router();

  // Diagnostic logger inside the router
  apiRouter.use((req, res, next) => {
    console.log(`[API Router] Incoming Path: ${req.path} | Original URL: ${req.originalUrl}`);
    next();
  });

  // API Health check
  apiRouter.get('/health', (req, res) => {
    res.json({ 
      status: 'ok',
      env: process.env.NODE_ENV,
      adminInitialized: admin.apps.length > 0 
    });
  });

  // UN-AUTHENTICATED PING
  apiRouter.get('/ping', (req, res) => {
    res.json({ pong: true, timestamp: new Date().toISOString() });
  });

  // Admin API Routes
  apiRouter.get('/admin/health', (req, res) => {
    res.json({ status: 'admin-ok', initialized: admin.apps.length > 0 });
  });

  // List all users from Auth and Merge with Firestore
  apiRouter.get('/admin/list-users', async (req, res) => {
    console.log(`[API] Admin: List Users called`);
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        console.warn("[API] No bearer token provided");
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) {
        console.warn(`[API] Unauthorized email target: ${decodedToken.email}`);
        return res.status(403).json({ error: 'Forbidden' });
      }

      // 1. Get all users from Auth
      const listUsersResult = await admin.auth().listUsers(1000);
      const authUsers = listUsersResult.users;

      // 2. Get all users from Firestore
      let firestoreData: Record<string, any> = {};
      try {
        const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
          ? firebaseConfig.firestoreDatabaseId
          : undefined;
        const db = admin.firestore(dbId);
        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => { firestoreData[doc.id] = doc.data(); });
      } catch (fsError: any) {
        console.warn("Firestore fetch failed:", fsError.message);
      }

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

      console.log(`[API] Returning ${mergedUsers.length} users`);
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
      const email = decodedToken.email?.toLowerCase() || '';
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      if (!adminEmails.includes(email)) return res.status(403).json({ error: `Unauthorized` });

      await admin.auth().deleteUser(uid);
      const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
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
    const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
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

    await batch.commit();
    res.json({ success: true, message: `Successfully seeded ${totalAdded} items across ${categories.length} categories (Excluding Cricket).` });
    } catch (error: any) {
      console.error('[Seed Error]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Specific 404 for API to prevent falling into SPA fallback
  apiRouter.all('*', (req, res) => {
    console.warn(`[API 404] Not Match: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'API route not found', url: req.originalUrl });
  });

  // Mount API router
  app.use('/api', apiRouter);


  // 2. VITE / STATIC / SPA FALLBACK (MOVE TO AFTER API ROUTES)
  if (process.env.NODE_ENV !== 'production') {
    console.log("[Server] Running in Development mode (Vite)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Running in Production mode (Static)");
    // Use process.cwd() to be safe in bundled environments
    const distPath = path.join(process.cwd(), 'dist');
    
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        // Log where the fallthrough is happening
        console.log(`[Static Fallthrough] Serving index.html for: ${req.url}`);
        
        // Anti-masking for API calls
        if (req.url.startsWith('/api/') || req.path.startsWith('/api/')) {
          return res.status(404).json({
            error: "API route not found",
            url: req.url,
            path: req.path,
            reason: "Request reached the SPA fallback route instead of an API handler."
          });
        }

        res.setHeader('X-SPA-Fallback', 'true');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.error(`[Error] dist/ directory not found at ${distPath}`);
      app.get('*', (req, res) => {
        res.status(500).send("Application not built. Please run 'npm run build' first.");
      });
    }
  }

  // Global error handler to ensure JSON responses even for internal errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Error Handler]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  return app;
}

// Separate the initialization from the exporting
let isInitialized = false;
export async function ensureInitialized() {
  if (isInitialized) return app;
  await startServer();
  isInitialized = true;
  return app;
}

// Start the server if this file is run directly
const isVercel = process.env.VERCEL === '1';

if (!isVercel) {
  ensureInitialized().then((app) => {
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default app;
