import React, { useState, useMemo } from 'react';
import { deleteDoc, doc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { Calendar, MapPin, ArrowLeft, Trash2, Users, Send, Check, HelpCircle, X, Crown, AlignLeft, Clock } from 'lucide-react';

export default function EventDetailPage({ event, user, onBack }) {
  // 'invitingIndex' controla el estado de carga de botones individuales
  const [invitingIndex, setInvitingIndex] = useState(null); 
  
  // Verificar si soy el creador
  const isCreator = user?.uid === event.creatorId;

  // Buscar mi estado actual en la lista de asistentes
  const myAttendance = useMemo(() => {
    if (!event.attendees) return null;
    // Buscamos por UID o por coincidencia de teléfono limpio
    const myRawPhone = (user.phoneNumber || '').replace(/[^0-9]/g, '');
    return event.attendees.find(a => {
        if (a.uid === user.uid) return true;
        const guestPhone = (a.phone || '').replace(/[^0-9]/g, '');
        return myRawPhone && guestPhone && (guestPhone === myRawPhone || guestPhone.includes(myRawPhone));
    });
  }, [event.attendees, user]);

  const currentStatus = myAttendance?.status || 'pending';

  // --- LÓGICA: BORRAR EVENTO (SOLO CREADOR) ---
  const handleDelete = async () => {
    if(!window.confirm("¿Estás seguro de eliminar este evento permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'events', event.id));
      onBack();
    } catch (error) {
      console.error("Error:", error);
      alert("No se pudo borrar.");
    }
  };

  // --- LÓGICA: CAMBIAR MI ESTADO (SOLO INVITADO) ---
  // (Incluye el arreglo de duplicados por teléfono)
  const handleChangeStatus = async (newStatus) => {
    try {
      const eventRef = doc(db, 'events', event.id);
      const currentAttendees = event.attendees || [];
      const myRawPhone = (user.phoneNumber || '').replace(/[^0-9]/g, ''); 
      
      // 1. Filtramos para quitar cualquier registro previo mío (por UID o teléfono)
      const otherAttendees = currentAttendees.filter(a => {
        const guestPhone = (a.phone || '').replace(/[^0-9]/g, '');
        const isMeByUid = a.uid === user.uid;
        const isMeByPhone = myRawPhone && guestPhone && (guestPhone === myRawPhone || guestPhone.includes(myRawPhone) || myRawPhone.includes(guestPhone));
        return !isMeByUid && !isMeByPhone;
      });

      // 2. Creamos mi nuevo registro
      const myNewEntry = {
        uid: user.uid,
        name: user.displayName || 'Usuario',
        phone: user.phoneNumber || 'App',
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      // 3. Guardamos la lista actualizada
      let updates = {
        attendees: [...otherAttendees, myNewEntry]
      };

      if (newStatus === 'confirmed' || newStatus === 'maybe') {
        updates.guestIds = arrayUnion(user.uid);
      }

      await updateDoc(eventRef, updates);
      // Feedback opcional
      // alert(`Estado actualizado.`);

    } catch (error) {
      console.error("Error actualizando status:", error);
      alert("Error al actualizar.");
    }
  };

  // --- LÓGICA: INVITAR (SOLO CREADOR) ---
  const handleInvite = async (guest, index) => {
    setInvitingIndex(index);
    let rawPhone = guest.phone.replace(/[^0-9]/g, ''); 
    let searchPhones = [rawPhone];
    if (rawPhone.startsWith('593')) searchPhones.push('0' + rawPhone.substring(3));
    if (rawPhone.startsWith('09')) searchPhones.push('593' + rawPhone.substring(1));

    try {
      const q = query(collection(db, 'users'), where('phone', 'in', searchPhones));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const targetUser = querySnapshot.docs[0].data();
        await addDoc(collection(db, 'users', targetUser.uid, 'notifications'), {
          type: 'invitation',
          eventId: event.id,
          eventName: event.name,
          fromName: event.creatorName,
          fromPhoto: event.creatorPhoto || null,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        alert(`✅ Invitación enviada a App.`);
      } else {
        let whatsappPhone = rawPhone.startsWith('0') ? '593' + rawPhone.substring(1) : rawPhone;
        const message = `Hola ${guest.name}! 🥳 Te invito a "${event.name}". Confirma aquí: miapp.com`;
        const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_system');
      }
    } catch (error) {
      console.error("Error al invitar:", error);
    } finally {
      setInvitingIndex(null);
    }
  };

  // Definir colores según el rol (para el fondo de los widgets)
  const themeBgColor = isCreator ? 'bg-orange-50' : 'bg-purple-50';
  const themeAccentColor = isCreator ? 'text-orange-600' : 'text-purple-600';
  const themeBorderColor = isCreator ? 'border-orange-100' : 'border-purple-100';

  return (
    <div className="flex flex-col h-screen bg-gray-100 animate-fade-in font-sans overflow-hidden">
      
      {/* --- HEADER GRANDE --- */}
      <div className={`h-72 relative shrink-0 ${isCreator ? 'bg-gradient-to-br from-orange-500 to-red-600' : 'bg-gradient-to-br from-purple-600 to-indigo-700'}`}>
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
          <button onClick={onBack} className="bg-black/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/30 transition active:scale-95">
            <ArrowLeft size={24} />
          </button>
          <div className="flex gap-2">
             {isCreator && (
                <div className="bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1">
                  <Crown size={12} /> Admin
                </div>
             )}
             <div className="bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wide">
               {event.type}
             </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-32 z-10">
          <h1 className="text-4xl font-black text-white leading-none mb-2 drop-shadow-lg">{event.name}</h1>
          <p className="text-white/90 text-sm font-medium flex items-center gap-2">
            Organizado por {event.creatorName}
          </p>
        </div>
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-bl-full blur-3xl pointer-events-none z-0"></div>
      </div>

      {/* --- CONTENIDO PRINCIPAL (Estilo Widgets) --- */}
      <div className="flex-1 -mt-8 bg-gray-100 rounded-t-[2.5rem] relative z-30 overflow-y-auto overflow-x-hidden pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="p-6 space-y-6">

          {/* 1. SECCIÓN INVITADOS (Burbujas estilo Instagram) */}
          <div className="mb-2">
             <div className="flex items-center justify-between mb-3 px-1">
               <h3 className={`font-bold text-sm uppercase tracking-wider ${themeAccentColor}`}>Invitados</h3>
               <span className={`${themeBgColor} ${themeAccentColor} px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border ${themeBorderColor}`}>
                 <Users size={12} /> {event.attendees?.length || 0}
               </span>
             </div>
             
             {/* Contenedor de scroll horizontal */}
             <div className="flex gap-4 overflow-x-auto pb-2 px-1 scroll-smooth snap-x snap-mandatory -mx-1 scrollbar-hide">
               {/* Botón para añadir (solo creador) - Opcional, por ahora lo quito para limpiar la vista
               {isCreator && (
                 <button className="flex flex-col items-center shrink-0 snap-start">
                   <div className={`w-16 h-16 rounded-full ${themeBgColor} border-2 border-dashed ${themeBorderColor} flex items-center justify-center text-2xl text-gray-400 shadow-sm active:scale-95 transition`}>+</div>
                   <span className="text-xs text-gray-500 mt-2 font-medium">Invitar</span>
                 </button>
               )} */}

               {event.attendees && event.attendees.length > 0 ? (
                 event.attendees.map((guest, index) => {
                   const isMe = user?.uid === guest.uid;
                   // Lógica para el botón de invitar del creador
                   const needsInvitation = isCreator && guest.status !== 'confirmed';

                   return (
                    <div key={index} className="flex flex-col items-center shrink-0 snap-start relative group">
                      <div className={`relative w-16 h-16 p-0.5 rounded-full border-2 ${
                          guest.status === 'confirmed' ? 'border-green-500' : 
                          guest.status === 'declined' ? 'border-red-300' :
                          themeBorderColor
                        } shadow-sm transition group-hover:shadow-md`}>
                        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xl overflow-hidden">
                           {/* Aquí iría la foto si la tuvieras */}
                           {guest.name.charAt(0)}
                        </div>
                        
                        {/* Badge de estado (Check/X/Question) */}
                        <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-xs
                          ${guest.status === 'confirmed' ? 'bg-green-500' : 
                            guest.status === 'declined' ? 'bg-red-400' :
                            'bg-orange-400'}`}>
                          {guest.status === 'confirmed' && <Check size={12} strokeWidth={3} />}
                          {guest.status === 'declined' && <X size={12} strokeWidth={3} />}
                          {guest.status === 'maybe' && <HelpCircle size={12} strokeWidth={3} />}
                          {!guest.status && <span className="text-[10px] font-bold">?</span>}
                        </div>

                        {/* Botón flotante de enviar invitación (Solo Creador) */}
                        {needsInvitation && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleInvite(guest, index); }}
                             disabled={invitingIndex === index}
                             className="absolute -top-1 -right-1 w-7 h-7 bg-white text-orange-500 rounded-full shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition z-10 border border-orange-100"
                           >
                             {invitingIndex === index ? <span className="animate-spin h-3 w-3 border-2 border-orange-500 rounded-full border-t-transparent"></span> : <Send size={14} />}
                           </button>
                        )}
                      </div>
                      <span className={`text-xs mt-2 font-medium truncate max-w-[70px] ${isMe ? themeAccentColor + ' font-bold' : 'text-gray-600'}`}>
                        {isMe ? 'Tú' : guest.name.split(' ')[0]}
                      </span>
                    </div>
                   );
                 })
               ) : (
                 <p className="text-sm text-gray-400 italic py-4">Aún no hay invitados.</p>
               )}
             </div>
          </div>

          {/* --- WIDGETS DE INFORMACIÓN --- */}
          <div className="grid grid-cols-1 gap-4">
            
            {/* Widget Doble: Fecha y Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] shadow-sm flex items-start gap-4 border border-gray-50">
                <div className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor}`}>
                  <Calendar size={24} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha</h4>
                  <p className="font-bold text-gray-800 text-lg leading-tight">
                    {new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-sm text-gray-500">{new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long' })}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] shadow-sm flex items-start gap-4 border border-gray-50">
                <div className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor}`}>
                  <Clock size={24} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hora</h4>
                  <p className="font-bold text-gray-800 text-lg leading-tight">{event.time}</p>
                </div>
              </div>
            </div>

             {/* Widget Ubicación (Mapa placeholder) */}
            <div className="bg-white p-1 rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden relative group cursor-pointer">
              {/* Placeholder visual de mapa */}
              <div className="h-40 bg-blue-50 w-full rounded-[2rem] relative overflow-hidden opacity-80">
                <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm flex items-center gap-3 border border-white/50 z-10">
                    <div className={`p-2 rounded-full ${themeBgColor} ${themeAccentColor} shrink-0`}>
                       <MapPin size={20} />
                    </div>
                    <p className="font-bold text-gray-800 line-clamp-2 pr-2">{event.locationName || "Sin ubicación definida"}</p>
                 </div>
              </div>
              <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/5 rounded-[2.5rem]"></div>
            </div>

            {/* 2. PANEL DE ESTADO (SOLO INVITADO) - Estilo Widget */}
            {!isCreator && (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-purple-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full opacity-50 pointer-events-none"></div>
                <h3 className="font-bold text-purple-900 text-lg mb-4 text-center relative z-10">¿Asistirás al evento?</h3>
                <div className="grid grid-cols-3 gap-3 relative z-10">
                    <button 
                      onClick={() => handleChangeStatus('confirmed')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl text-sm font-bold transition active:scale-95 ${currentStatus === 'confirmed' ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                      <div className={`mb-2 p-2 rounded-full ${currentStatus === 'confirmed' ? 'bg-white/20' : 'bg-white'}`}>
                        <Check size={24} />
                      </div>
                      Asistiré
                    </button>
                    <button 
                      onClick={() => handleChangeStatus('maybe')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl text-sm font-bold transition active:scale-95 ${currentStatus === 'maybe' ? 'bg-orange-400 text-white shadow-lg shadow-orange-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                      <div className={`mb-2 p-2 rounded-full ${currentStatus === 'maybe' ? 'bg-white/20' : 'bg-white'}`}>
                       <HelpCircle size={24} />
                      </div>
                      Tal vez
                    </button>
                    <button 
                      onClick={() => handleChangeStatus('declined')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl text-sm font-bold transition active:scale-95 ${currentStatus === 'declined' ? 'bg-gray-400 text-white shadow-lg shadow-gray-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                      <div className={`mb-2 p-2 rounded-full ${currentStatus === 'declined' ? 'bg-white/20' : 'bg-white'}`}>
                        <X size={24} />
                      </div>
                      No iré
                    </button>
                </div>
                <p className="text-center text-xs text-gray-400 mt-4">
                  Tu estado actual: <strong>{currentStatus === 'confirmed' ? 'Confirmado' : currentStatus === 'maybe' ? 'En duda' : currentStatus === 'declined' ? 'Rechazado' : 'Pendiente'}</strong>
                </p>
              </div>
            )}

            {/* Widget Descripción */}
            {event.description && (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 flex items-start gap-4">
                <div className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor} shrink-0`}>
                  <AlignLeft size={24} />
                </div>
                <div>
                   <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descripción</h4>
                   <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                     {event.description}
                   </p>
                </div>
              </div>
            )}

            {/* Widget Eliminar (SOLO CREADOR) */}
            {isCreator && (
              <button onClick={handleDelete} className="bg-red-50 p-6 rounded-[2.5rem] shadow-sm border border-red-100 flex items-center justify-center gap-3 text-red-600 font-bold active:scale-95 transition hover:bg-red-100 mt-4">
                <Trash2 size={24} /> Eliminar Evento
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}