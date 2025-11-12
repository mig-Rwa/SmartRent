'use client';

import type { User } from '@/types/user';

function generateToken(): string {
  const arr = new Uint8Array(12);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (v) => v.toString(16).padStart(2, '0')).join('');
}

// Sample user for development (not used in production)
const sampleUser: User = {
  id: 'USR-000',
  username: 'sofia_rivers',
  email: 'sofia@devias.io',
  role: 'tenant',
  first_name: 'Sofia',
  last_name: 'Rivers',
  phone: '555-0100',
  avatar_url: '/assets/avatar.png',
  name: 'Sofia Rivers',
  avatar: '/assets/avatar.png',
};

export interface SignUpParams {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: 'landlord' | 'tenant';
}

export interface SignInWithOAuthParams {
  provider: 'google' | 'discord';
}

export interface SignInWithPasswordParams {
  email: string;
  password: string;
}

export interface ResetPasswordParams {
  email: string;
}

// Helper to get JWT token from localStorage
function getAuthHeader(): HeadersInit {
  const token = localStorage.getItem('custom-auth-token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

class AuthClient {
  async signUp(params: SignUpParams): Promise<{ error?: string }> {
    const { username, firstName, lastName, email, password, phone, role } = params;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          phone: phone || undefined,
          role,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.data.token) {
        localStorage.setItem('custom-auth-token', data.data.token);
        // Store user data including role
        localStorage.setItem('user-role', data.data.user.role);
        localStorage.setItem('user-data', JSON.stringify(data.data.user));
        return {};
      } else {
        return { error: data.message || 'Registration failed' };
      }
    } catch (err: any) {
      return { error: err.message || 'Network error' };
    }
  }

  async signInWithOAuth(_: SignInWithOAuthParams): Promise<{ error?: string }> {
    return { error: 'Social authentication not implemented' };
  }

  async signInWithPassword(params: SignInWithPasswordParams): Promise<{ error?: string }> {
    const { email, password } = params;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.data.token) {
        localStorage.setItem('custom-auth-token', data.data.token);
        // Store user data including role
        localStorage.setItem('user-role', data.data.user.role);
        localStorage.setItem('user-data', JSON.stringify(data.data.user));
        return {};
      } else {
        return { error: data.message || 'Invalid email or password' };
      }
    } catch (err: any) {
      return { error: err.message || 'Network error' };
    }
  }

  async resetPassword(_: ResetPasswordParams): Promise<{ error?: string }> {
    return { error: 'Password reset not implemented' };
  }

  async updatePassword(_: ResetPasswordParams): Promise<{ error?: string }> {
    return { error: 'Update reset not implemented' };
  }

  async getUser(): Promise<{ data?: User | null; error?: string }> {
    const token = localStorage.getItem('custom-auth-token');
    if (!token) {
      return { data: null };
    }
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        } as HeadersInit,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.data) {
        // Transform backend user format to frontend User type
        const backendUser = data.data;
        const user: User = {
          id: String(backendUser.id),
          username: backendUser.username,
          email: backendUser.email,
          role: backendUser.role,
          first_name: backendUser.first_name,
          last_name: backendUser.last_name,
          phone: backendUser.phone,
          avatar_url: backendUser.avatar_url,
          created_at: backendUser.created_at,
          // Computed fields for backwards compatibility
          name: `${backendUser.first_name} ${backendUser.last_name}`.trim(),
          avatar: backendUser.avatar_url,
        };
        return { data: user };
      } else if (res.status === 401) {
        // Not authenticated, but not a fatal error
        return { data: null };
      } else {
        return { data: null, error: data.message || 'Not authenticated' };
      }
    } catch (err: any) {
      return { data: null, error: err.message || 'Network error' };
    }
  }

  async signOut(): Promise<{ error?: string }> {
    localStorage.removeItem('custom-auth-token');
    localStorage.removeItem('user-role');
    localStorage.removeItem('user-data');

    return {};
  }
}

export const authClient = new AuthClient();
