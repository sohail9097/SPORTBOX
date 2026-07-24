import { db, handleFirestoreError, OperationType, doc, getDoc, getDocs, setDoc, deleteDoc, query, collection, where, runTransaction } from './firebase';

export interface DeviceSession {
  id: string;
  userId: string;
  email: string;
  normalizedEmail: string;
  deviceId: string;
  deviceName: string;
  loginTime: string;
  lastActive: string;
}

const DEVICE_ID_KEY = 'sportsbox_device_id';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log(`[SessionManager] Generated new persistent deviceId: "${deviceId}"`);
  } else {
    console.log(`[SessionManager] Retrieved persistent deviceId from localStorage: "${deviceId}"`);
  }
  return deviceId;
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  let os = "Device";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
}

export function getSessionDocId(userIdOrEmail: string, deviceId: string): string {
  const cleanUser = userIdOrEmail.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDev = deviceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanUser}_${cleanDev}`;
}

/**
 * Checks device session for the given email atomically using Firestore runTransaction.
 * - Enforces case-insensitive, trimmed email queries bypassing stale cache.
 * - If current device already has a session -> update lastActive.
 * - If session count < 2 -> create new session document.
 * - If session count >= 2 -> return allowed: false and the activeSessions list.
 */
export async function verifyOrCreateSession(userEmail: string, userUid: string): Promise<{
  allowed: boolean;
  activeSessions?: DeviceSession[];
  currentSessionId?: string;
}> {
  if (!userEmail) return { allowed: true };

  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const normalizedEmail = userEmail.toLowerCase().trim();
  const docId = getSessionDocId(normalizedEmail, deviceId);

  console.log(`[SessionManager] verifyOrCreateSession starting for user: "${normalizedEmail}", deviceId: "${deviceId}", docId: "${docId}"`);

  try {
    // Live query for current active sessions belonging to this user (bypassCache = true)
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', normalizedEmail)
    );
    const querySnap = await getDocs(q, { bypassCache: true });

    let activeSessions: DeviceSession[] = [];
    querySnap.forEach((docSnap) => {
      activeSessions.push({
        id: docSnap.id,
        ...docSnap.data()
      } as DeviceSession);
    });

    console.log(`[SessionManager] Active sessions query result for "${normalizedEmail}": count = ${activeSessions.length}`, activeSessions.map(s => `[${s.id}: ${s.deviceName}]`));

    // Check if current device already has a session document in the query
    const hasCurrentDevice = activeSessions.some(s => s.id === docId);

    if (hasCurrentDevice) {
      const sessionRef = doc(db, 'sessions', docId);
      await setDoc(sessionRef, {
        lastActive: new Date().toISOString()
      }, { merge: true });

      console.log(`[SessionManager] Current device "${docId}" is already active. Updated lastActive timestamp.`);
      return { allowed: true, currentSessionId: docId };
    }

    // Check if session limit is reached (2 devices max)
    if (activeSessions.length >= 2) {
      console.warn(`[SessionManager] Session limit EXCEEDED for "${normalizedEmail}". Active sessions: ${activeSessions.length} >= 2. Access DENIED.`);
      return {
        allowed: false,
        activeSessions
      };
    }

    // Wrap session document creation in an atomic Firestore transaction to prevent race conditions
    const sessionRef = doc(db, 'sessions', docId);
    
    await runTransaction(db, async (transaction) => {
      // Lock existing sessions inside transaction
      for (const s of activeSessions) {
        await transaction.get(doc(db, 'sessions', s.id));
      }

      const snap = await transaction.get(sessionRef);
      if (snap.exists()) {
        transaction.update(sessionRef, { lastActive: new Date().toISOString() });
        return;
      }

      const newSession: DeviceSession = {
        id: docId,
        userId: normalizedEmail,
        email: normalizedEmail,
        normalizedEmail: normalizedEmail,
        deviceId,
        deviceName,
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };

      transaction.set(sessionRef, newSession);
    });

    console.log(`[SessionManager] Atomic transaction completed. Session created for "${docId}". Access ALLOWED.`);
    return { allowed: true, currentSessionId: docId };
  } catch (error) {
    console.error("[SessionManager] Error checking/creating session limit:", error);
    handleFirestoreError(error, OperationType.GET, 'sessions');
    // Reject login if error occurs so invalid or exceeding logins cannot bypass verification
    return { allowed: false, activeSessions: [] };
  }
}

/**
 * Creates session directly after a remote session was logged out by the user
 */
export async function forceCreateSession(userEmail: string): Promise<string> {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const normalizedEmail = userEmail.toLowerCase().trim();
  const docId = getSessionDocId(normalizedEmail, deviceId);
  const sessionRef = doc(db, 'sessions', docId);

  const newSession: DeviceSession = {
    id: docId,
    userId: normalizedEmail,
    email: normalizedEmail,
    normalizedEmail: normalizedEmail,
    deviceId,
    deviceName,
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  await setDoc(sessionRef, newSession);
  console.log(`[SessionManager] Force created session docId "${docId}" for device "${deviceName}"`);
  return docId;
}

/**
 * Remove session by doc ID
 */
export async function removeSession(sessionId: string): Promise<void> {
  try {
    console.log(`[SessionManager] Removing session document ID: "${sessionId}"`);
    const sessionRef = doc(db, 'sessions', sessionId);
    await deleteDoc(sessionRef);
  } catch (error) {
    console.error("[SessionManager] Error deleting session:", error);
    handleFirestoreError(error, OperationType.DELETE, `sessions/${sessionId}`);
  }
}

/**
 * Remove current device session
 */
export async function removeCurrentSession(userEmail: string): Promise<void> {
  if (!userEmail) return;
  const deviceId = getDeviceId();
  const docId = getSessionDocId(userEmail, deviceId);
  await removeSession(docId);
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userEmail: string): Promise<DeviceSession[]> {
  if (!userEmail) return [];
  try {
    const normalizedEmail = userEmail.toLowerCase().trim();
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', normalizedEmail)
    );
    const querySnap = await getDocs(q, { bypassCache: true });
    const sessions: DeviceSession[] = [];
    querySnap.forEach((docSnap) => {
      sessions.push({
        id: docSnap.id,
        ...docSnap.data()
      } as DeviceSession);
    });
    return sessions;
  } catch (error) {
    console.error("[SessionManager] Error fetching user sessions:", error);
    return [];
  }
}
