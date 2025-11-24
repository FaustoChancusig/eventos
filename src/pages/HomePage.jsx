import React, { useState, useEffect } from 'react';
// IMPORTANTE: 'getDoc' se mantiene para la lógica de evitar duplicados
import { collection, query, where, onSnapshot, or, doc, updateDoc, arrayUnion, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { 
  Search, Bell, Calendar, MapPin, Clock, User, 
  ChevronDown, PartyPopper, X, Check, Crown,
  AlertCircle, Info, CheckCircle, XCircle // Iconos nuevos para las alertas
} from 'lucide-react';

// --- COMPONENTE NOTIFICACIÓN (TOAST) ---
const Notification = ({ type, message, onClose, isVisible }) => {
  if (!isVisible) return null;
  const config = {
    success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: <CheckCircle className="w-5 h-5 text-green-600" /> },
    error: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: <XCircle className="w-5 h-5 text-red-600" /> },
    warning: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', icon: <AlertCircle className="w-5 h-5 text-orange-600" /> },
    info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: <Info className="w-5 h-5 text-blue-600" /> }
  };
  const { bg, text, icon } = config[type] || config.info;
  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
      <div className={`${bg} border ${text} px-4 py-3 rounded-xl shadow-lg max-w-sm flex items-start gap-3`}>
        {icon}
        <div className="flex-1"><p className="text-sm font-medium">{message}</p></div>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

