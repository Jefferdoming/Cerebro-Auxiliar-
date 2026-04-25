
import { useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { NotificationService } from '../services/notificationService';

export default function NotificationManager() {
  const lastCheckedMinute = useRef<string>('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const routineRef = doc(db, 'routines', auth.currentUser.uid);
    
    const unsub = onSnapshot(routineRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const times = data.times;
      const medication = data.medication;

      // Check every minute
      const interval = setInterval(() => {
        const now = new Date();
        const currentMinute = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (currentMinute === lastCheckedMinute.current) return;
        lastCheckedMinute.current = currentMinute;

        // Check medication times
        const { morning, afternoon, night } = times;
        const meds = medication;

        if (morning === currentMinute && !meds.morning) {
          NotificationService.showNotification(
            "🌅 Ritual da Manhã",
            "Hora da medicação e de começar seu dia com calma."
          );
        }
        
        if (afternoon === currentMinute && !meds.afternoon) {
          NotificationService.showNotification(
            "☀️ Ritual da Tarde",
            "Lembrete: Medicação da tarde! Como está seu foco?"
          );
        }
        
        if (night === currentMinute && !meds.night) {
          NotificationService.showNotification(
            "🌙 Ritual da Noite",
            "Hora de desconectar e tomar a medicação da noite."
          );
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    });

    return unsub;
  }, []);

  return null; // This is a logic-only component
}
