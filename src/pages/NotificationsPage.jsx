import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Bell, Check, X, User, ArrowLeft } from 'lucide-react';

export default function NotificationsPage({ user, onBack }) {
  const [notifications, setNotifications] = useState([]);

  // 1. Escuchar notificaciones en tiempo real
  useEffect(() => {
    if (!user) return;
    
    // Buscamos en la subcolección 'notifications' de mi usuario
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('status', '==', 'pending') // Solo las pendientes
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar por fecha (más nuevas primero)
      notifs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Aceptar Invitación
  const handleAccept = async (notification) => {
    try {
      // A. Agregarnos a la lista de asistentes del evento real
      const eventRef = doc(db, 'events', notification.eventId);
      await updateDoc(eventRef, {
        attendees: arrayUnion({
          name: user.displayName || 'Usuario',
          phone: user.phoneNumber || 'App', // O el dato que tengas
          status: 'confirmed'
        })
      });

      // B. Marcar notificación como vista/aceptada (o borrarla)
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', notification.id));
      
      alert(`¡Genial! Has confirmado tu asistencia a ${notification.eventName}`);
    } catch (error) {
      console.error("Error al aceptar:", error);
      alert("El evento quizás ya no existe.");
    }
  };

  // 3. Rechazar Invitación
  const handleReject = async (id) => {
    if(!window.confirm("¿Rechazar invitación?")) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', id));
    } catch (error) {
      console.error(error);
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
            <p>No tienes notificaciones nuevas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div key={notif.id} className="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 flex flex-col gap-3">
                
                {/* Encabezado de la Notificación */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    {notif.fromPhoto ? <img src={notif.fromPhoto} className="w-full h-full rounded-full object-cover"/> : <User size={18}/>}
                  </div>
                  <div>
                    <p className="text-sm text-gray-800">
                      <span className="font-bold">{notif.fromName || 'Alguien'}</span> te invitó a su evento:
                    </p>
                    <h3 className="font-bold text-purple-700 text-lg">{notif.eventName}</h3>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex gap-3 mt-1">
                  <button 
                    onClick={() => handleAccept(notif)}
                    className="flex-1 bg-purple-600 text-white py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <Check size={16} /> Asistir
                  </button>
                  <button 
                    onClick={() => handleReject(notif.id)}
                    className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <X size={16} /> Rechazar
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