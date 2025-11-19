import React, { useState } from 'react';
import { deleteDoc, doc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { Calendar, MapPin, ArrowLeft, Trash2, Users, Send, MessageCircle, CheckCircle } from 'lucide-react';

export default function EventDetailPage({ event, onBack }) {
  const [invitingIndex, setInvitingIndex] = useState(null); // Para mostrar carga en un botón específico

  // --- 1. BORRAR EVENTO ---
  const handleDelete = async () => {
    if(!window.confirm("¿Estás seguro de eliminar este evento?")) return;
    try {
      await deleteDoc(doc(db, 'events', event.id));
      onBack();
    } catch (error) {
      console.error("Error:", error);
      alert("No se pudo borrar.");
    }
  };

  // --- 2. LÓGICA DE INVITACIÓN (EL CEREBRO) ---
  const handleInvite = async (guest, index) => {
    setInvitingIndex(index);
    
    // Limpiamos el teléfono del invitado (solo números para buscar)
    // Ejemplo: "+593 99-123" -> "59399123"
    const cleanPhone = guest.phone.replace(/[^0-9]/g, ''); 

    try {
      // A. BUSCAMOS SI YA ES USUARIO DE LA APP
      // Nota: Esto asume que al registrarse guardamos el teléfono en el campo 'phone'
      const q = query(collection(db, 'users'), where('phone', '==', cleanPhone));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // --- ESCENARIO 1: TIENE LA APP ---
        // Le enviamos una notificación interna
        const targetUser = querySnapshot.docs[0].data();
        
        await addDoc(collection(db, 'users', targetUser.uid, 'notifications'), {
          type: 'invitation',
          eventId: event.id,
          eventName: event.name,
          fromName: event.creatorName,
          message: `¡Te he invitado a ${event.name}!`,
          read: false,
          createdAt: serverTimestamp()
        });

        alert(`✅ ¡Listo! Se envió una notificación a ${guest.name} dentro de la App.`);
      
      } else {
        // --- ESCENARIO 2: NO TIENE LA APP ---
        // Abrimos WhatsApp
        const message = `¡Hola ${guest.name}! 👋 Te invito a mi evento "${event.name}" en EventMaster.\n\n📅 Cuándo: ${event.date} a las ${event.time}\n📍 Dónde: ${event.locationName}\n\nDescarga la app para ver los detalles y confirmar: https://tu-app-link.com`;
        
        // Usamos el link universal de WhatsApp
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_system');
      }

    } catch (error) {
      console.error("Error invitando:", error);
      alert("Hubo un error al procesar el número.");
    } finally {
      setInvitingIndex(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white animate-fade-in font-sans">
      
      {/* Header con Imagen (Gradiente) */}
      <div className="h-64 bg-gradient-to-br from-purple-700 to-blue-600 relative shrink-0">
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10">
          <button onClick={onBack} className="bg-black/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/30 transition">
            <ArrowLeft size={24} />
          </button>
          <div className="bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wide">
            {event.type}
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20">
          <h1 className="text-3xl font-bold text-white leading-tight mb-1">{event.name}</h1>
          <p className="text-white/80 text-sm flex items-center gap-2">
            Organizado por {event.creatorName}
          </p>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 -mt-6 bg-white rounded-t-[2rem] relative z-10 overflow-y-auto pb-8">
        
        {/* Indicador visual */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Tarjetas de Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
               <div className="flex items-center gap-2 text-purple-600 mb-1">
                 <Calendar size={18} /> <span className="text-xs font-bold uppercase">Fecha</span>
               </div>
               <p className="font-bold text-gray-800">{event.date}</p>
               <p className="text-sm text-gray-500">{event.time}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
               <div className="flex items-center gap-2 text-blue-600 mb-1">
                 <MapPin size={18} /> <span className="text-xs font-bold uppercase">Lugar</span>
               </div>
               <p className="font-bold text-gray-800 line-clamp-2 text-sm">{event.locationName || "Ver en mapa"}</p>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wide mb-2">Acerca del evento</h3>
            <p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
              {event.description || "Sin descripción detallada."}
            </p>
          </div>

          {/* --- SECCIÓN DE INVITADOS --- */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wide">Lista de Invitados</h3>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                <Users size={14} /> {event.attendees?.length || 0}
              </span>
            </div>

            <div className="space-y-3">
              {event.attendees && event.attendees.length > 0 ? (
                event.attendees.map((guest, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      {/* Inicial del nombre */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
                        {guest.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{guest.name}</p>
                        <p className="text-xs text-gray-400">{guest.phone}</p>
                      </div>
                    </div>
                    
                    {/* BOTÓN DE ACCIÓN */}
                    <button 
                      onClick={() => handleInvite(guest, index)}
                      disabled={invitingIndex === index}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-sm active:scale-95 ${
                         invitingIndex === index 
                           ? 'bg-gray-100 text-gray-400' 
                           : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200'
                      }`}
                    >
                      {invitingIndex === index ? (
                        'Enviando...'
                      ) : (
                        <>
                          Invitar <Send size={12} />
                        </>
                      )}
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                  <Users className="mx-auto mb-2 text-gray-300" size={32} />
                  <p>No hay invitados en la lista.</p>
                </div>
              )}
            </div>
          </div>

          {/* Botón Eliminar */}
          <button 
            onClick={handleDelete} 
            className="w-full py-4 flex items-center justify-center text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition mt-4 border border-transparent hover:border-red-100"
          >
            <Trash2 size={18} className="mr-2" /> Eliminar Evento
          </button>

        </div>
      </div>
    </div>
  );
}