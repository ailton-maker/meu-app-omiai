import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logout, db } from '../lib/firebase';
import { setDoc, doc } from 'firebase/firestore';
import { Settings, LogOut, Edit3, User as UserIcon, Heart, Book, MapPin, Briefcase, GraduationCap, Database, CreditCard, Eye, BarChart3, Sparkles, Bell, BellOff, Share2, Crown, Navigation } from 'lucide-react';
import { cn } from '../lib/utils';
import { CitySelect } from '../components/CitySelect';
import { motion, AnimatePresence } from 'motion/react';

export const Profile = () => {
  const { profile, updateProfile, isPremium: checkPremium } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [editedBio, setEditedBio] = useState(profile?.bio || '');
  const [editedCity, setEditedCity] = useState(profile?.hometown || '');
  const [editedOccupation, setEditedOccupation] = useState(profile?.occupation || '');
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const isPremium = checkPremium();

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
          setEditedCity(city);
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

  React.useEffect(() => {
    if (!profile) return;

    const fetchHistory = async () => {
      try {
        const { collection, query, orderBy, limit, onSnapshot } = await import('firebase/firestore');
        const q = query(
          collection(db, 'users', profile.uid, 'location_history'),
          orderBy('timestamp', 'desc'),
          limit(10)
        );

        const unsubscribe = onSnapshot(q, (snap) => {
          const history = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setLocationHistory(history);
          setHistoryLoading(false);
        });

        return unsubscribe;
      } catch (err) {
        console.error('Error fetching history:', err);
        setHistoryLoading(false);
      }
    };

    const unsubPromise = fetchHistory();
    return () => {
      unsubPromise.then(unsub => unsub?.());
    };
  }, [profile?.uid]);

  const handleManageSubscription = () => {
    setManagingSubscription(true);
    setTimeout(() => setManagingSubscription(false), 3000);
  };

  // Sync bio and city when profile updates and not currently editing
  React.useEffect(() => {
    if (!isEditing && profile) {
      setEditedBio(profile.bio || '');
      setEditedCity(profile.hometown || '');
      setEditedOccupation(profile.occupation || '');
    }
  }, [profile, isEditing]);

  const saveProfile = async () => {
    try {
      await updateProfile({ 
        bio: editedBio, 
        hometown: editedCity,
        occupation: editedOccupation 
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Erro ao salvar perfil. Tente novamente.');
    }
  };

  const handleInvite = () => {
    if (!profile) return;
    const inviteMsg = `Ei! Estou usando o Omiai para encontrar conexões reais. Use meu código ${profile.inviteCode} ao se cadastrar e ganhe uma semana de Premium! Baixe agora: ${window.location.origin}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Convite Omiai',
        text: inviteMsg,
        url: window.location.origin,
      }).catch(console.error);
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(inviteMsg);
      alert('Link de convite copiado para a área de transferência!');
    }
  };

  const seedDemoData = async () => {
    if (!profile) return;
    if (isSeeding) return;

    try {
      setIsSeeding(true);
      const { serverTimestamp, writeBatch, collection, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const maleNames = ['Gabriel', 'Lucas', 'Mateus', 'Rafael', 'Bruno', 'Thiago', 'Vinícius', 'Rodrigo', 'André', 'Felipe', 'Gustavo', 'Daniel', 'Marcelo', 'Ricardo', 'Eduardo', 'Paulo', 'Leandro', 'Fábio', 'Vitor', 'Alexandre', 'Carlos', 'João', 'Henrique', 'Diego', 'Leonardo', 'Murilo', 'Samuel', 'Arthur', 'Igor', 'Otávio'];
      const femaleNames = ['Beatriz', 'Camila', 'Fernanda', 'Juliana', 'Mariana', 'Letícia', 'Amanda', 'Bruna', 'Larissa', 'Patrícia', 'Renata', 'Isabela', 'Bianca', 'Clara', 'Giovanna', 'Helena', 'Alice', 'Sophia', 'Laura', 'Valentina', 'Isadora', 'Cecília', 'Olívia', 'Manuela', 'Lorena', 'Vitória', 'Carolina', 'Elisa', 'Gabriela', 'Luísa'];
      
      const interestsPool = ['Tecnologia', 'Culinária', 'Música', 'Arte', 'Esportes', 'Viagens', 'Leitura', 'Fotografia', 'Ciclismo', 'Cinema', 'Yoga', 'Natureza', 'Games', 'Dança', 'Moda', 'História', 'Política', 'Ciência', 'Arquitetura', 'Vinil'];
      const hobbiesPool = ['Corrida', 'Trilha', 'Meditação', 'Pintura', 'Tocar Instrumento', 'Cozinhar', 'Assistir Séries', 'Academia', 'Jardinagem', 'Escalar', 'Surfar', 'Skate', 'Xadrez', 'Escrever', 'Board Games'];
      const occupationsPool = ['Engenheiro', 'Arquiteta', 'Designer', 'Médico', 'Professor', 'Advogado', 'Artista', 'Chef', 'Jornalista', 'Desenvolvedor', 'Psicólogo', 'Analista', 'Gestor', 'Fotógrafo', 'Empresário', 'Estudante'];
      const citiesPool = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Salvador', 'Fortaleza', 'Recife', 'Brasília', 'Florianópolis', 'Campinas', 'Osasco', 'Guarulhos'];
      const biosPool = [
        "Sempre em busca da próxima aventura.",
        "Amante de café e boas conversas sobre o universo.",
        "Na dúvida, eu escolho viajar.",
        "Fã de tecnologia, mas também de uma boa trilha.",
        "Buscando alguém para dividir uma pizza e risadas.",
        "Apaixonada por artes e museus.",
        "A vida é curta demais para não ser vivida intensamente.",
        "Se você gosta de música ao vivo, já somos amigos.",
        "Mestre cuca nas horas vagas.",
        "Amo pets mais que pessoas (brincadeira... ou não).",
        "Leitor ávido e cinéfilo assumido.",
        "Buscando conexões reais em um mundo digital.",
        "Skate, praia e bons drinks.",
        "Sempre com um novo projeto na cabeça."
      ];

      const totalPerGender = 15;

      // Helper to get random items
      const getRandom = <T,>(arr: T[], n: number): T[] => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
      };

      // Generate Men
      for (let i = 0; i < totalPerGender; i++) {
        const name = maleNames[i % maleNames.length];
        const userRef = doc(db, 'users', `demo_m_${i}`);
        
        // Random coords around SP (-23.55, -46.63) +/- 0.4 deg (~40km)
        const lat = -23.5505 + (Math.random() - 0.5) * 0.4;
        const lng = -46.6333 + (Math.random() - 0.5) * 0.4;

        batch.set(userRef, {
          uid: `demo_m_${i}`,
          displayName: name,
          photoURL: `https://images.unsplash.com/photo-${1500000000000 + (i * 123456) % 1000000}?auto=format&fit=crop&w=800&q=80`,
          bio: biosPool[Math.floor(Math.random() * biosPool.length)],
          interests: getRandom(interestsPool, 3),
          hobbies: getRandom(hobbiesPool, 2),
          occupation: occupationsPool[Math.floor(Math.random() * occupationsPool.length)],
          hometown: citiesPool[Math.floor(Math.random() * citiesPool.length)],
          gender: 'Masculino',
          age: 19 + Math.floor(Math.random() * 25),
          lastSeenLocation: { latitude: lat, longitude: lng },
          lastSeenAt: serverTimestamp(),
          preferences: {
            interestedIn: ['Feminino'],
            ageRange: [18, 50],
          },
          createdAt: serverTimestamp(),
        });
      }

      // Generate Women
      for (let i = 0; i < totalPerGender; i++) {
        const name = femaleNames[i % femaleNames.length];
        const userRef = doc(db, 'users', `demo_f_${i}`);

        // Random coords around SP
        const lat = -23.5505 + (Math.random() - 0.5) * 0.4;
        const lng = -46.6333 + (Math.random() - 0.5) * 0.4;

        batch.set(userRef, {
          uid: `demo_f_${i}`,
          displayName: name,
          photoURL: `https://images.unsplash.com/photo-${1600000000000 + (i * 789012) % 1000000}?auto=format&fit=crop&w=800&q=80`,
          bio: biosPool[Math.floor(Math.random() * biosPool.length)],
          interests: getRandom(interestsPool, 3),
          hobbies: getRandom(hobbiesPool, 2),
          occupation: occupationsPool[Math.floor(Math.random() * occupationsPool.length)],
          hometown: citiesPool[Math.floor(Math.random() * citiesPool.length)],
          gender: 'Feminino',
          age: 19 + Math.floor(Math.random() * 25),
          lastSeenLocation: { latitude: lat, longitude: lng },
          lastSeenAt: serverTimestamp(),
          preferences: {
            interestedIn: ['Masculino'],
            ageRange: [18, 50],
          },
          createdAt: serverTimestamp(),
        });
      }
      
      // Simulate multiple crossings
      for (let j = 0; j < 25; j++) {
        const crossingRef = doc(collection(db, 'crossings'));
        const demoTarget = profile.gender === 'Masculino' ? `demo_f_${j}` : `demo_m_${j}`;
        batch.set(crossingRef, {
          participants: [profile.uid, demoTarget],
          timestamp: serverTimestamp(),
          locationName: citiesPool[j % citiesPool.length]
        });
      }

      // Simulate Likes RECEIVED (Te Curtiu)
      for (let j = 0; j < 15; j++) {
        const likeRef = doc(collection(db, 'likes'));
        const demoFrom = profile.gender === 'Masculino' ? `demo_f_${j + 30}` : `demo_m_${j + 30}`;
        batch.set(likeRef, {
          fromUid: demoFrom,
          toUid: profile.uid,
          timestamp: serverTimestamp(),
          type: 'like'
        });
      }

      // Simulate Likes SENT (Suas Curtidas)
      for (let j = 0; j < 10; j++) {
        const likeRef = doc(collection(db, 'likes'));
        const demoTo = profile.gender === 'Masculino' ? `demo_f_${j + 20}` : `demo_m_${j + 20}`;
        batch.set(likeRef, {
          fromUid: profile.uid,
          toUid: demoTo,
          timestamp: serverTimestamp(),
          type: 'like'
        });
      }

      // Simulate some Messages
      for (let j = 0; j < 3; j++) {
        const demoPartner = profile.gender === 'Masculino' ? `demo_f_${j + 30}` : `demo_m_${j + 30}`;
        const chatId = [profile.uid, demoPartner].sort().join('_');
        const msgRef = doc(collection(db, `chats/${chatId}/messages`));
        batch.set(msgRef, {
          senderId: demoPartner,
          text: `Olá! Vi que nossos caminhos se cruzaram em ${citiesPool[j % citiesPool.length]}.`,
          timestamp: serverTimestamp()
        });
      }

      // Simulate Mutual Matches
      for (let j = 0; j < 5; j++) {
        const demoUid = profile.gender === 'Masculino' ? `demo_f_${j + 50}` : `demo_m_${j + 50}`;
        
        // Like FROM demo user
        const likeInRef = doc(collection(db, 'likes'));
        batch.set(likeInRef, {
          fromUid: demoUid,
          toUid: profile.uid,
          timestamp: serverTimestamp(),
          type: 'like'
        });

        // Like TO demo user
        const likeOutRef = doc(collection(db, 'likes'));
        batch.set(likeOutRef, {
          fromUid: profile.uid,
          toUid: demoUid,
          timestamp: serverTimestamp(),
          type: 'like'
        });

        // Simulate an initial message
        const messageRef = doc(collection(db, 'messages'));
        batch.set(messageRef, {
          fromUid: demoUid,
          toUid: profile.uid,
          text: "Oi! Tudo bem? Adorei seu perfil! 😊",
          timestamp: serverTimestamp(),
          read: false
        });
      }

      // Simulate personal location history
      const historyLocations = [
        { lat: -23.5615, lng: -46.6559 }, // Paulista
        { lat: -23.5854, lng: -46.6576 }, // Ibirapuera
        { lat: -23.5448, lng: -46.6276 }, // Mercado Municipal
        { lat: -23.5594, lng: -46.6875 }, // Vila Madalena
        { lat: -23.5505, lng: -46.6333 }, // Sé
      ];

      for (let j = 0; j < historyLocations.length; j++) {
        const historyRef = doc(collection(db, 'users', profile.uid, 'location_history'));
        batch.set(historyRef, {
          coords: { 
            latitude: historyLocations[j].lat, 
            longitude: historyLocations[j].lng 
          },
          timestamp: serverTimestamp()
        });
      }

      await batch.commit();
      alert(`Sucesso! Criamos um ecossistema completo para você:\n- 30 novos perfis reais (15 homens, 15 mulheres)\n- 25 cruzamentos de caminho\n- 15 pessoas que já te curtiram\n- 5 matches mútuos com mensagens iniciais\n\nAgora você pode testar todas as abas do app!`);
    } catch (err) {
      console.error('Seed error:', err);
      alert('Erro ao popular banco de dados (Batch): ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSeeding(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter">Perfil</h1>
        <div className="flex gap-4">
          <button 
            onClick={seedDemoData} 
            disabled={isSeeding}
            className={cn(
              "p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2 group cursor-pointer",
              isSeeding && "opacity-50 cursor-not-allowed"
            )}
          >
            <Database size={20} className={cn("text-white/60 group-hover:text-orange-500 transition-colors", isSeeding && "animate-pulse")} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 hidden sm:block">
              {isSeeding ? 'Gerando...' : 'Demo'}
            </span>
          </button>
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
          >
            <Edit3 size={20} className={cn("text-white/60 transition-colors", isEditing && "text-orange-500")} />
          </button>
          <button 
            onClick={logout} 
            className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
          >
            <LogOut size={20} className="text-white/60" />
          </button>
        </div>
      </header>

      {/* Main Card */}
      <div className="space-y-8">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-tr from-orange-500 to-blue-500 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
            <img
              src={profile.photoURL || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'}
              alt={profile.displayName}
              className="relative w-24 h-24 rounded-full object-cover border-2 border-black"
            />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">{profile.displayName}</h2>
            <div className="flex items-center gap-2 mt-1">
              {isPremium ? (
                <div className="flex items-center gap-1 text-orange-500">
                  <Crown size={12} fill="currentColor" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Premium Ativo</p>
                </div>
              ) : (
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Membro Standard</p>
              )}
            </div>
          </div>
        </div>

        {/* Invite Button (Discreet) */}
        <button 
          onClick={handleInvite}
          className="w-full p-4 bg-orange-500/10 border border-orange-500/20 rounded-[32px] flex items-center justify-between group hover:bg-orange-500/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Share2 size={18} className="text-black" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Convidar Amigos</p>
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">Ganhe 1 semana de Premium</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-black/40 rounded-full border border-white/10">
            <span className="text-[10px] font-mono font-black text-white/60 tracking-wider">
              {profile.inviteCode}
            </span>
          </div>
        </button>

        {/* Bio Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">A Narrativa</h3>
          </div>
          {isEditing ? (
            <div className="space-y-4">
              <textarea
                value={editedBio}
                onChange={(e) => setEditedBio(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-orange-500 transition-all min-h-[120px]"
                placeholder="Conte sua história..."
              />
              <button
                onClick={saveProfile}
                className="w-full py-3 bg-orange-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-orange-600 transition-all cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium leading-relaxed text-white/80">
              {profile.bio || "Crie uma biografia que capture sua essência. Onde você esteve? Para onde está indo?"}
            </p>
          )}
        </section>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-white/5 rounded-[32px] border border-white/10 space-y-2">
            <Briefcase size={16} className="text-orange-500 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Ocupação</p>
            {isEditing ? (
              <input 
                value={editedOccupation}
                onChange={(e) => setEditedOccupation(e.target.value)}
                placeholder="Ex: Designer"
                className="w-full bg-transparent border-b border-white/10 py-1 text-xs font-bold uppercase tracking-widest outline-none focus:border-orange-500"
              />
            ) : (
              <p className="text-xs font-bold uppercase tracking-widest truncate">{profile.occupation || 'Nômade Digital'}</p>
            )}
          </div>
          <div className="p-5 bg-white/5 rounded-[32px] border border-white/10 space-y-2">
            <MapPin size={16} className="text-blue-500 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Cidade</p>
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <CitySelect 
                      value={editedCity} 
                      onChange={(val) => setEditedCity(val)} 
                      placeholder="Cidade..."
                    />
                  </div>
                  <button
                    onClick={detectCity}
                    disabled={isLocating}
                    type="button"
                    className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500 hover:bg-blue-500/20 transition-all flex-shrink-0"
                    title="Detectar localização"
                  >
                    <Navigation size={16} className={cn(isLocating && "animate-pulse")} />
                  </button>
                </div>
                {isLocating && <p className="text-[7px] font-black uppercase tracking-widest text-blue-500 animate-pulse">Buscando cidade...</p>}
              </div>
            ) : (
              <p className="text-xs font-bold uppercase tracking-widest truncate">{profile.hometown || 'Cidadão do Mundo'}</p>
            )}
          </div>
        </div>

        {/* Interests & Hobbies */}
        <section className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-orange-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Interesses</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.interests.length > 0 ? profile.interests.map(i => (
                <span key={i} className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">{i}</span>
              )) : (
                <p className="text-[10px] text-white/20 italic">Adicione interesses para descobrir conexões profundas.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Book size={14} className="text-blue-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Hobbies</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.hobbies.length > 0 ? profile.hobbies.map(h => (
                <span key={h} className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">{h}</span>
              )) : (
                <p className="text-[10px] text-white/20 italic">Adicione hobbies para mapear suas paixões diárias.</p>
              )}
            </div>
          </div>
        </section>

        {/* Subscription Section */}
        <section className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-purple-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Plano de Assinatura</h3>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-[32px] space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <CreditCard size={80} className="text-purple-500 rotate-12" />
              </div>

              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white">Seu Plano Atual</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-500 text-[8px] font-black uppercase tracking-widest rounded-full border border-purple-500/20">
                      Premium
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleManageSubscription}
                  disabled={managingSubscription}
                  className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 active:bg-orange-500 active:text-black active:border-orange-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  Gerenciar Assinatura
                </button>
              </div>

              <AnimatePresence>
                {managingSubscription && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      Gerenciando sua assinatura...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10 pt-4 border-t border-white/5">
                {/* Premium Details */}
                <div className="space-y-4 p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-500">Benefícios Premium</p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="w-1 h-1 rounded-full bg-purple-500 mt-1.5" />
                      <p className="text-[9px] text-white/70 font-medium leading-relaxed uppercase tracking-widest">
                        Envie mensagens antes do match
                      </p>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-1 h-1 rounded-full bg-purple-500 mt-1.5" />
                      <p className="text-[9px] text-white/70 font-medium leading-relaxed uppercase tracking-widest">
                        Até 20 conversas simultâneas
                      </p>
                    </li>
                  </ul>
                </div>

                {/* Free Details */}
                <div className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/5 opacity-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Plano Gratuito</p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="w-1 h-1 rounded-full bg-white/20 mt-1.5" />
                      <p className="text-[9px] text-white/40 font-medium leading-relaxed uppercase tracking-widest">
                        Visualização de propagandas
                      </p>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-1 h-1 rounded-full bg-white/20 mt-1.5" />
                      <p className="text-[9px] text-white/40 font-medium leading-relaxed uppercase tracking-widest">
                        Até 7 conversas simultâneas
                      </p>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Notification Settings */}
        <section className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-orange-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Notificações</h3>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-[32px] space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Heart size={14} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">Novos Matches</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">Avisar quando houver sinergia</p>
                  </div>
                </div>
                <button 
                  onClick={() => updateProfile({ 
                    notificationSettings: { 
                      ...profile.notificationSettings, 
                      matches: !profile.notificationSettings?.matches 
                    } as any
                  })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
                    profile.notificationSettings?.matches ? "bg-orange-500" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: profile.notificationSettings?.matches ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-4 h-4 bg-white rounded-full shadow-lg"
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Briefcase size={14} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">Mensagens</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">Alertar novos contatos</p>
                  </div>
                </div>
                <button 
                  onClick={() => updateProfile({ 
                    notificationSettings: { 
                      ...profile.notificationSettings, 
                      messages: !profile.notificationSettings?.messages 
                    } as any
                  })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
                    profile.notificationSettings?.messages ? "bg-orange-500" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: profile.notificationSettings?.messages ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-4 h-4 bg-white rounded-full shadow-lg"
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Statistics Section */}
        <section className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-orange-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Estatísticas</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-white/5 border border-white/10 rounded-[24px] flex flex-col items-center justify-center text-center space-y-2">
                <div className="p-2 bg-blue-500/10 rounded-full">
                  <Eye size={14} className="text-blue-500" />
                </div>
                <p className="text-lg font-black uppercase tracking-tighter">1.2k</p>
                <p className="text-[7px] font-bold uppercase tracking-widest text-white/40">Fotos Visualizadas</p>
              </div>
              
              <div className="p-4 bg-white/5 border border-white/10 rounded-[24px] flex flex-col items-center justify-center text-center space-y-2">
                <div className="p-2 bg-orange-500/10 rounded-full">
                  <Heart size={14} fill="currentColor" className="text-orange-500 fill-orange-500/50" />
                </div>
                <p className="text-lg font-black uppercase tracking-tighter">342</p>
                <p className="text-[7px] font-bold uppercase tracking-widest text-white/40">Perfis Curtidos</p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-[24px] flex flex-col items-center justify-center text-center space-y-2">
                <div className="p-2 bg-yellow-500/10 rounded-full">
                  <Sparkles size={14} className="text-yellow-500" />
                </div>
                <p className="text-lg font-black uppercase tracking-tighter">18</p>
                <p className="text-[7px] font-bold uppercase tracking-widest text-white/40">Matches Encontrados</p>
              </div>
            </div>
          </div>
        </section>

        {/* Location History Section */}
        <section className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-blue-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Histórico de Movimentação</h3>
            </div>
            <div className="space-y-3">
              {historyLoading ? (
                <div className="p-8 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-3">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/40">Sincronizando trajetórias...</p>
                </div>
              ) : locationHistory.length === 0 ? (
                <div className="p-8 bg-white/5 border border-white/10 rounded-2xl text-center space-y-2">
                  <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Nenhum registro ainda</p>
                  <p className="text-[8px] font-medium text-white/10 uppercase tracking-widest">Mova-se para mapear seus caminhos</p>
                </div>
              ) : (
                locationHistory.map((loc, i) => {
                  const date = loc.timestamp?.toDate() || new Date();
                  const timeStr = date.toLocaleString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    day: '2-digit', 
                    month: '2-digit' 
                  });
                  
                  return (
                    <div key={loc.id || i} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group transition-all hover:bg-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                          <MapPin size={14} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-white">
                            {loc.coords.latitude.toFixed(4)}, {loc.coords.longitude.toFixed(4)}
                          </p>
                          <p className="text-[8px] font-medium uppercase tracking-widest text-white/40">{timeStr}</p>
                        </div>
                      </div>
                      <a 
                        href={`https://www.google.com/maps?q=${loc.coords.latitude},${loc.coords.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"
                      >
                        Ver no Mapa
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Admin/Debug Info (Only shown for demo) */}
        <div className="pt-8 opacity-20 hover:opacity-100 transition-opacity">
          <p className="text-[8px] uppercase tracking-widest text-center">UID: {profile.uid}</p>
        </div>
      </div>
    </div>
  );
};
