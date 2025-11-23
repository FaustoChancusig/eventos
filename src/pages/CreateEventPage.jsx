import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, doc, serverTimestamp,
  query, orderBy, onSnapshot, deleteDoc, getDocs, where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Contacts } from '@capacitor-community/contacts';
import {
  MapPin, Calendar, Clock, AlignLeft, ArrowLeft, Type, AlertCircle,
  Plus, Check, Trash2, Eye, X, Map as MapIcon
} from 'lucide-react';

import EventPreviewModal from '../components/EventPreviewModal';
import MapSelectorPage from './MapSelectorPage';

export default function CreateEventPage({ user, onBack, eventToEdit }) {

  const [loading, setLoading] = useState(false);

  // ⛔ ERRORES INDIVIDUALES
  const [nameError, setNameError] = useState(null);
  const [dateError, setDateError] = useState(null);
  const [timeError, setTimeError] = useState(null);
  const [locationError, setLocationError] = useState(null);

  const [error, setError] = useState(null);

  const isEditing = !!eventToEdit;

  const [guests, setGuests] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const [showMapSelector, setShowMapSelector] = useState(false);

  // 🎨 Configuración de fondo del evento (gradient / imagen)
  const [backgroundConfig, setBackgroundConfig] = useState({
    type: 'gradient',
    value: 'from-primary-300 to-primary-500',
    file: null // si es imagen
  });

  const defaultTags = ['Fiesta', 'Reunión', 'Cena', 'Deportes', 'Viaje', 'Trabajo'];
  const [customTags, setCustomTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // 🟠 Bottom sheet de fecha/hora
  const [showDateTimeSheet, setShowDateTimeSheet] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'Fiesta',
    date: '',
    time: '',
    description: '',
    locationName: '',
    lat: null,
    lng: null
  });

  // === Cargar datos si estamos editando ===
  useEffect(() => {
    if (eventToEdit) {
      setFormData({
        name: eventToEdit.name || '',
        type: eventToEdit.type || 'Fiesta',
        date: eventToEdit.date || '',
        time: eventToEdit.time || '',
        description: eventToEdit.description || '',
        locationName: eventToEdit.locationName || '',
        lat: eventToEdit.lat || null,
        lng: eventToEdit.lng || null
      });

      // Si el evento ya tiene background, lo usamos
      if (eventToEdit.background) {
        setBackgroundConfig({
          type: eventToEdit.background.type || 'gradient',
          value: eventToEdit.background.value || 'from-primary-300 to-primary-500',
          file: null
        });
      }
    }
  }, [eventToEdit]);

  // === Cargar etiquetas personalizadas ===
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'tags'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);


  // === Agregar etiqueta ===
  const handleAddTag = async () => {
    const tagText = newTag.trim();
    if (!tagText || defaultTags.includes(tagText) || customTags.some(t => t.name === tagText)) return;

    try {
      await addDoc(collection(db, 'users', user.uid, 'tags'), {
        name: tagText,
        createdAt: serverTimestamp()
      });

      setFormData({ ...formData, type: tagText });
      setNewTag('');
      setIsAddingTag(false);

    } catch (err) {
      console.error(err);
    }
  };

  // === Eliminar etiqueta ===
  const handleDeleteTag = async (tagId, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Borrar etiqueta?")) return;

    await deleteDoc(doc(db, 'users', user.uid, 'tags', tagId));

    if (formData.type === customTags.find(t => t.id === tagId)?.name) {
      setFormData(prev => ({ ...prev, type: 'Fiesta' }));
    }
  };

  // === Contactos ===
  const handleAddGuest = async () => {
    try {
      const permission = await Contacts.requestPermissions();
      if (permission.contacts === 'granted') {
        const result = await Contacts.pickContact({ projection: { name: true, phones: true } });

        if (result && result.contact) {
          const name = result.contact.name?.display || "Sin nombre";
          const rawPhone = result.contact.phones?.[0]?.number || "";
          const phone = rawPhone.replace(/[^0-9+]/g, '');

          if (!guests.some(g => g.phone === phone)) {
            setGuests(prev => [...prev, { name, phone }]);
          }
        }
      }

    } catch (err) {
      console.log("Selección de contacto cancelada");
    }
  };

  const removeGuest = (index) =>
    setGuests(guests.filter((_, i) => i !== index));

  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const setEventType = (type) =>
    setFormData(prev => ({ ...prev, type }));

  // === Confirmar ubicación del mapa ===
  const handleLocationConfirmed = (locationData) => {
    setFormData(prev => ({
      ...prev,
      lat: locationData.lat,
      lng: locationData.lng,
      locationName: locationData.address || "Ubicación personalizada"
    }));

    if (locationError) setLocationError(null);
  };


  /* ============================================================
      Helper: Redimensionar imagen ANTES de subir
     ============================================================ */

  const resizeImageFile = async (file, maxWidth = 1280, maxHeight = 1280, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
          let { width, height } = img;

          // Si ya es pequeña, se deja igual
          if (width <= maxWidth && height <= maxHeight) {
            URL.revokeObjectURL(objectUrl);
            return resolve(file);
          }

          const ratio = Math.min(maxWidth / width, maxHeight / height);
          const targetWidth = Math.round(width * ratio);
          const targetHeight = Math.round(height * ratio);

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl);
              if (!blob) {
                return resolve(file); // fallback: devolver original
              }
              const resizedFile = new File([blob], file.name, {
                type: blob.type || file.type,
                lastModified: Date.now(),
              });
              resolve(resizedFile);
            },
            file.type === 'image/png' ? 'image/png' : 'image/jpeg',
            quality
          );
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(file); // si falla el resize, seguimos con el original
        };

        img.src = objectUrl;
      } catch (err) {
        console.error("Error al redimensionar imagen:", err);
        resolve(file);
      }
    });
  };


  /* ============================================================
      VALIDACIÓN INDIVIDUAL + BLOQUEO FECHAS Y HORAS PASADAS
     ============================================================ */

  const handlePreview = (e) => {
    e.preventDefault();
    setError(null);

    setNameError(null);
    setDateError(null);
    setTimeError(null);
    setLocationError(null);

    let hasError = false;

    if (!formData.name.trim()) {
      setNameError("Debes ingresar un nombre para el evento.");
      hasError = true;
    }

    if (!formData.date) {
      setDateError("Selecciona una fecha.");
      hasError = true;
    }

    if (!formData.time) {
      setTimeError("Selecciona una hora.");
      hasError = true;
    }

    if (!formData.lat) {
      setLocationError("Selecciona una ubicación en el mapa.");
      hasError = true;
    }

    // Validación fecha/hora > actual
    if (formData.date && formData.time) {
      const now = new Date();
      const eventDate = new Date(`${formData.date}T${formData.time}`);

      if (eventDate < now) {
        setTimeError("La fecha y hora deben ser posteriores al momento actual.");
        hasError = true;
      }
    }

    if (hasError) return;

    setShowPreview(true);
  };


  /* ============================================================
     PUBLICAR EVENTO
     ============================================================ */

  const handlePublish = async () => {
    setLoading(true);
    setError(null);

    try {
      let finalBackground = {
        type: 'gradient',
        value: backgroundConfig.value
      };

      // 🖼️ Si el usuario eligió imagen de fondo, la procesamos
      if (backgroundConfig.type === 'image' && backgroundConfig.file) {
        const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB
        let fileToUpload = backgroundConfig.file;

        if (fileToUpload.size > MAX_FILE_SIZE) {
          setError("La imagen es demasiado pesada (máximo 6 MB). Intenta con otra o recórtala.");
          setShowPreview(false);
          setLoading(false);
          return;
        }

        // Si pesa más de 1.5MB, intentamos redimensionar
        if (fileToUpload.size > 1.5 * 1024 * 1024) {
          fileToUpload = await resizeImageFile(fileToUpload);
        }

        const storageRef = ref(storage, `event_backgrounds/${user.uid}/${Date.now()}`);
        await uploadBytes(storageRef, fileToUpload);
        const url = await getDownloadURL(storageRef);
        finalBackground = { type: 'image', value: url };
      }

      const eventData = { ...formData, background: finalBackground };

      if (isEditing) {
        const eventRef = doc(db, 'events', eventToEdit.id);
        await updateDoc(eventRef, {
          ...eventData,
          updatedAt: serverTimestamp()
        });

        alert("Evento actualizado correctamente.");
      } else {
        const docRef = await addDoc(collection(db, 'events'), {
          ...eventData,
          creatorId: user.uid,
          creatorName: user.displayName || 'Anónimo',
          creatorPhoto: user.photoURL || null,
          attendees: guests,
          createdAt: serverTimestamp()
        });

        const eventId = docRef.id;

        // 🔔 Notificaciones a invitados dentro de la app
        const promises = guests.map(async (guest) => {
          const cleanPhone = guest.phone.replace(/[^0-9]/g, '');

          let searchPhones = [cleanPhone];

          if (cleanPhone.startsWith('593')) searchPhones.push('0' + cleanPhone.substring(3));
          if (cleanPhone.startsWith('09')) searchPhones.push('593' + cleanPhone.substring(1));

          const q = query(collection(db, 'users'), where('phone', 'in', searchPhones));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const targetUser = querySnapshot.docs[0].data();

            await addDoc(collection(db, 'users', targetUser.uid, 'notifications'), {
              type: 'invitation',
              eventId,
              eventName: formData.name,
              fromName: user.displayName || 'Alguien',
              fromPhoto: user.photoURL,
              status: 'pending',
              message: `¡Te he invitado a ${formData.name}!`,
              createdAt: serverTimestamp()
            });
          }
        });

        await Promise.all(promises);
      }

      onBack();

    } catch (error) {
      console.error(error);
      setError("Error al guardar el evento. Intenta de nuevo.");
      setShowPreview(false);

    } finally {
      setLoading(false);
    }
  };


  /* ============================================================
    Helpers visuales: etiquetas de fecha/hora para el botón
     ============================================================ */

  const formatDateLabel = () => {
    if (!formData.date) return 'Elegir fecha';
    const d = new Date(formData.date + 'T00:00:00');
    const opts = { weekday: 'short', day: 'numeric', month: 'short' };
    return d.toLocaleDateString('es-ES', opts);
  };

  const formatTimeLabel = () => {
    if (!formData.time) return 'Elegir hora';
    return formData.time.substring(0, 5);
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const minTimeToday = new Date().toTimeString().slice(0, 5);


  /* ============================================================
     ======================= RENDER ==============================
     ============================================================ */

  return (
    <>
      {showMapSelector ? (
        <MapSelectorPage
          onClose={() => setShowMapSelector(false)}
          onConfirm={handleLocationConfirmed}
          initialLat={formData.lat}
          initialLng={formData.lng}
        />
      ) : (
        <div className="flex flex-col h-screen bg-surface-50 font-sans animate-fade-in relative">

          {/* Header */}
          <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-[100] border-b border-surface-200">
            <button
              onClick={onBack}
              className="p-2 hover:bg-surface-100 rounded-full transition text-ink/70 active:scale-95"
            >
              <ArrowLeft size={24} />
            </button>

            <h2 className="ml-4 text-lg font-bold text-ink">
              {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>
          </div>

          <form className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">

            {error && (
              <div className="bg-dangerBg border border-danger/50 text-danger p-3 rounded-xl flex items-center gap-3 text-sm font-medium animate-fade-in">
                <AlertCircle size={20} /> {error}
              </div>
            )}

            {/* === Detalles === */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Detalles</h3>
              
              {/* NOMBRE */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-3">
                <Type className="text-primary-600" size={20} />
                <input
                  name="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Nombre del evento..."
                  className="w-full outline-none text-ink font-medium placeholder-ink/40"
                />
              </div>

              {nameError && (
                <p className="text-danger bg-dangerBg border border-danger/40 p-2 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16}/> {nameError}
                </p>
              )}

              {/* === Etiquetas === */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-surface-200">
                
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs text-ink/40 font-bold uppercase">Categoría</label>

                  {!isAddingTag ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingTag(true)}
                      className="text-xs text-primary-700 font-bold flex items-center gap-1 bg-primary-100 px-2 py-1 rounded hover:bg-primary-200 transition active:scale-95"
                    >
                      <Plus size={14} /> Nueva
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full max-w-[220px] animate-fade-in">
                      <input
                        autoFocus
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Nueva..."
                        className="flex-1 bg-surface-100 border border-primary-300 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary-500"
                      />
                      <button type="button" onClick={handleAddTag} className="text-green-600 bg-green-50 p-1 rounded active:scale-95">
                        <Check size={16} />
                      </button>
                      <button type="button" onClick={() => setIsAddingTag(false)} className="text-danger bg-dangerBg p-1 rounded active:scale-95">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {defaultTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEventType(tag)}
                      className={`
                        px-4 py-2 rounded-full text-sm font-bold border transition-all whitespace-nowrap active:scale-95
                        ${formData.type === tag
                          ? 'bg-primary-500 text-white border-primary-500 shadow'
                          : 'bg-white text-ink/60 border-surface-300'}
                      `}
                    >
                      {tag}
                    </button>
                  ))}

                  {customTags.map(tag => (
                    <div key={tag.id} className="relative group inline-flex">
                      <button
                        type="button"
                        onClick={() => setEventType(tag.name)}
                        className={`
                          px-4 py-2 rounded-full text-sm font-bold pr-9 border transition-all whitespace-nowrap active:scale-95
                          ${formData.type === tag.name
                            ? 'bg-primary-100 text-primary-800 border-primary-300 shadow-sm'
                            : 'bg-white text-ink/60 border-surface-300 border-dashed'}
                        `}
                      >
                        {tag.name}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteTag(tag.id, e)}
                        className="absolute right-1 top-1.5 p-1 text-ink/40 hover:text-danger active:scale-90"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* === Fecha y hora (con bottom sheet) === */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Fecha y Hora</h3>

              {(dateError || timeError) && (
                <p className="text-danger bg-dangerBg border border-danger/40 p-2 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16}/> {dateError || timeError}
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowDateTimeSheet(true)}
                className="
                  w-full bg-white rounded-2xl shadow-sm border border-surface-200 
                  flex items-center justify-between px-4 py-4 active:scale-95 transition
                "
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary-100 text-primary-700">
                    <Calendar size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-ink/40 font-bold uppercase mb-0.5">Fecha</p>
                    <p className="text-sm font-semibold text-ink">
                      {formatDateLabel()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-px bg-surface-300" />
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-primary-50 text-primary-600">
                      <Clock size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-ink/40 font-bold uppercase mb-0.5">Hora</p>
                      <p className="text-sm font-semibold text-ink">
                        {formatTimeLabel()}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* === Ubicación === */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Ubicación</h3>

              {locationError && (
                <p className="text-danger bg-dangerBg border border-danger/40 p-2 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16}/> {locationError}
                </p>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                <div
                  onClick={() => setShowMapSelector(true)}
                  className="flex items-center gap-3 p-4 active:bg-surface-100 transition cursor-pointer"
                >
                  <MapPin className="text-primary-600 shrink-0" size={24} />

                  <div className="flex-1">
                    {formData.locationName ? (
                      <div className="font-bold text-ink text-sm">
                        {formData.locationName}
                      </div>
                    ) : (
                      <div className="text-ink/40 text-sm font-medium">
                        Selecciona la ubicación en el mapa
                      </div>
                    )}

                    {formData.lat && (
                      <div className="text-[10px] text-green-600 font-bold mt-0.5">
                        Ubicación confirmada ✓
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => setShowMapSelector(true)}
                    className="
                      w-full bg-primary-100 text-primary-700 font-bold py-3 rounded-xl 
                      flex items-center justify-center gap-2 border border-primary-200 
                      active:scale-95 transition
                    "
                  >
                    <MapIcon size={18} />
                    {formData.lat ? "Cambiar en Mapa" : "Seleccionar en Mapa"}
                  </button>
                </div>
              </div>
            </div>

            {/* === Descripción === */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex gap-3">
              <AlignLeft className="text-ink/40 mt-1" size={20} />
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="Notas extra..."
                className="w-full outline-none text-ink text-sm resize-none placeholder-ink/40"
              ></textarea>
            </div>

            {/* === Botón Continuar === */}
            <button
              type="button"
              onClick={handlePreview}
              className="
                w-full bg-primary-500 hover:bg-primary-600 
                text-white font-bold py-4 rounded-xl shadow-lg 
                active:scale-95 flex justify-center items-center gap-2 transition
              "
            >
              <Eye size={20} /> Continuar a diseño
            </button>

          </form>

          {/* PREVIEW */}
          {showPreview && (
            <EventPreviewModal
              formData={formData}
              guests={guests}
              isEditing={isEditing}
              loading={loading}
              onClose={() => setShowPreview(false)}
              onPublish={handlePublish}
              onAddGuest={handleAddGuest}
              onRemoveGuest={removeGuest}
              onBackgroundChange={setBackgroundConfig}
            />
          )}

          {/* 🟠 Bottom Sheet de Fecha y Hora */}
          {showDateTimeSheet && (
            <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/40 backdrop-blur-sm">
              <div
                className="
                  bg-white rounded-t-3xl shadow-xl p-4 pt-3 
                  animate-[bottomSheet_0.25s_cubic-bezier(.28,.8,.32,1)]
                "
              >
                <div className="w-12 h-1.5 bg-surface-300 rounded-full mx-auto mb-3" />

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wide">
                    Fecha y Hora del evento
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowDateTimeSheet(false)}
                    className="p-2 rounded-full hover:bg-surface-100 active:scale-95"
                  >
                    <X size={18} className="text-ink/60" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* FECHA */}
                  <div className="bg-surface-50 p-3 rounded-2xl border border-surface-200">
                    <div className="flex items-center gap-2 mb-2 text-primary-700">
                      <Calendar size={18} />
                      <span className="text-xs font-bold uppercase">FECHA</span>
                    </div>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      min={todayStr} // Bloquea fechas pasadas
                      onChange={(e) => {
                        setFormData({ ...formData, date: e.target.value });
                        if (dateError) setDateError(null);
                        if (timeError) setTimeError(null);
                      }}
                      className="w-full outline-none text-ink bg-transparent text-sm"
                    />
                  </div>

                  {/* HORA */}
                  <div className="bg-surface-50 p-3 rounded-2xl border border-surface-200">
                    <div className="flex items-center gap-2 mb-2 text-primary-700">
                      <Clock size={18} />
                      <span className="text-xs font-bold uppercase">HORA</span>
                    </div>

                    <input
                      type="time"
                      name="time"
                      value={formData.time}
                      disabled={!formData.date}
                      min={
                        formData.date === todayStr
                          ? minTimeToday
                          : undefined
                      }
                      onChange={(e) => {
                        setFormData({ ...formData, time: e.target.value });
                        if (timeError) setTimeError(null);
                      }}
                      className="w-full outline-none text-ink bg-transparent text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDateTimeSheet(false)}
                  className="
                    w-full bg-primary-500 hover:bg-primary-600 text-white 
                    font-bold py-3 rounded-xl active:scale-95 transition
                  "
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </>
  );
}
