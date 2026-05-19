import { app, ensureInitialized } from '../server.js';

export default async function handler(req: any, res: any) {
  try {
    console.log(`[Vercel Function] Handling ${req.method} ${req.url}`);
    // Ensure routes are registered before handling request
    const initializedApp = await ensureInitialized();
    return initializedApp(req, res);
  } catch (error: any) {
    console.error("[Vercel Function] Error:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
}
