import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Search, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { ChatView } from '../components/ChatView';

interface ChatPreview {
  id: string;
  friendId: string;
  friendName: string;
  friendPhoto: string;
  lastMessage: string;
  unreadCount: number;
  timestamp: any;
}

export const Messages = () => {
  const { profile } = useAuth();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<ChatPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!profile) return;

    // Listen to real-time chat updates where current user is a participant
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef, 
      where('participants', 'array-contains', profile.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList: ChatPreview[] = [];
      
      for (const chatDoc of snapshot.docs) {
        const data = chatDoc.data();
        const friendId = data.participants.find((uid: string) => uid !== profile.uid);
        
        if (friendId) {
          // Fetch friend's basic profile info
          // Note: In production, you might denormalize friend info into the chat doc 
          // or use a cache/state management to avoid repeated fetches.
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          if (friendDoc.exists()) {
            const friendData = friendDoc.data();
            chatList.push({
              id: chatDoc.id,
              friendId,
              friendName: friendData.displayName,
              friendPhoto: friendData.photoURL,
              lastMessage: data.lastMessage || 'Nova conexão...',
              unreadCount: data.unreadCount?.[profile.uid] || 0,
              timestamp: data.updatedAt
            });
          }
        }
      }
      
      setChats(chatList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const filteredChats = chats.filter(chat => 
    chat.friendName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <AnimatePresence>
        {selectedChat && (
          <ChatView
            chatId={selectedChat.id}
            friendName={selectedChat.friendName}
            friendPhoto={selectedChat.friendPhoto}
            onBack={() => setSelectedChat(null)}
          />
        )}
      </AnimatePresence>

      <header className="space-y-6">
        <h1 className="text-3xl font-black uppercase tracking-tighter">Mensagens</h1>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
          <input
            type="text"
            placeholder="Buscar conexões..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-orange-500 transition-all"
          />
        </div>
      </header>

      {/* Concurrent Conversations Slots */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Conversas Simultâneas ({chats.length})</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {[...Array(10)].map((_, i) => {
            const activeChat = chats[i];
            return (
              <div 
                key={i} 
                onClick={() => activeChat && setSelectedChat(activeChat)}
                className={cn(
                  "flex-shrink-0 w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group hover:bg-white/10 transition-all cursor-pointer overflow-hidden",
                  !activeChat && "border-dashed"
                )}
              >
                 {activeChat ? (
                   <div className="relative w-full h-full">
                     <img src={activeChat.friendPhoto} className="w-full h-full object-cover" alt={activeChat.friendName} />
                     {activeChat.unreadCount > 0 && (
                        <div className="absolute top-1 right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-black" />
                     )}
                   </div>
                 ) : (
                   <MessageCircle size={16} className="text-white/10 group-hover:text-orange-500 transition-colors" />
                 )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Chat List */}
      <section className="space-y-2">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-orange-500" />
            <p className="text-[8px] font-bold uppercase tracking-widest text-white/20">Sincronizando chats...</p>
          </div>
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat, i) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedChat(chat)}
              className="flex items-center gap-4 p-4 rounded-[32px] hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/10 group"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={chat.friendPhoto}
                  alt={chat.friendName}
                  className="w-16 h-16 rounded-[24px] object-cover border border-white/10"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-black rounded-full shadow-lg" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-end mb-1">
                  <h4 className="text-sm font-black uppercase tracking-widest truncate">{chat.friendName}</h4>
                  <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                    {chat.timestamp?.toDate ? chat.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recente'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                   <p className={cn(
                     "text-xs truncate font-medium transition-colors",
                     chat.unreadCount > 0 ? "text-white" : "text-white/40 group-hover:text-white/60"
                   )}>
                     {chat.lastMessage}
                   </p>
                   {chat.unreadCount > 0 && (
                     <div className="bg-orange-500 px-2 py-0.5 rounded-full shadow-lg shadow-orange-500/20">
                        <span className="text-[8px] font-black text-black">
                          {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                        </span>
                     </div>
                   )}
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="pt-20 text-center space-y-4 opacity-20">
            <MessageCircle className="mx-auto" size={48} />
            <p className="text-[10px] uppercase font-black tracking-[0.3em]">Nenhuma conversa encontrada</p>
            <p className="text-[8px] uppercase font-bold tracking-widest">Encontre novas conexões no Discover!</p>
          </div>
        )}
      </section>
    </div>
  );
};
