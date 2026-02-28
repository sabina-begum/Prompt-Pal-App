import * as React from 'react'
import { Text, View, KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSignUp, useSSO } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { GoogleIcon } from '@/components/GoogleIcon'
import * as WebBrowser from 'expo-web-browser'
import { logger } from '@/lib/logger'
import { getClerkErrorMessage, getOAuthRedirectCandidates } from '@/lib/oauthRedirect'

// Browser warming hook for better OAuth UX
const useWarmUpBrowser = () => {
  React.useEffect(() => {
    void WebBrowser.warmUpAsync().catch(() => undefined)
    return () => {
      void WebBrowser.coolDownAsync().catch(() => undefined)
    }
  }, [])
}

WebBrowser.maybeCompleteAuthSession()

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const { startSSOFlow } = useSSO()
  const router = useRouter()

  useWarmUpBrowser()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [pendingVerification, setPendingVerification] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<{
    email?: string;
    password?: string;
    code?: string;
    general?: string
  }>({})

  // Validate sign-up form
  const validateSignUpForm = () => {
    const newErrors: { email?: string; password?: string } = {}

    if (!emailAddress.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(emailAddress)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required'
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Validate verification form
  const validateVerificationForm = () => {
    const newErrors: { code?: string } = {}

    if (!code.trim()) {
      newErrors.code = 'Verification code is required'
    } else if (code.length !== 6 || !/^\d+$/.test(code)) {
      newErrors.code = 'Please enter a valid 6-digit code'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submission of sign-up form
  const onSignUpPress = async () => {
    if (!isLoaded || isLoading) return

    if (!validateSignUpForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      await signUp.create({
        emailAddress,
        password,
      })

      // Send user an email with verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

      // Set 'pendingVerification' to true to display second form
      // and capture OTP code
      setPendingVerification(true)
    } catch (err) {
      const errorMessage = (err && typeof err === 'object' && 'errors' in err && Array.isArray((err as { errors?: Array<{ message?: string }> }).errors))
        ? (err as { errors: Array<{ message?: string }> }).errors[0]?.message || 'Failed to create account'
        : 'Failed to create account'
      setErrors({ general: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle submission of verification form
  const onVerifyPress = async () => {
    if (!isLoaded || isLoading) return

    if (!validateVerificationForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      // Use the code the user provided to attempt verification
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      })

      // If verification was completed, set the session to active
      // and redirect the user
      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId })
        router.replace('/')
      } else {
        setErrors({ general: 'Verification failed. Please try again.' })
      }
    } catch (err) {
      const errorMessage = (err && typeof err === 'object' && 'errors' in err && Array.isArray((err as { errors?: Array<{ message?: string }> }).errors))
        ? (err as { errors: Array<{ message?: string }> }).errors[0]?.message || 'Verification failed'
        : 'Verification failed'
      setErrors({ general: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle OAuth sign up
  const handleOAuthSignUp = React.useCallback(async (provider: 'google' | 'apple') => {
    if (isOAuthLoading || !startSSOFlow) return

    setIsOAuthLoading(provider)
    setErrors({})

    try {
      const redirectCandidates = getOAuthRedirectCandidates()
      let lastError: unknown = null

      for (const redirectUrl of redirectCandidates) {
        try {
          const ssoAttempt = await startSSOFlow({
            strategy: `oauth_${provider}`,
            redirectUrl,
          })
          const createdSessionId =
            ssoAttempt.createdSessionId ??
            ssoAttempt.signIn?.createdSessionId ??
            ssoAttempt.signUp?.createdSessionId

          if (createdSessionId) {
            await ssoAttempt.setActive?.({ session: createdSessionId })
            router.replace('/')
            return
          }

          const completionStatus = ssoAttempt.signIn?.status || ssoAttempt.signUp?.status
          if (completionStatus) {
            const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)
            lastError = new Error(
              `${providerLabel} authentication did not complete (status: ${completionStatus}).`
            )
            break
          }
        } catch (attemptError) {
          lastError = attemptError
        }
      }

      const fallbackMessage = `Failed to sign up with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
      let errorMessage = getClerkErrorMessage(lastError, fallbackMessage)
      if (errorMessage.includes('Missing external verification redirect URL for SSO flow')) {
        const primaryRedirect = redirectCandidates[0] || 'promptpal://sso-callback'
        const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)
        errorMessage = `${providerLabel} SSO redirect is not configured in Clerk. Add ${primaryRedirect} to Clerk redirect URLs.`
      }

      logger.error('OAuthSignUp', lastError, {
        provider,
        redirectCandidates,
      })

      setErrors({ general: errorMessage })
    } catch (err: any) {
      let errorMessage = getClerkErrorMessage(
        err,
        `Failed to sign up with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
      )
      if (errorMessage.includes('Missing external verification redirect URL for SSO flow')) {
        const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)
        errorMessage = `${providerLabel} SSO redirect is not configured in Clerk for this app build.`
      }
      setErrors({ general: errorMessage })
    } finally {
      setIsOAuthLoading(null)
    }
  }, [startSSOFlow, isOAuthLoading])

  if (pendingVerification) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            showsVerticalScrollIndicator={false}
            className="px-6"
          >
            {/* Header */}
            <View className="items-center mb-10">
              <View className="w-20 h-20 bg-info/10 rounded-[32px] items-center justify-center mb-6 border border-info/20 shadow-lg shadow-info/20">
                <Ionicons name="mail-unread" size={40} color="#4151FF" />
              </View>
              <Text className="text-onSurface text-3xl font-black mb-3 tracking-tight">
                Verify Email
              </Text>
              <Text className="text-onSurfaceVariant text-center text-[10px] font-black uppercase tracking-[2px] leading-4 px-10">
                We've sent a 6-digit code to{'\n'}<Text className="text-onSurface font-black tracking-normal">{emailAddress}</Text>
              </Text>
            </View>

            {/* Verification Form */}
            <View className="bg-surface border border-outline/20 rounded-[40px] p-8 shadow-2xl shadow-black/50 mb-8">
              {errors.general && (
                <View className="bg-error/10 border border-error/30 rounded-2xl p-4 mb-6">
                  <Text className="text-error text-[10px] text-center font-black uppercase tracking-widest">
                    {errors.general}
                  </Text>
                </View>
              )}

              <View className="mb-8">
                <Text className="text-onSurfaceVariant text-[10px] font-black uppercase mb-4 ml-1 tracking-[2px] text-center">Enter 6-Digit Code</Text>
                <View className={`bg-surfaceVariant/50 border ${errors.code ? 'border-error' : 'border-outline/30'} rounded-3xl px-4 py-6 items-center`}>
                  <TextInput
                    className="text-onSurface text-5xl font-black tracking-[12px] text-center w-full"
                    value={code}
                    onChangeText={(text) => {
                      setCode(text.replace(/[^0-9]/g, '').slice(0, 6))
                      if (errors.code) setErrors({ ...errors, code: undefined })
                    }}
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>
                {errors.code && <Text className="text-error text-[10px] mt-2 text-center font-black uppercase tracking-widest">{errors.code}</Text>}
              </View>

              <TouchableOpacity
                onPress={onVerifyPress}
                disabled={isLoading}
                className={`bg-primary h-16 rounded-full items-center justify-center shadow-lg shadow-primary/20 ${isLoading ? 'opacity-70' : ''}`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-black text-lg uppercase tracking-widest">Verify & Join</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPendingVerification(false)}
                className="mt-8 py-2 items-center"
              >
                <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-widest">Back to Sign Up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
          className="px-6"
        >
          {/* Header */}
          <View className="items-center mb-10">
            <View className="flex-row items-center mb-3">
              <Text className="text-primary text-5xl font-black tracking-tighter">Prompt</Text>
              <Text className="text-secondary text-5xl font-black tracking-tighter">Pal</Text>
            </View>
            <Text className="text-onSurfaceVariant text-center text-[10px] font-black uppercase tracking-[3px] leading-4">
              Create an account to start your{'\n'}mastery journey
            </Text>
          </View>

          {/* Sign Up Form */}
          <View className="bg-surface border border-outline/20 rounded-[40px] p-8 shadow-2xl shadow-black/50 mb-8">
            <Text className="text-onSurface text-2xl font-black mb-8 text-center tracking-tight">
              Sign Up
            </Text>

            {errors.general && (
              <View className="bg-error/10 border border-error/30 rounded-2xl p-4 mb-6">
                <Text className="text-error text-[10px] text-center font-black uppercase tracking-widest">
                  {errors.general}
                </Text>
              </View>
            )}

            <View className="space-y-5">
              <View>
                <Text className="text-onSurfaceVariant text-[10px] font-black uppercase mb-2 ml-1 tracking-[2px]">Email Address</Text>
                <View className={`bg-surfaceVariant/50 border ${errors.email ? 'border-error' : 'border-outline/30'} rounded-2xl px-4 py-4 flex-row items-center`}>
                  <Ionicons name="mail-outline" size={20} color={errors.email ? "#EF4444" : "#9CA3AF"} />
                  <TextInput
                    className="flex-1 ml-3 text-onSurface text-base font-bold"
                    value={emailAddress}
                    onChangeText={(text) => {
                      setEmailAddress(text)
                      if (errors.email) setErrors({ ...errors, email: undefined })
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {errors.email && <Text className="text-error text-[10px] mt-1.5 ml-1 font-black uppercase tracking-widest">{errors.email}</Text>}
              </View>

              <View className="mt-4">
                <Text className="text-onSurfaceVariant text-[10px] font-black uppercase mb-2 ml-1 tracking-[2px]">Password</Text>
                <View className={`bg-surfaceVariant/50 border ${errors.password ? 'border-error' : 'border-outline/30'} rounded-2xl px-4 py-4 flex-row items-center`}>
                  <Ionicons name="key-outline" size={20} color={errors.password ? "#EF4444" : "#9CA3AF"} />
                  <TextInput
                    className="flex-1 ml-3 text-onSurface text-base font-bold"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text)
                      if (errors.password) setErrors({ ...errors, password: undefined })
                    }}
                    secureTextEntry
                  />
                </View>
                {errors.password && <Text className="text-error text-[10px] mt-1.5 ml-1 font-black uppercase tracking-widest">{errors.password}</Text>}
              </View>
            </View>

            <View className="bg-surfaceVariant/30 rounded-2xl p-4 mt-6">
              <Text className="text-onSurfaceVariant text-[9px] leading-4 font-black uppercase tracking-[1px]">
                • 8+ characters, uppercase, lowercase, and a number.
              </Text>
            </View>

            {/* OAuth Buttons */}
            <View className="mt-8 space-y-3">
              <View className="flex-row items-center mb-4">
                <View className="flex-1 h-px bg-outline/30" />
                <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-widest mx-4">or continue with</Text>
                <View className="flex-1 h-px bg-outline/30" />
              </View>

              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => handleOAuthSignUp('google')}
                  disabled={!!isOAuthLoading}
                  className={`flex-1 bg-white border border-outline/30 h-16 rounded-2xl items-center justify-center flex-row shadow-lg mx-2 ${isOAuthLoading === 'google' ? 'opacity-70' : ''}`}
                >
                  {isOAuthLoading === 'google' ? (
                    <ActivityIndicator color="#4285F4" size="small" />
                  ) : (
                    <>
                      <GoogleIcon size={20} />
                      <Text className="text-gray-700 font-black text-xs uppercase tracking-widest ml-3">Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleOAuthSignUp('apple')}
                  disabled={!!isOAuthLoading}
                  className={`flex-1 bg-black border border-outline/30 h-16 rounded-2xl items-center justify-center flex-row shadow-lg mx-2 ${isOAuthLoading === 'apple' ? 'opacity-70' : ''}`}
                >
                  {isOAuthLoading === 'apple' ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color="white" />
                      <Text className="text-white font-black text-xs uppercase tracking-widest ml-3">Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={onSignUpPress}
              disabled={isLoading}
              className={`bg-secondary h-16 rounded-full items-center justify-center mt-8 shadow-lg shadow-secondary/20 ${isLoading ? 'opacity-70' : ''}`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-black text-lg uppercase tracking-widest">Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign In Link */}
          <View className="flex-row justify-center items-center mb-10">
            <Text className="text-onSurfaceVariant text-xs font-black uppercase tracking-widest">
              Already have an account?
            </Text>
            <Link href="/(auth)/sign-in" className="ml-2">
              <Text className="text-secondary text-xs font-black uppercase tracking-widest">
                Sign In
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
