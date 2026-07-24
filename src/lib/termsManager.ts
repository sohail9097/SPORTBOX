import { db, doc, getDoc, setDoc, collection, query, where, getDocs, handleFirestoreError, OperationType } from './firebase';
import { CURRENT_TERMS_VERSION } from '../config/termsConfig';

export interface TermsAcceptanceRecord {
  id?: string;
  userId: string;
  acceptedAt: string;
  version: string;
}

export function getTermsDocId(email: string, version: string = CURRENT_TERMS_VERSION): string {
  const normalized = email.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanVer = version.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${normalized}_v${cleanVer}`;
}

/**
 * Checks Firestore to see if an email address has accepted the specified terms version.
 */
export async function checkHasAcceptedTerms(email: string, version: string = CURRENT_TERMS_VERSION): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const normalized = email.toLowerCase().trim();

  try {
    const docId = getTermsDocId(normalized, version);
    const docRef = doc(db, 'termsAcceptance', docId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.version === version) {
        console.log(`[TermsManager] Terms v${version} accepted record FOUND for "${normalized}" (docId: ${docId})`);
        return true;
      }
    }

    const q = query(
      collection(db, 'termsAcceptance'),
      where('userId', '==', normalized),
      where('version', '==', version)
    );
    const querySnap = await getDocs(q, { bypassCache: true });

    if (!querySnap.empty) {
      console.log(`[TermsManager] Terms v${version} accepted record FOUND via query for "${normalized}"`);
      return true;
    }

    console.log(`[TermsManager] Terms v${version} accepted record NOT found for "${normalized}". Needs acceptance.`);
    return false;
  } catch (err) {
    console.warn('[TermsManager] Error checking terms acceptance in Firestore:', err);
    return false;
  }
}

/**
 * Records acceptance of current terms version for an email address in Firestore.
 */
export async function recordTermsAcceptance(email: string, version: string = CURRENT_TERMS_VERSION): Promise<void> {
  if (!email || !email.trim()) return;
  const normalized = email.toLowerCase().trim();
  const docId = getTermsDocId(normalized, version);
  const docRef = doc(db, 'termsAcceptance', docId);

  const record: TermsAcceptanceRecord = {
    userId: normalized,
    acceptedAt: new Date().toISOString(),
    version: version
  };

  try {
    await setDoc(docRef, record, { merge: true });
    console.log(`[TermsManager] Successfully recorded terms acceptance v${version} for "${normalized}"`);
  } catch (err) {
    console.error(`[TermsManager] Failed to record terms acceptance for "${normalized}":`, err);
    handleFirestoreError(err, OperationType.WRITE, `termsAcceptance/${docId}`);
  }
}
