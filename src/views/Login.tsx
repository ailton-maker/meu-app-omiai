import React from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithGoogle } from '../lib/firebase';
import { motion } from 'motion/react';

export const Login = () => {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden flex flex-col items-center justify-center px-8 text-center text-white">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 space-y-12"
      >
        <div className="flex flex-col items-center space-y-6">
          <div className="w-32 h-32 relative">
            {/* Fallback heart icon if image fails */}
            <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl animate-pulse" />
            <img 
              src="/logo.png" 
              alt="Omiai Logo" 
              className="w-full h-full object-contain relative z-10 invert brightness-200"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="space-y-4">
            <h1 className="text-8xl font-black tracking-tighter uppercase leading-[0.8] text-white">
              Omiai
            </h1>
            <p className="text-white/40 font-medium tracking-[0.2em] uppercase text-xs">
              Conexões que cruzam seu caminho
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <p className="text-white/60 text-lg font-light leading-relaxed max-w-sm mx-auto">
            Encontre as pessoas com quem você cruzou no mundo real.
            Baseado em proximidade e interesses compartilhados.
          </p>
          
          <button
            onClick={handleLogin}
            className="w-full py-5 bg-white text-black rounded-3xl font-bold uppercase tracking-widest text-sm hover:bg-orange-500 hover:text-white transition-all transform hover:scale-105"
          >
            Entrar com Google
          </button>
        </div>

        <div className="pt-12 text-[10px] text-white/20 uppercase tracking-widest font-bold">
          Gratuito para todos. Para sempre.
        </div>
      </motion.div>
    </div>
  );
};
