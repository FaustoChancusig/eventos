import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { Contacts } from '@capacitor-community/contacts'; 
import { 
  MapContainer, TileLayer, Marker, useMapEvents, useMap 
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet'; 
import { 
  MapPin, Calendar, Clock, AlignLeft, ArrowLeft, 
  Type, AlertCircle, UserPlus, X, Plus, Check, Trash2, Eye, Send, 
  PartyPopper, Gift, Cake 
} from 'lucide-react';

// --- Iconos Leaflet ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Componentes Mapa
function LocationSelector({ onLocationSelected, position }) {
  useMapEvents({ click(e) { onLocationSelected(e.latlng.lat, e.latlng.lng); }, });
  return position ? <Marker position={position} /> : null;
}

function MapMover({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.flyTo([lat, lng], 16, { duration: 1.5 }); }, [lat, lng, map]);
  return null;
}

export default function CreateEventPage({ user, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados
  const [guests, setGuests] = useState([]);
  const [showPreview, setShowPreview] = useState(false); // Controla el modal de vista previa

  const [suggestions, setSuggestions] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const defaultTags = ['Fiesta', 'Reunión', 'Cena', 'Deportes', 'Viaje', 'Trabajo'];
  const [customTags, setCustomTags] = useState([]); 
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const [formData, setFormData] = useState({
    name: '', type: 'Fiesta', date: '', time: '', description: '', locationName: '', lat: null, lng: null
  });

  // Cargar Etiquetas
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'tags'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // --- LÓGICA DE MAPA ---
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

  // --- ETIQUETAS ---
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

  // --- CONTACTOS ---
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

  // --- VALIDACIÓN PREVIA A VISTA PREVIA ---
  const handlePreview = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError("Falta nombre");
    if (!formData.date) return setError("Falta fecha");
    if (!formData.time) return setError("Falta hora");
    if (!formData.lat) return setError("Falta ubicación");
    
    setError(null);
    setShowPreview(true);
  };

  // --- PUBLICAR Y ENVIAR INVITACIONES AUTOMÁTICAMENTE ---
  const handlePublish = async () => {
    setLoading(true);
    try {
      // 1. Guardar el evento
      const docRef = await addDoc(collection(db, 'events'), {
        ...formData,
        creatorId: user.uid,
        creatorName: user.displayName || 'Anónimo',
        creatorPhoto: user.photoURL || null,
        attendees: guests, // Se guarda la lista inicial
        createdAt: serverTimestamp()
      });

      const eventId = docRef.id;

      // 2. Procesar Invitaciones Automáticas
      // Recorremos la lista de invitados seleccionados
      const promises = guests.map(async (guest) => {
        const cleanPhone = guest.phone.replace(/[^0-9]/g, '');
        
        // Buscamos variantes del número para encontrar usuario
        let searchPhones = [cleanPhone];
        if (cleanPhone.startsWith('593')) searchPhones.push('0' + cleanPhone.substring(3));
        if (cleanPhone.startsWith('09')) searchPhones.push('593' + cleanPhone.substring(1));

        const q = query(collection(db, 'users'), where('phone', 'in', searchPhones));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // TIENE APP: Enviamos notificación
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
        } else {
           // NO TIENE APP: No podemos abrir WhatsApp automáticamente en bucle sin interacción del usuario
           // (Los navegadores bloquean popups múltiples).
           // Lo ideal aquí es avisar al usuario al final "Se enviaron X notificaciones, recuerda compartir por WhatsApp a los demás".
        }
      });

      await Promise.all(promises);
      
      // Alerta final si había invitados sin app
      // (Opcional: Podrías mostrar un resumen)
      
      onBack(); // Volver al Home
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
        <h2 className="ml-4 text-lg font-bold text-gray-800">Nuevo Evento</h2>
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
            <MapContainer center={[-0.1807, -78.4678]} zoom={13} style={{ height: '100%', width: '100%' }}>
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

        {/* Botón Vista Previa (Reemplaza al Submit directo) */}
        <button type="button" onClick={handlePreview} className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 flex justify-center items-center gap-2">
          <Eye size={20} /> Vista Previa
        </button>
      </form>

      {/* --- MODAL DE VISTA PREVIA --- */}
      {showPreview && (
        <div className="fixed inset-0 z-[2000] bg-gray-100 flex flex-col animate-slide-up">
          
          {/* Header Modal */}
          <div className="bg-white p-4 shadow-sm flex items-center justify-between">
             <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><X size={24}/></button>
             <h2 className="text-lg font-bold text-gray-800">Vista Previa</h2>
             <div className="w-10"></div> {/* Espaciador */}
          </div>

          <div className="flex-1 overflow-y-auto p-6">      
            {/* TARJETA DE EVENTO (Mismo estilo que Home) */}
            <div className="relative overflow-hidden w-full min-h-[480px] bg-gradient-to-br from-orange-400 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col justify-between border-2 border-white/10">
              <PartyPopper className="absolute top-8 left-6 text-white opacity-20 rotate-[-15deg]" size={48} />
              <Cake className="absolute bottom-24 right-[-10px] text-white opacity-20 rotate-[10deg]" size={80} />
              <div className="absolute top-0 right-0 w-56 h-56 bg-white opacity-10 rounded-bl-full pointer-events-none blur-2xl"></div>

              <div className="relative z-10 flex justify-center mt-2">
                <span className="bg-black/20 px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest backdrop-blur-md border border-white/10 shadow-sm">
                  {formData.type}
                </span>
              </div>

              <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center my-6 px-2">
                <h3 className="text-4xl font-black leading-tight mb-4 drop-shadow-lg tracking-tighter break-words w-full">
                  {formData.name}
                </h3>
              </div>
              
              <div className="relative z-10 flex flex-col gap-3 text-orange-50 text-base font-medium w-full mt-auto">
                <div className="flex items-center justify-center gap-3 bg-black/10 px-6 py-4 rounded-3xl backdrop-blur-md border border-white/10 w-full shadow-inner">
                  <Calendar size={20} className="shrink-0 text-white" />
                  <span className="capitalize text-white">{formData.date}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="flex items-center justify-center gap-2 bg-black/10 px-4 py-3.5 rounded-3xl backdrop-blur-md border border-white/10 shadow-inner">
                        <Clock size={18} className="shrink-0 text-white" />
                        <span className="text-white">{formData.time}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-black/10 px-4 py-3.5 rounded-3xl backdrop-blur-md border border-white/10 shadow-inner overflow-hidden">
                        <MapPin size={18} className="shrink-0 text-white" />
                        <span className="truncate text-sm text-white">{formData.locationName || "Mapa"}</span>
                    </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN INVITADOS (Aquí se agregan antes de publicar) */}
            <div className="mt-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2"><UserPlus size={20} className="text-purple-600"/> Invitar Amigos</h3>
               
               <button onClick={handleAddGuest} className="w-full py-3 border-2 border-dashed border-purple-200 text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition flex justify-center items-center gap-2 mb-4">
                 <Plus size={18}/> Seleccionar de Agenda
               </button>

               {guests.length > 0 ? (
                 <div className="space-y-2">
                   {guests.map((guest, idx) => (
                     <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">{guest.name.charAt(0)}</div>
                          <span className="text-sm font-bold text-gray-700">{guest.name}</span>
                       </div>
                       <button onClick={() => removeGuest(idx)} className="text-gray-400 hover:text-red-500"><X size={16}/></button>
                     </div>
                   ))}
                 </div>
               ) : (
                 <p className="text-center text-gray-400 text-sm italic">Aún no has seleccionado invitados.</p>
               )}
            </div>
          </div>

          {/* Botón Final de Publicar */}
          <div className="p-4 bg-white border-t border-gray-100">
            <button 
              onClick={handlePublish}
              disabled={loading}
              className="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-xl active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {loading ? 'Publicando...' : <><Send size={20} /> Publicar y Enviar</>}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}