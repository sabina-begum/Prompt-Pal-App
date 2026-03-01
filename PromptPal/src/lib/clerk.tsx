import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from './auth';
import { logger } from './logger';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey || publishableKey === 'your_clerk_publishable_key_here') {
  logger.warn('Clerk', 'Invalid or missing Clerk publishable key. Authentication will not work. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env file.');
}

export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  if (!publishableKey || publishableKey === 'your_clerk_publishable_key_here') {
    logger.warn('Clerk', 'Clerk not configured - wrapping children without authentication');
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      {children}
    </ClerkProvider>
  );
}

export { useAuth };
