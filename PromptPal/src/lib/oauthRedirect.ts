import * as AuthSession from 'expo-auth-session'

interface ClerkErrorShape {
  message?: string
  errors?: Array<{
    message?: string
    longMessage?: string
  }>
}

/**
 * Provide a prioritized set of native redirect URLs for Clerk SSO.
 * Some provider/dashboard setups only allow one callback shape.
 */
export function getOAuthRedirectCandidates(): string[] {
  const dynamicCandidates = [
    AuthSession.makeRedirectUri({
      scheme: 'promptpal',
      path: 'sso-callback',
    }),
    AuthSession.makeRedirectUri({
      scheme: 'promptpal',
      path: 'oauth-native-callback',
    }),
  ]

  const envOverride = process.env.EXPO_PUBLIC_CLERK_OAUTH_REDIRECT_URL?.trim()

  const candidates = [
    envOverride,
    ...dynamicCandidates,
  ].filter((value): value is string => Boolean(value))

  return Array.from(new Set(candidates))
}

/**
 * Clerk errors can appear in multiple shapes. Return a useful user-facing message.
 */
export function getClerkErrorMessage(error: unknown, fallbackMessage: string): string {
  if (!error || typeof error !== 'object') {
    return fallbackMessage
  }

  const clerkError = error as ClerkErrorShape
  const firstError = clerkError.errors?.[0]

  return firstError?.longMessage || firstError?.message || clerkError.message || fallbackMessage
}
