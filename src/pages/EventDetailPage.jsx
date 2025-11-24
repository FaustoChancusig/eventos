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
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Calendar,
  MapPin,
  ArrowLeft,
  Trash2,
  Users,
  Send,
  Check,
  HelpCircle,
  X,
  Crown,
  AlignLeft,
  Clock,
  Edit,
  Image,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';

// 📱 Plugin de contactos (Capacitor)
import { Contacts } from '@capacitor-community/contacts';

import EventGallery from '../components/EventGallery';
import EventChat from '../components/EventChat';

// Componente de notificación profesional
const Notification = ({ type, message, onClose, isVisible }) => {
  if (!isVisible) return null;

  const config = {
    success: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: <XCircle className="w-5 h-5 text-red-600" />
    },
    warning: {
      bg: 'bg-orange-50 border-orange-200',
      text: 'text-orange-800',
      icon: <AlertCircle className="w-5 h-5 text-orange-600" />
    },
    info: {
      bg: 'bg-orange-50 border-orange-200',
      text: 'text-orange-800',
      icon: <Info className="w-5 h-5 text-orange-600" />
    }
  };

  const { bg, text, icon } = config[type] || config.info;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`${bg} border ${text} px-4 py-3 rounded-xl shadow-lg max-w-sm flex items-start gap-3`}>
        {icon}
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Componente de confirmación profesional
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", type = "warning" }) => {
  if (!isOpen) return null;

  const config = {
    warning: {
      bg: 'bg-orange-50',
      icon: <AlertCircle className="w-6 h-6 text-orange-600" />,
      button: 'bg-orange-600 hover:bg-orange-700'
    },
    danger: {
      bg: 'bg-red-50',
      icon: <AlertCircle className="w-6 h-6 text-red-600" />,
      button: 'bg-red-600 hover:bg-red-700'
    },
    info: {
      bg: 'bg-orange-50',
      icon: <Info className="w-6 h-6 text-orange-600" />,
      button: 'bg-orange-600 hover:bg-orange-700'
    }
  };

  const { bg, icon, button } = config[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className={`${bg} p-6 rounded-t-2xl flex items-center gap-3`}>
          {icon}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300">{message}</p>
        </div>
        
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 ${button} text-white rounded-xl font-medium transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function EventDetailPage({ event: initialEvent, user, onBack, onEdit, onEventUpdate }) {
  const [invitingIndex, setInvitingIndex] = useState(null);
  const [currentTab, setCurrentTab] = useState('info');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [event, setEvent] = useState(initialEvent);
  const [currentStatus, setCurrentStatus] = useState('pending');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Estados para notificaciones y modales
  const [notification, setNotification] = useState({ isVisible: false, type: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, config: {} });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setEvent(initialEvent);
  }, [initialEvent]);

  const isCreator = user?.uid === event.creatorId;

  // Calcular el estado actual del usuario
  useEffect(() => {
    if (!event.attendees) {
      setCurrentStatus('pending');
      return;
    }
    
    const myRawPhone = (user.phoneNumber || '').replace(/[^0-9]/g, '');
    const myAttendance = event.attendees.find(a => {
      if (a.uid === user.uid) return true;
      const guestPhone = (a.phone || '').replace(/[^0-9]/g, '');
      return (
        myRawPhone &&
        guestPhone &&
        (guestPhone === myRawPhone || guestPhone.includes(myRawPhone))
      );
    });
    
    setCurrentStatus(myAttendance?.status || 'pending');
  }, [event.attendees, user]);

  const isConfirmed = currentStatus === 'confirmed';

  // Mostrar notificación
  const showNotification = (type, message, duration = 4000) => {
    setNotification({ isVisible: true, type, message });
    setTimeout(() => {
      setNotification({ isVisible: false, type: '', message: '' });
    }, duration);
  };

  // Mostrar modal de confirmación
  const showConfirmModal = (config) => {
    setConfirmModal({ isOpen: true, config });
  };

  // Cerrar modal de confirmación
  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, config: {} });
  };

  // --- ABRIR GOOGLE MAPS EXTERNO ---
  const handleOpenMap = () => {
    if (event.lat && event.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`;
      window.open(url, '_blank');
    } else if (event.locationName) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        event.locationName
      )}`;
      window.open(url, '_blank');
    }
  };

  const handleDelete = async () => {
    showConfirmModal({
      title: 'Eliminar evento',
      message: '¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.',
      type: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'events', event.id));
          showNotification('success', 'Evento eliminado correctamente');
          setTimeout(() => onBack(), 1000);
        } catch (error) {
          showNotification('error', 'Error al eliminar el evento');
        } finally {
          closeConfirmModal();
        }
      },
      onCancel: closeConfirmModal
    });
  };

  const handleChangeStatus = async (newStatus) => {
    // Actualizar estado local inmediatamente
    setCurrentStatus(newStatus);
    setIsUpdatingStatus(true);

    try {
      const eventRef = doc(db, 'events', event.id);
      const currentAttendees = event.attendees || [];
      const myRawPhone = (user.phoneNumber || '').replace(/[^0-9]/g, '');

      // Filtrar la entrada actual del usuario
      const otherAttendees = currentAttendees.filter(a => {
        if (a.uid === user.uid) return false;
        const guestPhone = (a.phone || '').replace(/[^0-9]/g, '');
        return !(guestPhone === myRawPhone);
      });

      const myNewEntry = {
        uid: user.uid,
        name: user.displayName || 'Usuario',
        phone: user.phoneNumber || 'App',
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      // Actualizar en Firebase
      await updateDoc(eventRef, {
        attendees: [...otherAttendees, myNewEntry]
      });

      // Actualizar el estado local del evento
      const updatedEvent = {
        ...event,
        attendees: [...otherAttendees, myNewEntry]
      };
      setEvent(updatedEvent);

      // Mostrar notificación de éxito
      const statusMessages = {
        confirmed: '¡Confirmado! Nos alegra que asistas al evento',
        maybe: 'Estado actualizado a "Tal vez"',
        declined: 'Has indicado que no asistirás al evento'
      };
      showNotification('success', statusMessages[newStatus]);


    } catch (error) {
      console.error('Error al actualizar estado:', error);
      // Revertir el estado local si hay error
      setCurrentStatus(currentStatus);
      showNotification('error', 'Error al actualizar tu asistencia');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleInvite = async (guest, index) => {
    setInvitingIndex(index);
    const rawPhone = guest.phone.replace(/[^0-9]/g, '');

    try {
      const q = query(collection(db, 'users'), where('phone', '==', rawPhone));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const targetUser = querySnapshot.docs[0].data();
        await addDoc(collection(db, 'users', targetUser.uid, 'notifications'), {
          type: 'invitation',
          eventId: event.id,
          eventName: event.name,
          fromName: event.creatorName,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        showNotification('success', `Invitación enviada a ${guest.name}`);
      } else {
        showNotification('info', `${guest.name} no está registrado en la app`);
      }
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error al enviar la invitación');
    } finally {
      setInvitingIndex(null);
    }
  };

  // 🧡 NUEVO: agregar invitado usando el picker nativo de contactos
  const handleAddGuestFromContacts = async () => {
    try {
      const result = await Contacts.pickContact({
        projection: {
          name: true,
          phones: true
        }
      });

      const contact = result?.contact;
      if (!contact) {
        return; // usuario canceló
      }

      const displayName =
        contact.name?.display || contact.name?.given || 'Invitado';
      const phoneNumber = contact.phones?.[0]?.number;

      if (!phoneNumber) {
        showNotification('warning', 'Este contacto no tiene número telefónico');
        return;
      }

      const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');

      const currentAttendees = event.attendees || [];
      const alreadyExists = currentAttendees.some(a => {
        const guestPhone = (a.phone || '').replace(/[^0-9]/g, '');
        return guestPhone && guestPhone === normalizedPhone;
      });

      if (alreadyExists) {
        showNotification('warning', 'Este contacto ya está en la lista de invitados');
        return;
      }

      const eventRef = doc(db, 'events', event.id);

      const newGuest = {
        uid: null, // todavía no es usuario registrado en la app
        name: displayName,
        phone: normalizedPhone,
        status: 'pending',
        addedBy: user.uid,
        addedAt: new Date().toISOString()
      };

      await updateDoc(eventRef, {
        attendees: arrayUnion(newGuest)
      });

      // Actualizar estado local inmediatamente
      setEvent({
        ...event,
        attendees: [...currentAttendees, newGuest]
      });

      showNotification('success', `${displayName} agregado como invitado`);

    } catch (error) {
      console.error('Error al seleccionar contacto', error);
      showNotification('error', 'No se pudo acceder a los contactos. Verifica los permisos de la aplicación.');
    }
  };

  const headerBgClass =
    event.background?.type === 'gradient'
      ? `bg-gradient-to-br ${event.background.value}`
      : isCreator
      ? 'bg-gradient-to-br from-orange-500 to-red-600'
      : 'bg-gradient-to-br from-orange-600 to-amber-700';

  const headerBgStyle =
    event.background?.type === 'image'
      ? {
          backgroundImage: `url(${event.background.value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }
      : {};

  const themeBgColor = 'bg-orange-50';
  const themeAccentColor = 'text-orange-600';
  const themeBorderColor = 'border-orange-100';

  // Medir la altura del header después del renderizado
  useEffect(() => {
    const headerElement = document.querySelector('.event-header');
    if (headerElement) {
      setHeaderHeight(headerElement.offsetHeight);
    }
  }, []);

  const renderContent = () => {
    if (currentTab === 'info') {
      return (
        <div className="p-6 space-y-6 text-ink dark:text-slate-100">
          {/* INVITADOS */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3
                className={`font-bold text-sm uppercase tracking-wider ${themeAccentColor}`}
              >
                Invitados
              </h3>
              {isCreator && (
                <button
                  onClick={handleAddGuestFromContacts}
                  className="w-14 h-14 bg-orange-100 border border-orange-300
                             rounded-2xl shadow-md flex items-center justify-center
                             hover:bg-orange-200 active:scale-95 transition-all"
                >
                  <Users size={20} className="text-orange-600" />
                  <span className="text-orange-600 font-bold text-2xl -ml-1">
                    +
                  </span>
                </button>
              )}
              <span
                className={`${themeBgColor} ${themeAccentColor} px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border ${themeBorderColor}`}
              >
                <Users size={12} /> {event.attendees?.length || 0}
              </span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 px-1 whitespace-nowrap">
              {event.attendees?.length > 0 ? (
                event.attendees.map((guest, index) => {
                  const isMe = user.uid === guest.uid;
                  const needsInvitation =
                    isCreator && guest.status !== 'confirmed';

                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center shrink-0"
                    >
                      <div
                        className={`relative w-16 h-16 p-0.5 rounded-full border-2 ${
                          guest.status === 'confirmed'
                            ? 'border-green-500'
                            : guest.status === 'declined'
                            ? 'border-red-300'
                            : themeBorderColor
                        }`}
                      >
                        <div className="w-full h-full rounded-full bg-gray-200 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold text-xl">
                          {guest.name.charAt(0)}
                        </div>

                        {needsInvitation && (
                          <button
                            onClick={() => handleInvite(guest, index)}
                            disabled={invitingIndex === index}
                            className="absolute -top-1 -right-1 w-7 h-7 bg-white dark:bg-slate-900 text-orange-500 rounded-full shadow-md flex items-center justify-center"
                          >
                            {invitingIndex === index ? (
                              <span className="animate-spin h-3 w-3 border-2 border-orange-500 rounded-full border-t-transparent"></span>
                            ) : (
                              <Send size={14} />
                            )}
                          </button>
                        )}
                      </div>

                      <span
                        className={`text-xs mt-2 font-medium ${
                          isMe
                            ? themeAccentColor
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {isMe ? 'Tú' : guest.name.split(' ')[0]}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic py-4">
                  Aún no hay invitados.
                </p>
              )}
            </div>
          </div>

          {/* FECHA Y HORA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm flex items-start gap-4 border border-gray-50 dark:border-slate-800">
              <div
                className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor}`}
              >
                <Calendar size={24} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Fecha
                </h4>
                <p className="font-bold text-gray-800 dark:text-white text-lg leading-tight">
                  {new Date(
                    event.date + 'T00:00:00'
                  ).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(
                    event.date + 'T00:00:00'
                  ).toLocaleDateString('es-ES', {
                    weekday: 'long'
                  })}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm flex items-start gap-4 border border-gray-50 dark:border-slate-800">
              <div
                className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor}`}
              >
                <Clock size={24} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Hora
                </h4>
                <p className="font-bold text-gray-800 dark:text-white text-lg leading-tight">
                  {event.time}
                </p>
              </div>
            </div>
          </div>

          {/* UBICACIÓN - CLICK PARA ABRIR MAPA */}
          <button
            onClick={handleOpenMap}
            className="w-full text-left bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-slate-800 active:scale-95 transition-transform group hover:border-orange-200"
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-full ${themeBgColor} ${themeAccentColor} group-hover:bg-orange-100 transition-colors`}
              >
                <MapPin size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800 dark:text-white leading-tight">
                  {event.locationName || 'Sin ubicación'}
                </p>
                {event.lat && event.lng ? (
                  <p className="text-xs text-orange-500 font-bold mt-1 flex items-center gap-1">
                    Ver en Google Maps ↗
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Sin coordenadas</p>
                )}
              </div>
            </div>
          </button>

          {/* ESTADO DEL INVITADO - ACTUALIZACIÓN EN TIEMPO REAL */}
          {!isCreator && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-orange-100 dark:border-slate-800">
              <h3 className="font-bold text-orange-900 dark:text-orange-300 text-lg mb-4 text-center">
                ¿Asistirás al evento?
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleChangeStatus('confirmed')}
                  disabled={isUpdatingStatus}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 font-bold text-sm transition-all duration-200
                    ${
                      currentStatus === 'confirmed'
                        ? 'bg-green-500 text-white shadow-lg scale-105 border-2 border-green-600'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-2 border-transparent hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-900/20'
                    } ${isUpdatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUpdatingStatus && currentStatus === 'confirmed' ? (
                    <span className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></span>
                  ) : (
                    <>
                      <div className={`p-2 rounded-full ${currentStatus === 'confirmed' ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900/40'}`}>
                        <Check size={20} className={currentStatus === 'confirmed' ? 'text-white' : 'text-green-600'} />
                      </div>
                      Asistiré
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleChangeStatus('maybe')}
                  disabled={isUpdatingStatus}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 font-bold text-sm transition-all duration-200
                    ${
                      currentStatus === 'maybe'
                        ? 'bg-orange-500 text-white shadow-lg scale-105 border-2 border-orange-600'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-2 border-transparent hover:bg-orange-50 hover:border-orange-200 dark:hover:bg-orange-900/20'
                    } ${isUpdatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUpdatingStatus && currentStatus === 'maybe' ? (
                    <span className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></span>
                  ) : (
                    <>
                      <div className={`p-2 rounded-full ${currentStatus === 'maybe' ? 'bg-white/20' : 'bg-orange-100 dark:bg-orange-900/40'}`}>
                        <HelpCircle size={20} className={currentStatus === 'maybe' ? 'text-white' : 'text-orange-600'} />
                      </div>
                      Tal vez
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleChangeStatus('declined')}
                  disabled={isUpdatingStatus}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 font-bold text-sm transition-all duration-200
                    ${
                      currentStatus === 'declined'
                        ? 'bg-red-500 text-white shadow-lg scale-105 border-2 border-red-600'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-2 border-transparent hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/20'
                    } ${isUpdatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUpdatingStatus && currentStatus === 'declined' ? (
                    <span className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></span>
                  ) : (
                    <>
                      <div className={`p-2 rounded-full ${currentStatus === 'declined' ? 'bg-white/20' : 'bg-red-100 dark:bg-red-900/40'}`}>
                        <X size={20} className={currentStatus === 'declined' ? 'text-white' : 'text-red-600'} />
                      </div>
                      No iré
                    </>
                  )}
                </button>
              </div>

              {/* Indicador de estado actual */}
              {currentStatus !== 'pending' && (
                <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                  <p className="text-center text-orange-700 dark:text-orange-300 text-sm font-medium">
                    Estado actual: 
                    <span className="font-bold ml-1">
                      {currentStatus === 'confirmed' && '✅ Asistiré'}
                      {currentStatus === 'maybe' && '🤔 Tal vez'}
                      {currentStatus === 'declined' && '❌ No iré'}
                    </span>
                    {isUpdatingStatus && (
                      <span className="ml-2 text-xs text-orange-500">Actualizando...</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* DESCRIPCIÓN */}
          {event.description && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-slate-800 flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor}`}
              >
                <AlignLeft size={24} />
              </div>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {event.description}
              </p>
            </div>
          )}

          {/* GESTIÓN DEL EVENTO */}
          {isCreator && (
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                onClick={() => onEdit(event)}
                className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-[2.5rem] border border-orange-100 dark:border-orange-800 flex items-center gap-3 text-orange-600 dark:text-orange-300 font-bold hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              >
                <Edit size={20} /> Editar
              </button>

              <button
                onClick={handleDelete}
                className="bg-red-50 dark:bg-red-900/20 p-4 rounded-[2.5rem] border border-red-100 dark:border-red-800 flex items-center gap-3 text-red-600 dark:text-red-300 font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={20} /> Eliminar
              </button>
            </div>
          )}
        </div>
      );
    }

    if (currentTab === 'gallery') {
      return (
        <div className="p-6">
          <EventGallery
            eventId={event.id}
            user={user}
            isConfirmed={isConfirmed || isCreator}
          />
        </div>
      );
    }

    if (currentTab === 'chat') {
      return (
        <div className="h-full">
          <EventChat
            eventId={event.id}
            user={user}
            isConfirmed={isConfirmed || isCreator}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-950 animate-fade-in font-sans text-ink dark:text-slate-100">
      {/* HEADER FIJADO */}
      <div className="fixed top-0 left-0 right-0 z-50 event-header">
        {/* HEADER PRINCIPAL */}
        <div
          className={`min-h-[35vh] relative shrink-0 pt-20 ${headerBgClass}`}
          style={headerBgStyle}
        >
          {event.background?.type === 'image' && (
            <div className="absolute inset-0 bg-black/40"></div>
          )}

          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
            <button
              onClick={onBack}
              className="bg-black/20 dark:bg-black/30 p-2 rounded-full text-white hover:bg-black/30 transition-colors"
            >
              <ArrowLeft size={22} />
            </button>

            <div className="flex items-center gap-2 h-10">
              {isCreator && (
                <button
                  onClick={() => onEdit(event)}
                  className="w-10 h-10 bg-white/20 dark:bg-white/10 backdrop-blur-md rounded-full text-white border border-white/10 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <Edit size={20} />
                </button>
              )}

              {isCreator && (
                <div className="h-10 px-4 bg-white/20 dark:bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-bold flex items-center gap-1 border border-white/10">
                  <Crown size={12} /> Admin
                </div>
              )}

              <div className="h-10 px-4 bg-white/20 dark:bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-bold uppercase tracking-wide flex items-center border border-white/10">
                {event.type}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-10">
            <h1 className="text-4xl font-black text-white mb-2">
              {event.name}
            </h1>
            <p className="text-white/80 text-sm">
              Organizado por {event.creatorName}
            </p>
          </div>
        </div>

        {/* TABS FIJADOS DEBAJO DEL HEADER */}
        <div className="bg-gray-100 dark:bg-slate-900 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-none pt-4 pb-0">
          <div className="flex justify-around border-b border-gray-200 dark:border-slate-700 px-6">
            <button
              onClick={() => setCurrentTab('info')}
              className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all
                ${
                  currentTab === 'info'
                    ? 'text-orange-600 dark:text-orange-300 border-orange-600 dark:border-orange-300'
                    : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-orange-500 dark:hover:text-orange-400'
                }`}
            >
              <Calendar size={18} className="inline mr-2" /> Info
            </button>

            <button
              onClick={() => setCurrentTab('gallery')}
              className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all
                ${
                  currentTab === 'gallery'
                    ? 'text-orange-600 dark:text-orange-300 border-orange-600 dark:border-orange-300'
                    : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-orange-500 dark:hover:text-orange-400'
                }`}
            >
              <Image size={18} className="inline mr-2" /> Galería
            </button>

            <button
              onClick={() => setCurrentTab('chat')}
              className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all
                ${
                  currentTab === 'chat'
                    ? 'text-orange-600 dark:text-orange-300 border-orange-600 dark:border-orange-300'
                    : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-orange-500 dark:hover:text-orange-400'
                }`}
            >
              <MessageCircle size={18} className="inline mr-2" /> Chat
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO CON MARGEN SUPERIOR PARA EL HEADER FIJADO */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden pb-8 mt-[calc(35vh+80px)]"
        style={{ marginTop: `calc(${headerHeight}px + 1rem)` }}
      >
        {renderContent()}
      </div>

      {/* NOTIFICACIONES PROFESIONALES */}
      <Notification
        type={notification.type}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={() => setNotification({ isVisible: false, type: '', message: '' })}
      />

      {/* MODAL DE CONFIRMACIÓN PROFESIONAL */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.config.title}
        message={confirmModal.config.message}
        type={confirmModal.config.type}
        confirmText={confirmModal.config.confirmText}
        cancelText={confirmModal.config.cancelText}
        onConfirm={confirmModal.config.onConfirm}
        onCancel={confirmModal.config.onCancel}
      />
    </div>
  );
}