import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { User, Briefcase, Heart, Sparkles, ArrowRight, Camera, MapPin, Navigation } from 'lucide-react';
import { CitySelect } from '../components/CitySelect';
import { cn } from '../lib/utils';

export const Onboarding: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [formData, setFormData] = useState({
    gender: profile?.gender || 'Masculino',
    interestedIn: (profile?.gender === 'Masculino' ? ['Feminino'] : ['Masculino']) as string[],
    occupation: profile?.occupation || '',
    hometown: profile?.hometown || '',
    bio: profile?.bio || '',
    displayName: profile?.displayName || '',
    inviteCodeUsed: '',
  });

  const detectCity = async () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`);
        const data = await response.json();
        
        const city = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.state_district;
        
        if (city) {
          setFormData({ ...formData, hometown: city });
        } else {
          alert('Não foi possível determinar sua cidade automaticamente.');
        }
      } catch (err) {
        console.error('Error reverse geocoding:', err);
        alert('Erro ao detectar localização. Tente manualmente.');
      } finally {
        setIsLocating(false);
      }
    }, (error) => {
      console.error('Geolocation error:', error);
      alert('Permissão de localização negada ou erro no GPS.');
      setIsLocating(false);
    });
  };

  const totalSteps = 6;

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      setIsSubmitting(true);
      try {
        const { collection, query, where, getDocs, doc, setDoc, serverTimestamp, increment } = await import('firebase/firestore');
        const db = (await import('../lib/firebase')).db;
        
        let referralReward = 0;
        let referrerUid = '';

        if (formData.inviteCodeUsed.trim()) {
          const q = query(collection(db, 'users'), where('inviteCode', '==', formData.inviteCodeUsed.trim()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const referrerDoc = querySnapshot.docs[0];
            referrerUid = referrerDoc.id;
            referralReward = 7; // days

            // Award premium to referrer (1 week)
            const refData = referrerDoc.data();
            const currentExpiry = refData.premiumExpiry ? new Date(refData.premiumExpiry).getTime() : Date.now();
            const newExpiry = new Date(Math.max(Date.now(), currentExpiry) + 7 * 24 * 60 * 60 * 1000);
            
            await setDoc(doc(db, 'users', referrerUid), {
              premiumExpiry: newExpiry.toISOString()
            }, { merge: true });
          }
        }

        // Finalize onboarding
        const expiryDate = referralReward > 0 
          ? new Date(Date.now() + referralReward * 24 * 60 * 60 * 1000) 
          : null;

        await updateProfile({
          ...formData,
          preferences: {
            ...profile?.preferences,
            interestedIn: formData.interestedIn,
            ageRange: profile?.preferences?.ageRange || [18, 99],
          },
          referredBy: referrerUid || undefined,
          premiumExpiry: expiryDate?.toISOString() || profile?.premiumExpiry,
          onboardingCompleted: true,
        } as any);
        navigate('/');
      } catch (err) {
        console.error('Onboarding error:', err);
        alert('Erro ao finalizar cadastro: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8 text-center"
          >
            <div className="mx-auto w-24 h-24 mb-6 relative">
              <img 
                src="/logo.png" 
                alt="Omiai Logo" 
                className="w-full h-full object-contain invert brightness-200"
                onError={(e) => {
                   e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full -z-10 animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Bem-vindo ao Omiai</h2>
            <p className="text-white/60">Vamos preparar seu perfil para que caminhos incríveis se cruzem.</p>
            <div className="space-y-4 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Como devemos te chamar?</p>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Seu nome"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-lg font-medium outline-none focus:border-orange-500/50 transition-colors"
                id="onboarding-name"
              />
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-bold text-center">Qual o seu gênero?</h2>
            <p className="text-white/60 text-center text-sm">Isso nos ajuda a filtrar conexões relevantes para você.</p>
            <div className="grid grid-cols-1 gap-4">
              {['Masculino', 'Feminino'].map((g) => (
                <button
                  key={g}
                  id={`onboarding-gender-${g}`}
                  onClick={() => setFormData({ 
                    ...formData, 
                    gender: g,
                    interestedIn: g === 'Masculino' ? ['Feminino'] : ['Masculino']
                  })}
                  className={`p-6 rounded-[24px] border transition-all flex items-center justify-between ${
                    formData.gender === g 
                    ? 'bg-orange-500 border-orange-500 text-black font-bold' 
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  <span className="uppercase tracking-widest text-xs">{g === 'Masculino' ? 'Homem' : 'Mulher'}</span>
                  <div className={`w-4 h-4 rounded-full border-2 ${formData.gender === g ? 'border-black bg-black' : 'border-white/20'}`} />
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center text-white/40 italic">* Sua privacidade é nossa prioridade.</p>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-bold text-center">O que você faz?</h2>
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-[24px] p-1 flex items-center gap-3 pr-4 focus-within:border-orange-500/50 transition-colors">
                <div className="w-12 h-12 rounded-[20px] bg-white/5 flex items-center justify-center">
                  <Briefcase size={20} className="text-orange-500" />
                </div>
                <input
                  type="text"
                  id="onboarding-occupation"
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  placeholder="Sua profissão ou paixão..."
                  className="flex-1 bg-transparent py-4 text-sm font-medium outline-none"
                />
              </div>
              <p className="text-white/40 text-xs text-center">Ex: Arquiteto, Chef, Estudante de História, Viajante...</p>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-bold text-center">Onde você está?</h2>
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-2">
                   <MapPin size={20} className="text-orange-500" />
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Sua Cidade</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <CitySelect 
                      value={formData.hometown} 
                      onChange={(val) => setFormData({ ...formData, hometown: val })}
                      placeholder="Selecione sua cidade..."
                    />
                  </div>
                  <button
                    onClick={detectCity}
                    disabled={isLocating}
                    type="button"
                    className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-500 hover:bg-orange-500/20 transition-all flex-shrink-0"
                  >
                    <Navigation size={20} className={cn(isLocating && "animate-pulse")} />
                  </button>
                </div>
                {isLocating && (
                   <div className="flex items-center justify-center gap-2 py-2">
                     <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                     <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                     <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce" />
                     <span className="text-[8px] font-black uppercase tracking-widest text-orange-500">Localizando...</span>
                   </div>
                )}
              </div>
              <p className="text-white/40 text-xs text-center italic">Isso nos ajuda a mostrar pessoas que cruzam seu caminho.</p>
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-bold text-center">Conte um pouco sobre você</h2>
            <div className="space-y-4">
              <textarea
                id="onboarding-bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Uma bio curta que desperte curiosidade..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-[24px] p-6 text-sm font-medium outline-none focus:border-orange-500/50 transition-colors resize-none"
              />
              <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20 text-[10px] text-orange-500 uppercase tracking-widest font-bold text-center">
                Dica: Mencione onde você costuma ser encontrado(a)
              </div>
            </div>
          </motion.div>
        );
      case 6:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-orange-500/10 rounded-[24px] flex items-center justify-center mx-auto mb-4">
                 <Sparkles size={32} className="text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold">Você tem um convite?</h2>
              <p className="text-white/60 text-sm">Insira o código de quem te indicou para ganhar uma semana de Assinatura Premium grátis!</p>
            </div>
            <div className="space-y-4">
               <input
                type="text"
                value={formData.inviteCodeUsed}
                onChange={(e) => setFormData({ ...formData, inviteCodeUsed: e.target.value.toUpperCase() })}
                placeholder="OMIAI-XXXXXX"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-xl font-black tracking-widest outline-none focus:border-orange-500/50 transition-colors"
                id="onboarding-invite"
              />
              <p className="text-[10px] text-center text-white/20 uppercase tracking-[0.2em]">Pode deixar em branco se não tiver um</p>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-8 flex flex-col pt-20 pb-12 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[30%] bg-orange-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[30%] bg-pink-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Progress Bar */}
      <div className="flex gap-2 mb-12">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div 
            key={i} 
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i + 1 <= step ? 'bg-orange-500' : 'bg-white/10'
            }`} 
          />
        ))}
      </div>

      <div className="flex-1 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>

      <div className="mt-auto">
        <button
          id="onboarding-next-btn"
          onClick={handleNext}
          disabled={(step === 1 && !formData.displayName) || (step === 4 && !formData.hometown) || isSubmitting}
          className="w-full bg-white text-black p-5 rounded-[24px] font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              {step === totalSteps ? 'Finalizar' : 'Continuar'}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
