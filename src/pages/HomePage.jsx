import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { 
  Search, Bell, Calendar, MapPin, Clock, User, 
  ChevronDown, Filter, PartyPopper, Gift, Cake, X, Check 
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
    const q = query(collection(db, 'events'), where("creatorId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

  // Acciones de Notificación
  const handleAcceptNotif = async (notification) => {
    try {
      const eventRef = doc(db, 'events', notification.eventId);
      await updateDoc(eventRef, {
        attendees: arrayUnion({
          name: user.displayName || 'Usuario',
          phone: user.phoneNumber || 'App',
          status: 'confirmed'
        })
      });
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', notification.id));
      alert(`¡Asistirás a ${notification.eventName}!`);
    } catch (error) {
      console.error(error);
      alert("Error al aceptar.");
    }
  };

  const handleRejectNotif = async (id) => {
    if(!window.confirm("¿Rechazar?")) return;
    await deleteDoc(doc(db, 'users', user.uid, 'notifications', id));
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
    <div className="flex flex-col w-full h-screen bg-red-50 font-sans relative overflow-hidden">
      
      {/* --- HEADER (Fijo arriba) --- */}
      <div className="pt-12 pb-4 px-6 flex justify-between items-center shrink-0 bg-red-50 z-20 relative">
        <div className="flex-1 mr-4">
          {isSearchOpen ? (
            <div className="flex items-center bg-white rounded-full px-4 py-2 animate-fade-in shadow-sm">
              <Search size={18} className="text-gray-500 mr-2" />
              <input 
                autoFocus
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar evento..."
                className="bg-transparent outline-none w-full text-gray-800 placeholder-gray-400"
              />
              <button onClick={() => {setIsSearchOpen(false); setSearchTerm('');}} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 animate-fade-in">
              
              {/* --- AVATAR CLICABLE (AQUÍ ESTÁ EL CAMBIO) --- */}
              <div 
                onClick={() => onNavigate('profile')} // Navegar al perfil
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm bg-gray-100 cursor-pointer active:scale-90 transition-transform"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400"><User /></div>
                )}
              </div>
              
              <h1 className="text-lg font-bold text-gray-800 drop-shadow-sm">Hola, {displayName}!</h1>
            </div>
          )}
        </div>

        <div className="flex gap-3 shrink-0">
          {!isSearchOpen && (
            <button onClick={() => setIsSearchOpen(true)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-600 shadow-md active:scale-95 transition-transform hover:scale-105">
              <Search size={20} />
            </button>
          )}
          <button 
            onClick={() => setShowNotifications(true)}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-600 shadow-md active:scale-95 transition-transform hover:scale-105 relative"
          >
            <Bell size={20} />
            {hasNewNotifs && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
          </button>
        </div>
      </div>

      {/* --- FILTRO --- */}
      <div className="px-6 py-2 bg-red-50 z-10 relative shrink-0 mb-2">
        <div className="relative">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full bg-white text-gray-800 rounded-2xl py-3.5 px-5 flex items-center justify-between shadow-md active:bg-gray-50 transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-3">
              <Filter size={18} className="text-orange-500" />
              <span className="font-bold text-sm tracking-wide">
                {filterType === 'upcoming' ? 'Eventos Próximos' : 'Eventos Pasados'}
              </span>
            </div>
            <ChevronDown size={16} className={`text-gray-400 transform transition duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFilterOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl overflow-hidden z-50 animate-slide-down border border-gray-100">
              <button 
                onClick={() => { setFilterType('upcoming'); setIsFilterOpen(false); }}
                className={`w-full text-left px-5 py-3.5 text-sm font-medium hover:bg-orange-50 flex items-center justify-between transition-colors ${filterType === 'upcoming' ? 'text-orange-600 bg-orange-50' : 'text-gray-600'}`}
              >
                Próximos {filterType === 'upcoming' && <Check size={16}/>}
              </button>
              <button 
                onClick={() => { setFilterType('past'); setIsFilterOpen(false); }}
                className={`w-full text-left px-5 py-3.5 text-sm font-medium hover:bg-orange-50 flex items-center justify-between transition-colors ${filterType === 'past' ? 'text-orange-600 bg-orange-50' : 'text-gray-600'}`}
              >
                Pasados {filterType === 'past' && <Check size={16}/>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- LISTA DE EVENTOS --- */}
      <div className="flex-1 w-full overflow-y-auto px-4 pb-32 space-y-6 scroll-smooth">
        
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-80 -mt-10">
            <div className="bg-white p-6 rounded-full mb-4 shadow-md">
              <Calendar size={36} className="text-orange-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-700 mb-1">Sin eventos {filterType === 'upcoming' ? 'próximos' : 'pasados'}</h2>
            <p className="text-gray-500 text-sm mb-6">No se encontraron resultados.</p>
            
            {filterType === 'upcoming' && (
              <button 
                onClick={() => onNavigate('create')}
                className="bg-white text-orange-600 px-8 py-3 rounded-full font-bold shadow-lg hover:bg-gray-50 transition active:scale-95 border border-orange-100"
              >
                Crear evento
              </button>
            )}
          </div>

        ) : (
          filteredEvents.map((evt) => (
            <div 
              key={evt.id} 
              onClick={() => onSelectEvent(evt)}
              className="relative overflow-hidden w-full min-h-[450px] bg-gradient-to-br from-orange-400 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-xl cursor-pointer transform transition hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between"
            >
              <PartyPopper className="absolute top-8 left-6 text-white opacity-20 rotate-[-15deg]" size={40} />
              <Cake className="absolute bottom-8 right-6 text-white opacity-20 rotate-[10deg]" size={64} />
              <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-10 rounded-bl-full pointer-events-none blur-xl"></div>

              <div className="relative z-10 flex justify-center mt-4">
                <span className="bg-black/20 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest backdrop-blur-md border border-white/10 shadow-sm">
                  {evt.type}
                </span>
              </div>

              <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center my-6 px-2">
                <h3 className="text-5xl font-black leading-none mb-4 drop-shadow-lg tracking-tighter line-clamp-4 break-words w-full">
                  {evt.name}
                </h3>
              </div>
              
              <div className="relative z-10 flex flex-col gap-3 text-orange-50 text-base font-medium w-full mb-4">
                <div className="flex items-center justify-center gap-3 bg-black/10 px-6 py-4 rounded-3xl backdrop-blur-sm border border-white/5 w-full shadow-inner">
                  <Calendar size={20} className="shrink-0" />
                  <span>{new Date(evt.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="flex items-center justify-center gap-2 bg-black/10 px-4 py-3 rounded-3xl backdrop-blur-sm border border-white/5 shadow-inner">
                        <Clock size={18} className="shrink-0" />
                        {evt.time}
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-black/10 px-4 py-3 rounded-3xl backdrop-blur-sm border border-white/5 shadow-inner overflow-hidden">
                        <MapPin size={18} className="shrink-0" />
                        <span className="truncate text-sm">{evt.locationName || "Mapa"}</span>
                    </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      {filteredEvents.length > 0 && filterType === 'upcoming' && (
        <button 
          onClick={() => onNavigate('create')}
          className="absolute bottom-8 right-6 w-16 h-16 bg-white text-orange-500 rounded-full shadow-2xl border border-orange-100 flex items-center justify-center z-30 active:scale-90 hover:bg-gray-50 transition-transform"
        >
          <span className="text-4xl font-light leading-none pb-1">+</span>
        </button>
      )}

      {/* NOTIFICACIONES */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowNotifications(false)}></div>
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl animate-slide-in-right flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                <Bell size={20} className="text-orange-500" /> Notificaciones
              </h2>
              <button onClick={() => setShowNotifications(false)} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition">
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-70">
                  <Bell size={40} className="mb-3 text-gray-300" />
                  <p>Estás al día</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 transition-shadow hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0 font-bold border border-orange-200">
                        {notif.fromName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 leading-tight mb-1">
                          <span className="font-bold text-gray-900">{notif.fromName}</span> te invitó a:
                        </p>
                        <p className="font-bold text-orange-600 text-lg">{notif.eventName}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <button onClick={() => handleAcceptNotif(notif)} className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-xs font-bold active:scale-95 shadow-md shadow-orange-200 transition">Aceptar</button>
                      <button onClick={() => handleRejectNotif(notif.id)} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-xs font-bold active:scale-95 hover:bg-gray-200 transition">Rechazar</button>
                    </div>
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