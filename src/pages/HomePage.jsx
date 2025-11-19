import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase'; 
import { Calendar, MapPin, Clock, Plus, Search, LogOut, User, ChevronRight, Bell } from 'lucide-react';

export default function HomePage({ user, onNavigate, onSelectEvent }) {
  const [events, setEvents] = useState([]);
  const [hasNotifications, setHasNotifications] = useState(false);

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
  
  // Listener para notificaciones pendientes
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasNotifications(!snapshot.empty);
    });
    return () => unsubscribe();
  }, [user]);


  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Usuario';

  return (
    <div className="flex flex-col h-screen bg-gray-50 animate-fade-in font-sans">
      {/* Header */}
      <div className="bg-purple-700 pt-12 pb-8 px-6 rounded-b-[2.5rem] shadow-xl z-10 shrink-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-purple-400 flex items-center justify-center text-white font-bold shadow-inner overflow-hidden border-2 border-purple-300">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover"/>
              ) : (
                <User size={24} />
              )}
            </div>
            <div>
              <p className="text-purple-200 text-xs uppercase tracking-wider">Hola,</p>
              <h2 className="text-white text-lg font-bold truncate w-40 capitalize">{displayName}</h2>
            </div>
          </div>
          
          <div className="flex gap-2">
             {/* Botón Notificaciones */}
             <button 
               onClick={() => onNavigate('notifications')}
               className="bg-purple-600 p-2.5 rounded-xl text-white hover:bg-purple-500 transition shadow-lg relative active:scale-95"
             >
               <Bell size={20} />
               {hasNotifications && (
                 <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-purple-600 animate-pulse"></span>
               )}
             </button>

             {/* Botón Salir */}
             <button 
                onClick={() => signOut(auth)} 
                className="bg-purple-600 p-2.5 rounded-xl text-white hover:bg-purple-500 transition shadow-lg active:scale-95"
             >
               <LogOut size={20} />
             </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-purple-300" size={20} />
          <input type="text" placeholder="Buscar en mis eventos..." className="w-full bg-purple-800/50 backdrop-blur-sm text-white placeholder-purple-300 pl-12 pr-4 py-3.5 rounded-2xl border border-purple-500/30 focus:outline-none focus:bg-purple-800/70 transition-all" />
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-28">
        
        {/* Botón Crear */}
        <button 
          onClick={() => onNavigate('create')}
          className="w-full bg-white mb-6 py-4 rounded-2xl shadow-sm border border-purple-100 flex items-center justify-between px-6 active:scale-[0.98] transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full group-hover:bg-purple-200 transition-colors">
               <Plus size={24} className="text-purple-600" />
            </div>
            <span className="text-purple-700 font-bold text-lg">Crear Nuevo Evento</span>
          </div>
          <ChevronRight className="text-gray-300" />
        </button>

        <h3 className="text-gray-500 font-bold text-sm mb-4 uppercase tracking-wide">Mis Eventos</h3>

        {/* Lista */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 opacity-60 border-2 border-dashed border-gray-200 rounded-2xl">
            <Calendar size={40} className="mb-2 text-gray-300" />
            <p className="text-sm font-medium">No tienes eventos aún</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(evt => (
              <div 
                key={evt.id} 
                onClick={() => onSelectEvent(evt)} 
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] flex items-start"
              >
                <div className="bg-purple-50 rounded-xl px-3 py-2 text-center min-w-[60px] flex flex-col justify-center mr-4">
                  <span className="block text-purple-700 font-bold text-xl leading-none mb-0.5">
                    {evt.date ? new Date(evt.date + 'T00:00:00').getDate() : '??'}
                  </span>
                  <span className="block text-purple-400 text-[10px] uppercase font-bold tracking-wide">
                    {evt.date ? new Date(evt.date + 'T00:00:00').toLocaleString('es-ES', { month: 'short' }).replace('.', '') : 'MES'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1.5 truncate">{evt.name}</h3>
                  <div className="flex items-center text-gray-500 text-xs mb-1.5 font-medium">
                    <Clock size={14} className="mr-1.5 text-purple-400" />
                    {evt.time}
                  </div>
                  <div className="flex items-center text-gray-500 text-xs">
                    <MapPin size={14} className="mr-1.5 text-blue-400" />
                    <span className="truncate">{evt.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}