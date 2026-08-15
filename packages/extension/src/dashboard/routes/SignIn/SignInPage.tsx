import { useState } from 'react';
import { Sparkles, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@refloop/ui';
import { signIn } from '../../services/appService';

export function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 mb-4">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Welcome to RefLoop</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
            Your personal LinkedIn & Email referral outreach tracker.
          </p>
        </div>

        <div className="space-y-3 mb-8 bg-stone-50 dark:bg-stone-800/40 p-4 rounded-xl text-xs text-stone-600 dark:text-stone-300">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Track referral asks across LinkedIn & Email</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Automated housekeeping & follow-up queues</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Smart email pattern candidate generator</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
            {error}
          </div>
        )}

        <Button
          onClick={() => void handleSignIn()}
          isLoading={loading}
          variant="primary"
          size="lg"
          className="w-full justify-center space-x-2"
        >
          <span>Sign in with Google</span>
          <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="mt-6 flex items-center justify-center space-x-1.5 text-xs text-stone-400">
          <Shield className="h-3.5 w-3.5" />
          <span>Local-first storage — your data stays in your browser.</span>
        </div>
      </div>
    </div>
  );
}
