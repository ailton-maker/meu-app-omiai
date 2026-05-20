import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { calculateDistance } from '../lib/geo';

export interface LocationState {
  coords: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
}

export const useGeolocation = () => {
  const { profile, updateProfile } = useAuth();
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const newState = {
        coords: { latitude, longitude },
        timestamp: position.timestamp,
      };
      setLocation(newState);

      // Update Firebase Profile with new location if it moved significantly
      if (profile) {
        updateProfile({
          lastSeenLocation: { latitude, longitude },
          lastSeenAt: new Date().toISOString(),
        });

        // Log to location history if moved | throttled
        // For the demo, we'll just log it if it's the first time or if they moved ~500m
        const addHistory = async () => {
          const { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } = await import('firebase/firestore');
          const historyRef = collection(db, 'users', profile.uid, 'location_history');
          
          // Check last record to avoid spam
          const q = query(historyRef, orderBy('timestamp', 'desc'), limit(1));
          const snap = await getDocs(q);
          let shouldLog = true;

          if (!snap.empty) {
            const lastLog = snap.docs[0].data();
            const dist = calculateDistance(
              latitude, longitude,
              lastLog.coords.latitude, lastLog.coords.longitude
            );
            // Only log if moved more than 500 meters
            if (dist < 0.5) shouldLog = false;
          }

          if (shouldLog) {
            await addDoc(historyRef, {
              coords: { latitude, longitude },
              timestamp: serverTimestamp(),
            });
          }
        };
        addHistory().catch(console.error);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      setError(error.message);
    };

    const watcherId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });

    return () => navigator.geolocation.clearWatch(watcherId);
  }, [profile?.uid]);

  return { location, error };
};
