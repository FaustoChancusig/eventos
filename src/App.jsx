import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; 
import { auth } from './config/firebase'; // 👈 Importa la instancia de Auth limpia

// Importa todas las páginas
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import CreateEventPage from './pages/CreateEventPage';
import EventDetailPage from './pages/EventDetailPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [selectedEvent, setSelectedEvent] = useState(null); 

  // Efecto que escucha los cambios de sesión
  useEffect(() => {
    // Si la inicialización de Firebase falló (por credenciales), mostramos error
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

  // Manejo de error de configuración
  if (view === 'error_config') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6 text-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-red-600 font-bold text-xl mb-4">¡Falta Configuración!</h2>
          <p className="text-gray-600">Revisa que tus credenciales en <code className="bg-gray-200 px-1 rounded">src/config/firebase.js</code> sean correctas.</p>
        </div>
      </div>
    );
  }

  // Renderizado de Pantalla de Carga
  if (view === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-bold">
        Cargando App...
      </div>
    );
  }
  
  // Si no hay usuario, mostramos el Login
  if (!user) {
    return <AuthPage />;
  }

  // Router Principal (Vistas Protegidas)
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
      // Aseguramos que haya un evento antes de renderizar
      return selectedEvent ? (
        <EventDetailPage 
          event={selectedEvent} 
          onBack={() => setView('home')} 
        />
      ) : (
        // Si no hay evento, volvemos a Home para evitar errores
        (() => { setView('home'); return null; })()
      );

    default:
      return <div>Error: Vista no encontrada ({view})</div>;
  }
}