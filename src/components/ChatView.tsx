import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, ArrowLeft, MoreVertical, Loader2, Image as ImageIcon, Smile, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment,
  writeBatch
} from 'firebase/firestore';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  read: boolean;
  timestamp: any;
}

interface ChatViewProps {
  chatId: string;
  friendName: string;
  friendPhoto: string;
  onBack: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ chatId, friendName, friendPhoto, onBack }) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
      setTimeout(scrollToBottom, 100);

      // Mark messages from the other user as read
      const unreadFromFriend = snapshot.docChanges()
        .filter(change => change.type === 'added')
        .map(change => ({ id: change.doc.id, ...change.doc.data() } as Message))
        .filter(m => m.senderId !== profile?.uid && !m.read);

      if (unreadFromFriend.length > 0) {
        const batch = writeBatch(db);
        unreadFromFriend.forEach(m => {
          batch.update(doc(db, 'chats', chatId, 'messages', m.id), { read: true });
        });
        // Also clear unread count for current user in the chat doc
        batch.update(doc(db, 'chats', chatId), {
          [`unreadCount.${profile?.uid}`]: 0
        });
        batch.commit();
      }
    });

    return () => unsubscribe();
  }, [chatId, profile?.uid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !profile) return;

    const text = inputText.trim();
    setInputText('');

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: profile.uid,
        senderName: profile.displayName,
        text,
        read: false,
        timestamp: serverTimestamp()
      });

      // Find the friend's UID (chatId is usually uid1_uid2)
      const friendId = chatId.split('_').find(id => id !== profile.uid);

      // Update chat doc with last message and increment unread count for friend
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        [`unreadCount.${friendId}`]: increment(1)
      });

      // Also create a notification for the recipient
      if (friendId) {
        await addDoc(collection(db, 'notifications'), {
          toUid: friendId,
          fromUid: profile.uid,
          type: 'message',
          text: `${profile.displayName}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
          read: false,
          timestamp: serverTimestamp()
        });
      }

      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <header className="p-4 border-b border-white/10 flex items-center gap-4 bg-black/80 backdrop-blur-xl sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <img src={friendPhoto} alt={friendName} className="w-10 h-10 rounded-full object-cover border border-white/10" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">{friendName}</h3>
            <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Online Agora</p>
          </div>
        </div>
        <button className="p-2 text-white/40 hover:text-white transition-colors">
          <MoreVertical size={20} />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-orange-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 opacity-20 space-y-4">
            <Send className="mx-auto" size={40} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Comece a conversa!</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderId === profile?.uid;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className={cn(
                  "px-4 py-3 rounded-[24px] text-sm font-medium relative",
                  isMe 
                    ? "bg-orange-500 text-black rounded-tr-none" 
                    : "bg-white/5 text-white border border-white/10 rounded-tl-none"
                )}>
                  {m.text}
                </div>
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                    {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                  </span>
                  {isMe && (
                    <span className="text-black/40">
                      {m.read ? <CheckCheck size={10} className="text-green-400" /> : <Check size={10} />}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <footer className="p-4 bg-black border-t border-white/10">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <button type="button" className="p-2 text-white/40 hover:text-white transition-colors">
            <ImageIcon size={20} />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 pr-10 text-sm font-medium focus:outline-none focus:border-orange-500 transition-all"
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
              <Smile size={18} />
            </button>
          </div>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className={cn(
              "p-3 rounded-2xl transition-all",
              inputText.trim() ? "bg-orange-500 text-black shadow-lg" : "bg-white/5 text-white/20"
            )}
          >
            <Send size={20} />
          </button>
        </form>
      </footer>
    </div>
  );
};
