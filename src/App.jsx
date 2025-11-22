import React, { useState, useEffect, useRef } from 'react'; // 👈 Se añadió useRef
import { onAuthStateChanged } from 'firebase/auth'; 
import { auth } from './config/firebase'; 
import { App as CapacitorApp } from '@capacitor/app';

// Importamos las páginas
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import CreateEventPage from './pages/CreateEventPage';
import EventDetailPage from './pages/EventDetailPage';
import NotificationsPage from './pages/NotificationsPage'; // 
import ProfilePage from './pages/ProfilePage';


export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [selectedEvent, setSelectedEvent] = useState(null); 

  // Ref para controlar el doble toque para salir
  const lastBackPressTime = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false); // 👈 Se eliminó la 's' extra

  // --- 1. MANEJO DEL BOTÓN ATRÁS (ANDROID) - Lógica Doble Toque ---
  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      
      // CASO A: Estamos en una sub-página -> Volvemos al Home
      if (view !== 'home' && view !== 'login' && view !== 'loading') {
        setView('home');
      } 
      // CASO B: Estamos en Home o Login -> Lógica de doble toque para salir
      else {
        const now = new Date().getTime();
        // Si presionó hace menos de 2 segundos, SALIMOS
        if (now - lastBackPressTime.current < 2000) {
          CapacitorApp.exitApp();
        } else {
          // Si es la primera vez, mostramos el mensaje y guardamos el tiempo
          lastBackPressTime.current = now;
          setShowExitToast(true);
          // Ocultar mensaje después de 2 segundos
          setTimeout(() => setShowExitToast(false), 2000); 
        }
      }
    });

    return () => {
      backButtonListener.remove(); // Limpiamos el listener al desmontar
    };
  }, [view]); // Se actualiza cada vez que cambia la vista


  useEffect(() => {
    if (!auth) {
      setView('error_config');
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setView('home'); 
      } else {
        setView('login'); 
      }
    });
    return () => unsubscribe();
  }, []);

  // Pantalla de error si falta configuración
  if (view === 'error_config') {
    return <div className="p-10 text-center">Error: Falta configuración de Firebase.</div>;
  }

  // Pantalla de Carga
  if (view === 'loading') {
    return <div className="h-screen flex items-center justify-center">Cargando...</div>;
  }
  
  // Si no hay usuario, mostramos Login
  if (!user) {
    return (
      <>
        <AuthPage />
        {/* Aseguramos que el toast también se pueda mostrar en el Login */}
        {showExitToast && (
          <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-sm shadow-lg z-[9999] animate-fade-in pointer-events-none">
            Presiona otra vez para salir
          </div>
        )}
      </>
    );
  }

  // Router Principal
  const renderedView = (() => {
    switch (view) {
      case 'home':
        return (
          <HomePage 
            user={user} 
            onNavigate={setView} 
            onSelectEvent={(evt) => { setSelectedEvent(evt); setView('detail'); }} 
          />
        );
      
      case 'create':
        return (
          <CreateEventPage 
            user={user} 
            onBack={() => setView('home')} 
          />
        );

      case 'detail':
        return selectedEvent ? (
          <EventDetailPage 
            event={selectedEvent} 
            user={user}
            onBack={() => setView('home')} 
          />
        ) : (
          // Si no hay evento seleccionado, volvemos al home para evitar errores
          (() => { setView('home'); return null; })()
        );

      case 'notifications':
        return (
          <NotificationsPage 
            user={user} 
            onBack={() => setView('home')} 
          />
        );
      case 'profile':
        return (
          <ProfilePage 
            user={user} 
            onBack={() => setView('home')} 
          />
        );

      default:
        return <div className="p-10">Error: Vista no encontrada ({view})</div>;
    }
  })();

  return (
    <>
      {renderedView}
      
      {/* TOAST PERSONALIZADO (Mensaje flotante abajo) */}
      {showExitToast && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-sm shadow-lg z-[9999] animate-fade-in pointer-events-none">
          Presiona otra vez para salir
        </div>
      )}
    </>
  );
}