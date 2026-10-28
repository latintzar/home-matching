"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowRight, CheckCircle2, Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  signInWithMagicLink, 
  signInWithGoogle, 
  signInWithApple,
  signInAsTestUser 
} from "@/lib/supabase-browser";

// Icons for OAuth providers
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const errorParam = searchParams.get("error");
  
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(errorParam);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [testAuthLoading, setTestAuthLoading] = useState<string | null>(null);
  const [resetOnboarding, setResetOnboarding] = useState(false);

  // Check if test auth is enabled
  const isTestAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === "true";

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    const { error } = await signInWithGoogle(redirectTo);
    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
    // Redirect happens automatically
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    const { error } = await signInWithApple(redirectTo);
    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
    // Redirect happens automatically
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await signInWithMagicLink(
      email,
      `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
    );

    setIsLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setIsSent(true);
  };

  const handleTestLogin = async (persona: 'renter' | 'buyer' | 'pro') => {
    setTestAuthLoading(persona);
    setError(null);
    
    try {
      const { error } = await signInAsTestUser(persona, resetOnboarding);
      
      if (error) {
        setError(error.message);
        setTestAuthLoading(null);
        return;
      }

      // Redirect based on persona
      const targetPath = persona === 'pro' ? '/pro' : '/dashboard';
      router.push(targetPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test login failed');
      setTestAuthLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link 
          href="/"
          className="font-serif text-xl font-medium tracking-tight text-stone-900 hover:text-stone-600 transition-colors"
        >
          Leo.casa
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {!isSent ? (
            <>
              {/* Sign in heading */}
              <div className="text-center mb-8">
                <h1 className="font-serif text-3xl md:text-4xl font-medium text-stone-900 mb-3">
                  Bienvenido a Leo
                </h1>
                <p className="text-stone-600">
                  Tu asistente de vivienda en España
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* OAuth buttons */}
              <div className="space-y-3 mb-6">
                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full h-14 rounded-2xl bg-white border border-stone-200 text-stone-900 hover:bg-stone-50 text-base font-medium transition-all flex items-center justify-center gap-3"
                >
                  <GoogleIcon className="w-5 h-5" />
                  Continuar con Google
                </Button>

                <Button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={isLoading}
                  className="w-full h-14 rounded-2xl bg-black text-white hover:bg-stone-800 text-base font-medium transition-all flex items-center justify-center gap-3"
                >
                  <AppleIcon className="w-5 h-5" />
                  Continuar con Apple
                </Button>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-[#FDFBF7] px-4 text-stone-500">o</span>
                </div>
              </div>

              {/* Magic link option */}
              {!showEmailForm ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEmailForm(true)}
                  className="w-full h-14 rounded-2xl border-stone-200 text-stone-700 hover:bg-stone-50 text-base font-medium transition-all flex items-center justify-center gap-3"
                >
                  <Mail className="w-5 h-5" />
                  Continuar con Email
                </Button>
              ) : (
                <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <Input
                      type="email"
                      placeholder="operator@example.invalid"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-14 pl-12 pr-4 rounded-2xl border-stone-200 bg-white text-base focus:border-stone-400 focus:ring-stone-400"
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !email}
                    className="w-full h-14 rounded-2xl bg-stone-900 text-white hover:bg-stone-800 text-base font-medium transition-all"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Enviar enlace mágico
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="w-full text-sm text-stone-500 hover:text-stone-700"
                  >
                    Volver a opciones de inicio
                  </button>
                </form>
              )}

              {/* Terms */}
              <p className="mt-6 text-center text-sm text-stone-500">
                Al continuar, aceptas nuestros{" "}
                <Link href="/terms" className="underline hover:text-stone-700">
                  términos de servicio
                </Link>{" "}
                y{" "}
                <Link href="/privacy" className="underline hover:text-stone-700">
                  política de privacidad
                </Link>
              </p>

              {/* Test Auth Panel (Dev Only) */}
              {isTestAuthEnabled && (
                <div className="mt-8 pt-6 border-t border-dashed border-amber-300">
                  <div className="flex items-center gap-2 mb-4">
                    <FlaskConical className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">Test Mode (Dev Only)</span>
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestLogin('renter')}
                      disabled={testAuthLoading !== null}
                      className="flex-1 rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      {testAuthLoading === 'renter' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        '👤 Renter'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestLogin('buyer')}
                      disabled={testAuthLoading !== null}
                      className="flex-1 rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      {testAuthLoading === 'buyer' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        '🏠 Buyer'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestLogin('pro')}
                      disabled={testAuthLoading !== null}
                      className="flex-1 rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      {testAuthLoading === 'pro' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        '💼 Pro'
                      )}
                    </Button>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-amber-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetOnboarding}
                      onChange={(e) => setResetOnboarding(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    Start fresh (reset onboarding)
                  </label>
                </div>
              )}
            </>
          ) : (
            /* Success state */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              
              <h1 className="font-serif text-3xl font-medium text-stone-900 mb-3">
                ¡Revisa tu email!
              </h1>
              
              <p className="text-stone-600 mb-6">
                Hemos enviado un enlace mágico a{" "}
                <span className="font-medium text-stone-900">{email}</span>
              </p>
              
              <div className="bg-stone-100 rounded-2xl p-6 text-left">
                <p className="text-sm text-stone-600 mb-4">
                  <strong className="text-stone-900">¿No lo ves?</strong> Revisa tu carpeta de spam o promociones.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsSent(false)}
                  className="rounded-full border-stone-200"
                >
                  Usar otro email
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-stone-500">
        © 2025 Leo.casa
      </footer>
    </div>
  );
}

// Loading fallback for Suspense
function SignInLoading() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
    </div>
  );
}

// Main export with Suspense boundary for useSearchParams
export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInContent />
    </Suspense>
  );
}
