import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; 
import { auth } from './config/firebase'; 

// Importamos las páginas
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import CreateEventPage from './pages/CreateEventPage';
import EventDetailPage from './pages/EventDetailPage';
import NotificationsPage from './pages/NotificationsPage'; // <--- Asegúrate de tener este archivo
import ProfilePage from './pages/ProfilePage';


export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [selectedEvent, setSelectedEvent] = useState(null); 

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
    return <AuthPage />;
  }

  // Router Principal
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
          onBack={() => setView('home')} 
        />
      ) : (
        // Si no hay evento seleccionado, volvemos al home para evitar errores
        (() => { setView('home'); return null; })()
      );

    // --- AQUÍ ESTABA EL PROBLEMA: FALTABA ESTE CASO ---
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

  
}