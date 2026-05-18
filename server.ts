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
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const rootFiles = fs.readdirSync('./');
  
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
      const serviceAccountPath = path.join('./', serviceAccountFile);
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
  console.log(`[Server Initialization] Initializing Express app...`);
  const app = express();
  
  // Enable CORS for all routes
  app.use(cors());
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Debug logger for all incoming requests
  app.use((req, res, next) => {
    console.log(`[Request Log] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  const PORT = 3000;

  // Dedicated Admin API Route Handler
  app.all('/admin/api/v1/delete-user', async (req, res) => {
    console.log(`[Admin API] Received ${req.method} request`);
    const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
    
    // Health check / Info endpoint
    if (req.method === 'GET') {
      return res.json({ 
        status: 'online', 
        initialized: admin.apps.length > 0,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        appName: admin.apps[0]?.name || 'none'
      });
    }

    if (req.method !== 'POST') {
      console.warn(`[Admin API] Method ${req.method} not allowed`);
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

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
      // 1. Verify the Admin's ID Token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email?.toLowerCase() || '';
      
      // LOGS AS REQUESTED BY USER
      console.log("User email:", email); 
      console.log("Logged in email:", email);
      console.log("Is email verified:", decodedToken.email_verified);
      
      // Hardcoded admin emails
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      console.log("Allowed Admin Emails:", adminEmails);
      
      if (!adminEmails.includes(email)) {
        console.warn(`[Admin API] Unauthorized: ${email}`);
        return res.status(403).json({ error: `Unauthorized: ${email} is not an admin.` });
      }

      // 2. Delete the user from Firebase Auth
      console.log(`[Admin API] Deleting from Auth: ${uid}`);
      try {
        await admin.auth().deleteUser(uid);
        console.log(`[Admin API] Successfully deleted ${uid} from Auth`);
      } catch (authErr: any) {
        console.warn(`[Admin API] Auth deletion warning (user might already be gone): ${authErr.message}`);
        // Continue to Firestore even if Auth fails (maybe already deleted)
      }

      const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? firebaseConfig.firestoreDatabaseId
        : undefined;

      // 3. Delete from Firestore (OPTIONAL)
      try {
        console.log(`[Admin API] Deleting from Firestore: ${uid} (db: ${dbId || '(default)'})`);
        const db = admin.firestore(dbId);
        await db.collection('users').doc(uid).delete();
      } catch (fsError: any) {
        console.warn(`[Admin API] Firestore deletion failed: ${fsError.message}`);
      }
      
      return res.json({ success: true, message: 'User deletion process completed.' });
    } catch (error) {
      console.error('[Admin API] Error:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // List all users from Auth and Merge with Firestore
  app.get('/admin/api/v1/list-users', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) {
        console.error(`[Admin API] Unauthorized access attempt by ${decodedToken.email}`);
        return res.status(403).json({ error: 'Forbidden: Admins only' });
      }

      console.log("[Admin API] Fetching all users...");
      
      // 1. Get all users from Auth (with fallback)
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
        const db = admin.firestore();
        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => {
          firestoreData[doc.id] = doc.data();
        });
        console.log(`[Admin API] Firestore: Found ${Object.keys(firestoreData).length} profiles.`);
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
      
      // Always return a JSON object with a users array and diag info
      res.json({
        users: mergedUsers,
        diag: {
          authCount: authUsers.length,
          firestoreCount: Object.keys(firestoreData).length,
          projectId: admin.app().options.projectId,
          authError,
          firestoreError,
          hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT || fs.readdirSync('./').some(f => (f.startsWith('gen-lang-client') || f.startsWith('firebase-adminsdk')) && f.endsWith('.json'))
        }
      });
    } catch (error) {
      console.error('[Admin API] Critical Error in list-users:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown internal error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Catch-all route to serve index.html for SPA routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
