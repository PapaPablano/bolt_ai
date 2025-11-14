import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

interface SupabaseAuthPanelProps {
  title?: string;
  description?: string;
}

export function SupabaseAuthPanel({
  title = 'Sign in to manage your data',
  description = 'Authenticate with your Supabase credentials to access watchlists, alerts, and screener preferences.',
}: SupabaseAuthPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setStatus('Signed in successfully.');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setStatus('Account created. Please check your email to confirm access.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to authenticate');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 max-w-2xl mx-auto text-slate-200">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-6">{description}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-slate-300">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
            required
          />
        </label>

        <label className="block text-sm text-slate-300">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
            required
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-200"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </form>

      {status && (
        <div className="mt-4 text-sm text-slate-300 bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          {status}
        </div>
      )}
    </section>
  );
}
