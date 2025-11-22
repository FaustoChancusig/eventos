import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; 
import { auth } from './config/firebase'; 
import { App as CapacitorApp } from '@capacitor/app';

// Importamos las páginas
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import CreateEventPage from './pages/CreateEventPage';
import EventDetailPage from './pages/EventDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [selectedEvent, setSelectedEvent] = useState(null); 
  
  // 🆕 NUEVO: Estado para saber si estamos editando un evento existente
  const [eventToEdit, setEventToEdit] = useState(null);

  // Ref para controlar el doble toque para salir
  const lastBackPressTime = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);

  // --- MANEJO DEL BOTÓN ATRÁS (ANDROID) ---
  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      
      // Si no estamos en Home/Login/Loading, volvemos atrás
      if (view !== 'home' && view !== 'login' && view !== 'loading') {
        // Si estábamos en 'create' (editando o creando), limpiamos el estado de edición
        if (view === 'create') {
          setEventToEdit(null);
        }
        setView('home');
      } 
      // Si estamos en Home, lógica de doble toque para salir
      else {
        const now = new Date().getTime();
        if (now - lastBackPressTime.current < 2000) {
          CapacitorApp.exitApp();
        } else {
          lastBackPressTime.current = now;
          setShowExitToast(true);
          setTimeout(() => setShowExitToast(false), 2000); 
        }
      }
    });

    return () => {
      backButtonListener.remove();
    };
  }, [view]);

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

  if (view === 'error_config') {
    return <div className="p-10 text-center">Error: Falta configuración de Firebase.</div>;
  }

  if (view === 'loading') {
    return <div className="h-screen flex items-center justify-center">Cargando...</div>;
  }
  
  if (!user) {
    return (
      <>
        <AuthPage />
        {showExitToast && (
          <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-sm shadow-lg z-[9999] pointer-events-none">
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
            onNavigate={(target) => {
                // Al ir a crear desde el home, nos aseguramos de que sea uno nuevo
                if (target === 'create') setEventToEdit(null);
                setView(target);
            }} 
            onSelectEvent={(evt) => { setSelectedEvent(evt); setView('detail'); }} 
          />
        );
      
      case 'create':
        return (
          <CreateEventPage 
            user={user} 
            onBack={() => { setEventToEdit(null); setView('home'); }} 
            eventToEdit={eventToEdit} // 🆕 Pasamos el evento a editar (si existe)
          />
        );

      case 'detail':
        return selectedEvent ? (
          <EventDetailPage 
            event={selectedEvent} 
            user={user}
            onBack={() => setView('home')} 
            onEdit={(evt) => { // 🆕 Callback cuando el usuario pulsa Editar
                setEventToEdit(evt);
                setView('create');
            }}
          />
        ) : (
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
      {showExitToast && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-sm shadow-lg z-[9999] pointer-events-none animate-fade-in">
          Presiona otra vez para salir
        </div>
      )}
    </>
  );
}