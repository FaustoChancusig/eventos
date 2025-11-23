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
  
  // 🆕 Estado para controlar si el detalle está en overlay (bottom sheet)
  const [isDetailOverlayOpen, setIsDetailOverlayOpen] = useState(false);

  // 🆕 NUEVO: Estado para saber si estamos editando un evento existente
  const [eventToEdit, setEventToEdit] = useState(null);

  // Ref para controlar el doble toque para salir
  const lastBackPressTime = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);

  // --- MANEJO DEL BOTÓN ATRÁS (ANDROID) ---
  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {

      // 🆕 Primero: si está abierto el overlay de detalle, lo cerramos
      if (isDetailOverlayOpen && selectedEvent) {
        setIsDetailOverlayOpen(false);
        // pequeño delay para permitir la animación antes de limpiar el evento
        setTimeout(() => setSelectedEvent(null), 200);
        return;
      }
      
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
  }, [view, isDetailOverlayOpen, selectedEvent]);

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
              if (target === 'create') {
                setEventToEdit(null);
              }
              setView(target);
            }} 
            // 🆕 Ahora solo abrimos overlay, no cambiamos a 'detail'
            onSelectEvent={(evt) => { 
              setSelectedEvent(evt); 
              setIsDetailOverlayOpen(true);
            }} 
          />
        );
      
      case 'create':
        return (
          <CreateEventPage 
            user={user} 
            onBack={() => { 
              setEventToEdit(null); 
              setView('home'); 
            }} 
            eventToEdit={eventToEdit}
          />
        );

      // ❌ Ya no usamos 'detail' como vista aparte, ahora es overlay sobre Home
      // case 'detail': ...

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

      {/* 🆕 OVERLAY DETALLE DE EVENTO (Bottom sheet mobile friendly) */}
      {selectedEvent && isDetailOverlayOpen && (
        <div className="fixed inset-0 z-[998] bg-black/40 backdrop-blur-sm flex items-end animate-fade-in">
          {/* Capa para cerrar al tocar fuera */}
          <div 
            className="absolute inset-0"
            onClick={() => {
              setIsDetailOverlayOpen(false);
              setTimeout(() => setSelectedEvent(null), 200);
            }}
          ></div>

          {/* Contenedor tipo bottom-sheet */}
          <div className="relative w-full h-[92%] bg-gray-100 rounded-t-[32px] shadow-2xl z-[999] animate-slide-up overflow-hidden">
            <EventDetailPage 
              event={selectedEvent} 
              user={user}
              // Back dentro del detalle → solo cierra overlay
              onBack={() => {
                setIsDetailOverlayOpen(false);
                setTimeout(() => setSelectedEvent(null), 200);
              }} 
              // Editar → cierra overlay y abre Create con el evento cargado
              onEdit={(evt) => { 
                setIsDetailOverlayOpen(false);
                setSelectedEvent(null);
                setEventToEdit(evt);
                setView('create');
              }}
            />
          </div>
        </div>
      )}

      {showExitToast && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-sm shadow-lg z-[9999] pointer-events-none animate-fade-in">
          Presiona otra vez para salir
        </div>
      )}
    </>
  );
}
