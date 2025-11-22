import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, getDocs, where } from 'firebase/firestore';
// 🆕 IMPORTANTE: Agregar imports de storage aquí
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase'; 
import { Contacts } from '@capacitor-community/contacts'; 
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet'; 
import { MapPin, Calendar, Clock, AlignLeft, ArrowLeft, Type, AlertCircle, Plus, Check, Trash2, Eye, X } from 'lucide-react';

// 🆕 IMPORTAMOS EL NUEVO COMPONENTE
import EventPreviewModal from '../components/EventPreviewModal';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Componentes Mapa (INTACTOS)
function LocationSelector({ onLocationSelected, position }) {
  useMapEvents({ click(e) { onLocationSelected(e.latlng.lat, e.latlng.lng); }, });
  return position ? <Marker position={position} /> : null;
}

function MapMover({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.flyTo([lat, lng], 16, { duration: 1.5 }); }, [lat, lng, map]);
  return null;
}

export default function CreateEventPage({ user, onBack, eventToEdit }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isEditing = !!eventToEdit; 

  const [guests, setGuests] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  
  // 🆕 ESTADO PARA EL FONDO (Por defecto el gradiente naranja original)
  const [backgroundConfig, setBackgroundConfig] = useState({ type: 'gradient', value: 'from-orange-400 to-orange-600' });

  const defaultTags = ['Fiesta', 'Reunión', 'Cena', 'Deportes', 'Viaje', 'Trabajo'];
  const [customTags, setCustomTags] = useState([]); 
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const [formData, setFormData] = useState({
    name: '', type: 'Fiesta', date: '', time: '', description: '', locationName: '', lat: null, lng: null
  });

  // EFECTO: CARGAR DATOS SI ESTAMOS EDITANDO (INTACTO)
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
      // Si el evento editado ya tiene fondo, lo cargaríamos aquí (lógica futura)
    }
  }, [eventToEdit]);

  // Cargar Etiquetas (INTACTO)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'tags'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // --- LÓGICA DE MAPA (INTACTO) ---
  const searchLocationOnMap = async (text) => {
    if (!text || text.trim().length < 3) { setSuggestions([]); return; }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ec&q=${encodeURIComponent(text)}`);
      setSuggestions(await response.json());
    } catch (err) { console.error("Error buscando dirección:", err); }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
      const data = await res.json();
      if (data?.display_name) {
        const shortName = data.address.road || data.address.suburb || data.display_name.split(',')[0];
        setFormData(prev => ({ ...prev, locationName: shortName || data.display_name }));
      }
    } catch (err) { console.error("Error obteniendo dirección:", err); }
  };

  const handleLocationChange = (e) => {
    const text = e.target.value;
    setFormData(prev => ({ ...prev, locationName: text }));
    setIsTyping(true);
    searchLocationOnMap(text);
  };

  const selectSuggestion = (item) => {
    setFormData(prev => ({ ...prev, locationName: item.display_name.split(',')[0], lat: parseFloat(item.lat), lng: parseFloat(item.lon) }));
    setSuggestions([]); setIsTyping(false);
  };

  const setLocationFromMap = (lat, lng) => {
    setFormData(prev => ({ ...prev, lat, lng }));
    if(error) setError(null);
    reverseGeocode(lat, lng); 
  };

  // --- ETIQUETAS (INTACTO) ---
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

  // --- CONTACTOS (INTACTO) ---
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

  // --- VALIDACIÓN PREVIA (INTACTO) ---
  const handlePreview = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError("Falta nombre");
    if (!formData.date) return setError("Falta fecha");
    if (!formData.time) return setError("Falta hora");
    
    setError(null);
    setShowPreview(true);
  };

  // 🆕 LÓGICA PUBLICAR MEJORADA (Mismo comportamiento, solo agrega subida de foto)
  const handlePublish = async () => {
    setLoading(true);
    try {
      
      // 1. Gestionar Fondo
      let finalBackground = { type: 'gradient', value: backgroundConfig.value }; // Default
      
      if (backgroundConfig.type === 'image' && backgroundConfig.file) {
        // Subir a Storage
        const storageRef = ref(storage, `event_backgrounds/${user.uid}/${Date.now()}`);
        await uploadBytes(storageRef, backgroundConfig.file);
        const url = await getDownloadURL(storageRef);
        finalBackground = { type: 'image', value: url };
      }

      // Preparar datos
      const eventData = {
        ...formData,
        background: finalBackground // Guardamos el fondo en Firestore
      };

      if (isEditing) {
         // --- MODO ACTUALIZAR ---
         const eventRef = doc(db, 'events', eventToEdit.id);
         await updateDoc(eventRef, {
           ...eventData,
           updatedAt: serverTimestamp()
         });
         alert("Evento actualizado correctamente.");

      } else {
         // --- MODO CREAR NUEVO ---
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
               type: 'invitation',
               eventId: eventId,
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
      setError("Error al guardar.");
      setShowPreview(false);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans animate-fade-in relative">
      
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-[1000] border-b border-gray-100">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"><ArrowLeft size={24} /></button>
        <h2 className="ml-4 text-lg font-bold text-gray-800">{isEditing ? 'Editar Evento' : 'Nuevo Evento'}</h2>
      </div>

      <form className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-3 text-sm font-medium"><AlertCircle size={20} /> {error}</div>}

        {/* Datos Principales */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detalles</h3>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
            <Type className="text-purple-500" size={20} />
            <input name="name" value={formData.name} onChange={handleChange} placeholder="Nombre del evento..." className="w-full outline-none text-gray-700 font-medium placeholder-gray-400" />
          </div>
          
          {/* Etiquetas */}
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

        {/* Ubicación */}
        <div className="space-y-2 relative z-0">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ubicación</h3>
          <div className="relative w-full">
            <div className="bg-white p-4 rounded-t-2xl shadow-sm border border-gray-100 flex items-center gap-3 relative z-[50]">
              <MapPin className="text-purple-500" size={20} />
              <input name="locationName" value={formData.locationName} onChange={handleLocationChange} placeholder="Buscar dirección..." className="w-full outline-none text-gray-700 font-medium placeholder-gray-400" autoComplete="off"/>
            </div>
            {isTyping && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 bg-white shadow-2xl z-[9999] rounded-b-2xl border border-gray-200 max-h-56 overflow-y-auto top-full">
                {suggestions.map((item, index) => (
                  <div key={index} onClick={() => selectSuggestion(item)} className="p-3 hover:bg-purple-50 transition cursor-pointer border-b border-gray-50 text-sm text-gray-700">{item.display_name}</div>
                ))}
              </div>
            )}
          </div>
          <div className="h-64 rounded-b-2xl overflow-hidden shadow-inner border border-gray-200 relative z-[1]">
            <MapContainer center={formData.lat ? [formData.lat, formData.lng] : [-0.1807, -78.4678]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              <MapMover lat={formData.lat} lng={formData.lng} />
              <LocationSelector onLocationSelected={setLocationFromMap} position={formData.lat ? [formData.lat, formData.lng] : null} />
            </MapContainer>
            {!formData.lat && <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-purple-600 shadow-lg z-[400]">📍 Toca el mapa</div>}
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

      {/* 🆕 REEMPLAZAMOS EL MODAL ANTIGUO POR EL COMPONENTE NUEVO */}
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
  );
}