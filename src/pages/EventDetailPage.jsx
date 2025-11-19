import React, { useState } from 'react';
import { deleteDoc, doc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { Calendar, MapPin, ArrowLeft, Trash2, Users, Send } from 'lucide-react';

export default function EventDetailPage({ event, onBack }) {
  // 1. ESTADO: Usamos 'invitingIndex' para saber qué botón específico está cargando
  const [invitingIndex, setInvitingIndex] = useState(null); 

  // --- LÓGICA DE BORRAR EVENTO ---
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

  // --- LÓGICA DE INVITACIÓN ---
const handleInvite = async (guest, index) => {
    setInvitingIndex(index);
    
    // 1. Limpiamos el número del contacto (quitamos espacios, guiones, paréntesis)
    // Ejemplo: "+593 99-123" -> "59399123"
    let rawPhone = guest.phone.replace(/[^0-9]/g, ''); 

    // 2. Preparamos las variantes posibles para buscar en Firebase
    // Muchos guardan como '099...' y otros como '59399...'
    let searchPhones = [rawPhone];

    // Si tiene código de país 593, agregamos la versión local '09...'
    if (rawPhone.startsWith('593')) {
      searchPhones.push('0' + rawPhone.substring(3));
    }
    // Si es local '09...', agregamos la versión internacional '593...'
    if (rawPhone.startsWith('09')) {
      searchPhones.push('593' + rawPhone.substring(1));
    }

    console.log("Buscando usuario con estos números:", searchPhones);

    try {
      // 3. Hacemos la consulta usando 'where in' (busca si coincide con CUALQUIERA de la lista)
      const q = query(collection(db, 'users'), where('phone', 'in', searchPhones));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // --- CASO A: ENCONTRADO (Tiene App) ---
        const targetUser = querySnapshot.docs[0].data();
        
        await addDoc(collection(db, 'users', targetUser.uid, 'notifications'), {
          type: 'invitation',
          eventId: event.id,
          eventName: event.name,
          fromName: event.creatorName,
          fromPhoto: event.creatorPhoto,
          status: 'pending',
          message: `¡Te he invitado a ${event.name}!`,
          createdAt: serverTimestamp()
        });

        alert(`✅ ¡Encontrado! Invitación enviada a ${targetUser.username || guest.name} en la App.`);
      
      } else {
        // --- CASO B: NO ENCONTRADO (WhatsApp) ---
        // Usamos el número limpio internacional para el link de WhatsApp
        // Si no tiene 593, se lo ponemos para que el link funcione bien
        let whatsappPhone = rawPhone.startsWith('0') ? '593' + rawPhone.substring(1) : rawPhone;

        const message = `Hola ${guest.name}! 🥳 Te invito a "${event.name}". \n📅 ${event.date} - ${event.time}\n📍 ${event.locationName}\nDescarga la app aquí: miapp.com`;
        const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_system');
      }

    } catch (error) {
      console.error("Error al invitar:", error);
      alert("Error al buscar el usuario.");
    } finally {
      setInvitingIndex(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white animate-fade-in font-sans">
      
      {/* Header */}
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
          <p className="text-white/80 text-sm">Organizado por {event.creatorName}</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 -mt-6 bg-white rounded-t-[2rem] relative z-10 overflow-y-auto pb-8">
        <div className="p-6 space-y-6">
          
          {/* Detalles */}
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
               <p className="font-bold text-gray-800 line-clamp-2 text-sm">{event.locationName || "Ver Mapa"}</p>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wide mb-2">Detalles</h3>
            <p className="text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
              {event.description || "Sin descripción."}
            </p>
          </div>

          {/* Lista de Invitados */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wide">Invitados</h3>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                <Users size={14} /> {event.attendees?.length || 0}
              </span>
            </div>

            <div className="space-y-3">
              {event.attendees && event.attendees.length > 0 ? (
                event.attendees.map((guest, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg">
                        {guest.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{guest.name}</p>
                        <p className="text-xs text-gray-400">{guest.phone}</p>
                      </div>
                    </div>
                    
                    {/* Botón Invitar (Con estado correcto) */}
                    <button 
                      onClick={() => handleInvite(guest, index)}
                      disabled={invitingIndex === index}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-sm active:scale-95 ${
                         invitingIndex === index 
                           ? 'bg-gray-100 text-gray-400' 
                           : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {invitingIndex === index ? 'Enviando...' : <><Send size={12} /> Invitar</>}
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                  No hay invitados seleccionados.
                </div>
              )}
            </div>
          </div>

          <button onClick={handleDelete} className="w-full py-4 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition mt-4 border border-transparent hover:border-red-100 flex items-center justify-center">
            <Trash2 size={18} className="mr-2" /> Eliminar Evento
          </button>

        </div>
      </div>
    </div>
  );
}