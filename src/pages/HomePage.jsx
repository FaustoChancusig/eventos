import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, deleteDoc, or } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { 
  Search, Bell, Calendar, MapPin, Clock, User, 
  ChevronDown, Filter, PartyPopper, X, Check, Crown
} from 'lucide-react';

export default function HomePage({ user, onNavigate, onSelectEvent }) {
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [filterType, setFilterType] = useState('upcoming'); 
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNewNotifs, setHasNewNotifs] = useState(false);

  // 1. Cargar Eventos
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'events'), 
      or(
        where("creatorId", "==", user.uid),
        where("guestIds", "array-contains", user.uid)
      )
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        isMyEvent: doc.data().creatorId === user.uid 
      }));
      
      eventsData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setEvents(eventsData);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Cargar Notificaciones
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'notifications'), where('status', '==', 'pending'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setNotifications(notifs);
      setHasNewNotifs(!snapshot.empty);
    });
    return () => unsubscribe();
  }, [user]);

  const handleQuickViewNotif = () => {
    setShowNotifications(false);
    onNavigate('notifications');
  };

  // Filtrado
  const today = new Date().toISOString().split('T')[0];
  const filteredEvents = events.filter(evt => {
    const isDateMatch = filterType === 'upcoming' ? evt.date >= today : evt.date < today;
    const isSearchMatch = isSearchOpen ? evt.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    return isDateMatch && isSearchMatch;
  });

  const displayName = user?.displayName?.split(' ')[0] || 'Usuario';

  return (
    <div className="flex flex-col w-full h-screen bg-gray-50 font-sans relative overflow-hidden">
      
      {/* --- HEADER --- */}
      <div className="pt-12 pb-2 px-6 flex justify-between items-center shrink-0 z-20 relative">
        <div className="flex-1 mr-4">
          {isSearchOpen ? (
            <div className="flex items-center bg-white rounded-full px-4 py-3 animate-fade-in shadow-sm border border-gray-100">
              <Search size={18} className="text-gray-400 mr-2" />
              <input 
                autoFocus
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent outline-none w-full text-gray-800 placeholder-gray-400 text-sm"
              />
              <button onClick={() => {setIsSearchOpen(false); setSearchTerm('');}} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 animate-fade-in">
              <div 
                onClick={() => onNavigate('profile')}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md bg-gray-200 cursor-pointer active:scale-90 transition-transform"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400"><User /></div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Hola,</p>
                <h1 className="text-lg font-black text-gray-800 leading-none">{displayName}</h1>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 shrink-0">
          {!isSearchOpen && (
            <button onClick={() => setIsSearchOpen(true)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-600 shadow-sm border border-gray-100 active:scale-95 transition-transform">
              <Search size={20} />
            </button>
          )}
          <button 
            onClick={() => setShowNotifications(true)}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-600 shadow-sm border border-gray-100 active:scale-95 transition-transform relative"
          >
            <Bell size={20} />
            {hasNewNotifs && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse"></span>}
          </button>
        </div>
      </div>

      {/* --- FILTRO --- */}
      <div className="px-6 mb-2 shrink-0 z-10">
        <div className="relative inline-block w-full">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="bg-white text-gray-800 rounded-2xl py-3 px-5 flex items-center justify-between shadow-sm border border-gray-100 active:bg-gray-50 w-full"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide">
                {filterType === 'upcoming' ? 'Próximos Eventos' : 'Historial Pasado'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
               <ChevronDown size={16} className={`transform transition duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isFilterOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl overflow-hidden z-50 animate-slide-down border border-gray-100">
              <button 
                onClick={() => { setFilterType('upcoming'); setIsFilterOpen(false); }}
                className={`w-full text-left px-5 py-3.5 text-sm font-medium hover:bg-gray-50 flex items-center justify-between transition-colors ${filterType === 'upcoming' ? 'text-orange-600 bg-orange-50' : 'text-gray-600'}`}
              >
                Próximos {filterType === 'upcoming' && <Check size={16}/>}
              </button>
              <button 
                onClick={() => { setFilterType('past'); setIsFilterOpen(false); }}
                className={`w-full text-left px-5 py-3.5 text-sm font-medium hover:bg-gray-50 flex items-center justify-between transition-colors ${filterType === 'past' ? 'text-orange-600 bg-orange-50' : 'text-gray-600'}`}
              >
                Pasados {filterType === 'past' && <Check size={16}/>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- CARRUSEL DE EVENTOS --- */}
      <div className="flex-1 w-full flex flex-col justify-center overflow-hidden relative">
        
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-8 -mt-20">
            <div className="bg-white p-6 rounded-3xl mb-4 shadow-sm border border-gray-100">
              <Calendar size={32} className="text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-700 mb-1">Sin eventos</h2>
            <p className="text-gray-400 text-sm mb-6">
              {filterType === 'upcoming' ? 'No tienes planes pronto.' : 'Historial vacío.'}
            </p>
            
            {filterType === 'upcoming' && (
              <button 
                onClick={() => onNavigate('create')}
                className="bg-orange-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-orange-200 active:scale-95 transition text-sm"
              >
                Crear Evento
              </button>
            )}
          </div>

        ) : (
          // Contenedor Scroll
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 items-center h-full w-full scrollbar-hide pt-1 pb-4">
            {filteredEvents.map((evt) => {
              
              // 🆕 LÓGICA DE FONDO DINÁMICO
              const hasCustomBg = evt.background;
              
              // 1. Definir Clase Base y Estilo
              let bgClass = "";
              let bgStyle = {};

              if (hasCustomBg) {
                  if (evt.background.type === 'gradient') {
                      bgClass = `bg-gradient-to-br ${evt.background.value}`;
                  } else if (evt.background.type === 'image') {
                      bgClass = "bg-cover bg-center bg-no-repeat";
                      bgStyle = { backgroundImage: `url(${evt.background.value})` };
                  }
              } else {
                  // Fallback para eventos antiguos sin la propiedad background
                  bgClass = evt.isMyEvent 
                    ? 'bg-gradient-to-b from-orange-500 to-red-600' 
                    : 'bg-gradient-to-b from-purple-600 to-indigo-700';
              }

              return (
                <div 
                  key={evt.id} 
                  onClick={() => onSelectEvent(evt)}
                  style={bgStyle}
                  className={`snap-center shrink-0 relative overflow-hidden w-[93%] md:w-[400px] h-[78vh] rounded-[2.5rem] p-5 text-white shadow-2xl shadow-gray-300/50 cursor-pointer transform transition active:scale-[0.98] flex flex-col justify-between ${bgClass}`}
                >
                  
                  {/* 🆕 OVERLAY OSCURO (Solo si hay imagen personalizada) */}
                  {hasCustomBg && evt.background.type === 'image' && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-0"></div>
                  )}

                  {/* Decoraciones Fondo (Solo si NO es imagen personalizada para no ensuciarla) */}
                  {(!hasCustomBg || evt.background.type === 'gradient') && (
                    <>
                      <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-10 rounded-bl-full pointer-events-none blur-3xl z-0"></div>
                      <PartyPopper className="absolute top-12 -left-6 text-white opacity-10 rotate-[-15deg] z-0" size={100} />
                    </>
                  )}

                  {/* Top: Tipo y Rol */}
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="bg-black/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border border-white/10">
                      {evt.type}
                    </span>
                    {evt.isMyEvent ? (
                      <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm border border-white/10">
                        <Crown size={16} className="text-white" />
                      </div>
                    ) : (
                      <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm border border-white/10">
                         <User size={16} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* Centro: Título Gigante */}
                  <div className="relative z-10 mt-4 mb-auto flex flex-col justify-center h-full">
                    <h3 className="text-4xl font-black leading-[1.0] drop-shadow-lg line-clamp-5 text-pretty tracking-tight">
                      {evt.name}
                    </h3>
                  </div>
                  
                  {/* Bottom: DATOS */}
                  <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-[2rem] p-5 border border-white/20 shadow-sm mt-4">
                      
                      {/* Fila 1: Fecha */}
                      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                         <div className="pl-2">
                            <p className="text-3xl font-bold leading-none">
                              {new Date(evt.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                            </p>
                            <p className="text-sm text-white/80 font-medium uppercase tracking-wide mt-1">
                              {new Date(evt.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long' })}
                            </p>
                         </div>
                      </div>

                      {/* Fila 2: Hora y Lugar */}
                      <div className="grid grid-cols-2 gap-3">
                         <div className="flex items-center gap-2">
                            <Clock size={16} className="text-white/70 shrink-0" />
                            <span className="text-sm font-bold text-white truncate">{evt.time}</span>
                         </div>
                         <div className="flex items-center gap-2 overflow-hidden">
                            <MapPin size={16} className="text-white/70 shrink-0" />
                            <span className="text-sm font-bold text-white truncate">{evt.locationName || "Ubicación"}</span>
                         </div>
                      </div>
                  </div>

                </div>
              );
            })}
            
            {/* Espaciador final */}
            <div className="w-2 shrink-0"></div>
          </div>
        )}
      </div>

      {/* FAB: Crear Evento */}
      {filterType === 'upcoming' && (
        <button 
          onClick={() => onNavigate('create')}
          className="absolute bottom-6 right-6 w-14 h-14 bg-gray-900 text-white rounded-full shadow-xl flex items-center justify-center z-30 active:scale-90 transition-transform border-4 border-gray-50"
        >
          <span className="text-3xl font-light leading-none pb-1">+</span>
        </button>
      )}

      {/* NOTIFICACIONES MINI */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setShowNotifications(false)}></div>
          <div className="relative w-full max-w-xs bg-white h-full shadow-2xl animate-slide-in-right flex flex-col border-l border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                Notificaciones
              </h2>
              <button onClick={() => setShowNotifications(false)} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-gray-800 transition">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-70">
                  <Bell size={32} className="mb-3 text-gray-300" />
                  <p className="text-sm">Sin novedades</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0 font-bold text-xs">
                        {notif.fromName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 leading-tight mb-1">
                          <span className="font-bold text-gray-900">{notif.fromName}</span> te invitó a:
                        </p>
                        <p className="font-bold text-orange-600 text-sm">{notif.eventName}</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleQuickViewNotif} 
                      className="w-full bg-gray-900 text-white py-2 rounded-xl text-xs font-bold active:scale-95 transition"
                    >
                      Ver
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}