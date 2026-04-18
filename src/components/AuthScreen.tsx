import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        
        setMessage('Conta criada! Verifique o seu email para confirmar o registo. Se desativou a confirmação, o login foi automático.');
      }
    } catch (error: any) {
      setMessage(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm bg-gray-950 p-8 rounded-[2rem] border border-gray-800 shadow-2xl">
        <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-8">{isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}</h1>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          
          {message && (
            <p className={`text-sm text-center ${message.includes('Verifique') ? 'text-emerald-500' : 'text-rose-500'}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
          >
            {loading ? 'A processar...' : isLogin ? 'Entrar' : 'Registar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-gray-500 hover:text-white text-sm transition-colors"
          >
            {isLogin ? 'Não tem conta? Registe-se' : 'Já tem conta? Entre aqui'}
          </button>
        </div>
      </div>
    </div>
  );
}
