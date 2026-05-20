import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  interests: string[];
  hobbies: string[];
  hometown: string;
  occupation: string;
  gender: string;
  inviteCode: string;
  referredBy?: string;
  premiumExpiry?: string;
  preferences: {
    interestedIn: string[];
    ageRange: [number, number];
  };
  lastSeenLocation?: {
    latitude: number;
    longitude: number;
  };
  lastSeenAt: string;
  isPremium: boolean;
  notificationSettings?: {
    matches: boolean;
    messages: boolean;
  };
  onboardingCompleted?: boolean;
  hasSeenMatchTutorial?: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  isPremium: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isPremium = () => {
    if (!profile) return false;
    if (profile.isPremium) return true;
    if (profile.premiumExpiry) {
      return new Date(profile.premiumExpiry) > new Date();
    }
    return false;
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Initial check and creation if not exists
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            const shortUid = firebaseUser.uid.substring(0, 6).toUpperCase();
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'New User',
              photoURL: firebaseUser.photoURL || '',
              bio: '',
              interests: [],
              hobbies: [],
              hometown: '',
              occupation: '',
              gender: 'Masculino',
              inviteCode: `OMIAI-${shortUid}`,
              isPremium: false,
              preferences: {
                interestedIn: ['Feminino'],
                ageRange: [18, 99],
              },
              notificationSettings: {
                matches: true,
                messages: true,
              },
              onboardingCompleted: false,
              hasSeenMatchTutorial: false,
              lastSeenAt: serverTimestamp() as any,
              createdAt: serverTimestamp() as any,
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            setProfile(userSnap.data() as UserProfile);
          }

          // Real-time listener for profile updates
          unsubscribeProfile = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              setProfile(doc.data() as UserProfile);
            }
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        } finally {
          setLoading(false);
        }
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    
    // Optimistic update to prevent stale state redirects during navigation
    setProfile(prev => prev ? { ...prev, ...data } as UserProfile : null);
    
    await setDoc(userRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, updateProfile, isPremium }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
