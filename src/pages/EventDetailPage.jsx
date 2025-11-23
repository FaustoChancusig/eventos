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
  arrayUnion
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
  AlertCircle
} from 'lucide-react';

import EventGallery from '../components/EventGallery';
import EventChat from '../components/EventChat';

export default function EventDetailPage({ event, user, onBack, onEdit }) {
  const [invitingIndex, setInvitingIndex] = useState(null);
  const [currentTab, setCurrentTab] = useState('info');

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isCreator = user?.uid === event.creatorId;

  const myAttendance = useMemo(() => {
    if (!event.attendees) return null;
    const myRawPhone = (user.phoneNumber || '').replace(/[^0-9]/g, '');
    return event.attendees.find(a => {
      if (a.uid === user.uid) return true;
      const guestPhone = (a.phone || '').replace(/[^0-9]/g, '');
      return (
        myRawPhone &&
        guestPhone &&
        (guestPhone === myRawPhone || guestPhone.includes(myRawPhone))
      );
    });
  }, [event.attendees, user]);

  const currentStatus = myAttendance?.status || 'pending';
  const isConfirmed = currentStatus === 'confirmed';

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este evento?')) return;
    try {
      await deleteDoc(doc(db, 'events', event.id));
      onBack();
    } catch (error) {
      alert('Error al borrar.');
    }
  };

  const handleChangeStatus = async newStatus => {
    try {
      const eventRef = doc(db, 'events', event.id);
      const currentAttendees = event.attendees || [];
      const myRawPhone = (user.phoneNumber || '').replace(/[^0-9]/g, '');

      const otherAttendees = currentAttendees.filter(a => {
        const guestPhone = (a.phone || '').replace(/[^0-9]/g, '');
        return !(a.uid === user.uid || guestPhone === myRawPhone);
      });

      const myNewEntry = {
        uid: user.uid,
        name: user.displayName || 'Usuario',
        phone: user.phoneNumber || 'App',
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(eventRef, {
        attendees: [...otherAttendees, myNewEntry]
      });

    } catch (error) {
      alert('Error al actualizar.');
    }
  };

  const handleInvite = async (guest, index) => {
    setInvitingIndex(index);
    let rawPhone = guest.phone.replace(/[^0-9]/g, '');

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
        alert(`Invitación enviada.`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setInvitingIndex(null);
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

  const renderContent = () => {
    if (currentTab === 'info') {
      return (
        <div className="p-6 space-y-6">
          {/* INVITADOS */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className={`font-bold text-sm uppercase tracking-wider ${themeAccentColor}`}>
                Invitados
              </h3>
              <span className={`${themeBgColor} ${themeAccentColor} px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border ${themeBorderColor}`}>
                <Users size={12} /> {event.attendees?.length || 0}
              </span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 px-1 whitespace-nowrap">
              {event.attendees?.length > 0 ? (
                event.attendees.map((guest, index) => {
                  const isMe = user.uid === guest.uid;
                  const needsInvitation = isCreator && guest.status !== 'confirmed';

                  return (
                    <div key={index} className="flex flex-col items-center shrink-0">
                      <div
                        className={`relative w-16 h-16 p-0.5 rounded-full border-2 ${
                          guest.status === 'confirmed'
                            ? 'border-green-500'
                            : guest.status === 'declined'
                            ? 'border-red-300'
                            : themeBorderColor
                        }`}
                      >
                        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xl">
                          {guest.name.charAt(0)}
                        </div>

                        {needsInvitation && (
                          <button
                            onClick={() => handleInvite(guest, index)}
                            disabled={invitingIndex === index}
                            className="absolute -top-1 -right-1 w-7 h-7 bg-white text-orange-500 rounded-full shadow-md flex items-center justify-center"
                          >
                            {invitingIndex === index ? (
                              <span className="animate-spin h-3 w-3 border-2 border-orange-500 rounded-full border-t-transparent"></span>
                            ) : (
                              <Send size={14} />
                            )}
                          </button>
                        )}
                      </div>

                      <span className={`text-xs mt-2 font-medium ${isMe ? themeAccentColor : 'text-gray-600'}`}>
                        {isMe ? 'Tú' : guest.name.split(' ')[0]}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-400 italic py-4">
                  Aún no hay invitados.
                </p>
              )}
            </div>
          </div>

          {/* FECHA Y HORA */}
          <div className="grid grid-cols-2 gap-4">

            <div className="bg-white p-5 rounded-[2rem] shadow-sm flex items-start gap-4 border border-gray-50">
              <div className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor}`}>
                <Calendar size={24} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Fecha
                </h4>
                <p className="font-bold text-gray-800 text-lg leading-tight">
                  {new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', {
                    weekday: 'long'
                  })}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[2rem] shadow-sm flex items-start gap-4 border border-gray-50">
              <div className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor}`}>
                <Clock size={24} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Hora
                </h4>
                <p className="font-bold text-gray-800 text-lg leading-tight">
                  {event.time}
                </p>
              </div>
            </div>

          </div>

          {/* UBICACIÓN */}
          <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-gray-50">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${themeBgColor} ${themeAccentColor}`}>
                <MapPin size={24} />
              </div>
              <p className="font-bold text-gray-800">
                {event.locationName || 'Sin ubicación'}
              </p>
            </div>
          </div>

          {/* ESTADO DEL INVITADO */}
          {!isCreator && (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-orange-100">
              <h3 className="font-bold text-orange-900 text-lg mb-4 text-center">
                ¿Asistirás al evento?
              </h3>

              <div className="grid grid-cols-3 gap-3">

                <button
                  onClick={() => handleChangeStatus('confirmed')}
                  className={`p-4 rounded-2xl flex flex-col items-center font-bold text-sm 
                    ${currentStatus === 'confirmed'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-50 text-gray-600'
                    }`}
                >
                  <Check size={20} />
                  Asistiré
                </button>

                <button
                  onClick={() => handleChangeStatus('maybe')}
                  className={`p-4 rounded-2xl flex flex-col items-center font-bold text-sm 
                    ${currentStatus === 'maybe'
                      ? 'bg-orange-400 text-white'
                      : 'bg-gray-50 text-gray-600'
                    }`}
                >
                  <HelpCircle size={20} />
                  Tal vez
                </button>

                <button
                  onClick={() => handleChangeStatus('declined')}
                  className={`p-4 rounded-2xl flex flex-col items-center font-bold text-sm 
                    ${currentStatus === 'declined'
                      ? 'bg-gray-400 text-white'
                      : 'bg-gray-50 text-gray-600'
                    }`}
                >
                  <X size={20} />
                  No iré
                </button>

              </div>
            </div>
          )}

          {/* DESCRIPCIÓN */}
          {event.description && (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 flex items-start gap-4">
              <div className={`p-3 rounded-2xl ${themeBgColor} ${themeAccentColor}`}>
                <AlignLeft size={24} />
              </div>
              <p className="text-gray-700 whitespace-pre-line">
                {event.description}
              </p>
            </div>
          )}

          {/* GESTIÓN DEL EVENTO */}
          {isCreator && (
            <div className="grid grid-cols-2 gap-3 mt-4">

              <button
                onClick={() => onEdit(event)}
                className="bg-orange-50 p-4 rounded-[2.5rem] border border-orange-100 flex items-center gap-3 text-orange-600 font-bold"
              >
                <Edit size={20} /> Editar
              </button>

              <button
                onClick={handleDelete}
                className="bg-red-50 p-4 rounded-[2.5rem] border border-red-100 flex items-center gap-3 text-red-600 font-bold"
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
          <EventGallery eventId={event.id} user={user} isConfirmed={isConfirmed || isCreator} />
        </div>
      );
    }

    if (currentTab === 'chat') {
      return (
        <div className="h-full">
          <EventChat eventId={event.id} user={user} isConfirmed={isConfirmed || isCreator} />
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 animate-fade-in font-sans">
      {/* HEADER */}
      <div
        className={`h-80 relative shrink-0 ${headerBgClass}`}
        style={headerBgStyle}
      >

        {event.background?.type === 'image' && (
          <div className="absolute inset-0 bg-black/40"></div>
        )}

        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
          <button
            onClick={onBack}
            className="bg-black/20 p-2 rounded-full text-white"
          >
            <ArrowLeft size={22} />
          </button>

          {/* FIX: ALINEADO PERFECTAMENTE */}
          <div className="flex items-center gap-2 h-10">

            {isCreator && (
              <button
                onClick={() => onEdit(event)}
                className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full text-white border border-white/10 flex items-center justify-center"
              >
                <Edit size={20} />
              </button>
            )}

            {isCreator && (
              <div className="h-10 px-4 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-bold flex items-center gap-1 border border-white/10">
                <Crown size={12} /> Admin
              </div>
            )}

            <div className="h-10 px-4 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-bold uppercase tracking-wide flex items-center border border-white/10">
              {event.type}
            </div>

          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-10">
          <h1 className="text-4xl font-black text-white mb-2">{event.name}</h1>
          <p className="text-white/80 text-sm">Organizado por {event.creatorName}</p>
        </div>
      </div>

      {/* TABS */}
      <div className="relative z-30 bg-gray-100 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] -mt-4 pt-4 pb-0">
        <div className="flex justify-around border-b border-gray-200 px-6">

          <button
            onClick={() => setCurrentTab('info')}
            className={`flex-1 py-3 text-center font-bold text-sm border-b-2 ${
              currentTab === 'info'
                ? 'text-orange-600 border-orange-600'
                : 'text-gray-400 border-transparent'
            }`}
          >
            <Calendar size={18} className="inline mr-2" /> Info
          </button>

          <button
            onClick={() => setCurrentTab('gallery')}
            className={`flex-1 py-3 text-center font-bold text-sm border-b-2 ${
              currentTab === 'gallery'
                ? 'text-orange-600 border-orange-600'
                : 'text-gray-400 border-transparent'
            }`}
          >
            <Image size={18} className="inline mr-2" /> Galería
          </button>

          <button
            onClick={() => setCurrentTab('chat')}
            className={`flex-1 py-3 text-center font-bold text-sm border-b-2 ${
              currentTab === 'chat'
                ? 'text-orange-600 border-orange-600'
                : 'text-gray-400 border-transparent'
            }`}
          >
            <MessageCircle size={18} className="inline mr-2" /> Chat
          </button>

        </div>
      </div>

      {/* CONTENIDO SCROLLABLE */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-8">
        {renderContent()}
      </div>

    </div>
  );
}
