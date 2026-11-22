import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { isAdminRole, isSuperAdminEmail } from '../constants/auth';
import { AlertCircle, LogIn, RefreshCw, X } from 'lucide-react';

interface AuthErrorState {
  code?: string;
  title: string;
  message: string;
  domain?: string;
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  signingIn: boolean;
  isAdmin: boolean;
  authError: AuthErrorState | null;
  clearAuthError: () => void;
  loginWithGoogle: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatFirebaseAuthError = (error: any): AuthErrorState => {
  const code = error?.code || '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  switch (code) {
    case 'auth/popup-blocked':
      return {
        code,
        title: 'Sign-In Popup Was Blocked',
        message:
          'Your browser blocked the Google sign-in window. Please allow popups for this site and click Try Again.',
      };
    case 'auth/popup-closed-by-user':
      return {
        code,
        title: 'Sign-In Cancelled',
        message: 'The Google sign-in window was closed before completing login. Click below to try again.',
      };
    case 'auth/cancelled-popup-request':
      return {
        code,
        title: 'Sign-In Already Open',
        message: 'Another sign-in window is already open or was superseded. Please wait a moment and try again.',
      };
    case 'auth/unauthorized-domain':
      return {
        code,
        title: 'Domain Not Authorized in Firebase',
        message: `This domain ("${hostname}") is not yet listed under Authorized Domains in Firebase Authentication settings. Add "${hostname}" in Firebase Console -> Authentication -> Settings -> Authorized domains.`,
        domain: hostname,
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        title: 'Google Sign-In Disabled',
        message:
          'Google Sign-In provider is not enabled in Firebase Authentication. Enable Google in Firebase Console -> Authentication -> Sign-in method.',
      };
    case 'auth/network-request-failed':
      return {
        code,
        title: 'Network Connection Error',
        message: 'Unable to reach Firebase Authentication. Check your internet connection and try again.',
      };
    default:
      return {
        code,
        title: 'Authentication Error',
        message: error?.message || 'Unable to sign in right now. Please try again.',
      };
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorState | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
        return;
      }

      const emailLower = (u.email || '').trim().toLowerCase();
      const superAdminMatch = isSuperAdminEmail(emailLower);

      try {
        const userDocRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userDocRef);

        if (superAdminMatch) {
          if (!userSnap.exists() || userSnap.data()?.role !== 'super_admin') {
            await setDoc(
              userDocRef,
              {
                uid: u.uid,
                email: emailLower,
                displayName: u.displayName || emailLower.split('@')[0],
                photoURL: u.photoURL || '',
                role: 'super_admin',
                createdAt: userSnap.exists()
                  ? userSnap.data()?.createdAt || new Date().toISOString()
                  : new Date().toISOString(),
              },
              { merge: true }
            );
          }
          setRole('super_admin');
          setLoading(false);
          return;
        }

        // Check if this email has an active staff invite
        let invitedRole: string | null = null;
        if (emailLower) {
          try {
            const inviteRef = doc(db, 'staff_invites', emailLower);
            const inviteSnap = await getDoc(inviteRef);
            if (inviteSnap.exists()) {
              invitedRole = inviteSnap.data()?.role || null;
            }
          } catch (inviteErr) {
            console.warn('Staff invite lookup skipped:', inviteErr);
          }
        }

        if (userSnap.exists()) {
          const existingRole = userSnap.data()?.role || 'user';
          if (invitedRole && invitedRole !== existingRole && !isAdminRole(existingRole)) {
            await setDoc(
              userDocRef,
              {
                role: invitedRole,
                displayName: u.displayName || userSnap.data()?.displayName || emailLower.split('@')[0],
                photoURL: u.photoURL || userSnap.data()?.photoURL || '',
              },
              { merge: true }
            );
            setRole(invitedRole);
          } else {
            setRole(existingRole);
          }
        } else {
          const resolvedRole = invitedRole || 'user';
          await setDoc(userDocRef, {
            uid: u.uid,
            email: emailLower,
            displayName: u.displayName || emailLower.split('@')[0],
            photoURL: u.photoURL || '',
            role: resolvedRole,
            createdAt: new Date().toISOString(),
          });
          setRole(resolvedRole);
        }
      } catch (err) {
        console.error('Failed to resolve user profile/role:', err);
        setRole(superAdminMatch ? 'super_admin' : 'user');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (): Promise<boolean> => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      return true;
    } catch (error: any) {
      console.error('Google Sign-In failed:', error);
      setAuthError(formatFirebaseAuthError(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signingIn,
        isAdmin: isAdminRole(role) || isSuperAdminEmail(user?.email),
        authError,
        clearAuthError,
        loginWithGoogle,
        signOutUser,
      }}
    >
      {children}

      {authError && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={clearAuthError} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-6 bg-[#0B3C5D] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-[#EAB308]" size={24} />
                <h3 className="font-black text-lg">{authError.title}</h3>
              </div>
              <button onClick={clearAuthError} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-600 leading-relaxed">{authError.message}</p>
              {authError.domain && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 font-mono text-xs text-[#0B3C5D] break-all">
                  {authError.domain}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={clearAuthError}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-200 font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => loginWithGoogle()}
                  disabled={signingIn}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#0B3C5D] text-white font-bold text-sm hover:bg-[#1F7A8C] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {signingIn ? <RefreshCw size={16} className="animate-spin" /> : <LogIn size={16} />}
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
