export interface User {
  id: string;
  username: string;
  email: string;
  role: 'landlord' | 'tenant';
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  created_at?: string;

  // Computed properties for backwards compatibility
  name?: string; // Will be computed from first_name + last_name
  avatar?: string; // Alias for avatar_url

  [key: string]: unknown;
}
