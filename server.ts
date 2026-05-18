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
  const firebaseConfigPath = './firebase-applet-config.json';
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  const rootFiles = fs.readdirSync('./');
  const serviceAccountFile = rootFiles.find(f => 
    (f.startsWith('gen-lang-client') || f.startsWith('firebase-adminsdk')) && f.endsWith('.json')
  );

  if (serviceAccountFile) {
    const serviceAccountPath = path.join('./', serviceAccountFile);
    console.log(`[Admin Init] Found service account: ${serviceAccountFile}`);
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    if (!admin.apps.length) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId
      });
      console.log(`[Admin Init] Firebase Admin initialized with service account for project: ${firebaseConfig.projectId}`);
    }
  } else {
    console.warn("[Admin Init] No service account JSON file found in root. Using ADC with explicit Project ID.");
    if (!admin.apps.length) {
      adminApp = admin.initializeApp({
        projectId: firebaseConfig.projectId
      });
      console.log(`[Admin Init] Firebase Admin initialized with ADC for project: ${firebaseConfig.projectId}`);
    }
  }
} catch (error) {
  console.error("[Admin Init] ERROR during initialization:", error);
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

  // List all users from Auth and Merge with Firestore with robust error handling
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
      const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
      
      // 1. Get all users from Auth (MUST WORK)
      let authUsers: admin.auth.UserRecord[] = [];
      try {
        const listUsersResult = await admin.auth().listUsers(1000);
        authUsers = listUsersResult.users;
        console.log(`[Admin API] Found ${authUsers.length} users in Firebase Authentication.`);
      } catch (authErr: any) {
        console.error("[Admin API] Auth listUsers failed:", authErr.message);
        return res.status(500).json({ error: "Failed to fetch users from Authentication: " + authErr.message });
      }

      // 2. Get all users from Firestore (OPTIONAL)
      let firestoreData: Record<string, any> = {};
      try {
        const db = admin.firestore();
        console.log(`[Admin API] Attempting Firestore fetch (Project: ${admin.app().options.projectId})`);
        
        // Debug: list one collection just to see if it works
        const collections = await db.listCollections();
        console.log(`[Admin API] Collections found: ${collections.map(c => c.id).join(', ')}`);

        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => {
          firestoreData[doc.id] = doc.data();
        });
        console.log(`[Admin API] Successfully merged data for ${Object.keys(firestoreData).length} Firestore profiles.`);
      } catch (fsError: any) {
        console.warn(`[Admin API] Firestore fetch failed (Code ${fsError.code}): ${fsError.message}`);
        
        // Try fallback with explicit databaseId if config says so
        if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
          try {
             const db = admin.firestore(firebaseConfig.firestoreDatabaseId);
             const snapshot = await db.collection('users').get();
             snapshot.forEach(doc => {
               firestoreData[doc.id] = doc.data();
             });
             console.log(`[Admin API] Resolved via Database ID: ${firebaseConfig.firestoreDatabaseId}`);
          } catch (retryErr) {
             console.warn(`[Admin API] Failover Firestore retry failed too.`);
          }
        }
      }

      // 3. Merge and return
      const mergedUsers = authUsers.map(authUser => {
        const profile = firestoreData[authUser.uid] || {};
        return {
          id: authUser.uid,
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName || profile.displayName || authUser.email?.split('@')[0] || 'Unknown User',
          photoURL: authUser.photoURL || profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser.email || 'U')}&background=random`,
          createdAt: authUser.metadata.creationTime,
          lastSignInTime: authUser.metadata.lastSignInTime,
          mobileNumber: profile.mobileNumber || '',
          subscriptionTier: profile.subscriptionTier || 'free',
          subscriptionStatus: profile.subscriptionStatus || 'none',
          role: profile.role || 'user',
          ...profile
        };
      });

      res.json(mergedUsers);
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
