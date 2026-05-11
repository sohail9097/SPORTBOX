import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import serviceAccount from './gen-lang-client-0783495181-firebase-adminsdk-fbsvc-c6efa0d61d.json';

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
  });
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
    const { uid, idToken } = req.body;
    
    if (!uid || !idToken) {
      return res.status(400).json({ error: 'Missing uid or idToken' });
    }

    try {
      // Verify token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // Hardcoded admin emails as per firestore.rules
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Delete from Auth
      await admin.auth().deleteUser(uid);
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
