'use client';

import * as React from 'react';

import type { User } from '@/types/user';
import { authClient } from '@/lib/auth/client';
import { logger } from '@/lib/default-logger';

export interface UserContextValue {
  user: User | null;
  error: string | null;
  isLoading: boolean;
  checkSession?: () => Promise<void>;
}

export const UserContext = React.createContext<UserContextValue | undefined>(undefined);

export interface UserProviderProps {
  children: React.ReactNode;
}

export function UserProvider({ children }: UserProviderProps): React.JSX.Element {
  const [state, setState] = React.useState<{ user: User | null; error: string | null; isLoading: boolean }>({
    user: null,
    error: null,
    isLoading: true,
  });
  const [isChecking, setIsChecking] = React.useState(false);

  const checkSession = React.useCallback(async (): Promise<void> => {
    // Prevent multiple simultaneous checks
    if (isChecking) {
      return;
    }
    
    setIsChecking(true);
    
    try {
      const { data, error } = await authClient.getUser();

      if (error) {
        logger.error(error);
        // Only clear token on 401 Unauthorized (invalid/expired token)
        // Don't clear on network errors or rate limiting (429)
        if (error.includes('401') || error.includes('Unauthorized') || error.includes('Invalid token')) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('custom-auth-token');
          }
          setState((prev) => ({ ...prev, user: null, error: 'Session expired', isLoading: false }));
        } else {
          // For other errors (rate limit, network), keep trying but show error
          setState((prev) => ({ ...prev, user: null, error: null, isLoading: false }));
        }
        setIsChecking(false);
        return;
      }

      setState((prev) => ({ ...prev, user: data ?? null, error: null, isLoading: false }));
      setIsChecking(false);
    } catch (error) {
      logger.error(error);
      // Don't clear token on network errors - just set loading to false
      setState((prev) => ({ ...prev, user: null, error: null, isLoading: false }));
      setIsChecking(false);
    }
  }, [isChecking]);

  React.useEffect(() => {
    checkSession().catch((error) => {
      logger.error(error);
      // noop
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Expected
  }, []);

  return <UserContext.Provider value={{ ...state, checkSession }}>{children}</UserContext.Provider>;
}

export const UserConsumer = UserContext.Consumer;
