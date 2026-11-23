import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Campaign, Submission, UserWallet } from '../types';
import { authFetch } from '../utils/authFetch';

const ADMIN_EMAIL = 'anglaranni66@gmail.com';

function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      clean[k] = v.filter((item) => item !== undefined);
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      clean[k] = stripUndefined(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function logFirestoreBackupIssue(err: unknown, op: OperationType, path: string) {
  try {
    handleFirestoreError(err, op, path);
  } catch (logged) {
    // Non-fatal: primary API store persists locally; structured error already logged
    console.warn('[FirestoreSync] Backup warning:', logged instanceof Error ? logged.message : logged);
  }
}

export function isFirebaseUserSignedIn(): boolean {
  return Boolean(auth.currentUser);
}

export async function syncCampaignToFirestore(campaign: Campaign): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const path = `campaigns/${campaign.id}`;
  try {
    await setDoc(doc(db, 'campaigns', campaign.id), stripUndefined(campaign), { merge: true });
  } catch (err) {
    logFirestoreBackupIssue(err, OperationType.WRITE, path);
  }
}

export async function syncAllCampaignsToFirestore(campaigns: Campaign[]): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || user.email !== ADMIN_EMAIL) return;
  for (const camp of campaigns) {
    await syncCampaignToFirestore(camp);
  }
}

export async function syncSubmissionToFirestore(submission: Submission): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin && submission.userId !== user.uid) {
    // Demo/non-matching UID cannot write under owner-only Firestore rules
    return;
  }

  const path = `submissions/${submission.id}`;
  try {
    const cleanPayload = stripUndefined({
      ...submission,
      // Ensure rules-compliant initial create defaults if creator is writing
      finalPayout: isAdmin ? submission.finalPayout : 0,
      payoutCredited: isAdmin ? Boolean(submission.payoutCredited) : false,
      status: isAdmin ? submission.status : 'pending',
    });
    await setDoc(doc(db, 'submissions', submission.id), cleanPayload, { merge: true });
  } catch (err) {
    logFirestoreBackupIssue(err, OperationType.WRITE, path);
  }
}

export async function syncUserWalletToFirestore(wallet: UserWallet): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || wallet.id !== user.uid) return;

  const isAdmin = user.email === ADMIN_EMAIL;
  const path = `users/${wallet.id}`;
  const userRef = doc(db, 'users', wallet.id);

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(
        userRef,
        stripUndefined({
          id: wallet.id,
          email: user.email || wallet.email,
          displayName: wallet.displayName || user.displayName || 'Toolpotro Creator',
          role: isAdmin ? 'admin' : 'creator',
          walletProvider: wallet.walletProvider || '',
          walletNumber: wallet.walletNumber || '',
          availableBalance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          createdAt: wallet.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    } else if (isAdmin) {
      await setDoc(userRef, stripUndefined(wallet), { merge: true });
    } else {
      await updateDoc(
        userRef,
        stripUndefined({
          walletProvider: wallet.walletProvider || '',
          walletNumber: wallet.walletNumber || '',
          displayName: wallet.displayName || user.displayName || 'Toolpotro Creator',
          updatedAt: new Date().toISOString(),
        })
      );
    }
  } catch (err) {
    logFirestoreBackupIssue(err, OperationType.WRITE, path);
  }
}

export async function loadFirestoreBackupAndHydrateServer(isAdmin: boolean): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const campaigns: Campaign[] = [];
  const submissions: Submission[] = [];
  const users: UserWallet[] = [];

  try {
    const campSnap = await getDocs(collection(db, 'campaigns'));
    campSnap.forEach((d) => campaigns.push(d.data() as Campaign));
  } catch (err) {
    logFirestoreBackupIssue(err, OperationType.LIST, 'campaigns');
  }

  try {
    const subQuery = isAdmin
      ? collection(db, 'submissions')
      : query(collection(db, 'submissions'), where('userId', '==', user.uid));
    const subSnap = await getDocs(subQuery);
    subSnap.forEach((d) => submissions.push(d.data() as Submission));
  } catch (err) {
    logFirestoreBackupIssue(err, OperationType.LIST, 'submissions');
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      users.push(userDoc.data() as UserWallet);
    }
  } catch (err) {
    logFirestoreBackupIssue(err, OperationType.GET, `users/${user.uid}`);
  }

  if (campaigns.length > 0 || submissions.length > 0 || users.length > 0) {
    try {
      const res = await authFetch('/api/sync/hydrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaigns, submissions, users }),
      });
      if (res.ok) {
        const result = await res.json();
        const hydratedTotal =
          (result.hydrated?.campaigns || 0) +
          (result.hydrated?.submissions || 0) +
          (result.hydrated?.users || 0);
        return hydratedTotal > 0;
      }
    } catch (err) {
      console.warn('[FirestoreSync] Hydration POST failed:', err);
    }
  }

  return false;
}
