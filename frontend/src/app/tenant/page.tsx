'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { logger } from '@/lib/default-logger';

export default function Page(): React.JSX.Element {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      logger.debug('[Tenant Page] Logging out...');
      
      // Sign out from Firebase
      await authClient.signOut();
      
      // Clear all localStorage items
      localStorage.removeItem('custom-auth-token');
      localStorage.removeItem('user-role');
      localStorage.removeItem('user-data');
      localStorage.removeItem('authToken');
      
      logger.debug('[Tenant Page] Logout successful, redirecting to sign-in');
      
      // Redirect to sign-in page
      router.push('/auth/sign-in');
    } catch (error) {
      logger.error('[Tenant Page] Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Tenant Dashboard (Coming Soon)
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 3 }}>
        The tenant interface is not yet implemented. You are currently logged in as a tenant.
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        To access the landlord dashboard:
      </Typography>
      
      <ol>
        <li>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Click the logout button below to clear your session
          </Typography>
        </li>
        <li>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Go to Sign Up and create a new account with role "Landlord"
          </Typography>
        </li>
        <li>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Sign in with your landlord account
          </Typography>
        </li>
      </ol>

      <Button 
        variant="contained" 
        color="error" 
        onClick={handleLogout} 
        disabled={isLoggingOut}
        sx={{ mt: 2 }}
      >
        {isLoggingOut ? 'Logging out...' : 'Logout & Clear Session'}
      </Button>
    </Box>
  );
}
