import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, getDocs, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase'; 
import { Contacts } from '@capacitor-community/contacts'; 
import { MapPin, Calendar, Clock, AlignLeft, ArrowLeft, Type, AlertCircle, Plus, Check, Trash2, Eye, X, Map as MapIcon } from 'lucide-react';

// IMPORTAR COMPONENTES
import EventPreviewModal from '../components/EventPreviewModal';
import MapSelectorPage from './MapSelectorPage'; // <--- IMPORTAMOS EL NUEVO COMPONENTE

export default function CreateEventPage({ user, onBack, eventToEdit }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isEditing = !!eventToEdit; 

  const [guests, setGuests] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // 🆕 ESTADO PARA CONTROLAR EL VISOR DEL MAPA
  const [showMapSelector, setShowMapSelector] = useState(false);

  // 🆕 ESTADO PARA EL FONDO
  const [backgroundConfig, setBackgroundConfig] = useState({ type: 'gradient', value: 'from-orange-400 to-orange-600' });

  const defaultTags = ['Fiesta', 'Reunión', 'Cena', 'Deportes', 'Viaje', 'Trabajo'];
  const [customTags, setCustomTags] = useState([]); 
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const [formData, setFormData] = useState({
    name: '', type: 'Fiesta', date: '', time: '', description: '', locationName: '', lat: null, lng: null
  });

  // EFECTO: CARGAR DATOS SI ESTAMOS EDITANDO
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
    }
  }, [eventToEdit]);

  // Cargar Etiquetas
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'tags'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // --- LOGICA ETIQUETAS ---
  const handleAddTag = async () => {
    const tagText = newTag.trim();
    if (!tagText || defaultTags.includes(tagText) || customTags.some(t => t.name === tagText)) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'tags'), { name: tagText, createdAt: serverTimestamp() });
      setFormData({ ...formData, type: tagText });
      setNewTag('');
      setIsAddingTag(false);
    } catch (err) { console.error(err); }
  };

  const handleDeleteTag = async (tagId, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Borrar etiqueta?")) return;
    await deleteDoc(doc(db, 'users', user.uid, 'tags', tagId));
    if (formData.type === customTags.find(t => t.id === tagId)?.name) setFormData(prev => ({ ...prev, type: 'Fiesta' }));
  };

  // --- LOGICA CONTACTOS ---
  const handleAddGuest = async () => {
    try {
      const permission = await Contacts.requestPermissions();
      if (permission.contacts === 'granted') {
        const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
        if (result && result.contact) {
          const name = result.contact.name?.display || "Sin nombre";
          const rawPhone = result.contact.phones?.[0]?.number || "";
          const phone = rawPhone.replace(/[^0-9+]/g, ''); 
          if (!guests.some(g => g.phone === phone)) setGuests(prev => [...prev, { name, phone }]);
        }
      } else { alert("Se requiere permiso."); }
    } catch (err) { console.log("Cancelado"); }
  };

  const removeGuest = (index) => setGuests(guests.filter((_, i) => i !== index));
  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const setEventType = (type) => setFormData(prev => ({ ...prev, type }));

  // --- 🆕 CALLBACK CUANDO EL MAPA CONFIRMA ---
  const handleLocationConfirmed = (locationData) => {
    setFormData(prev => ({
        ...prev,
        lat: locationData.lat,
        lng: locationData.lng,
        locationName: locationData.address || "Ubicación personalizada"
    }));
  };

  // --- VALIDACIÓN Y PUBLICACIÓN ---
  const handlePreview = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError("Falta nombre");
    if (!formData.date) return setError("Falta fecha");
    if (!formData.time) return setError("Falta hora");
    setError(null);
    setShowPreview(true);
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      let finalBackground = { type: 'gradient', value: backgroundConfig.value }; 
      if (backgroundConfig.type === 'image' && backgroundConfig.file) {
        const storageRef = ref(storage, `event_backgrounds/${user.uid}/${Date.now()}`);
        await uploadBytes(storageRef, backgroundConfig.file);
        const url = await getDownloadURL(storageRef);
        finalBackground = { type: 'image', value: url };
      }

      const eventData = { ...formData, background: finalBackground };

      if (isEditing) {
         const eventRef = doc(db, 'events', eventToEdit.id);
         await updateDoc(eventRef, { ...eventData, updatedAt: serverTimestamp() });
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
               type: 'invitation', eventId: eventId, eventName: formData.name, fromName: user.displayName || 'Alguien', fromPhoto: user.photoURL, status: 'pending', message: `¡Te he invitado a ${formData.name}!`, createdAt: serverTimestamp()
             });
           }
         });
         await Promise.all(promises);
      }
      onBack(); 
    } catch (error) {
      console.error(error);
      setError("Error al guardar.");
      setShowPreview(false);
    } finally { setLoading(false); }
  };



  // REEMPLAZA DESDE AQUÍ HASTA EL FINAL DEL ARCHIVO
  return (
    <>
      {showMapSelector ? (
        /* --- MODO 1: VISOR DE MAPA (Pantalla Completa) --- */
        <MapSelectorPage 
          onClose={() => setShowMapSelector(false)}
          onConfirm={handleLocationConfirmed}
          initialLat={formData.lat}
          initialLng={formData.lng}
        />
      ) : (
        /* --- MODO 2: FORMULARIO DE EVENTO (Normal) --- */
        <div className="flex flex-col h-screen bg-gray-50 font-sans animate-fade-in relative">
          
          {/* Header */}
          <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-[100] border-b border-gray-100">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"><ArrowLeft size={24} /></button>
            <h2 className="ml-4 text-lg font-bold text-gray-800">{isEditing ? 'Editar Evento' : 'Nuevo Evento'}</h2>
          </div>

          <form className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-3 text-sm font-medium"><AlertCircle size={20} /> {error}</div>}

            {/* Detalles (Nombre y Etiquetas) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detalles</h3>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                <Type className="text-purple-500" size={20} />
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Nombre del evento..." className="w-full outline-none text-gray-700 font-medium placeholder-gray-400" />
              </div>
              
              {/* Sección Etiquetas */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                    <label className="text-xs text-gray-400 font-bold uppercase">Categoría</label>
                    {!isAddingTag ? (
                      <button type="button" onClick={() => setIsAddingTag(true)} className="text-xs text-purple-600 font-bold flex items-center gap-1 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 transition"><Plus size={14} /> Nueva</button>
                    ) : (
                      <div className="flex items-center gap-2 w-full max-w-[220px] animate-fade-in">
                        <input autoFocus type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nueva..." className="flex-1 bg-gray-50 border border-purple-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-purple-500"/>
                        <button type="button" onClick={handleAddTag} className="text-green-600 bg-green-50 p-1 rounded"><Check size={16}/></button>
                        <button type="button" onClick={() => setIsAddingTag(false)} className="text-red-400 bg-red-50 p-1 rounded"><X size={16}/></button>
                      </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {defaultTags.map(tag => (<button key={tag} type="button" onClick={() => setEventType(tag)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all ${formData.type === tag ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-600 border-gray-200'}`}>{tag}</button>))}
                  {customTags.map(tag => (
                    <div key={tag.id} className="relative group inline-flex">
                        <button type="button" onClick={() => setEventType(tag.name)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all pr-9 ${formData.type === tag.name ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-sm' : 'bg-white text-gray-600 border-gray-200 border-dashed'}`}>{tag.name}</button>
                        <button onClick={(e) => handleDeleteTag(tag.id, e)} className="absolute right-1 top-1.5 p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1 text-purple-500"><Calendar size={18}/><span className="text-xs font-bold">FECHA</span></div>
                <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full outline-none bg-transparent text-gray-700 font-medium"/>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1 text-purple-500"><Clock size={18}/><span className="text-xs font-bold">HORA</span></div>
                <input type="time" name="time" value={formData.time} onChange={handleChange} className="w-full outline-none bg-transparent text-gray-700 font-medium"/>
              </div>
            </div>

            {/* Ubicación (SOLO LECTURA / VISOR) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ubicación</h3>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div onClick={() => setShowMapSelector(true)} className="flex items-center gap-3 p-4 active:bg-gray-50 transition cursor-pointer">
                  <MapPin className="text-purple-500 shrink-0" size={24} />
                  <div className="flex-1">
                      {formData.locationName ? (
                        <div className="font-bold text-gray-800 text-sm">{formData.locationName}</div>
                      ) : (
                        <div className="text-gray-400 text-sm font-medium">Ej: Casa de Juan (o selecciona en mapa)</div>
                      )}
                      {formData.lat && <div className="text-[10px] text-green-600 font-bold mt-0.5">Ubicación confirmada ✓</div>}
                  </div>
                </div>
                <div className="px-4 pb-4">
                    <button type="button" onClick={() => setShowMapSelector(true)} className="w-full bg-purple-50 text-purple-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-purple-100 active:scale-95 transition">
                        <MapIcon size={18} /> {formData.lat ? "Cambiar en Mapa" : "Seleccionar en Google Maps"}
                    </button>
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-3">
              <AlignLeft className="text-gray-400 mt-1" size={20} />
              <textarea name="description" value={formData.description} onChange={handleChange} rows="3" placeholder="Notas extra..." className="w-full outline-none text-gray-700 text-sm resize-none placeholder-gray-400"></textarea>
            </div>

            <button type="button" onClick={handlePreview} className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 flex justify-center items-center gap-2">
              <Eye size={20} /> Continuar a Diseño
            </button>
          </form>

          {/* Modal de Vista Previa */}
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
        </div>
      )}
    </>
  );
}