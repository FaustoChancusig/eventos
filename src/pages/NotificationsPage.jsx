import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Bell, Check, X, User, ArrowLeft, HelpCircle } from 'lucide-react';

export default function NotificationsPage({ user, onBack }) {
  const [notifications, setNotifications] = useState([]);

  // 1. Escuchar notificaciones
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Responder Invitación (Maneja los 3 estados)
  const handleResponse = async (notification, status) => {
    // status puede ser: 'confirmed' | 'maybe' | 'declined'
    
    try {
      const eventRef = doc(db, 'events', notification.eventId);
      
      // Datos del invitado
      const guestData = {
        uid: user.uid, // Guardamos el UID para poder buscarlo luego
        name: user.displayName || 'Usuario',
        phone: user.phoneNumber || 'App',
        status: status, // 'confirmed', 'maybe', 'declined'
        respondedAt: new Date().toISOString()
      };

      // Objeto de actualización para Firestore
      let updates = {
        attendees: arrayUnion(guestData) // Agregamos a la lista visual de invitados
      };

      // TRUCO CLAVE: Si acepta o pone 'tal vez', agregamos su ID a 'guestIds'
      // para que el evento aparezca en su HomePage.
      if (status === 'confirmed' || status === 'maybe') {
        updates.guestIds = arrayUnion(user.uid);
      }

      await updateDoc(eventRef, updates);

      // Borramos la notificación porque ya fue atendida
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', notification.id));
      
      // Feedback al usuario
      if (status === 'declined') {
        alert("Has rechazado la invitación.");
      } else {
        alert(`¡Listo! Has respondido: ${status === 'confirmed' ? 'Asistiré' : 'Tal vez'}`);
      }

    } catch (error) {
      console.error("Error al responder:", error);
      alert("Ocurrió un error o el evento ya no existe.");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 animate-fade-in font-sans">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-4 text-lg font-bold text-gray-800">Notificaciones</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="bg-gray-100 p-6 rounded-full mb-4">
              <Bell size={32} className="text-gray-300" />
            </div>
            <p>No tienes notificaciones pendientes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(notif => (
              <div key={notif.id} className="bg-white p-5 rounded-2xl shadow-sm border border-purple-100 flex flex-col gap-4">
                
                {/* Encabezado */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 border-2 border-white shadow-sm">
                    {notif.fromPhoto ? <img src={notif.fromPhoto} className="w-full h-full rounded-full object-cover"/> : <User size={20}/>}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 leading-snug">
                      <span className="font-bold text-gray-900">{notif.fromName || 'Alguien'}</span> te invita a:
                    </p>
                    <h3 className="font-bold text-purple-700 text-xl mt-1">{notif.eventName}</h3>
                  </div>
                </div>

                {/* Botones de Acción (3 Opciones) */}
                <div className="grid grid-cols-3 gap-2">
                  {/* 1. ASISTIRÉ */}
                  <button 
                    onClick={() => handleResponse(notif, 'confirmed')}
                    className="flex flex-col items-center justify-center gap-1 bg-green-50 text-green-700 py-3 rounded-xl font-bold text-xs active:scale-95 transition border border-green-100 hover:bg-green-100"
                  >
                    <div className="bg-green-200 p-1.5 rounded-full text-green-800">
                      <Check size={16} /> 
                    </div>
                    Asistiré
                  </button>

                  {/* 2. TAL VEZ */}
                  <button 
                    onClick={() => handleResponse(notif, 'maybe')}
                    className="flex flex-col items-center justify-center gap-1 bg-orange-50 text-orange-700 py-3 rounded-xl font-bold text-xs active:scale-95 transition border border-orange-100 hover:bg-orange-100"
                  >
                    <div className="bg-orange-200 p-1.5 rounded-full text-orange-800">
                      <HelpCircle size={16} /> 
                    </div>
                    Tal vez
                  </button>

                  {/* 3. NO ASISTIRÉ */}
                  <button 
                    onClick={() => {
                      if(window.confirm("¿Seguro que quieres rechazar? La invitación desaparecerá.")) {
                        handleResponse(notif, 'declined');
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-1 bg-gray-50 text-gray-600 py-3 rounded-xl font-bold text-xs active:scale-95 transition border border-gray-200 hover:bg-gray-100"
                  >
                    <div className="bg-gray-200 p-1.5 rounded-full text-gray-600">
                      <X size={16} /> 
                    </div>
                    No iré
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}