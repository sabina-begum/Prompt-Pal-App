import { useSignIn, useSSO } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import { Text, View, KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React, { useState, useCallback, useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { GoogleIcon } from '@/components/GoogleIcon'
import * as WebBrowser from 'expo-web-browser'
import { logger } from '@/lib/logger'
import { getClerkErrorMessage, getOAuthRedirectCandidates } from '@/lib/oauthRedirect'

// Browser warming hook for better OAuth UX
const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync().catch(() => undefined)
    return () => {
      void WebBrowser.coolDownAsync().catch(() => undefined)
    }
  }, [])
}

WebBrowser.maybeCompleteAuthSession()

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { startSSOFlow } = useSSO()
  const router = useRouter()

  useWarmUpBrowser()

  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})

  // Validate form inputs
  const validateForm = () => {
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
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle the submission of the sign-in form
  const onSignInPress = async () => {
    if (!isLoaded || isLoading) return

    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      })

      // If sign-in process is complete, set the created session as active
      // and redirect the user
      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId })
        router.replace('/')
      } else {
        // If the status isn't complete, check why. User might need to
        // complete further steps.
        setErrors({ general: 'Sign in failed. Please try again.' })
      }
    } catch (err) {
      // Use generic error message to prevent user enumeration attacks
      // Don't expose whether email exists or if password is wrong
      logger.error('SignIn', err, { email: emailAddress })
      setErrors({ general: 'Invalid email or password. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle OAuth sign in
  const handleOAuthSignIn = useCallback(async (provider: 'google' | 'apple') => {
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

      const fallbackMessage = `Failed to sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
      let errorMessage = getClerkErrorMessage(lastError, fallbackMessage)
      if (errorMessage.includes('Missing external verification redirect URL for SSO flow')) {
        const primaryRedirect = redirectCandidates[0] || 'promptpal://sso-callback'
        const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)
        errorMessage = `${providerLabel} SSO redirect is not configured in Clerk. Add ${primaryRedirect} to Clerk redirect URLs.`
      }

      logger.error('OAuthSignIn', lastError, {
        provider,
        redirectCandidates,
      })
      setErrors({ general: errorMessage })
    } catch (err: any) {
      let errorMessage = getClerkErrorMessage(
        err,
        `Failed to sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
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
              Enter your credentials to continue{'\n'}your engineering journey
            </Text>
          </View>

          {/* Sign In Form */}
          <View className="bg-surface border border-outline/20 rounded-[40px] p-8 shadow-2xl shadow-black/50 mb-8">
            <Text className="text-onSurface text-2xl font-black mb-8 text-center tracking-tight">
              Welcome Back
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

            {/* OAuth Buttons */}
            <View className="mt-8 space-y-3">
              <View className="flex-row items-center mb-4">
                <View className="flex-1 h-px bg-outline/30" />
                <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-widest mx-4">or continue with</Text>
                <View className="flex-1 h-px bg-outline/30" />
              </View>

              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => handleOAuthSignIn('google')}
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
                  onPress={() => handleOAuthSignIn('apple')}
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
              onPress={onSignInPress}
              disabled={isLoading}
              className={`bg-primary h-16 rounded-full items-center justify-center mt-8 shadow-lg shadow-primary/20 ${isLoading ? 'opacity-70' : ''}`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-black text-lg uppercase tracking-widest">Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity className="mt-6 self-center">
              <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-widest">Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <View className="flex-row justify-center items-center mb-10">
            <Text className="text-onSurfaceVariant text-xs font-black uppercase tracking-widest">
              Don't have an account?
            </Text>
            <Link href="/(auth)/sign-up" className="ml-2">
              <Text className="text-primary text-xs font-black uppercase tracking-widest">
                Create Account
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
