import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

import { useStorageState } from '@/hooks/use-storage-state';

type SignInPayload = {
  email: string;
  password: string;
};

type SignInResult =
  | { ok: true; session: string }
  | { ok: false; code: 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' };

type SignUpPayload = {
  email: string;
  password: string;
};

type SignUpResult = { ok: true } | { ok: false; code: 'EMAIL_IN_USE' };

type ForgotPasswordResult = { ok: true } | { ok: false; code: 'USER_NOT_FOUND' };

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

type ChangePasswordResult =
  | { ok: true }
  | { ok: false; code: 'NOT_AUTHENTICATED' | 'INVALID_CURRENT_PASSWORD' | 'USER_NOT_FOUND' };

type AuthContextValue = {
  signIn: (payload: SignInPayload) => SignInResult;
  signUp: (payload: SignUpPayload) => SignUpResult;
  forgotPassword: (email: string) => ForgotPasswordResult;
  changePassword: (payload: ChangePasswordPayload) => ChangePasswordResult;
  signOut: () => void;
  session: string | null;
  isLoading: boolean;
};

const DEFAULT_PASSWORDS: Record<string, string> = {};

const AuthContext = createContext<AuthContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState('session');
  const [[isUsersLoading, storedUsers], setStoredUsers] = useStorageState('auth-passwords');

  const passwordByEmail = useMemo<Record<string, string>>(() => {
    if (!storedUsers) {
      return DEFAULT_PASSWORDS;
    }

    try {
      const parsed = JSON.parse(storedUsers) as Record<string, string>;
      return { ...DEFAULT_PASSWORDS, ...parsed };
    } catch {
      return DEFAULT_PASSWORDS;
    }
  }, [storedUsers]);

  const savePasswords = (next: Record<string, string>) => {
    setStoredUsers(JSON.stringify(next));
  };

  const signIn = ({ email, password }: SignInPayload): SignInResult => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!passwordByEmail[normalizedEmail]) {
      return { ok: false, code: 'USER_NOT_FOUND' };
    }

    const expectedPassword = passwordByEmail[normalizedEmail];
    if (!expectedPassword || expectedPassword !== password) {
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }

    const nextSession = `session-${normalizedEmail}`;
    setSession(nextSession);
    return { ok: true, session: nextSession };
  };

  const signUp = ({ email, password }: SignUpPayload): SignUpResult => {
    const normalizedEmail = email.trim().toLowerCase();
    if (passwordByEmail[normalizedEmail]) {
      return { ok: false, code: 'EMAIL_IN_USE' };
    }

    savePasswords({ ...passwordByEmail, [normalizedEmail]: password });
    return { ok: true };
  };

  const forgotPassword = (email: string): ForgotPasswordResult => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!passwordByEmail[normalizedEmail]) {
      return { ok: false, code: 'USER_NOT_FOUND' };
    }

    return { ok: true };
  };

  const changePassword = ({
    currentPassword,
    newPassword,
  }: ChangePasswordPayload): ChangePasswordResult => {
    if (!session) {
      return { ok: false, code: 'NOT_AUTHENTICATED' };
    }

    const email = session.replace('session-', '');
    const expectedPassword = passwordByEmail[email];

    if (!expectedPassword) {
      return { ok: false, code: 'USER_NOT_FOUND' };
    }

    if (expectedPassword !== currentPassword) {
      return { ok: false, code: 'INVALID_CURRENT_PASSWORD' };
    }

    savePasswords({ ...passwordByEmail, [email]: newPassword });
    return { ok: true };
  };

  const signOut = () => {
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signUp,
        forgotPassword,
        changePassword,
        signOut,
        session,
        isLoading: isLoading || isUsersLoading,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useSession must be used within a SessionProvider.');
  }

  return value;
}

