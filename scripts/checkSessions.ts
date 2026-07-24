import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

let config: any = {};
if (fs.existsSync('./firebase-applet-config.json')) {
  config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
}

if (!getApps().length) {
  initializeApp({
    projectId: config.projectId || 'sportsbox-1'
  });
}

const db = getFirestore();

async function checkSessions() {
  console.log("=== Checking Firestore 'sessions' collection ===");
  try {
    const snapshot = await db.collection('sessions').get();
    console.log(`Total session documents in Firestore: ${snapshot.size}`);
    snapshot.forEach(doc => {
      console.log(`Doc ID: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
    });
  } catch (err) {
    console.error("Error reading sessions:", err);
  }
}

checkSessions();
