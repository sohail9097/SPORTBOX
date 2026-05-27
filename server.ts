import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';
import cors from 'cors';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

// Lazy initialize Gemini client or check before calling to prevent crash on startup if key is missing
function getGeminiClient() {
  let apiKey = process.env.GEMINI_API_KEY;
  
  if (apiKey) {
    apiKey = apiKey.replace(/['"]/g, '').trim();
  }
  
  // Robust check: if empty, undefined, or matches the common placeholder "MY_GEMINI_API_KEY"
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "" || apiKey.includes("PLACEHOLDER")) {
    apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      apiKey = apiKey.replace(/['"]/g, '').trim();
    }
  }
  
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "" || apiKey.includes("PLACEHOLDER")) {
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required. Please verify Settings > Secrets.");
  }
  
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

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
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (sa && sa.project_id === firebaseConfig.projectId) {
          serviceAccount = sa;
          console.log(`[Admin Init] Initializing with service account from Environment Variable.`);
        } else {
          console.warn(`[Admin Init] FIREBASE_SERVICE_ACCOUNT project ID (${sa ? sa.project_id : 'unknown'}) does not match config project ID (${firebaseConfig.projectId}). Ignoring service account.`);
        }
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
  
  // Parse JSON bodies with a limit suitable for base64 images (e.g., 20mb)
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

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

  // --- RAZORPAY PAYMENT GATEWAY MODULE ---
  let razorpayInstance: any = null;
  function getRazorpay() {
    if (!razorpayInstance) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        throw new Error("Razorpay API Keys are not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
      }
      razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });
    }
    return razorpayInstance;
  }

  // Create Razorpay Order
  apiRouter.post('/razorpay/create-order', async (req, res) => {
    try {
      const { planId, amount } = req.body;
      if (!planId || !amount) {
        return res.status(400).json({ error: 'Missing parameters: planId and amount are required' });
      }

      const client = getRazorpay();
      
      const options = {
        amount: Math.round(parseFloat(amount) * 100), // Amount in paise
        currency: "INR",
        receipt: `receipt_${planId}_${Date.now()}`
      };

      const order = await (client.orders as any).create(options);
      console.log(`[Razorpay] Created order ${order.id} for plan ${planId} of amount ${amount} INR`);

      res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID // Send to client for initialization
      });
    } catch (error: any) {
      console.error('[Razorpay Create Order Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to create order' });
    }
  });

  // Verify Razorpay Payment Signature and activate subscription
  apiRouter.post('/razorpay/verify-payment', async (req, res) => {
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature, 
        uid, 
        planId, 
        displayName, 
        mobileNumber 
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !uid || !planId) {
        return res.status(400).json({ error: 'Missing required parameters for payment verification' });
      }

      // Verify Razorpay Signature
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        throw new Error("Razorpay Secret is not configured on the server.");
      }

      const signBody = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signBody)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        console.warn(`[Razorpay Signature Invalidation] Received: ${razorpay_signature}, Expected: ${expectedSignature}`);
        return res.status(400).json({ success: false, error: 'Payment verification failed: Invalid signature' });
      }

      console.log(`[Razorpay Payment Verified] Order: ${razorpay_order_id}, Payment: ${razorpay_payment_id}`);

      // Update subscription in Firestore
      const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
      const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? firebaseConfig.firestoreDatabaseId
        : undefined;
      const db = admin.firestore(dbId);

      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const existingData = userSnap.exists ? userSnap.data() : {};

      const newUserData = {
        uid,
        email: existingData?.email || null,
        displayName: displayName || existingData?.displayName || null,
        subscriptionTier: planId,
        subscriptionStatus: 'active',
        mobileNumber: mobileNumber || existingData?.mobileNumber || null,
        isMobileVerified: true,
        lastPaymentDate: new Date().toISOString(),
        paymentDetails: {
          gateway: 'razorpay',
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          verifiedAt: new Date().toISOString()
        },
        createdAt: existingData?.createdAt || new Date().toISOString()
      };

      await userRef.set(newUserData, { merge: true });
      console.log(`[Firestore Updated] Activated subscription for ${uid} as ${planId}`);

      res.json({ success: true, message: 'Payment verified and subscription activated.' });
    } catch (error: any) {
      console.error('[Razorpay Verify Payment Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to verify payment' });
    }
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
          createdAt: authUser?.metadata?.creationTime || profile.createdAt || null,
          lastSignInTime: authUser?.metadata?.lastSignInTime || profile.lastSignInTime || null,
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

  apiRouter.post('/admin/generate-blog', async (req, res) => {
    // Shared fallback helper to generate valid, engaging blog when API key is missing or invalid
    function generateLocalFallbackBlog(titleStr: string, imgStr: string | null, authorName: string, authorEmail: string, reasonText: string) {
      const normTitle = titleStr.toLowerCase();
      let category = 'football';
      let tags = ['sports', 'news', 'breaking'];
      
      if (normTitle.includes('foot') || normTitle.includes('soccer') || normTitle.includes('goala') || normTitle.includes('laliga') || normTitle.includes('premier')) {
        category = 'football';
        tags = ['football', 'goals', 'tactics', 'matchday'];
      } else if (normTitle.includes('f1') || normTitle.includes('race') || normTitle.includes('prix') || normTitle.includes('clash') || normTitle.includes('grandprix') || normTitle.includes('motor')) {
        category = 'f1';
        tags = ['f1', 'racing', 'motorsport', 'speed'];
      } else if (normTitle.includes('basket') || normTitle.includes('dunk') || normTitle.includes('nba')) {
        category = 'basketball';
        tags = ['basketball', 'nba', 'hoops', 'court'];
      } else if (normTitle.includes('tennis') || normTitle.includes('grandslam') || normTitle.includes('court') || normTitle.includes('wimbledon')) {
        category = 'tennis';
        tags = ['tennis', 'grandslam', 'wimbledon', 'match'];
      } else if (normTitle.includes('box') || normTitle.includes('fight') || normTitle.includes('knockout') || normTitle.includes('ring') || normTitle.includes('ufc')) {
        category = 'boxing';
        tags = ['boxing', 'fight', 'knockout', 'championship'];
      } else if (normTitle.includes('cricket') || normTitle.includes('bat') || normTitle.includes('wicket') || normTitle.includes('overs')) {
        category = 'cricket';
        tags = ['cricket', 'matchday', 't20', 'testmatch'];
      } else if (normTitle.includes('esport') || normTitle.includes('game') || normTitle.includes('gamer') || normTitle.includes('tourney')) {
        category = 'esports';
        tags = ['esports', 'gaming', 'tournament', 'championship'];
      } else if (normTitle.includes('olympic') || normTitle.includes('medal') || normTitle.includes('gold')) {
        category = 'olympics';
        tags = ['olympics', 'goldmedal', 'athletics', 'global'];
      } else if (normTitle.includes('golf') || normTitle.includes('swing')) {
        category = 'golf';
        tags = ['golf', 'pga', 'green', 'tour'];
      } else if (normTitle.includes('wrestl') || normTitle.includes('wwe') || normTitle.includes('ring')) {
        category = 'wrestling';
        tags = ['wrestling', 'wwe', 'smackdown', 'raw'];
      } else if (normTitle.includes('water') || normTitle.includes('swim') || normTitle.includes('surf') || normTitle.includes('pool')) {
        category = 'watersports';
        tags = ['watersports', 'swimming', 'surfing', 'olympics'];
      } else if (normTitle.includes('stunt') || normTitle.includes('extreme') || normTitle.includes('skate')) {
        category = 'stunts';
        tags = ['stunts', 'extreme', 'adrenaline', 'action'];
      } else if (normTitle.includes('polo')) {
        category = 'polo';
        tags = ['polo', 'equestrian', 'match', 'elite'];
      } else if (normTitle.includes('kabaddi')) {
        category = 'kabaddi';
        tags = ['kabaddi', 'prokabaddi', 'raid', 'tackle'];
      } else if (normTitle.includes('hockey')) {
        category = 'hockey';
        tags = ['hockey', 'puck', 'onice', 'nhl'];
      }

      const cleanTitle = titleStr.trim();
      const content = `⚠️ **SPORTBOX ANALYTICS ENGINE NOTICE**
*This professional column was auto-generated by the SportsBox Local Editorial Engine as a developer/preview fallback (Reason: ${reasonText}). Setup process.env.GEMINI_API_KEY inside Settings > Secrets to enable full multimodal Gemini AI context-aware writing.*

**The Opening Play: A Strategic Awakening**

The sporting world stood still as the highly anticipated match unfolded. With "${cleanTitle}" capturing the undivided attention of analysts, commentators, and fans around the hemisphere, the sheer level of performance displayed on the arena floor redefined competitive benchmarks. Under tactical setups meticulously detailed behind closed doors over the past fortnight, both squads emerged onto the playing field exhibiting a fierce level of athletic intensity that immediately set a historic pace.

**The Tactical Chess Match under Pressure**

At the very heart of the clash was an intense battle of analytical systems. Strategists highlighted the lightning-fast transition transitions and fluid adaptations within the mid-field, court, or track zone as teams worked relentlessly under suffocating pressure to secure their team's advantage. This was not simply a physical battle, but a fast-moving chess match where every fractional second decision carried immediate championship-defining consequences. Observers in the stands marvelled at how split-second reactions could render standard drills completely obsolete.

**Heroic Individual Outbursts and Execution**

As the remaining minutes of competition ticked down, leadership and mental resilience became the ultimate separators. Highly refined precision, unwavering focus under hostile fan displays, and flawless execution of set-pieces transformed a tense stand-off into a masterclass of pure technique. Experienced analytical boards noted that these pressure-test moments reveal the true substance of professional training regimens, separating standard players from those who leave historical legacies on the scoreboard.

**A Lasting Legacy on the Tournament Table**

The long-term effects of this epic encounter will surely reverberate throughout the category and inspire teams for seasons ahead. It has galvanized the fanbase, set a completely new blueprint for technical development, and reminded the community that sportsmanship and rigorous consistency remain the bedrock of modern entertainment. Whether through numeric records or raw emotional moments, the event surrounding "${cleanTitle}" marks another unforgettable page in our digital archive.`;

      return {
        title: cleanTitle,
        excerpt: `The strategic showdown of "${cleanTitle}" delivered on all promises, showcasing elite coaching and exceptional athletic display.`,
        content: content,
        category: category,
        readTime: "5 min read",
        tags: tags,
        imageUrl: imgStr && imgStr.trim() !== '' ? imgStr : "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800",
        author: authorName || "SportsBox Senior Editor",
        authorEmail: authorEmail || "editor@sportsbox.com",
        createdAt: new Date().toISOString(),
        likesCount: 0,
        views: 1
      };
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email?.toLowerCase() || '';
      const adminEmails = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];
      if (!adminEmails.includes(email)) {
        return res.status(403).json({ error: 'Forbidden: Access restricted to administrators' });
      }

      const { title, image } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Missing blog title' });
      }

      const authorName = decodedToken.name || "SportsBox Senior Editor";

      // Wrap the Gemini execution in a nested try-catch to enable fallback rather than crashing
      try {
        // Initialize Gemini safely
        const client = getGeminiClient();

        // Gather parts to send to Gemini
        let parts: any[] = [];
        
        // Look at image parameter. It can be a base64 string or an URL.
        if (image && typeof image === 'string') {
          if (image.startsWith('data:image/')) {
            // Extract base64 encoded data
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];
              const data = matches[2];
              parts.push({
                inlineData: { mimeType, data }
              });
              console.log(`[Gemini Blog Gen] Using uploaded base64 image (Mime: ${mimeType})`);
            }
          } else if (image.startsWith('http://') || image.startsWith('https://')) {
            // It's a URL. We can attempt to fetch it and convert to base64 for multimodal input.
            try {
              const imgRes = await fetch(image);
              if (imgRes.ok) {
                const buffer = await imgRes.arrayBuffer();
                const base64Str = Buffer.from(buffer).toString('base64');
                const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
                parts.push({
                  inlineData: { mimeType: contentType, data: base64Str }
                });
                console.log(`[Gemini Blog Gen] Successfully fetched and processed image from URL: ${image}`);
              }
            } catch (fetchErr) {
              console.warn(`[Gemini Blog Gen] Could not fetch image URL directly. Falling back to describing the title.`, fetchErr);
            }
          }
        }

        // Add the final textual prompt
        const promptText = `Generate a complete sports blog post based on the title: "${title}".
        ${parts.length > 0 ? "Analyze the attached image and incorporate its elements or context into the article natural style." : ""}
        Ensure the output strictly adheres to the requested JSON schema.`;

        parts.push({ text: promptText });

        console.log(`[Gemini Blog Gen] Querying gemini-3.5-flash for Title: "${title}"...`);

        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts },
          config: {
            systemInstruction: `You are an elite, highly professional sports journalist and senior editor for SportsBox.
            Your goal is to write captivating, detailed, and masterfully crafted sport articles or blogs based on a given Title and an optional Image.
            The article content must be structured into logical, detailed, and analytical paragraphs (separated by double newlines \\n\\n) with appropriate, catchy inline bold subtitles (i.e. **Subheading**) instead of Markdown headers.
            Keep the tone energetic, informative, premium, and authoritative.
            You must select the best matching category from our valid set, generate an engaging 1-2 sentence excerpt, a realistic read time (e.g., '5 min read'), and appropriate tags.`,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Highly engaging final headline modeled after: " + title },
                excerpt: { type: Type.STRING, description: "A punchy teaser/hook sentence to attract readers." },
                content: { type: Type.STRING, description: "A very detailed, fully descriptive sport article body. Must have at least 4-5 substantial paragraphs separated by double-newlines (\\n\\n)." },
                category: { type: Type.STRING, description: "Must be exactly one of: football, basketball, tennis, f1, boxing, golf, esports, kabaddi, hockey, cricket, wrestling, watersports, stunts, polo, olympics." },
                readTime: { type: Type.STRING, description: "Estimated read length e.g. '5 min read'" },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["title", "excerpt", "content", "category", "readTime", "tags"]
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error("Empty response from Gemini model.");
        }

        const generatedBlog = JSON.parse(responseText.trim());
        console.log(`[Gemini Blog Gen] Successfully generated blog for "${title}". Chosen category: ${generatedBlog.category}`);

        return res.json({
          success: true,
          blog: {
            title: generatedBlog.title || title,
            excerpt: generatedBlog.excerpt || "An exciting new sport writeup.",
            content: generatedBlog.content,
            category: generatedBlog.category || "football",
            readTime: generatedBlog.readTime || "5 min read",
            tags: generatedBlog.tags || ["sports"],
            imageUrl: image || "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=800",
            author: authorName,
            authorEmail: email,
            createdAt: new Date().toISOString(),
            likesCount: 0,
            views: 1
          }
        });
      } catch (gemError: any) {
        console.warn(`[Gemini Blog Gen] Primary AI model generation failed. Initiating fall-back engine. Reason: ${gemError.message}`);
        
        const fallback = generateLocalFallbackBlog(title, image, authorName, email, gemError.message || 'Key configuration check');
        return res.json({
          success: true,
          blog: fallback
        });
      }
    } catch (error: any) {
      console.error('[Admin API Generate Blog Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to auto-generate blog content' });
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

    const categories = ['football', 'basketball', 'tennis', 'f1', 'boxing', 'golf', 'esports', 'kabaddi', 'hockey', 'cricket', 'wrestling', 'watersports', 'stunts', 'polo', 'olympics'];
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

    // Seed premium vertical sport shorts
    const shortsData = [
      {
        id: 'short-bkey-1',
        title: 'Steph Curry Pregame Shooting routine',
        description: 'Witness the pure excellence of Curry as he warms up for the big game with non-stop swishes!',
        category: 'basketball',
        type: 'short',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-basketball-player-dribbling-the-ball-34444-large.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=800',
        isPremium: false,
        viewCount: 14500,
        likes: 1243,
        createdAt: now,
        status: 'ended',
        tags: ['basketball', 'speed', 'pro']
      },
      {
        id: 'short-soccer-2',
        title: 'Top Bin Practice Goal of the Week',
        description: 'Perfect curled shot into the absolute top corner of the net during sunset practice.',
        category: 'football',
        type: 'short',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-ball-in-stadium-1549-large.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800',
        isPremium: false,
        viewCount: 22400,
        likes: 3105,
        createdAt: now,
        status: 'ended',
        tags: ['football', 'goal', 'skills']
      },
      {
        id: 'short-boxing-3',
        title: 'Rapid Fire Punch Combos',
        description: 'Unbelievable speed and precision combos training session under intense coaches directions.',
        category: 'boxing',
        type: 'short',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-boxing-glove-hitting-air-4876-large.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800',
        isPremium: true,
        viewCount: 8900,
        likes: 721,
        createdAt: now,
        status: 'ended',
        tags: ['boxing', 'training', 'speed']
      },
      {
        id: 'short-tennis-4',
        title: 'Perfect Forehand Stroke Slow-Mo',
        description: 'Deconstruct the flawless forehand technique under advanced high-speed action camera.',
        category: 'tennis',
        type: 'short',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tennis-player-hitting-ball-with-racket-1550-large.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1622279457486-62dcc4a4bd1d?q=80&w=800',
        isPremium: false,
        viewCount: 12000,
        likes: 914,
        createdAt: now,
        status: 'ended',
        tags: ['tennis', 'pro', 'skills']
      }
    ];

    shortsData.forEach(short => {
      const docRef = db.collection('content').doc(short.id);
      batch.set(docRef, short);
      totalAdded++;
    });

    await batch.commit();
    res.json({ success: true, message: `Successfully seeded ${totalAdded} items including vertical Sport Shots and Cricket.` });
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

  // Serve static SEO assets explicitly to bypass SPA routing
  app.get('/sitemap.xml', (req, res) => {
    const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      res.header('Content-Type', 'application/xml');
      return res.sendFile(sitemapPath);
    }
    const distSitemapPath = path.join(process.cwd(), 'dist', 'sitemap.xml');
    if (fs.existsSync(distSitemapPath)) {
      res.header('Content-Type', 'application/xml');
      return res.sendFile(distSitemapPath);
    }
    return res.status(404).send('Sitemap not found');
  });

  app.get('/robots.txt', (req, res) => {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    if (fs.existsSync(robotsPath)) {
      res.header('Content-Type', 'text/plain');
      return res.sendFile(robotsPath);
    }
    const distRobotsPath = path.join(process.cwd(), 'dist', 'robots.txt');
    if (fs.existsSync(distRobotsPath)) {
      res.header('Content-Type', 'text/plain');
      return res.sendFile(distRobotsPath);
    }
    return res.status(404).send('Robots.txt not found');
  });

  // Loader.io Verification Routes
  app.get('/loaderio-378b532336c0428f9443cbbce52c4005', (req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send('loaderio-378b532336c0428f9443cbbce52c4005');
  });

  app.get('/loaderio-378b532336c0428f9443cbbce52c4005.txt', (req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send('loaderio-378b532336c0428f9443cbbce52c4005');
  });

  app.get('/loaderio-378b532336c0428f9443cbbce52c4005.html', (req, res) => {
    res.header('Content-Type', 'text/html');
    res.send('loaderio-378b532336c0428f9443cbbce52c4005');
  });

  app.get('/loaderio-c9cbe19d7f3f88ed1dac558d20e9ae41', (req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send('loaderio-c9cbe19d7f3f88ed1dac558d20e9ae41');
  });

  app.get('/loaderio-c9cbe19d7f3f88ed1dac558d20e9ae41.txt', (req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send('loaderio-c9cbe19d7f3f88ed1dac558d20e9ae41');
  });

  app.get('/loaderio-c9cbe19d7f3f88ed1dac558d20e9ae41.html', (req, res) => {
    res.header('Content-Type', 'text/html');
    res.send('loaderio-c9cbe19d7f3f88ed1dac558d20e9ae41');
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
