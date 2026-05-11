import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';
import cors from 'cors';

// Initialize Firebase Admin
try {
  let serviceAccount: any = null;
  const files = fs.readdirSync('./');
  const serviceAccountFile = files.find(f => f.startsWith('gen-lang-client') && f.endsWith('.json')) || 
                             files.find(f => f.startsWith('firebase-adminsdk') && f.endsWith('.json'));

  if (serviceAccountFile) {
    console.log(`Found service account file: ${serviceAccountFile}`);
    serviceAccount = JSON.parse(fs.readFileSync(path.join('./', serviceAccountFile), 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized successfully using service account file.");
  } else {
    // Attempt initialization with default credentials (ADC)
    console.log("No service account file found. Attempting default credentials...");
    admin.initializeApp();
    console.log("Firebase Admin initialized using default credentials.");
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(cors());
  
  // Debug logger
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  const PORT = 3000;

  // Admin API routes
  app.all('/admin-api/delete-user', async (req, res) => {
    console.log('Admin API Request:', req.method, req.url);
    
    // Check if initialized
    if (admin.apps.length === 0) {
      return res.status(500).json({ error: 'Firebase Admin not initialized. Please ensure service account is configured.' });
    }

    if (req.method === 'GET') {
      return res.json({ status: 'active', message: 'Endpoint is reachable. Use POST with credentials to perform deletion.' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed. Please use POST.' });
    }

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
