import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';
import cors from 'cors';

// Initialize Firebase Admin
try {
  const rootFiles = fs.readdirSync('./');
  const serviceAccountFile = rootFiles.find(f => 
    (f.startsWith('gen-lang-client') || f.startsWith('firebase-adminsdk')) && f.endsWith('.json')
  );

  if (serviceAccountFile) {
    const serviceAccountPath = path.join('./', serviceAccountFile);
    console.log(`[Admin Init] Found service account: ${serviceAccountFile}`);
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("[Admin Init] Firebase Admin initialized with service account.");
    }
  } else {
    console.warn("[Admin Init] No service account JSON file found in root. Falling back to default credentials.");
    if (!admin.apps.length) {
      admin.initializeApp();
      console.log("[Admin Init] Firebase Admin initialized with default credentials.");
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
  app.all('/api/v1/admin/delete-user', async (req, res) => {
    console.log(`[Admin API] Received ${req.method} request for user deletion`);
    
    // Handle CORS preflight explicitly if needed (though app.use(cors()) does this)
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    // Health check / Info endpoint
    if (req.method === 'GET') {
      return res.json({ 
        status: 'online', 
        initialized: admin.apps.length > 0,
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
      return res.status(500).json({ error: 'Firebase Admin not initialized. Check server logs for startup errors.' });
    }

    const { uid, idToken } = req.body;
    
    if (!uid || !idToken) {
      console.warn('[Admin API] Missing UID or ID Token in request body');
      return res.status(400).json({ error: 'Missing uid or idToken' });
    }

    try {
      // 1. Verify the Admin's ID Token
      console.log('[Admin API] Verifying admin token...');
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email?.toLowerCase() || '';
      console.log(`[Admin API] Request by: ${email}`);
      
      // Hardcoded admin emails as per firestore.rules
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      if (!adminEmails.includes(email)) {
        console.warn(`[Admin API] Unauthorized access attempt by ${email}`);
        return res.status(403).json({ error: 'Unauthorized: You do not have admin privileges' });
      }

      // 2. Delete the user from Firebase Auth
      console.log(`[Admin API] Deleting user from Auth: ${uid}`);
      await admin.auth().deleteUser(uid);
      console.log(`[Admin API] Successfully deleted user ${uid} from Auth`);
      
      return res.json({ success: true, message: 'User deleted from Authentication successfully' });
    } catch (error) {
      console.error('[Admin API] Operation failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown server error';
      return res.status(500).json({ error: message });
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
