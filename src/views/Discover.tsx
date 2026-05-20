import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, limit, doc, setDoc, addDoc, serverTimestamp, increment, startAfter, orderBy, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Copy, MapPin, Heart, X, Sparkles, ZoomIn, Sliders, Navigation, Send, MessageSquare, MoreVertical, AlertTriangle, CheckCircle, User as UserIcon, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateDistance } from '../lib/geo';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix for Leaflet default icon issues in React
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

interface Profile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  interests: string[];
  hobbies: string[];
  age?: number;
  lastSeenLocation?: {
    latitude: number;
    longitude: number;
  };
}

export const Discover = () => {
  const { profile } = useAuth();
  const { location } = useGeolocation();
  const [rawUsers, setRawUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards');
  const [insight, setInsight] = useState<string>('Analisando conexões...');
  const [crossingInfo, setCrossingInfo] = useState<string>('Caminhos cruzados recentemente');
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [maxDistance, setMaxDistance] = useState(25);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 99]);

  // Temporary filter states for the UI
  const [tempMaxDistance, setTempMaxDistance] = useState(maxDistance);
  const [tempAgeRange, setTempAgeRange] = useState(ageRange);
  const [tempSelectedInterests, setTempSelectedInterests] = useState(selectedInterests);

  const handleOpenFilters = () => {
    setTempMaxDistance(maxDistance);
    setTempAgeRange(ageRange);
    setTempSelectedInterests(selectedInterests);
    setShowFilters(true);
  };

  const handleApplyFilters = () => {
    setMaxDistance(tempMaxDistance);
    setAgeRange(tempAgeRange);
    setSelectedInterests(tempSelectedInterests);
    setCurrentIndex(0);
    setShowFilters(false);
  };
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [matchData, setMatchData] = useState<{ user: Profile; message: string } | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  const availableInterests = [
    'Tecnologia', 'Viagens', 'Música', 'Esportes', 'Culinária', 
    'Cinema', 'Arte', 'Fotografia', 'Leitura', 'Games'
  ];

  // Filtered users based on distance and interests
  const nearbyUsers = useMemo(() => {
    if (!location) return rawUsers;
    
    return rawUsers.filter(user => {
      // Distance filter
      let matchesDistance = true;
      if (user.lastSeenLocation) {
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          user.lastSeenLocation.latitude,
          user.lastSeenLocation.longitude
        );
        matchesDistance = distance <= maxDistance;
      } else {
        // If no location, we might still want to show them if we're not being strict
        // but for this app proximity is key, so we'll skip them if strict
        matchesDistance = false; 
      }

      // Interests filter
      let matchesInterests = true;
      if (selectedInterests.length > 0) {
        matchesInterests = selectedInterests.some(interest => 
          user.interests.includes(interest)
        );
      }

      // Age filter
      const userAge = user.age || 25; // Fallback for users without age field
      const matchesAge = userAge >= ageRange[0] && userAge <= ageRange[1];

      return matchesDistance && matchesInterests && matchesAge;
    });
  }, [rawUsers, maxDistance, selectedInterests, ageRange, location]);

  const fetchInsight = async (otherUser: Profile) => {
    if (!profile) return;
    setInsight('Sincronizando almas...');
    
    try {
      // Check for real crossing info in Firestore first
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const crossingsRef = collection(db, 'crossings');
      const q = query(
        crossingsRef, 
        where('participants', 'array-contains', profile.uid)
      );
      
      const snap = await getDocs(q);
      const crossing = snap.docs.find(doc => doc.data().participants.includes(otherUser.uid));
      
      if (crossing) {
        setCrossingInfo(`Cruzaram caminhos em: ${crossing.data().locationName}`);
      } else {
        setCrossingInfo('Cruzaram caminhos há pouco');
      }

      // Fetch AI Insight
      const response = await fetch('/api/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileA: profile,
          profileB: otherUser,
        }),
      });
      const data = await response.json();
      setInsight(data.insight);
    } catch (error) {
      setInsight('Uma conexão misteriosa aguarda...');
    }
  };

  useEffect(() => {
    if (nearbyUsers[currentIndex]) {
      fetchInsight(nearbyUsers[currentIndex]);
    }
  }, [currentIndex, nearbyUsers]);

  const fetchUsers = React.useCallback(async (isLoadMore = false) => {
    if (!profile || !profile.uid) {
      setLoading(false);
      return;
    }
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setRawUsers([]);
      setLastDoc(null);
      setHasMore(true);
      setCurrentIndex(0);
    }

    try {
      const usersRef = collection(db, 'users');
      
      const interestedIn = profile.preferences?.interestedIn || [];
      const defaultGenders = profile.gender === 'Masculino' ? ['Feminino'] : ['Masculino'];
      const targetGenders = interestedIn.length > 0 ? interestedIn : defaultGenders;

      let q = query(
        usersRef, 
        where('gender', 'in', targetGenders),
        orderBy('uid'),
        limit(30)
      );

      if (isLoadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      
      const users: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid !== profile.uid) {
          users.push(data);
        }
      });

      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastDoc(lastVisible || null);
      setHasMore(querySnapshot.docs.length === 30);

      if (isLoadMore) {
        setRawUsers(prev => [...prev, ...users]);
      } else {
        setRawUsers(users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profile, lastDoc]);

  // Initial fetch
  useEffect(() => {
    fetchUsers();
  }, [profile?.uid, JSON.stringify(profile?.preferences?.interestedIn), maxDistance, JSON.stringify(selectedInterests), JSON.stringify(ageRange)]);

  // Infinite loading trigger
  useEffect(() => {
    if (currentIndex >= nearbyUsers.length - 2 && hasMore && !loading && !loadingMore && nearbyUsers.length > 0) {
      fetchUsers(true);
    }
  }, [currentIndex, nearbyUsers.length, hasMore, loading, loadingMore, fetchUsers]);

  const nextUser = () => {
    setShowReportMenu(false);
    setShowShareMenu(false);
    setReportSuccess(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleReport = () => {
    // In a real app, this would send a report to a collection
    setReportSuccess(true);
    setShowReportMenu(false);
    setTimeout(() => {
      nextUser();
    }, 2000);
  };

  const handleShare = (platform: 'whatsapp' | 'telegram' | 'copy') => {
    if (!currentUser) return;
    
    // We don't have detailed user routes yet, so we share the app and mention the user
    // In a real production app, this would be a deep link: window.location.origin + '/user/' + currentUser.uid
    const appUrl = window.location.origin;
    const shareText = `Ei! Acabei de encontrar o perfil de ${currentUser.displayName} no Omiai! Conectando pessoas por caminhos que se cruzam.`;
    
    if (platform === 'copy') {
      navigator.clipboard.writeText(`${shareText} ${appUrl}`);
      alert('Link copiado para a área de transferência!');
    } else {
      const shareUrls = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + appUrl)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(shareText)}`,
      };
      window.open(shareUrls[platform], '_blank');
    }
    setShowShareMenu(false);
  };

  const handleLike = async () => {
    if (!profile || !currentUser) return;
    
    // Set local state for rewarding animation
    setIsLiked(true);
    setTimeout(() => setIsLiked(false), 1000);

    try {
      const { addDoc, serverTimestamp, query, where, getDocs } = await import('firebase/firestore');
      
      // 1. Create the like
      await addDoc(collection(db, 'likes'), {
        fromUid: profile.uid,
        toUid: currentUser.uid,
        timestamp: serverTimestamp()
      });

      // 2. Check for mutual like (Match)
      const likesRef = collection(db, 'likes');
      const q = query(
        likesRef,
        where('fromUid', '==', currentUser.uid),
        where('toUid', '==', profile.uid)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        // It's a match!
        setMatchData({ user: currentUser, message: '' });
        
        // 3. Create the chat document immediately
        const chatId = [profile.uid, currentUser.uid].sort().join('_');
        await setDoc(doc(db, 'chats', chatId), {
          participants: [profile.uid, currentUser.uid],
          lastMessage: '',
          updatedAt: serverTimestamp(),
          unreadCount: {
            [profile.uid]: 0,
            [currentUser.uid]: 0
          }
        }, { merge: true });

        // 4. Create notifications for both
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
          toUid: currentUser.uid,
          fromUid: profile.uid,
          type: 'match',
          text: `Você deu match com ${profile.displayName}!`,
          read: false,
          timestamp: serverTimestamp()
        });
        await addDoc(notificationsRef, {
          toUid: profile.uid,
          fromUid: currentUser.uid,
          type: 'match',
          text: `Parabéns! Novo match com ${currentUser.displayName}!`,
          read: false,
          timestamp: serverTimestamp()
        });
      } else {
        nextUser();
      }
    } catch (error) {
       nextUser();
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
      nextUser();
    } catch (error) {
      console.error('Error sending match message:', error);
      setMatchData(null);
      nextUser();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
        <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Escaneando caminhos...</p>
      </div>
    );
  }

  const currentUser = nearbyUsers[currentIndex];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full animate-pulse" />
            <img 
              src="/logo.png" 
              alt="Omiai Logo" 
              className="w-12 h-12 object-contain relative z-10 invert brightness-200"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Omiai</h1>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
              {location ? `Rastreamento Ativo • ${maxDistance}km` : 'Aguardando localização...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === 'cards' ? "bg-orange-500 text-black shadow-lg" : "text-white/40 hover:text-white"
              )}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === 'map' ? "bg-orange-500 text-black shadow-lg" : "text-white/40 hover:text-white"
              )}
            >
              <MapIcon size={18} />
            </button>
          </div>
          <button 
            onClick={() => showFilters ? setShowFilters(false) : handleOpenFilters()}
            className={cn(
              "p-3 rounded-2xl border transition-all",
              showFilters ? "bg-orange-500 border-orange-500 text-black" : "bg-white/5 border-white/10 text-white/60 hover:text-white"
            )}
          >
            <Sliders size={20} />
          </button>
        </div>
      </header>

      {/* Distance Filter UI */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-8 bg-white/5 border border-white/10 rounded-[40px] space-y-10 mb-8 backdrop-blur-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Distance Slider */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Navigation size={14} className="text-orange-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Distância Máxima</p>
                    </div>
                    <span className="text-xs font-bold text-orange-500">{tempMaxDistance}km</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    value={tempMaxDistance}
                    onChange={(e) => {
                      setTempMaxDistance(Number(e.target.value));
                    }}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-[8px] font-bold text-white/20 uppercase tracking-widest">
                    <span>1km</span>
                    <span>25km</span>
                    <span>50km</span>
                  </div>
                </div>

                {/* Age Range Slider */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <UserIcon size={14} className="text-orange-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Faixa de Idade</p>
                    </div>
                    <span className="text-xs font-bold text-orange-500">{tempAgeRange[0]} - {tempAgeRange[1]} anos</span>
                  </div>
                  
                  <div className="relative h-6 flex items-center">
                    <div className="absolute w-full h-1.5 bg-white/10 rounded-lg" />
                    <div 
                      className="absolute h-1.5 bg-orange-500 rounded-lg"
                      style={{
                        left: `${((tempAgeRange[0] - 18) / (99 - 18)) * 100}%`,
                        right: `${100 - ((tempAgeRange[1] - 18) / (99 - 18)) * 100}%`
                      }}
                    />
                    <input 
                      type="range" 
                      min="18" 
                      max="99" 
                      value={tempAgeRange[0]}
                      onChange={(e) => {
                        const val = Math.min(Number(e.target.value), tempAgeRange[1] - 1);
                        setTempAgeRange([val, tempAgeRange[1]]);
                      }}
                      className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none cursor-pointer accent-orange-500 z-10 [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
                    />
                    <input 
                      type="range" 
                      min="18" 
                      max="99" 
                      value={tempAgeRange[1]}
                      onChange={(e) => {
                        const val = Math.max(Number(e.target.value), tempAgeRange[0] + 1);
                        setTempAgeRange([tempAgeRange[0], val]);
                      }}
                      className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none cursor-pointer accent-orange-500 z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-bold text-white/20 uppercase tracking-widest">
                    <span>18 anos</span>
                    <span>99 anos</span>
                  </div>
                </div>
              </div>

              {/* Interests Multi-Select */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-orange-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Filtrar por Interesses</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableInterests.map((interest) => {
                    const isSelected = tempSelectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        onClick={() => {
                          const newSelection = isSelected
                            ? tempSelectedInterests.filter(i => i !== interest)
                            : [...tempSelectedInterests, interest];
                          setTempSelectedInterests(newSelection);
                        }}
                        className={cn(
                          "px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                          isSelected 
                            ? "bg-orange-500 border-orange-500 text-black shadow-lg shadow-orange-500/20" 
                            : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                        )}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-4">
                  <button 
                    onClick={handleApplyFilters}
                    className="px-6 py-2.5 bg-white/10 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-orange-500 hover:border-orange-500 hover:text-black transition-all"
                  >
                    Confirmar
                  </button>
                  {tempSelectedInterests.length > 0 && (
                    <button 
                      onClick={() => {
                        setTempSelectedInterests([]);
                      }}
                      className="text-[8px] font-bold uppercase tracking-widest text-white/20 hover:text-white/40 active:text-orange-500 transition-colors"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <AnimatePresence mode="wait">
          {viewMode === 'map' ? (
            <motion.div
              key="map-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-[60vh] rounded-[40px] overflow-hidden border border-white/10 shadow-2xl relative z-0"
            >
              <MapContainer
                center={[
                  location?.coords.latitude || -23.5505,
                  location?.coords.longitude || -46.6333
                ]}
                zoom={13}
                scrollWheelZoom={true}
                className="w-full h-full"
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://openfreemap.org/">OpenFreeMap</a> contributors'
                  url="https://tiles.openfreemap.org/styles/liberty/{z}/{x}/{y}.png"
                />
                
                {/* User's own location */}
                {location && (
                  <Marker 
                    position={[location.coords.latitude, location.coords.longitude]}
                    icon={L.divIcon({
                      className: 'custom-div-icon',
                      html: `<div class="relative w-6 h-6">
                        <div class="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
                        <div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-lg relative z-10"></div>
                      </div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  />
                )}

                {/* Nearby users */}
                {nearbyUsers.map((user, idx) => {
                  if (!user.lastSeenLocation) return null;
                  return (
                    <Marker
                      key={user.uid}
                      position={[user.lastSeenLocation.latitude, user.lastSeenLocation.longitude]}
                      eventHandlers={{
                        click: () => {
                          setCurrentIndex(idx);
                          setViewMode('cards');
                        },
                      }}
                      icon={L.divIcon({
                        className: 'user-marker-icon',
                        html: `<div class="relative group">
                          <div class="w-10 h-10 rounded-2xl border-2 border-orange-500 overflow-hidden shadow-lg transform transition-transform group-hover:scale-110 active:scale-95 bg-black">
                            <img src="${user.photoURL}" alt="${user.displayName}" class="w-full h-full object-cover" />
                          </div>
                          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-orange-500 rotate-45 border-b border-r border-orange-500 shadow-sm"></div>
                        </div>`,
                        iconSize: [40, 40],
                        iconAnchor: [20, 40]
                      })}
                    >
                      <Popup className="custom-popup">
                        <div className="p-2 text-center">
                          <p className="text-xs font-bold uppercase tracking-widest text-black">{user.displayName}</p>
                          <button 
                            className="text-[10px] text-orange-500 font-bold uppercase mt-1"
                            onClick={() => {
                              setCurrentIndex(idx);
                              setViewMode('cards');
                            }}
                          >
                            Ver Perfil
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              
              {/* Map Floating Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl z-[1000]">
                <span className="px-4 py-2 bg-orange-500/20 text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-orange-500/20">
                  {nearbyUsers.length} Pessoas Próximas
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="card-view"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
            {!currentUser || currentIndex >= nearbyUsers.length ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                {loadingMore ? (
                  <div className="space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500 mx-auto"></div>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Buscando mais conexões...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                      <MapPin className="text-white/20" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold">Ninguém por perto</h2>
                    <div className="space-y-4 max-w-xs mx-auto">
                      <p className="text-white/40">
                        {hasMore 
                          ? "Encontramos alguns usuários, mas nenhum dentro do seu raio de alcance ou interesses." 
                          : "Você explorou todos os caminhos desta região por enquanto!"}
                      </p>
                      <div className="flex flex-col gap-2">
                        {hasMore && (
                          <button 
                            onClick={() => fetchUsers(true)}
                            className="px-6 py-3 bg-orange-500 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-orange-600 transition-all shadow-lg"
                          >
                            Carregar Mais Usuários
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setTempMaxDistance(50);
                            setMaxDistance(50);
                            setCurrentIndex(0);
                          }}
                          className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 hover:text-orange-400 transition-colors py-2"
                        >
                          Aumentar para 50km
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentUser.uid}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative aspect-[3/4] w-full rounded-[40px] overflow-hidden bg-white/5 group border border-white/10"
                  >
                    {/* Profile Image */}
                    <div 
                      className="absolute inset-0 cursor-zoom-in group"
                      onClick={() => setIsZoomed(true)}
                    >
                      <img
                        src={currentUser.photoURL || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'}
                        alt={currentUser.displayName}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute top-6 right-6 p-3 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn size={20} className="text-white/60" />
                      </div>

                      {/* Action Buttons on Card */}
                      <div className="absolute bottom-6 right-6 flex items-center gap-4 z-20">
                        <div className="group/tooltip relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              nextUser();
                            }}
                            className="w-14 h-14 bg-white/10 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white/40 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all transform hover:scale-110 active:scale-95 shadow-xl"
                          >
                            <X size={28} />
                          </button>
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
                            Rejeitar
                          </div>
                        </div>

                        <div className="group/tooltip relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLike();
                            }}
                            className={cn(
                              "relative w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-orange-500/40 transition-all transform hover:scale-110 active:scale-95",
                              isLiked ? "bg-white text-orange-500" : "bg-orange-500"
                            )}
                          >
                            <motion.div
                              animate={isLiked ? { scale: [1, 2, 1], rotate: [0, 15, -15, 0] } : {}}
                              transition={{ duration: 0.5 }}
                            >
                              <Heart size={28} fill="currentColor" />
                            </motion.div>

                            <AnimatePresence>
                              {isLiked && (
                                <motion.div
                                  initial={{ opacity: 0, y: 0, scale: 0 }}
                                  animate={{ opacity: [0, 1, 0], y: -50, scale: [0.5, 1.5, 0.5], x: [0, 10, -10, 0] }}
                                  exit={{ opacity: 0 }}
                                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                >
                                  <Heart size={40} fill="currentColor" className="text-orange-500" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </button>
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
                            Curtir
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Actions (Menu/Share) */}
                    <div className="absolute top-6 left-6 z-10 flex gap-2">
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowShareMenu(!showShareMenu);
                          setShowReportMenu(false);
                        }}
                        className={cn(
                          "p-3 rounded-2xl border transition-all",
                          showShareMenu ? "bg-orange-500 border-orange-500 text-black" : "bg-black/20 backdrop-blur-md border-white/10 text-white/60 hover:text-white"
                        )}
                      >
                        <Share2 size={20} />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReportMenu(!showReportMenu);
                          setShowShareMenu(false);
                        }}
                        className="p-3 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10 text-white/60 hover:text-white transition-all"
                      >
                        <MoreVertical size={20} />
                      </button>

                      <AnimatePresence>
                        {showShareMenu && (
                          <motion.div
                            initial={{ opacity: 0, x: -10, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -10, scale: 0.95 }}
                            className="absolute top-0 left-14 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 min-w-[180px] shadow-2xl overflow-hidden z-20"
                          >
                            <p className="px-4 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 mb-1">Compartilhar Perfil</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShare('whatsapp');
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-bold uppercase tracking-widest text-left"
                            >
                              <MessageSquare size={14} className="text-green-500" />
                              WhatsApp
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShare('telegram');
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-bold uppercase tracking-widest text-left"
                            >
                              <Send size={14} className="text-blue-400" />
                              Telegram
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShare('copy');
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-bold uppercase tracking-widest text-left"
                            >
                              <Copy size={14} className="text-orange-500" />
                              Copiar Link
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showReportMenu && (
                          <motion.div
                            initial={{ opacity: 0, x: -10, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -10, scale: 0.95 }}
                            className="absolute top-0 left-14 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 min-w-[160px] shadow-2xl overflow-hidden z-20"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReport();
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-white/5 rounded-xl transition-colors text-xs font-black uppercase tracking-widest"
                            >
                              <AlertTriangle size={16} />
                              Denunciar Perfil
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Report Success Overlay */}
                    <AnimatePresence>
                      {reportSuccess && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
                        >
                          <motion.div
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-6"
                          >
                            <CheckCircle size={40} />
                          </motion.div>
                          <h4 className="text-2xl font-black uppercase tracking-tighter mb-2">Denúncia Recebida</h4>
                          <p className="text-white/40 text-xs font-bold uppercase tracking-widest leading-relaxed">
                            Obrigado por nos ajudar a manter a comunidade segura. Analisaremos este perfil em breve.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 pointer-events-none" />

                    {/* Info Card */}
                    <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-end justify-between"
                      >
                        <div>
                          <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">
                            {currentUser.displayName}
                          </h3>
                          <div className="flex items-center gap-2 mt-2 text-white/60">
                            <MapPin size={14} className="text-orange-500" />
                            <span className="text-xs font-bold uppercase tracking-[0.1em]">{crossingInfo}</span>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-wrap gap-2"
                      >
                        {currentUser.interests.slice(0, 3).map((interest) => (
                          <span
                            key={interest}
                            className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10"
                          >
                            {interest}
                          </span>
                        ))}
                      </motion.div>

                      <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-white/60 text-sm font-medium line-clamp-2 leading-relaxed"
                      >
                        {currentUser.bio || "Sem biografia ainda. Vamos conversar para descobrir!"}
                      </motion.p>

                      {/* AI Insights Chip */}
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, type: 'spring', damping: 15 }}
                        className="pt-2"
                      >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-2xl border border-orange-500/30">
                          <Sparkles size={12} className="text-orange-500" />
                          <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest">
                            Omiai Insight: {insight}
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="flex justify-center gap-6 pt-6">
                  <div className="group/tooltip relative">
                    <button
                      onClick={nextUser}
                      className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-red-500 hover:bg-red-500/5 hover:border-red-500/20 transition-all transform hover:scale-110 hover:-rotate-12 active:scale-90 shadow-lg"
                    >
                      <X size={32} />
                    </button>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-2xl">
                      Rejeitar
                    </div>
                  </div>

                  <div className="group/tooltip relative">
                    <button
                      onClick={handleLike}
                      className={cn(
                        "relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl shadow-orange-500/40 transition-all transform hover:scale-110 hover:rotate-12 active:scale-95",
                        isLiked ? "bg-white text-orange-500" : "bg-orange-500"
                      )}
                    >
                      <motion.div
                        animate={isLiked ? { scale: [1, 1.4, 1], rotate: [0, 20, -20, 0] } : {}}
                        transition={{ duration: 0.4 }}
                      >
                        <Heart size={36} fill="currentColor" />
                      </motion.div>
                      
                      {/* Reward Particles */}
                      <AnimatePresence>
                        {isLiked && [...Array(3)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 0, x: 0 }}
                            animate={{ 
                              opacity: [0, 1, 0], 
                              y: -100 - (i * 20), 
                              x: (i - 1) * 30,
                              scale: [0.5, 1, 0.5],
                              rotate: (i - 1) * 20
                            }}
                            className="absolute pointer-events-none"
                          >
                            <Heart size={20 + (i * 4)} fill="currentColor" className="text-orange-500" />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </button>
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-2xl" >
                      Curtir
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <AnimatePresence>
        {isZoomed && currentUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-0 md:p-10 cursor-zoom-out"
            onClick={() => {
              setIsZoomed(false);
              setZoomScale(1);
            }}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10 hover:bg-white/20 transition-all z-20"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(false);
                setZoomScale(1);
              }}
            >
              <X size={24} />
            </motion.button>
            
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: zoomScale,
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full max-w-4xl h-full md:h-[85vh] rounded-[40px] overflow-hidden border border-white/10 shadow-2xl cursor-zoom-in"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomScale(zoomScale === 1 ? 1.8 : 1);
                }}
              >
                <img
                  src={currentUser.photoURL || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'}
                  alt={currentUser.displayName}
                  className="w-full h-full object-cover select-none"
                  draggable={false}
                />
                <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">{currentUser.displayName}</h3>
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{crossingInfo}</p>
                </div>
                
                {/* Scale Indicator */}
                <div className="absolute top-8 left-8 px-4 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    Zoom: {zoomScale === 1 ? '100%' : '180%'}
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <p className="text-[10px] text-white font-black uppercase tracking-[0.3em]">Sincronia Encontrada</p>
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
                    Você e {matchData.user.displayName.split(' ')[0]}
                  </p>
                  <p className="text-white/60 text-sm font-medium">
                    Seus caminhos parecem destinados a cruzar. <br/>Dê o primeiro passo agora!
                  </p>
                </div>

                {/* Quick Message Input */}
                <div className="relative group">
                  <input
                    type="text"
                    value={matchData.message}
                    onChange={(e) => setMatchData({ ...matchData, message: e.target.value })}
                    placeholder="Diga algo incrível..."
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
                  onClick={() => {
                    setMatchData(null);
                    nextUser();
                  }}
                  className="text-white/40 text-[10px] uppercase font-black tracking-widest hover:text-white transition-colors pt-2"
                >
                  Deixar para depois
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
