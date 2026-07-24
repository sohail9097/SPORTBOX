import { db, handleFirestoreError, OperationType, doc, getDoc, getDocs, setDoc, deleteDoc, query, collection, where } from './firebase';

export interface DeviceSession {
  id: string;
  userId: string;
  email: string;
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
  const cleanUser = userIdOrEmail.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDev = deviceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanUser}_${cleanDev}`;
}

/**
 * Checks device session for the given email.
 * If current device already has a session -> update lastActive.
 * If session count < 2 -> create new session.
 * If session count >= 2 -> return allowed: false and the activeSessions list.
 */
export async function verifyOrCreateSession(userEmail: string, userUid: string): Promise<{
  allowed: boolean;
  activeSessions?: DeviceSession[];
  currentSessionId?: string;
}> {
  if (!userEmail) return { allowed: true };

  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const normalizedEmail = userEmail.toLowerCase();
  const docId = getSessionDocId(normalizedEmail, deviceId);

  try {
    const sessionRef = doc(db, 'sessions', docId);
    const sessionSnap = await getDoc(sessionRef);

    if (sessionSnap.exists()) {
      // Session already active for this device -> update lastActive
      await setDoc(sessionRef, {
        lastActive: new Date().toISOString()
      }, { merge: true });

      return { allowed: true, currentSessionId: docId };
    }

    // Query active sessions for this user's email
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', normalizedEmail)
    );
    const querySnap = await getDocs(q);

    let activeSessions: DeviceSession[] = [];
    querySnap.forEach((docSnap) => {
      activeSessions.push({
        id: docSnap.id,
        ...docSnap.data()
      } as DeviceSession);
    });

    if (activeSessions.length < 2) {
      const newSession: DeviceSession = {
        id: docId,
        userId: normalizedEmail,
        email: normalizedEmail,
        deviceId,
        deviceName,
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };

      await setDoc(sessionRef, newSession);
      return { allowed: true, currentSessionId: docId };
    } else {
      return {
        allowed: false,
        activeSessions
      };
    }
  } catch (error) {
    console.error("[SessionManager] Error checking session limit:", error);
    handleFirestoreError(error, OperationType.GET, 'sessions');
    return { allowed: true, currentSessionId: docId };
  }
}

/**
 * Creates session directly after a remote session was logged out by the user
 */
export async function forceCreateSession(userEmail: string): Promise<string> {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const normalizedEmail = userEmail.toLowerCase();
  const docId = getSessionDocId(normalizedEmail, deviceId);
  const sessionRef = doc(db, 'sessions', docId);

  const newSession: DeviceSession = {
    id: docId,
    userId: normalizedEmail,
    email: normalizedEmail,
    deviceId,
    deviceName,
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  await setDoc(sessionRef, newSession);
  return docId;
}

/**
 * Remove session by doc ID
 */
export async function removeSession(sessionId: string): Promise<void> {
  try {
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
    const normalizedEmail = userEmail.toLowerCase();
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', normalizedEmail)
    );
    const querySnap = await getDocs(q);
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
