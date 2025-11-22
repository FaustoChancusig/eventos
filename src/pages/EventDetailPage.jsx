import React, { useState, useMemo } from 'react';
import { deleteDoc, doc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { Calendar, MapPin, ArrowLeft, Trash2, Users, Send, Check, HelpCircle, X, Crown } from 'lucide-react';

export default function EventDetailPage({ event, user, onBack }) {
  // 'invitingIndex' controla el estado de carga de botones individuales
  const [invitingIndex, setInvitingIndex] = useState(null); 
  
  // Verificar si soy el creador
  const isCreator = user?.uid === event.creatorId;

  // Buscar mi estado actual en la lista de asistentes
  const myAttendance = useMemo(() => {
    if (!event.attendees) return null;
    return event.attendees.find(a => a.uid === user?.uid);
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
// --- LÓGICA: CAMBIAR MI ESTADO (SOLO INVITADO) ---
  const handleChangeStatus = async (newStatus) => {
    try {
      const eventRef = doc(db, 'events', event.id);
      
      const currentAttendees = event.attendees || [];
      
      // 1. Buscamos si ya estoy en la lista (por UID o por TELÉFONO)
      // Esto es clave: si me invitaron como "Pato U" (sin UID, solo phone), debo encontrar ese registro.
      // Limpiamos los teléfonos para comparar (quitamos espacios, guiones, etc.)
      const myRawPhone = (user.phoneNumber || '').replace(/[^0-9]/g, ''); 
      
      const otherAttendees = currentAttendees.filter(a => {
        const guestPhone = (a.phone || '').replace(/[^0-9]/g, '');
        
        // Mantenemos al invitado si:
        // A. NO es mi UID
        // B. Y TAMPOCO es mi número de teléfono (en caso de que no tenga UID aún)
        const isMeByUid = a.uid === user.uid;
        const isMeByPhone = myRawPhone && guestPhone && (guestPhone === myRawPhone || guestPhone.includes(myRawPhone) || myRawPhone.includes(guestPhone));
        
        return !isMeByUid && !isMeByPhone;
      });

      // 2. Creamos mi nuevo registro con los datos actualizados de mi perfil real
      const myNewEntry = {
        uid: user.uid,
        name: user.displayName || 'Usuario', // Aquí se guardará "Patricio"
        phone: user.phoneNumber || 'App',
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      // 3. Guardamos la lista filtrada + mi nueva entrada
      let updates = {
        attendees: [...otherAttendees, myNewEntry]
      };

      if (newStatus === 'confirmed' || newStatus === 'maybe') {
        updates.guestIds = arrayUnion(user.uid);
      }

      await updateDoc(eventRef, updates);
      
      // Feedback visual inmediato (opcional, para que no tengas que recargar para ver el cambio)
      alert(`Estado actualizado a: ${newStatus === 'confirmed' ? 'Asistiré' : newStatus === 'maybe' ? 'Tal vez' : 'No asistiré'}`);

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
        // CASO A: Usuario con App
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
        alert(`✅ Invitación enviada a ${targetUser.username || guest.name} en la App.`);
      } else {
        // CASO B: WhatsApp
        let whatsappPhone = rawPhone.startsWith('0') ? '593' + rawPhone.substring(1) : rawPhone;
        const message = `Hola ${guest.name}! 🥳 Te invito a "${event.name}". \n📅 ${event.date} - ${event.time}\n📍 ${event.locationName}\nConfirma aquí: miapp.com`;
        const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_system');
      }
    } catch (error) {
      console.error("Error al invitar:", error);
      alert("Error al procesar invitación.");
    } finally {
      setInvitingIndex(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white animate-fade-in font-sans">
      
      {/* Header */}
      <div className={`h-64 relative shrink-0 ${isCreator ? 'bg-gradient-to-br from-orange-500 to-red-600' : 'bg-gradient-to-br from-purple-600 to-indigo-700'}`}>
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10">
          <button onClick={onBack} className="bg-black/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/30 transition">
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
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
               <div className="flex items-center gap-2 text-gray-600 mb-1">
                 <Calendar size={18} /> <span className="text-xs font-bold uppercase">Fecha</span>
               </div>
               <p className="font-bold text-gray-800">{event.date}</p>
               <p className="text-sm text-gray-500">{event.time}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
               <div className="flex items-center gap-2 text-gray-600 mb-1">
                 <MapPin size={18} /> <span className="text-xs font-bold uppercase">Lugar</span>
               </div>
               <p className="font-bold text-gray-800 line-clamp-2 text-sm">{event.locationName || "Ver Mapa"}</p>
            </div>
          </div>

          {/* PANEL DE INVITADO: CAMBIAR ESTADO */}
          {!isCreator && (
            <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
              <h3 className="font-bold text-purple-900 text-sm mb-3 text-center">Tu Asistencia</h3>
              <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => handleChangeStatus('confirmed')}
                    className={`flex flex-col items-center p-2 rounded-xl text-xs font-bold transition ${currentStatus === 'confirmed' ? 'bg-green-500 text-white shadow-lg' : 'bg-white text-gray-500'}`}
                  >
                    <Check size={20} className="mb-1"/> Asistiré
                  </button>
                  <button 
                    onClick={() => handleChangeStatus('maybe')}
                    className={`flex flex-col items-center p-2 rounded-xl text-xs font-bold transition ${currentStatus === 'maybe' ? 'bg-orange-400 text-white shadow-lg' : 'bg-white text-gray-500'}`}
                  >
                    <HelpCircle size={20} className="mb-1"/> Tal vez
                  </button>
                  <button 
                    onClick={() => handleChangeStatus('declined')}
                    className={`flex flex-col items-center p-2 rounded-xl text-xs font-bold transition ${currentStatus === 'declined' ? 'bg-gray-500 text-white shadow-lg' : 'bg-white text-gray-500'}`}
                  >
                    <X size={20} className="mb-1"/> No iré
                  </button>
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wide mb-2">Descripción</h3>
            <p className="text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
              {event.description || "Sin descripción."}
            </p>
          </div>

          {/* Lista de Invitados */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wide">Lista de Invitados</h3>
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                <Users size={14} /> {event.attendees?.length || 0}
              </span>
            </div>

            <div className="space-y-3">
              {event.attendees && event.attendees.length > 0 ? (
                event.attendees.map((guest, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2
                        ${guest.status === 'confirmed' ? 'bg-green-100 text-green-600 border-green-200' : 
                          guest.status === 'declined' ? 'bg-gray-100 text-gray-400 border-gray-200' :
                          'bg-orange-50 text-orange-400 border-orange-100'
                        }`}
                      >
                        {guest.status === 'confirmed' && <Check size={14} />}
                        {guest.status === 'maybe' && <HelpCircle size={14} />}
                        {guest.status === 'declined' && <X size={14} />}
                        {!guest.status && guest.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{guest.name} {user?.uid === guest.uid && '(Tú)'}</p>
                        <p className="text-xs text-gray-400">
                           {guest.status === 'confirmed' ? 'Asistirá' : guest.status === 'declined' ? 'No asistirá' : 'Pendiente'}
                        </p>
                      </div>
                    </div>
                    
                    {/* SOLO EL CREADOR VE EL BOTÓN DE INVITAR y SOLO SI NO ESTA CONFIRMADO */}
                    {isCreator && guest.status !== 'confirmed' && (
                      <button 
                        onClick={() => handleInvite(guest, index)}
                        disabled={invitingIndex === index}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-sm active:scale-95 ${
                           invitingIndex === index 
                             ? 'bg-gray-100 text-gray-400' 
                             : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        {invitingIndex === index ? '...' : <Send size={12} />}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                  Aún no hay invitados.
                </div>
              )}
            </div>
          </div>

          {/* SOLO EL CREADOR PUEDE ELIMINAR */}
          {isCreator && (
            <button onClick={handleDelete} className="w-full py-4 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition mt-4 border border-transparent hover:border-red-100 flex items-center justify-center">
              <Trash2 size={18} className="mr-2" /> Eliminar Evento
            </button>
          )}

        </div>
      </div>
    </div>
  );
}