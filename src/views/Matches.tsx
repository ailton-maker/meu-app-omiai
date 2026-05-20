import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, MessageSquare, Star, Loader2, Send, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc, addDoc, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LikedUser {
  uid: string;
  displayName: string;
  photoURL: string;
  likedAt: any;
}

export const Matches = () => {
  const { profile } = useAuth();
  const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);
  const [likedByUsers, setLikedByUsers] = useState<LikedUser[]>([]);
  const [allLikedUids, setAllLikedUids] = useState<Set<string>>(new Set());
  const [likerUids, setLikerUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState<{ user: LikedUser; message: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const { updateProfile } = useAuth();

  const fetchLikes = React.useCallback(async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      // 1. Fetch likes sent by the current user
      const likesRef = collection(db, 'likes');
      const qSent = query(
        likesRef,
        where('fromUid', '==', profile.uid),
        orderBy('timestamp', 'desc')
      );
      
      const sentSnapshot = await getDocs(qSent);
      const likedUids = sentSnapshot.docs.map(doc => doc.data().toUid);
      setAllLikedUids(new Set(likedUids));
      const likedTimestamps = sentSnapshot.docs.reduce((acc, doc) => {
        acc[doc.data().toUid] = doc.data().timestamp;
        return acc;
      }, {} as Record<string, any>);

      // 2. Fetch likes received by the current user
      const qReceived = query(
        likesRef,
        where('toUid', '==', profile.uid),
        orderBy('timestamp', 'desc')
      );
      
      const receivedSnapshot = await getDocs(qReceived);
      const receivedUids = receivedSnapshot.docs.map(doc => doc.data().fromUid);
      setLikerUids(new Set(receivedUids));
      const receivedTimestamps = receivedSnapshot.docs.reduce((acc, doc) => {
        acc[doc.data().fromUid] = doc.data().timestamp;
        return acc;
      }, {} as Record<string, any>);

      // 3. Fetch profiles for sent likes
      if (likedUids.length > 0) {
        const sentUsersToFetch = likedUids.slice(0, 10);
        const sentProfiles: LikedUser[] = [];
        for (const uid of sentUsersToFetch) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            sentProfiles.push({
              uid: userData.uid,
              displayName: userData.displayName,
              photoURL: userData.photoURL,
              likedAt: likedTimestamps[uid]
            });
          }
        }
        setLikedUsers(sentProfiles);
      } else {
        setLikedUsers([]);
      }

      // 4. Fetch profiles for received likes (Limit to 8 as requested)
      if (receivedUids.length > 0) {
        const receivedUsersToFetch = receivedUids.slice(0, 8);
        const receivedProfiles: LikedUser[] = [];
        for (const uid of receivedUsersToFetch) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            receivedProfiles.push({
              uid: userData.uid,
              displayName: userData.displayName,
              photoURL: userData.photoURL,
              likedAt: receivedTimestamps[uid]
            });
          }
        }
        setLikedByUsers(receivedProfiles);
      } else {
        setLikedByUsers([]);
      }
      
    } catch (error) {
      console.error('Error fetching likes:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.uid]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  // Check for first-time match tutorial
  useEffect(() => {
    if (profile && !profile.hasSeenMatchTutorial && (matchData || [...likerUids].some(uid => allLikedUids.has(uid)))) {
      // If we are currently showing a match celebration, wait for it to be dismissed?
      // Or show tutorial as part of the flow.
      // For now, let's trigger it when they have at least one match.
      if (!matchData && !loading) {
         setShowTutorial(true);
      }
    }
  }, [profile, likerUids, allLikedUids, matchData, loading]);

  const closeTutorial = async () => {
    setShowTutorial(false);
    if (profile) {
      await updateProfile({ hasSeenMatchTutorial: true });
    }
  };

  const handleLikeBack = async (targetUser: LikedUser) => {
    if (!profile) return;
    
    try {
      // 1. Create the like back
      await addDoc(collection(db, 'likes'), {
        fromUid: profile.uid,
        toUid: targetUser.uid,
        timestamp: serverTimestamp()
      });

      // 2. Create the chat document immediately
      const chatId = [profile.uid, targetUser.uid].sort().join('_');
      await setDoc(doc(db, 'chats', chatId), {
        participants: [profile.uid, targetUser.uid],
        lastMessage: '',
        updatedAt: serverTimestamp(),
        unreadCount: {
          [profile.uid]: 0,
          [targetUser.uid]: 0
        }
      }, { merge: true });

      // 3. Create notification for the target user (It's a mutual match)
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        toUid: targetUser.uid,
        fromUid: profile.uid,
        type: 'match',
        text: `Você deu match com ${profile.displayName}!`,
        read: false,
        timestamp: serverTimestamp()
      });
      // Also for the current user so they see the toast
      await addDoc(notificationsRef, {
        toUid: profile.uid,
        fromUid: targetUser.uid,
        type: 'match',
        text: `Parabéns! Novo match com ${targetUser.displayName}!`,
        read: false,
        timestamp: serverTimestamp()
      });

      // 4. Trigger the celebration
      setMatchData({ user: targetUser, message: '' });
      
      // 3. Refresh the lists
      fetchLikes();
    } catch (error) {
      console.error('Error liking back:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!profile || !matchData || !matchData.message.trim()) return;

    try {
      const chatId = [profile.uid, matchData.user.uid].sort().join('_');
      
      // 1. Create or update the Chat document
      await setDoc(doc(db, 'chats', chatId), {
        participants: [profile.uid, matchData.user.uid],
        lastMessage: matchData.message,
        updatedAt: serverTimestamp(),
        [`unreadCount.${matchData.user.uid}`]: increment(1)
      }, { merge: true });

      // 2. Add the message
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        senderId: profile.uid,
        senderName: profile.displayName,
        text: matchData.message,
        read: false,
        timestamp: serverTimestamp()
      });

      // 3. Add notification for the recipient
      await addDoc(collection(db, 'notifications'), {
        toUid: matchData.user.uid,
        fromUid: profile.uid,
        type: 'message',
        text: `${profile.displayName}: ${matchData.message.substring(0, 50)}${matchData.message.length > 50 ? '...' : ''}`,
        read: false,
        timestamp: serverTimestamp()
      });

      setMatchData(null);
    } catch (error) {
      console.error('Error sending match message:', error);
      setMatchData(null);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Conversas Simultâneas</h1>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Seus 10 canais de conexão ativa</p>
        </header>

        <div className="grid grid-cols-5 gap-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center group hover:bg-white/10 transition-all cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <MessageSquare size={14} className="text-white/20 group-hover:text-orange-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Te Curtiu</h1>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Últimas 8 pessoas que demonstraram interesse</p>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="animate-spin text-orange-500" size={24} />
            <p className="text-white/40 text-[8px] font-bold uppercase tracking-widest">Carregando...</p>
          </div>
        ) : likedByUsers.length > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {likedByUsers.map((user, i) => {
              const isMutual = allLikedUids.has(user.uid);
              return (
                <motion.div
                  key={user.uid}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "relative aspect-square rounded-[24px] overflow-hidden group border transition-all duration-500",
                    isMutual ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)] ring-2 ring-yellow-400/20" : "border-white/10"
                  )}
                >
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {isMutual && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/10 via-transparent to-yellow-500/10 pointer-events-none" />
                      <div className="absolute top-2 right-2 z-10 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border border-white/20 animate-in zoom-in duration-500 delay-300 fill-mode-both">
                        <Star size={14} className="text-black" fill="currentColor" />
                      </div>
                      <div className="absolute top-2 left-2 z-10 px-2.5 py-1 bg-yellow-400 rounded-[10px] shadow-lg border border-white/20">
                        <p className="text-[7px] font-black uppercase text-black tracking-widest">Match</p>
                      </div>
                    </>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                    <button
                      onClick={() => handleLikeBack(user)}
                      className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all hover:bg-orange-600 shadow-xl"
                    >
                      <motion.div
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        whileTap={{ scale: 0.8, rotate: -10 }}
                      >
                        <Heart size={20} fill="currentColor" />
                      </motion.div>
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2">
                     <p className="text-[8px] font-black uppercase tracking-widest truncate">{user.displayName}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center space-y-4 border border-dashed border-white/5 rounded-[32px]">
            <Heart className="text-white/5 mx-auto" size={24} />
            <p className="text-white/20 text-[8px] font-bold uppercase tracking-widest">Ainda ninguém te curtiu</p>
          </div>
        )}
      </section>

      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Suas Curtidas</h1>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Pessoas que você demonstrou interesse</p>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="animate-spin text-orange-500" size={24} />
            <p className="text-white/40 text-[8px] font-bold uppercase tracking-widest">Carregando...</p>
          </div>
        ) : likedUsers.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {likedUsers.map((user, i) => {
              const matchesYou = likerUids.has(user.uid);
              return (
                <motion.div
                  key={user.uid}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "relative aspect-[4/5] rounded-[32px] overflow-hidden group border transition-all duration-500",
                    matchesYou ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)] ring-2 ring-yellow-400/20" : "border-white/10"
                  )}
                >
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {matchesYou && (
                    <div className="absolute top-4 right-4 z-10 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border border-white/20 animate-in zoom-in duration-500 delay-300 fill-mode-both">
                      <Star size={16} className="text-black" fill="currentColor" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-xs font-black uppercase tracking-widest truncate">{user.displayName}</p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">
                        {matchesYou ? 'Vocês deram match' : 'Você curtiu'}
                      </p>
                    </div>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      matchesYou ? "bg-yellow-400" : "bg-orange-500"
                    )}>
                      {matchesYou ? <Star size={14} fill="black" className="text-black" /> : <Heart size={14} fill="white" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center space-y-4 border border-dashed border-white/5 rounded-[32px]">
            <Heart className="text-white/5 mx-auto" size={24} />
            <p className="text-white/20 text-[8px] font-bold uppercase tracking-widest">Nenhuma curtida enviada</p>
          </div>
        )}
      </section>

      <div className="p-8 bg-white/5 rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-20 h-20 relative">
          <img 
            src="/logo.png" 
            alt="Omiai Logo" 
            className="w-full h-full object-contain invert brightness-200"
            onError={(e) => {
               e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-orange-500/10 blur-xl rounded-full -z-10 animate-pulse" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest">Vantagens do Omiai</h3>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1 font-bold">Totalmente gratuito. Zero pagamentos. Conexões reais.</p>
        </div>
      </div>
      <AnimatePresence>
        {matchData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[40px] flex flex-col items-center justify-center p-6 text-center"
          >
            {/* Celebration Background Particles/Glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                animate={{ 
                  scale: [1, 1.4, 1],
                  opacity: [0.4, 0.8, 0.4],
                  rotate: [0, 180, 360] 
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-orange-500/40 via-pink-500/20 to-orange-500/40 blur-[120px] rounded-full"
              />
            </div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
              className="relative z-10 space-y-10 max-w-sm w-full"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-center"
                >
                  <div className="px-4 py-1.5 bg-orange-500 rounded-full shadow-lg shadow-orange-500/40">
                    <p className="text-[10px] text-white font-black uppercase tracking-[0.3em]">Conexão Confirmada</p>
                  </div>
                </motion.div>
                
                <motion.h2 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-7xl font-black uppercase tracking-tighter italic text-white drop-shadow-2xl"
                >
                  Match!
                </motion.h2>
              </div>

              {/* Photos Comparison - Handcrafted layout */}
              <div className="flex justify-center items-center relative py-4">
                <div className="flex -space-x-6">
                  <motion.div
                    initial={{ x: -20, rotate: -15, opacity: 0 }}
                    animate={{ x: 0, rotate: -8, opacity: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="w-36 h-36 rounded-[40px] border-[6px] border-white overflow-hidden shadow-2xl relative z-10"
                  >
                    <img src={profile?.photoURL} alt="You" className="w-full h-full object-cover" />
                  </motion.div>
                  
                  <motion.div
                    initial={{ x: 20, rotate: 15, opacity: 0 }}
                    animate={{ x: 0, rotate: 8, opacity: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="w-36 h-36 rounded-[40px] border-[6px] border-white overflow-hidden shadow-2xl relative z-20"
                  >
                    <img src={matchData.user.photoURL} alt={matchData.user.displayName} className="w-full h-full object-cover" />
                  </motion.div>
                </div>

                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.7, type: "spring" }}
                  className="absolute z-30 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl"
                >
                  <Heart size={32} className="text-orange-500" fill="currentColor" />
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <p className="text-white text-lg font-bold">
                    Omiai com {matchData.user.displayName.split(' ')[0]}
                  </p>
                  <p className="text-white/60 text-sm font-medium">
                    Sincronia perfeita detectada. <br/>Que tal dar o primeiro passo?
                  </p>
                </div>

                {/* Quick Message Input */}
                <div className="relative group">
                  <input
                    type="text"
                    value={matchData.message}
                    onChange={(e) => setMatchData({ ...matchData, message: e.target.value })}
                    placeholder="Mande um sinal..."
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-[30px] py-5 px-8 text-sm text-white focus:outline-none focus:border-white/40 transition-all placeholder:text-white/30"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    autoFocus
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!matchData.message.trim()}
                    className="absolute right-3 top-3 w-10 h-10 rounded-full bg-white flex items-center justify-center text-orange-500 disabled:opacity-50 transition-all hover:scale-110 active:scale-95 shadow-lg"
                  >
                    <Send size={18} />
                  </button>
                </div>
                
                <button 
                  onClick={() => setMatchData(null)}
                  className="text-white/40 text-[10px] uppercase font-black tracking-widest hover:text-white transition-colors pt-2"
                >
                  Responder depois
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTutorial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-[40px] p-8 max-w-sm w-full space-y-8 relative overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-pink-500" />
              
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Star className="text-orange-500" size={32} fill="currentColor" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">É um Match Real!</h2>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest leading-relaxed">
                  Vocês cruzaram caminhos e ambos deram Like. Aqui está como prosseguir:
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <Check size={16} className="text-black" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Benefício Mútuo</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-white/40 leading-normal">
                      Um match mútuo abre um canal de chat prioritário. É a forma mais direta de conexão.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={16} className="text-black" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">Inicie o Papo</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-white/40 leading-normal">
                      Vá até a aba de Mensagens agora para começar a conversa. O gelo já foi quebrado!
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={closeTutorial}
                className="w-full py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-orange-500 hover:text-white transition-all shadow-xl shadow-white/5"
              >
                Entendi, Vamos lá!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
