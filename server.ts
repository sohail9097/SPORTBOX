import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(fs.readFileSync('./gen-lang-client-0783495181-firebase-adminsdk-fbsvc-c6efa0d61d.json', 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin initialized successfully.");
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Admin API routes
  app.post('/api/admin/delete-auth-user', async (req, res) => {
    console.log('Received delete-auth-user request for UID:', req.body.uid);
    const { uid, idToken } = req.body;
    
    if (!uid || !idToken) {
      console.warn('Missing uid or idToken in request');
      return res.status(400).json({ error: 'Missing uid or idToken' });
    }

    try {
      // Verify token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log('Token verified for:', decodedToken.email);
      
      // Hardcoded admin emails as per firestore.rules
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) {
        console.warn('Unauthorized attempt by:', decodedToken.email);
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Delete from Auth
      await admin.auth().deleteUser(uid);
      console.log('User deleted successfully from Auth:', uid);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete Auth User error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
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
