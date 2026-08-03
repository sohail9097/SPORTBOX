import { db, handleFirestoreError, OperationType, doc, getDoc, getDocs, setDoc, deleteDoc, query, collection, where, runTransaction } from './firebase';

export interface DeviceSession {
  id: string;
  userId: string;
  email: string;
  normalizedEmail: string;
  deviceId: string;
  deviceName: string;
  deviceLabel?: string;
  deviceType: 'mobile' | 'desktop';
  loginTime: string;
  createdAt?: string;
  lastActive: string;
}

export interface DeviceInfo {
  deviceType: 'mobile' | 'desktop';
  deviceLabel: string;
}

const DEVICE_ID_KEY = 'sportsbox_device_id';

/**
 * Returns a persistent unique device identifier stored in localStorage.
 * IMPORTANT: We MUST use localStorage (not sessionStorage), as localStorage is shared across
 * all tabs in the same browser/device origin. sessionStorage is isolated per tab and would
 * cause multiple tabs in the same browser to be incorrectly counted as separate devices.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_default';
  
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
      console.log(`[SessionManager] Generated new persistent deviceId in localStorage: "${deviceId}"`);
    } else {
      console.log(`[SessionManager] Retrieved persistent deviceId from localStorage: "${deviceId}"`);
    }
    return deviceId;
  } catch (err) {
    console.warn("[SessionManager] localStorage error, falling back to browser-fingerprint deviceId:", err);
    return 'dev_fallback_' + (navigator.userAgent || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }
}

/**
 * Utility function that parses navigator.userAgent and returns device type ('mobile' | 'desktop')
 * and human-readable deviceLabel (e.g., 'Chrome on Windows', 'Safari on iPhone').
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return { deviceType: 'desktop', deviceLabel: 'Desktop Browser' };
  }

  const ua = navigator.userAgent || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceType: 'mobile' | 'desktop' = isMobile ? 'mobile' : 'desktop';

  let browser = "Browser";
  let os = "Device";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone")) os = "iPhone";
  else if (ua.includes("iPad")) os = "iPad";

  const deviceLabel = `${browser} on ${os}`;
  return { deviceType, deviceLabel };
}

/**
 * Detects whether current device is mobile or desktop.
 */
export function getDeviceType(): 'mobile' | 'desktop' {
  return getDeviceInfo().deviceType;
}

/**
 * Returns a human-readable device/browser string (e.g. "Chrome on macOS", "Safari on iPhone").
 */
export function getDeviceName(): string {
  return getDeviceInfo().deviceLabel;
}

/**
 * Formats ISO timestamp to human-readable relative time string (e.g. "Active 2 hours ago", "Active just now").
 */
export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Active recently';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Active recently';

  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return 'Active just now';
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `Active ${mins} min${mins === 1 ? '' : 's'} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `Active ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  if (days < 7) {
    return `Active ${days} day${days === 1 ? '' : 's'} ago`;
  }
  return `Active on ${date.toLocaleDateString()}`;
}