// --- COMPONENTE MODAL DE CONFIRMACIÓN ---
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", type = "warning" }) => {
  if (!isOpen) return null;
  const config = {
    warning: { bg: 'bg-orange-50', icon: <AlertCircle className="w-6 h-6 text-orange-600" />, button: 'bg-orange-600 hover:bg-orange-700' },
    danger: { bg: 'bg-red-50', icon: <AlertCircle className="w-6 h-6 text-red-600" />, button: 'bg-red-600 hover:bg-red-700' },
    info: { bg: 'bg-blue-50', icon: <Info className="w-6 h-6 text-blue-600" />, button: 'bg-blue-600 hover:bg-blue-700' }
  };
  const { bg, icon, button } = config[type];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full animate-scale-in">
        <div className={`${bg} p-6 rounded-t-2xl flex items-center gap-3`}>
          {icon}<h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="p-6"><p className="text-gray-600 dark:text-gray-300">{message}</p></div>
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onCancel} className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 text-gray-700">{cancelText}</button>
          <button onClick={onConfirm} className={`flex-1 py-3 px-4 ${button} text-white rounded-xl font-medium shadow-md`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default function HomePage({ user, onNavigate, onSelectEvent }) {
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [filterType, setFilterType] = useState('upcoming'); 
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNewNotifs, setHasNewNotifs] = useState(false);

  // --- ESTADOS PARA ALERTAS ---
  const [notificationState, setNotificationState] = useState({ isVisible: false, type: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, config: {} });

  const showNotification = (type, message) => {
    setNotificationState({ isVisible: true, type, message });
    setTimeout(() => setNotificationState({ isVisible: false, type: '', message: '' }), 4000);
  };

  // --- 1. CARGAR EVENTOS ---
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
    }, (error) => {
      console.error("Error cargando eventos:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // --- 2. CARGAR NOTIFICACIONES ---
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

  // --- 3. ACEPTAR NOTIFICACIÓN (Lógica Intacta) ---
  const handleAcceptNotif = async (notification) => {
    try {
        const eventRef = doc(db, 'events', notification.eventId);
        
        // PASO A: Leemos el evento actual para ver quién está
        const eventSnap = await getDoc(eventRef);
        
        if (eventSnap.exists()) {
            const eventData = eventSnap.data();
            const currentAttendees = eventData.attendees || [];

            // PASO B: Filtramos para SACAR al usuario si ya estaba
            const otherAttendees = currentAttendees.filter(a => a.uid !== user.uid);

            // PASO C: Creamos mi entrada limpia
            const myEntry = {
                uid: user.uid, 
                name: user.displayName || 'Usuario',
                status: 'confirmed', 
                photo: user.photoURL || null
            };

            // PASO D: Guardamos la lista limpia + mi entrada
            await updateDoc(eventRef, {
                attendees: [...otherAttendees, myEntry],
                guestIds: arrayUnion(user.uid) 
            });

            // Borrar notificación
            await deleteDoc(doc(db, 'users', user.uid, 'notifications', notification.id));
            
            // ALERTA PROFESIONAL
            showNotification('success', "¡Invitación aceptada!");
        }

    } catch (e) {
        console.error("Error aceptando", e);
        // ALERTA PROFESIONAL
        showNotification('error', "Hubo un error al aceptar la invitación.");
    }
  };

  // --- RECHAZAR CON MODAL PROFESIONAL ---
  const handleRejectNotif = (id) => {
    setConfirmModal({
      isOpen: true,
      config: {
        title: 'Rechazar invitación',
        message: '¿Estás seguro de que deseas rechazar esta invitación? Desaparecerá de tu lista.',
        type: 'danger',
        confirmText: 'Sí, rechazar',
        cancelText: 'Cancelar',
        onCancel: () => setConfirmModal({ isOpen: false, config: {} }),
        onConfirm: async () => {
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'notifications', id));
            showNotification('info', "Invitación rechazada");
          } catch (error) {
            showNotification('error', "Error al rechazar");
          } finally {
            setConfirmModal({ isOpen: false, config: {} });
          }
        }
      }
    });
  };

  const handleQuickViewNotif = () => {
    setShowNotifications(false);
    onNavigate('notifications');
  };

  // Filtrado
  const today = new Date().toISOString().split('T')[0];
  const filteredEvents = events.filter(evt => {
    if(!evt.date) return false;
    const isDateMatch = filterType === 'upcoming' ? evt.date >= today : evt.date < today;
    const isSearchMatch = isSearchOpen ? evt.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    return isDateMatch && isSearchMatch;
  });

  const displayName = user?.displayName?.split(' ')[0] || 'Usuario';

  return (
    <div className="flex flex-col w-full h-screen bg-gray-50 dark:bg-gray-900 font-sans relative overflow-hidden transition-colors">
      
      {/* HEADER */}
      <div className="pt-12 pb-2 px-6 flex justify-between items-center shrink-0 z-50 relative bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="flex-1 mr-4">
          {isSearchOpen ? (
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-full px-4 py-3 animate-fade-in shadow-sm border border-gray-200 dark:border-gray-700">
              <Search size={18} className="text-gray-400 dark:text-gray-300 mr-2" />
              <input 
                autoFocus
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent outline-none w-full text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
              />
              <button onClick={() => {setIsSearchOpen(false); setSearchTerm('');}} className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 animate-fade-in">
              <div 
                onClick={() => onNavigate('profile')}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-white dark:border-gray-700 shadow-md bg-gray-200 dark:bg-gray-700 cursor-pointer active:scale-90 transition-transform"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-300"><User /></div>
                )}
              </div>
              <div>
                 <p className="text-xs text-gray-400 dark:text-gray-300 font-medium">Hola,</p>
                <h1 className="text-lg font-black text-gray-800 dark:text-gray-100 leading-none">{displayName}</h1>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 shrink-0">
          {!isSearchOpen && (
            <button onClick={() => setIsSearchOpen(true)} className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 active:scale-95 transition-transform">
              <Search size={20} />
            </button>
          )}
          <button 
            onClick={() => setShowNotifications(true)}
            className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 active:scale-95 transition-transform relative"
          >
            <Bell size={20} />
            {hasNewNotifs && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-gray-900 animate-pulse"></span>}
          </button>
        </div>
      </div>

      {/* FILTRO */}
      <div className="px-6 mb-2 shrink-0 z-40 relative">
        <div className="relative inline-block w-full">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-2xl py-3 px-5 flex items-center justify-between shadow-sm border border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-700 w-full"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide">
                {filterType === 'upcoming' ? 'Próximos Eventos' : 'Historial Pasado'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
               <ChevronDown size={16} className={`text-gray-400 dark:text-gray-300 transition transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isFilterOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700 animate-slide-down">
              <button 
                onClick={() => { setFilterType('upcoming'); setIsFilterOpen(false); }}
                className={`w-full text-left px-5 py-3.5 text-sm font-medium flex items-center justify-between transition-colors ${
                  filterType === 'upcoming'
                    ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
                    : 'text-gray-600 dark:text-gray-200'
                }`}
              >
                Próximos {filterType === 'upcoming' && <Check size={16}/>}
              </button>
              <button 
                onClick={() => { setFilterType('past'); setIsFilterOpen(false); }}
                className={`w-full text-left px-5 py-3.5 text-sm font-medium flex items-center justify-between transition-colors ${
                  filterType === 'past'
                    ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
                    : 'text-gray-600 dark:text-gray-200'
                }`}
              >
                Pasados {filterType === 'past' && <Check size={16}/>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CARRUSEL DE EVENTOS */}
      <div className="flex-1 w-full flex flex-col justify-center overflow-hidden relative z-0">
        
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-8 -mt-20">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl mb-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <Calendar size={32} className="text-gray-300 dark:text-gray-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-100 mb-1">
              Sin eventos
            </h2>
            <p className="text-gray-400 dark:text-gray-300 text-sm mb-6">
              {filterType === 'upcoming' ? 'No tienes planes pronto.' : 'Historial vacío.'}
            </p>
            
            {filterType === 'upcoming' && (
              <button 
                onClick={() => onNavigate('create')}
                className="bg-orange-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-orange-200 dark:shadow-none active:scale-95 transition text-sm"
              >
                Crear Evento
              </button>
            )}
          </div>

        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 items-center h-full w-full scrollbar-hide pt-1 pb-4">
            {filteredEvents.map((evt) => {
              
              const hasCustomBg = evt.background;
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
                  bgClass = evt.isMyEvent 
                    ? 'bg-gradient-to-b from-orange-500 to-red-600' 
                    : 'bg-gradient-to-b from-purple-600 to-indigo-700';
              }

              return (
                <div
                  key={evt.id}
                  onClick={() => onSelectEvent(evt)}
                  style={bgStyle}
                  className={`snap-center shrink-0 relative overflow-hidden w-[93%] md:w-[400px] h-[78vh] rounded-[2.5rem] p-5 text-white shadow-2xl shadow-gray-300/50 cursor-pointer transition active:scale-[0.98] flex flex-col justify-between ${bgClass}`}
                >
                  {/* Overlay */}
                  {hasCustomBg && evt.background.type === 'image' && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-0"></div>
                  )}

                  {(!hasCustomBg || evt.background.type === 'gradient') && (
                    <>
                      <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-10 rounded-bl-full pointer-events-none blur-3xl z-0"></div>
                      <PartyPopper className="absolute top-12 -left-6 text-white opacity-10 rotate-[-15deg] z-0" size={100} />
                    </>
                  )}

                  {/* Top */}
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

                  {/* Centro */}
                  <div className="relative z-10 mt-4 mb-auto flex flex-col justify-center h-full">
                    <h3 className="text-4xl font-black leading-[1.0] drop-shadow-lg line-clamp-5 text-pretty tracking-tight">
                      {evt.name}
                    </h3>
                  </div>
                  
                  {/* Bottom */}
                  <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-[2rem] p-5 border border-white/20 shadow-sm mt-4">
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
            <div className="w-2 shrink-0"></div>
          </div>
        )}
      </div>

      {/* FAB */}
      {filterType === 'upcoming' && (
        <button 
          onClick={() => onNavigate('create')}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900 rounded-full shadow-xl flex items-center justify-center z-40 active:scale-90 transition-transform border-4 border-gray-50 dark:border-gray-800"
        >
          <span className="text-3xl font-light leading-none pb-1">+</span>
        </button>
      )}

      {/* NOTIFICACIONES */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
          <div className="relative w-full max-w-xs bg-white dark:bg-gray-800 h-full shadow-2xl animate-slide-in-right flex flex-col border-l border-gray-200 dark:border-gray-700 z-50">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                Notificaciones
              </h2>
              <button onClick={() => setShowNotifications(false)} className="p-2 bg-white dark:bg-gray-700 rounded-full shadow-sm text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 dark:bg-gray-900/10">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-300 opacity-70">
                  <Bell size={32} className="mb-3 text-gray-300" />
                  <p className="text-sm">Sin novedades</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} className="bg-white dark:bg-gray-700 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-600 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-300 font-bold text-xs overflow-hidden border border-orange-200 dark:border-orange-800 shrink-0">
                        {notif.fromPhoto ? (
                          <img src={notif.fromPhoto} alt="User" className="w-full h-full object-cover" />
                        ) : (
                          notif.fromName?.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-300 leading-tight mb-1">
                          <span className="font-bold text-gray-900 dark:text-gray-100">{notif.fromName}</span> te invitó a:
                        </p>
                        <p className="font-bold text-orange-600 dark:text-orange-300 text-sm">{notif.eventName}</p>
                      </div>
                    </div>
                    {/* Botones */}
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleAcceptNotif(notif)} 
                            className="flex-1 bg-green-500 text-white py-2 rounded-xl text-xs font-bold active:scale-95 transition shadow-sm"
                        >
                            Aceptar
                        </button>
                        <button 
                            onClick={() => handleRejectNotif(notif.id)} 
                            className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 py-2 rounded-xl text-xs font-bold active:scale-95 transition"
                        >
                            Rechazar
                        </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPONENTES DE ALERTA RENDERIZADOS AL FINAL */}
      <Notification 
        type={notificationState.type} 
        message={notificationState.message} 
        isVisible={notificationState.isVisible} 
        onClose={() => setNotificationState({ ...notificationState, isVisible: false })} 
      />
      
      <ConfirmationModal 
        isOpen={confirmModal.isOpen} 
        {...confirmModal.config} 
      />

    </div>
  );
}