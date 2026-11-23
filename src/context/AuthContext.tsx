import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { UserWallet } from '../types';
import {
  loadFirestoreBackupAndHydrateServer,
  syncUserWalletToFirestore,
} from '../services/firestoreSync';
import { authFetch } from '../utils/authFetch';

interface AuthContextType {
  currentUser: User | null;
  wallet: UserWallet | null;
  isAdmin: boolean;
  isLoading: boolean;
  authError: string | null;
  hydrationVersion: number;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  updateWalletBinding: (provider: 'bKash' | 'Nagad', number: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'anglaranni66@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hydrationVersion, setHydrationVersion] = useState(0);

  const fetchWallet = async (uid: string, email: string, name?: string) => {
    try {
      const res = await authFetch(`/api/users/${uid}?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data: UserWallet = await res.json();
        if (name && !data.displayName) {
          data.displayName = name;
        }
        setWallet(data);
        if (auth.currentUser && auth.currentUser.uid === uid) {
          void syncUserWalletToFirestore(data);
        }
      }
    } catch (err) {
      console.error('Failed to load wallet:', err);
    }
  };

  const hydrateFromFirestore = async (user: User) => {
    const isAdminEmail = Boolean(user.emailVerified && user.email?.toLowerCase() === ADMIN_EMAIL);
    const restored = await loadFirestoreBackupAndHydrateServer(isAdminEmail);
    if (restored) {
      setHydrationVersion((v) => v + 1);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setAuthError(null);
        await hydrateFromFirestore(user);
        await fetchWallet(user.uid, user.email || '', user.displayName || undefined);
      } else {
        setCurrentUser(null);
        setWallet(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const res = await signInWithPopup(auth, googleProvider);
      setCurrentUser(res.user);
      await hydrateFromFirestore(res.user);
      await fetchWallet(res.user.uid, res.user.email || '', res.user.displayName || undefined);
    } catch (err: any) {
      console.warn('Google sign-in error:', err?.message || err);
      setAuthError('Google লগইন পপআপ সম্পন্ন হয়নি। অনুগ্রহ করে পপআপ ব্লকার বন্ধ করে আবার চেষ্টা করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setWallet(null);
    setAuthError(null);
  };

  const refreshWallet = async () => {
    if (!currentUser) return;
    await fetchWallet(
      currentUser.uid,
      currentUser.email || '',
      currentUser.displayName || wallet?.displayName
    );
  };

  const updateWalletBinding = async (provider: 'bKash' | 'Nagad', number: string): Promise<boolean> => {
    if (!currentUser) {
      setAuthError('ওয়ালেট যুক্ত করতে আগে Google দিয়ে লগইন করুন।');
      return false;
    }
    try {
      const res = await authFetch('/api/wallet/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletProvider: provider,
          walletNumber: number,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshWallet();
        return true;
      }
      console.error('Wallet bind error:', data.error || 'Failed to update wallet number');
      return false;
    } catch (err) {
      console.error('Wallet bind error:', err);
      return false;
    }
  };

  const isAdmin = Boolean(
    currentUser?.emailVerified && currentUser.email?.toLowerCase() === ADMIN_EMAIL
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        wallet,
        isAdmin,
        isLoading,
        authError,
        hydrationVersion,
        loginWithGoogle,
        logout,
        refreshWallet,
        updateWalletBinding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
