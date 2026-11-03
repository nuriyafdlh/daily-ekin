import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore/lite';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppState, UserProfile, RhkItem, LogItem } from '../types';
import { waitForCloudSave } from '../utils/cloudRequest';

// One-shot backups use HTTP directly, without a persistent streaming connection
// or an offline write queue that can leave the save button waiting indefinitely.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const configAny = firebaseConfig as Record<string, any>;
export const db = configAny.firestoreDatabaseId
  ? getFirestore(app, configAny.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Google Auth Provider with Google Drive file scope
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory token cache (DO NOT store in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface CloudBackupItem {
  id: string;
  userId: string;
  label: string;
  createdAt: string;
  totalRhk: number;
  totalKegiatan: number;
  profile: UserProfile;
  rhk: RhkItem[];
  log: LogItem[];
  ringkas: Record<string, string[]>;
}

/**
 * Test connection to Firestore on boot
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    await getDoc(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore is offline.');
      return false;
    }
    return true;
  }
};

/**
 * Initialize Auth state listener
 */
export const initAuth = (
  onAuthSuccess?: (user: User, accessToken: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google Popup
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string | null }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory cached access token for Google Drive APIs
 */
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Sign out
 */
export const logOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Save current active state to cloud Firestore
 */
export const saveStateToCloud = async (
  state: AppState
): Promise<{ success: boolean; updatedAt: string }> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Silakan masuk dengan akun Google terlebih dahulu untuk menyinkronkan data ke cloud.');
  }

  const now = new Date().toISOString();
  const docRef = doc(db, 'cloud_state', user.uid);

  await waitForCloudSave(setDoc(
    docRef,
    {
      userId: user.uid,
      userEmail: user.email || '',
      updatedAt: now,
      totalRhk: state.rhk.length,
      totalKegiatan: state.log.length,
      profile: state.prof,
      rhk: state.rhk,
      log: state.log,
      ringkas: state.ringkas || {},
    },
    { merge: true }
  ));

  return { success: true, updatedAt: now };
};

/**
 * Create a named historical backup snapshot in Firestore
 */
export const createCloudBackupSnapshot = async (
  state: AppState,
  label?: string
): Promise<{ success: boolean; backupId: string; createdAt: string }> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Silakan masuk dengan akun Google untuk membuat titik cadangan di cloud.');
  }

  const now = new Date().toISOString();
  const backupId = 'bak_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const backupDocRef = doc(db, 'backups', backupId);

  await waitForCloudSave(setDoc(backupDocRef, {
    id: backupId,
    userId: user.uid,
    userEmail: user.email || '',
    label:
      label ||
      `Cadangan Kinerja - ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`,
    createdAt: now,
    totalRhk: state.rhk.length,
    totalKegiatan: state.log.length,
    profile: state.prof,
    rhk: state.rhk,
    log: state.log,
    ringkas: state.ringkas || {},
  }));

  return { success: true, backupId, createdAt: now };
};

/**
 * Load latest state from cloud Firestore
 */
export const loadStateFromCloud = async (): Promise<AppState | null> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Silakan masuk dengan akun Google terlebih dahulu.');
  }

  const docRef = doc(db, 'cloud_state', user.uid);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    prof: data.profile || {
      nama: user.displayName || 'Pegawai ASN',
      nip: '',
      pangkatGol: '',
      jabatan: '',
      unitKerja: '',
      instansi: '',
      atasanNama: '',
      atasanNip: '',
      atasanJabatan: '',
    },
    rhk: Array.isArray(data.rhk) ? data.rhk : [],
    log: Array.isArray(data.log) ? data.log : [],
    ringkas: data.ringkas || {},
    theme: 'system',
  };
};

/**
 * Fetch list of user's backup snapshots from Firestore
 */
export const fetchUserBackups = async (): Promise<CloudBackupItem[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  const backupsRef = collection(db, 'backups');
  const q = query(backupsRef, where('userId', '==', user.uid));
  const querySnapshot = await getDocs(q);

  const list: CloudBackupItem[] = [];
  querySnapshot.forEach((docSnap) => {
    const d = docSnap.data();
    list.push({
      id: d.id || docSnap.id,
      userId: d.userId,
      label: d.label || 'Cadangan',
      createdAt: d.createdAt,
      totalRhk: d.totalRhk || (Array.isArray(d.rhk) ? d.rhk.length : 0),
      totalKegiatan: d.totalKegiatan || (Array.isArray(d.log) ? d.log.length : 0),
      profile: d.profile,
      rhk: d.rhk || [],
      log: d.log || [],
      ringkas: d.ringkas || {},
    });
  });

  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/**
 * Delete a backup snapshot
 */
export const deleteCloudBackupDoc = async (backupId: string): Promise<boolean> => {
  const docRef = doc(db, 'backups', backupId);
  await deleteDoc(docRef);
  return true;
};
