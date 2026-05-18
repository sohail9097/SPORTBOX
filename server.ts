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
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
  const rootFiles = fs.readdirSync(process.cwd());
  
  let serviceAccount: any = null;

  // 1. Try to load from Environment Variable first (Good for Production/Vercel)
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
      const serviceAccountPath = path.join(process.cwd(), serviceAccountFile);
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
} catch (error) {
  console.error("[Admin Init] Error:", error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log(`[Server Initialization] Starting... NODE_ENV=${process.env.NODE_ENV}`);
  const app = express();
  
  // Enable CORS for all routes
  app.use(cors());
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Debug logger for all incoming requests - EARLY in the chain
  app.use((req, res, next) => {
    console.log(`[Request Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
  });

  const PORT = 3000;

  // 1. DEDICATED API ROUTES
  const apiRouter = express.Router();

  // API Health check
  apiRouter.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      api: 'root',
      env: process.env.NODE_ENV,
      adminInitialized: admin.apps.length > 0 
    });
  });

  // Admin Sub-Router
  const adminRouter = express.Router();

  adminRouter.get('/health', (req, res) => {
    console.log("[Admin API] /health checked");
    res.json({ status: 'admin-ok', initialized: admin.apps.length > 0 });
  });

  // List all users from Auth and Merge with Firestore
  adminRouter.get('/list-users', async (req, res) => {
    try {
      console.log("[Admin API] GET /list-users - Request received");
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        console.warn("[Admin API] Missing Authorization header");
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) {
        console.error(`[Admin API] Unauthorized access attempt by ${decodedToken.email}`);
        return res.status(403).json({ error: 'Forbidden: Admins only' });
      }

      console.log("[Admin API] Fetching all users from Auth and Firestore...");
      
      // 1. Get all users from Auth
      let authUsers: admin.auth.UserRecord[] = [];
      let authError: string | null = null;
      try {
        const listUsersResult = await admin.auth().listUsers(1000);
        authUsers = listUsersResult.users;
        console.log(`[Admin API] Auth: Found ${authUsers.length} users.`);
      } catch (authErr: any) {
        console.error("[Admin API] Auth listUsers failed:", authErr.message);
        authError = authErr.message;
      }

      // 2. Get all users from Firestore
      let firestoreData: Record<string, any> = {};
      let firestoreError: string | null = null;
      try {
        // Correctly handle non-default databases
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
          ? firebaseConfig.firestoreDatabaseId
          : undefined;
          
        const db = admin.firestore(dbId);
        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => {
          firestoreData[doc.id] = doc.data();
        });
        console.log(`[Admin API] Firestore: Found ${Object.keys(firestoreData).length} profiles in ${dbId || '(default)'} database.`);
      } catch (fsError: any) {
        console.warn(`[Admin API] Firestore fetch failed: ${fsError.message}`);
        firestoreError = fsError.message;
      }

      // 3. Merge data
      const allUids = new Set([
        ...authUsers.map(u => u.uid),
        ...Object.keys(firestoreData)
      ]);

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
          mobileNumber: profile.mobileNumber || '',
          subscriptionTier: profile.subscriptionTier || 'free',
          subscriptionStatus: profile.subscriptionStatus || 'none',
          ...profile
        };
      });

      console.log(`[Admin API] Returning ${mergedUsers.length} merged users.`);
      res.json({
        users: mergedUsers,
        diag: {
          authCount: authUsers.length,
          firestoreCount: Object.keys(firestoreData).length,
          projectId: admin.app().options.projectId,
          authError,
          firestoreError,
          hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT || fs.readdirSync(process.cwd()).some(f => (f.startsWith('gen-lang-client') || f.startsWith('firebase-adminsdk')) && f.endsWith('.json'))
        }
      });
    } catch (error) {
      console.error('[Admin API] Critical Error in list-users:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown internal error' });
    }
  });

  adminRouter.post('/delete-user', async (req, res) => {
    console.log(`[Admin API] POST /delete-user received`);
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Check Firebase Admin Status
    if (admin.apps.length === 0) {
      console.error('[Admin API] Firebase Admin NOT initialized');
      return res.status(500).json({ error: 'Firebase Admin not initialized. Check server logs.' });
    }

    const { uid, idToken } = req.body;
    
    if (!uid || !idToken) {
      console.warn('[Admin API] Missing UID or ID Token');
      return res.status(400).json({ error: 'Missing uid or idToken' });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email?.toLowerCase() || '';
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      
      if (!adminEmails.includes(email)) {
        return res.status(403).json({ error: `Unauthorized: ${email} is not an admin.` });
      }

      await admin.auth().deleteUser(uid);
      
      const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? firebaseConfig.firestoreDatabaseId
        : undefined;

      const db = admin.firestore(dbId);
      await db.collection('users').doc(uid).delete();
      
      res.json({ success: true, message: 'User deletion process completed.' });
    } catch (error) {
      console.error('[Admin API] Delete User Error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Mount Admin Router under /api/admin
  apiRouter.use('/admin', adminRouter);

  // Mount entire apiRouter under /api
  app.use('/api', apiRouter);

  // Catch-all for missing API routes - MUST return JSON
  app.all('/api/*', (req, res) => {
    console.warn(`[API 404] Missing endpoint: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: `API endpoint not found: ${req.method} ${req.url}`,
      tip: "Check your query paths. Available: /api/health, /api/admin/list-users, etc."
    });
  });


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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
