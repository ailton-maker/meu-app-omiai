import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageSquare, X } from 'lucide-react';
import { cn } from '../lib/utils';

export const NotificationManager = () => {
  const { profile } = useAuth();
  const [activeNotification, setActiveNotification] = useState<any>(null);

  useEffect(() => {
    if (!profile || !profile.uid) return;

    // Listen for new unread notifications
    const q = query(
      collection(db, 'notifications'),
      where('toUid', '==', profile.uid),
      where('read', '==', false),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          
          // Check user local preferences from profile
          const settings = profile.notificationSettings || { matches: true, messages: true };
          if (data.type === 'match' && !settings.matches) return;
          if (data.type === 'message' && !settings.messages) return;

          // Prevent notifying about one's own actions (though logic should handle this)
          if (data.fromUid === profile.uid) return;

          setActiveNotification({ id: change.doc.id, ...data });
          
          // Trigger browser notification if possible
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
             try {
               new Notification('Omiai', {
                 body: data.text,
                 // Using a generic icon if logo not available
                 icon: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixlib=rb-1.2.1&auto=format&fit=crop&w=128&x=128&q=80'
               });
             } catch (e) {
               console.warn('Browser notification failed', e);
             }
          }
        }
      });
    }, (error) => {
      console.warn('Notification listener error (likely rules not set yet):', error);
    });

    return () => unsubscribe();
  }, [profile?.uid, profile?.notificationSettings]);

  // Request browser permission on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (activeNotification) {
      const timer = setTimeout(() => {
        setActiveNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeNotification]);

  return (
    <AnimatePresence>
      {activeNotification && (
        <motion.div
          initial={{ y: -100, opacity: 0, x: '-50%' }}
          animate={{ y: 20, opacity: 1, x: '-50%' }}
          exit={{ y: -100, opacity: 0, x: '-50%' }}
          className="fixed top-0 left-1/2 z-[200] w-[calc(100%-32px)] max-w-sm px-4 py-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex items-center gap-4 cursor-pointer"
          onClick={() => setActiveNotification(null)}
        >
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
            activeNotification.type === 'match' ? "bg-orange-500 shadow-lg shadow-orange-500/20" : "bg-blue-500 shadow-lg shadow-blue-500/20"
          )}>
            {activeNotification.type === 'match' ? <Heart size={18} fill="white" className="text-white" /> : <MessageSquare size={18} fill="white" className="text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
              {activeNotification.type === 'match' ? 'Sinergia Encontrada' : 'Nova Mensagem'}
            </p>
            <p className="text-xs font-bold text-white truncate">{activeNotification.text}</p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveNotification(null); }}
            className="text-white/20 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
