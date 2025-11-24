import React, { useState, useMemo, useEffect } from 'react';
import {
  deleteDoc,
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove // Importante para quitarte si rechazas
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Calendar, MapPin, ArrowLeft, Trash2, Users, Send, Check, HelpCircle,
  X, Crown, AlignLeft, Clock, Edit, Image, MessageCircle, AlertCircle,
  CheckCircle, XCircle, Info
} from 'lucide-react';
import { Contacts } from '@capacitor-community/contacts';
import EventGallery from '../components/EventGallery';
import EventChat from '../components/EventChat';

// --- COMPONENTES DE UI (Notificación y Modal) ---
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

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", type = "warning" }) => {
  if (!isOpen) return null;
  const config = {
    warning: { bg: 'bg-orange-50', icon: <AlertCircle className="w-6 h-6 text-orange-600" />, button: 'bg-orange-600 hover:bg-orange-700' },
    danger: { bg: 'bg-red-50', icon: <AlertCircle className="w-6 h-6 text-red-600" />, button: 'bg-red-600 hover:bg-red-700' },
    info: { bg: 'bg-blue-50', icon: <Info className="w-6 h-6 text-blue-600" />, button: 'bg-blue-600 hover:bg-blue-700' }
  };
  const { bg, icon, button } = config[type];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className={`${bg} p-6 rounded-t-2xl flex items-center gap-3`}>
          {icon}<h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="p-6"><p className="text-gray-600 dark:text-gray-300">{message}</p></div>
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onCancel} className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-medium hover:bg-gray-50">{cancelText}</button>
          <button onClick={onConfirm} className={`flex-1 py-3 px-4 ${button} text-white rounded-xl font-medium`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default function EventDetailPage({ event: initialEvent, user, onBack, onEdit }) {
  const [invitingIndex, setInvitingIndex] = useState(null);
  const [currentTab, setCurrentTab] = useState('info');
  const [event, setEvent] = useState(initialEvent);
  const [currentStatus, setCurrentStatus] = useState('pending');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [notification, setNotification] = useState({ isVisible: false, type: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, config: {} });

  useEffect(() => { setEvent(initialEvent); }, [initialEvent]);

  const isCreator = user?.uid === event.creatorId;

  // --- NORMALIZAR TELÉFONOS (CLAVE PARA EVITAR DUPLICADOS) ---
  const normalizePhone = (phone) => {
    if (!phone) return '';
    let p = phone.replace(/[^0-9]/g, ''); 
    if (p.startsWith('593')) p = p.substring(3);
    if (p.startsWith('0')) p = p.substring(1);
    return p;
  };

  useEffect(() => {
    if (!event.attendees) { setCurrentStatus('pending'); return; }
    
    const myPhoneNorm = normalizePhone(user.phoneNumber);
    
    // Buscamos si yo estoy en la lista (ya sea por UID o por Teléfono)
    const myAttendance = event.attendees.find(a => {
      if (a.uid === user.uid) return true;
      const guestPhoneNorm = normalizePhone(a.phone);
      return (myPhoneNorm && guestPhoneNorm && myPhoneNorm === guestPhoneNorm);
    });
    
    setCurrentStatus(myAttendance?.status || 'pending');
  }, [event.attendees, user]);

  const isConfirmed = currentStatus === 'confirmed';

  const showNotification = (type, message) => {
    setNotification({ isVisible: true, type, message });
    setTimeout(() => setNotification({ isVisible: false, type: '', message: '' }), 4000);
  };

  const handleOpenMap = () => {
    if (event.lat && event.lng) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`, '_blank');
    } else if (event.locationName) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.locationName)}`, '_blank');
    }
  };

  const handleDelete = async () => {
    setConfirmModal({
      isOpen: true,
      config: {
        title: 'Eliminar evento',
        message: '¿Estás seguro? Esta acción no se puede deshacer.',
        type: 'danger',
        confirmText: 'Eliminar',
        onCancel: () => setConfirmModal({ isOpen: false, config: {} }),
        onConfirm: async () => {
          try {
            await deleteDoc(doc(db, 'events', event.id));
            onBack();
          } catch (error) { showNotification('error', 'Error al eliminar'); }
        }
      }
    });
  };

  // --- [CORREGIDO] CAMBIAR STATUS Y ACTUALIZAR HOME ---
  const handleChangeStatus = async (newStatus) => {
    setCurrentStatus(newStatus);
    setIsUpdatingStatus(true);
    
    try {
      const eventRef = doc(db, 'events', event.id);
      const currentAttendees = event.attendees || [];
      const myPhoneNorm = normalizePhone(user.phoneNumber);

      // 1. FILTRO ANTI-DUPLICADOS: Eliminamos tu rastro anterior (ya sea como usuario o como contacto telefónico)
      const otherAttendees = currentAttendees.filter(a => {
        if (a.uid === user.uid) return false; // Sacamos tu usuario anterior
        
        // Sacamos la invitación por teléfono si coincide con tu número
        const guestPhoneNorm = normalizePhone(a.phone);
        if (myPhoneNorm && guestPhoneNorm && myPhoneNorm === guestPhoneNorm) return false;
        
        return true;
      });

      // 2. CREAMOS TU NUEVA ENTRADA DE ASISTENCIA
      const myNewEntry = {
        uid: user.uid,
        name: user.displayName || 'Usuario',
        phone: user.phoneNumber || 'App',
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      // 3. PREPARAR ACTUALIZACIÓN
      const updates = {
        attendees: [...otherAttendees, myNewEntry]
      };

      // 4. [VITAL] ACTUALIZAR LISTA DE GUESTIDS PARA EL HOME
      if (newStatus === 'confirmed' || newStatus === 'maybe') {
        updates.guestIds = arrayUnion(user.uid); // ¡Esto hace que aparezca en tu Home!
      } else if (newStatus === 'declined') {
        updates.guestIds = arrayRemove(user.uid); // Esto lo quita si rechazas
      }

      // 5. BORRAR NOTIFICACIÓN PENDIENTE (Para que no te siga saliendo)
      const notifQuery = query(
        collection(db, 'users', user.uid, 'notifications'),
        where('eventId', '==', event.id),
        where('type', '==', 'invitation')
      );
      const notifDocs = await getDocs(notifQuery);
      notifDocs.forEach(async (docSnap) => {
        await deleteDoc(doc(db, 'users', user.uid, 'notifications', docSnap.id));
      });

      // Ejecutar actualización en evento
      await updateDoc(eventRef, updates);
      
      // Actualizar estado local
      setEvent({ ...event, ...updates });
      
      showNotification('success', 'Asistencia confirmada correctamente');
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error al actualizar');
      setCurrentStatus(currentStatus); 
    } finally { setIsUpdatingStatus(false); }
  };

  // --- ENVIAR INVITACIÓN INTELIGENTE ---
  const handleInvite = async (guest, index) => {
    setInvitingIndex(index);
    const cleanPhone = normalizePhone(guest.phone);
    
    // Buscar usuario con variaciones de teléfono para asegurar match
    let searchPhones = [cleanPhone, `0${cleanPhone}`, `593${cleanPhone}`];
    searchPhones = [...new Set(searchPhones)].filter(Boolean);

    try {
      const q = query(collection(db, 'users'), where('phone', 'in', searchPhones));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const targetUser = querySnapshot.docs[0].data();
        await addDoc(collection(db, 'users', targetUser.uid, 'notifications'), {
          type: 'invitation',
          eventId: event.id,
          eventName: event.name,
          fromName: user.displayName || 'Un amigo',
          fromPhoto: user.photoURL || null,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        showNotification('success', `¡Invitación enviada a ${guest.name}!`);
      } else {
        showNotification('info', `${guest.name} aún no usa la App.`);
      }
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error de conexión.');
    } finally {
      setInvitingIndex(null);
    }
  };

  // --- AGREGAR DESDE CONTACTOS ---
  const handleAddGuestFromContacts = async () => {
    try {
      const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
      if (!result?.contact) return;

      const contact = result.contact;
      const displayName = contact.name?.display || contact.name?.given || 'Invitado';
      const phoneNumber = contact.phones?.[0]?.number;

      if (!phoneNumber) { showNotification('warning', 'El contacto no tiene número'); return; }

      const normalizedInput = normalizePhone(phoneNumber);
      const currentAttendees = event.attendees || [];
      
      if (currentAttendees.some(a => normalizePhone(a.phone) === normalizedInput)) {
        showNotification('warning', 'Ya está en la lista');
        return;
      }

      const newGuest = {
        uid: null,
        name: displayName,
        phone: normalizedInput,
        status: 'pending',
        addedBy: user.uid,
        addedAt: new Date().toISOString()
      };
      
      // Guardamos el numero original para mostrarlo si hace falta, pero la lógica usa el normalizado
      newGuest.originalPhone = phoneNumber; 

      await updateDoc(doc(db, 'events', event.id), { attendees: arrayUnion(newGuest) });
      setEvent({ ...event, attendees: [...currentAttendees, newGuest] });
      showNotification('success', 'Agregado a la lista. ¡Toca el avión para invitarlo!');
    } catch (error) {
      showNotification('error', 'Error al acceder a contactos');
    }
  };

  const headerBgClass = event.background?.type === 'gradient'
    ? `bg-gradient-to-br ${event.background.value}`
    : 'bg-gradient-to-br from-orange-600 to-amber-700';

  const headerBgStyle = event.background?.type === 'image'
    ? { backgroundImage: `url(${event.background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  const renderContent = () => {
    if (currentTab === 'info') {
      return (
        <div className="p-6 space-y-6 text-ink dark:text-slate-100">
          {/* INVITADOS */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-bold text-sm uppercase tracking-wider text-orange-600">Invitados</h3>
              {isCreator && (
                <button onClick={handleAddGuestFromContacts} className="w-12 h-12 bg-orange-100 border border-orange-300 rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-sm">
                  <Users size={20} className="text-orange-600" /><span className="text-orange-600 font-bold text-lg ml-0.5">+</span>
                </button>
              )}
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 px-1">
              {event.attendees?.map((guest, index) => {
                const isMe = user.uid === guest.uid;
                const needsInvitation = isCreator && !guest.uid && guest.status !== 'confirmed';
                return (
                  <div key={index} className="flex flex-col items-center shrink-0 relative group">
                    <div className={`relative w-16 h-16 p-0.5 rounded-full border-2 transition-all ${guest.status === 'confirmed' ? 'border-green-500' : guest.status === 'declined' ? 'border-red-300' : 'border-orange-100'}`}>
                      <div className="w-full h-full rounded-full bg-gray-200 dark:bg-slate-800 flex items-center justify-center text-gray-500 font-bold text-xl capitalize overflow-hidden">
                        {guest.name.charAt(0)}
                      </div>
                      {needsInvitation && (
                        <button 
                          onClick={() => handleInvite(guest, index)} 
                          disabled={invitingIndex === index} 
                          className="absolute -top-1 -right-1 w-7 h-7 bg-white text-orange-500 rounded-full shadow-md flex items-center justify-center hover:scale-110 transition-transform"
                        >
                          {invitingIndex === index ? <span className="animate-spin h-3 w-3 border-2 border-orange-500 rounded-full border-t-transparent"></span> : <Send size={14} />}
                        </button>
                      )}
                    </div>
                    <span className="text-xs mt-2 font-medium text-gray-600 dark:text-gray-400 truncate max-w-[64px] text-center">
                      {isMe ? 'Tú' : guest.name.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FECHA Y HORA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm flex items-start gap-4 border border-gray-50 dark:border-slate-800">
              <div className="p-3 rounded-2xl bg-orange-50 text-orange-600"><Calendar size={24} /></div>
              <div><h4 className="text-xs font-bold text-gray-400 uppercase">Fecha</h4><p className="font-bold text-lg">{new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p></div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm flex items-start gap-4 border border-gray-50 dark:border-slate-800">
              <div className="p-3 rounded-2xl bg-orange-50 text-orange-600"><Clock size={24} /></div>
              <div><h4 className="text-xs font-bold text-gray-400 uppercase">Hora</h4><p className="font-bold text-lg">{event.time}</p></div>
            </div>
          </div>

          {/* UBICACIÓN */}
          <button onClick={handleOpenMap} className="w-full text-left bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-sm border border-gray-50 flex items-center gap-3 group active:scale-95 transition-transform">
            <div className="p-3 rounded-full bg-orange-50 text-orange-600 group-hover:bg-orange-100"><MapPin size={24} /></div>
            <div className="flex-1">
              <p className="font-bold text-gray-800 dark:text-white">{event.locationName || 'Sin ubicación'}</p>
              {event.lat && <p className="text-xs text-orange-500 font-bold mt-1">Ver en Google Maps ↗</p>}
            </div>
          </button>

          {/* ESTADO DE ASISTENCIA */}
          {!isCreator && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-orange-100 dark:border-slate-800">
              <h3 className="font-bold text-orange-900 dark:text-orange-300 text-center mb-4">¿Asistirás?</h3>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handleChangeStatus('confirmed')} disabled={isUpdatingStatus} className={`p-4 rounded-2xl flex flex-col items-center gap-2 font-bold text-sm transition-all ${currentStatus === 'confirmed' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-50 text-gray-600 dark:text-gray-400'}`}><Check size={20} /> Asistiré</button>
                <button onClick={() => handleChangeStatus('maybe')} disabled={isUpdatingStatus} className={`p-4 rounded-2xl flex flex-col items-center gap-2 font-bold text-sm transition-all ${currentStatus === 'maybe' ? 'bg-orange-500 text-white shadow-lg' : 'bg-gray-50 text-gray-600 dark:text-gray-400'}`}><HelpCircle size={20} /> Tal vez</button>
                <button onClick={() => handleChangeStatus('declined')} disabled={isUpdatingStatus} className={`p-4 rounded-2xl flex flex-col items-center gap-2 font-bold text-sm transition-all ${currentStatus === 'declined' ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-50 text-gray-600 dark:text-gray-400'}`}><X size={20} /> No iré</button>
              </div>
            </div>
          )}

          {/* DESCRIPCIÓN */}
          {event.description && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] flex gap-4"><div className="p-3 rounded-2xl bg-orange-50 text-orange-600"><AlignLeft size={24} /></div><p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{event.description}</p></div>
          )}

          {/* BOTONES CREADOR */}
          {isCreator && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => onEdit(event)} className="bg-orange-50 p-4 rounded-[2.5rem] border border-orange-100 flex items-center gap-3 text-orange-600 font-bold justify-center active:scale-95 transition"><Edit size={20} /> Editar</button>
              <button onClick={handleDelete} className="bg-red-50 p-4 rounded-[2.5rem] border border-red-100 flex items-center gap-3 text-red-600 font-bold justify-center active:scale-95 transition"><Trash2 size={20} /> Eliminar</button>
            </div>
          )}
        </div>
      );
    }
    if (currentTab === 'gallery') return <div className="p-6"><EventGallery eventId={event.id} user={user} isConfirmed={isConfirmed || isCreator} /></div>;
    if (currentTab === 'chat') return <div className="h-full"><EventChat eventId={event.id} user={user} isConfirmed={isConfirmed || isCreator} /></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-950 animate-fade-in font-sans text-ink dark:text-slate-100">
      <div className={`relative shrink-0 pt-8 ${headerBgClass}`} style={headerBgStyle}>
        {event.background?.type === 'image' && <div className="absolute inset-0 bg-black/40"></div>}
        <div className="relative z-20 p-4 flex justify-between items-center">
          <button onClick={onBack} className="bg-black/20 p-2 rounded-full text-white hover:bg-black/30"><ArrowLeft size={22} /></button>
          <div className="flex items-center gap-2">
            {isCreator && <button onClick={() => onEdit(event)} className="w-10 h-10 bg-white/20 rounded-full text-white flex items-center justify-center"><Edit size={20} /></button>}
            <div className="px-4 py-2 bg-white/20 rounded-full text-white text-xs font-bold uppercase">{event.type}</div>
          </div>
        </div>
        <div className="relative z-10 p-8 pt-4 pb-12">
          <h1 className="text-4xl font-black text-white mb-2 leading-tight">{event.name}</h1>
          <p className="text-white/80 text-sm">Organizado por {event.creatorName}</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-slate-950 rounded-t-[2.5rem] -mt-8 relative z-30 shadow-xl overflow-hidden">
        <div className="sticky top-0 bg-gray-100 dark:bg-slate-950 z-40 pt-4 border-b border-gray-200 dark:border-slate-700 px-6 flex justify-around shrink-0">
          <button onClick={() => setCurrentTab('info')} className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all ${currentTab === 'info' ? 'text-orange-600 border-orange-600' : 'text-gray-400 border-transparent'}`}>Info</button>
          <button onClick={() => setCurrentTab('gallery')} className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all ${currentTab === 'gallery' ? 'text-orange-600 border-orange-600' : 'text-gray-400 border-transparent'}`}>Galería</button>
          <button onClick={() => setCurrentTab('chat')} className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all ${currentTab === 'chat' ? 'text-orange-600 border-orange-600' : 'text-gray-400 border-transparent'}`}>Chat</button>
        </div>
        <div className="flex-1 overflow-y-auto pb-8">{renderContent()}</div>
      </div>
      <Notification type={notification.type} message={notification.message} isVisible={notification.isVisible} onClose={() => setNotification({ ...notification, isVisible: false })} />
      <ConfirmationModal isOpen={confirmModal.isOpen} {...confirmModal.config} />
    </div>
  );
}