export function getSessionDocId(userIdOrEmail: string, deviceId: string): string {
  const cleanUser = userIdOrEmail.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDev = deviceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanUser}_${cleanDev}`;
}

/**
 * Checks device session for the given email atomically using Firestore runTransaction.
 * Key Logic for 2-Device Limit:
 * 1. Read persistent deviceId from localStorage (same across all tabs in the same browser).
 * 2. Send deviceId to backend and check if an active session already exists for this deviceId OR docId.
 * 3. If YES -> reuse/update that existing session (update lastActive timestamp). Multiple open tabs share the SAME session!
 * 4. If NO -> count unique active devices (deduplicated by deviceId). If count >= 2, deny access; otherwise create new session doc.
 */
export async function verifyOrCreateSession(userEmail: string, userUid: string): Promise<{
  allowed: boolean;
  activeSessions?: DeviceSession[];
  currentSessionId?: string;
}> {
  if (!userEmail) return { allowed: true };

  const deviceId = getDeviceId();
  const { deviceType, deviceLabel } = getDeviceInfo();
  const deviceName = deviceLabel;
  const normalizedEmail = userEmail.toLowerCase().trim();
  const docId = getSessionDocId(normalizedEmail, deviceId);

  console.log(`[SessionManager] verifyOrCreateSession starting for user: "${normalizedEmail}", deviceId: "${deviceId}", docId: "${docId}", type: "${deviceType}"`);

  try {
    // Live query for current active sessions belonging to this user (bypassCache = true to get newest state)
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

    console.log(`[SessionManager] Active sessions query result for "${normalizedEmail}": count = ${activeSessions.length}`, activeSessions.map(s => `[id:${s.id}, deviceId:${s.deviceId}, name:${s.deviceLabel || s.deviceName}, type:${s.deviceType || 'unknown'}]`));

    // Rule 4: Check if current deviceId already has an active session doc in Firestore
    const existingCurrentDeviceSession = activeSessions.find(
      s => s.deviceId === deviceId || s.id === docId
    );

    if (existingCurrentDeviceSession) {
      // Current browser/device is ALREADY active! Reuse & update existing session instead of creating a new device entry.
      const targetDocId = existingCurrentDeviceSession.id || docId;
      const sessionRef = doc(db, 'sessions', targetDocId);

      await setDoc(sessionRef, {
        userId: normalizedEmail,
        email: normalizedEmail,
        normalizedEmail: normalizedEmail,
        deviceId,
        deviceName,
        deviceLabel,
        deviceType,
        lastActive: new Date().toISOString()
      }, { merge: true });

      // Clean up any stale duplicate session docs for the exact same deviceId if any exist
      const duplicates = activeSessions.filter(
        s => s.deviceId === deviceId && s.id !== targetDocId
      );
      for (const dup of duplicates) {
        console.log(`[SessionManager] Cleaning up duplicate session doc "${dup.id}" for deviceId "${deviceId}"`);
        try {
          await deleteDoc(doc(db, 'sessions', dup.id));
        } catch (_) {}
      }

      console.log(`[SessionManager] Existing session reused/updated for device "${deviceId}" (docId: "${targetDocId}"). Access ALLOWED.`);
      return { allowed: true, currentSessionId: targetDocId };
    }

    // Rule 5 & 6: Current deviceId is NEW. Count unique active physical devices for this user.
    const uniqueDevicesMap = new Map<string, DeviceSession>();
    for (const session of activeSessions) {
      const devKey = session.deviceId || session.id;
      if (!uniqueDevicesMap.has(devKey)) {
        uniqueDevicesMap.set(devKey, session);
      }
    }
    const uniqueActiveSessions = Array.from(uniqueDevicesMap.values());

    // Enforce 2-device limit based on UNIQUE device IDs, not tabs or login events
    if (uniqueActiveSessions.length >= 2) {
      console.warn(`[SessionManager] Session limit EXCEEDED for "${normalizedEmail}". Unique active devices: ${uniqueActiveSessions.length} >= 2. Access DENIED.`);
      return {
        allowed: false,
        activeSessions: uniqueActiveSessions
      };
    }

    // Atomic creation of new session document for this genuine new device
    const sessionRef = doc(db, 'sessions', docId);
    
    await runTransaction(db, async (transaction) => {
      // Lock existing sessions inside transaction
      for (const s of activeSessions) {
        await transaction.get(doc(db, 'sessions', s.id));
      }

      const nowIso = new Date().toISOString();
      const snap = await transaction.get(sessionRef);
      if (snap.exists()) {
        transaction.update(sessionRef, {
          lastActive: nowIso,
          deviceName,
          deviceLabel,
          deviceType
        });
        return;
      }

      const newSession: DeviceSession = {
        id: docId,
        userId: normalizedEmail,
        email: normalizedEmail,
        normalizedEmail: normalizedEmail,
        deviceId,
        deviceName,
        deviceLabel,
        deviceType,
        loginTime: nowIso,
        createdAt: nowIso,
        lastActive: nowIso
      };

      transaction.set(sessionRef, newSession);
    });

    console.log(`[SessionManager] New device session created for deviceId "${deviceId}" (docId: "${docId}"). Access ALLOWED.`);
    return { allowed: true, currentSessionId: docId };
  } catch (error) {
    console.error("[SessionManager] Error checking/creating session limit:", error);
    handleFirestoreError(error, OperationType.GET, 'sessions');
    return { allowed: false, activeSessions: [] };
  }
}

/**
 * Creates session directly after a remote session was logged out by the user
 */
export async function forceCreateSession(userEmail: string): Promise<string> {
  const deviceId = getDeviceId();
  const { deviceType, deviceLabel } = getDeviceInfo();
  const deviceName = deviceLabel;
  const normalizedEmail = userEmail.toLowerCase().trim();
  const docId = getSessionDocId(normalizedEmail, deviceId);
  const sessionRef = doc(db, 'sessions', docId);

  const nowIso = new Date().toISOString();
  const newSession: DeviceSession = {
    id: docId,
    userId: normalizedEmail,
    email: normalizedEmail,
    normalizedEmail: normalizedEmail,
    deviceId,
    deviceName,
    deviceLabel,
    deviceType,
    loginTime: nowIso,
    createdAt: nowIso,
    lastActive: nowIso
  };

  await setDoc(sessionRef, newSession);
  console.log(`[SessionManager] Force created session docId "${docId}" for device "${deviceLabel}" (${deviceType})`);
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
    const uniqueMap = new Map<string, DeviceSession>();
    querySnap.forEach((docSnap) => {
      const data = docSnap.data() as DeviceSession;
      const sessionObj = { id: docSnap.id, ...data };
      const devKey = data.deviceId || docSnap.id;
      if (!uniqueMap.has(devKey)) {
        uniqueMap.set(devKey, sessionObj);
      }
    });
    return Array.from(uniqueMap.values());
  } catch (error) {
    console.error("[SessionManager] Error fetching user sessions:", error);
    return [];
  }
}
