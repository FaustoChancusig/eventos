import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { Contacts } from '@capacitor-community/contacts'; // Plugin Nativo del celular
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet'; 
import { MapPin, Calendar, Clock, AlignLeft, ArrowLeft, Type, AlertCircle, UserPlus, X } from 'lucide-react';

// --- Corrección de iconos para Leaflet en React ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Componente para capturar el toque en el mapa
function LocationSelector({ onLocationSelected, position }) {
  useMapEvents({
    click(e) {
      onLocationSelected(e.latlng.lat, e.latlng.lng);
    },
  });
  return position ? <Marker position={position} /> : null;
}

export default function CreateEventPage({ user, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [guests, setGuests] = useState([]); // Lista de invitados seleccionados

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

  // --- 1. ABRIR CONTACTOS DEL CELULAR ---
  const handleAddGuest = async () => {
    try {
      // Pedimos permiso al sistema
      const permission = await Contacts.requestPermissions();
      
      if (permission.contacts === 'granted') {
        // Abrimos la agenda nativa
        const result = await Contacts.pickContact({
          projection: { name: true, phones: true }
        });

        if (result && result.contact) {
          const name = result.contact.name?.display || "Sin nombre";
          const rawPhone = result.contact.phones?.[0]?.number || "";
          // Limpiamos el número (quitamos espacios y símbolos raros)
          const phone = rawPhone.replace(/[^0-9+]/g, ''); 
          
          // Evitamos duplicados en la lista visual
          if (!guests.some(g => g.phone === phone)) {
             setGuests(prev => [...prev, { name, phone }]);
          }
        }
      } else {
        alert("Necesitamos permiso para ver tus contactos.");
      }
    } catch (err) {
      console.log("Selección cancelada por el usuario");
    }
  };

  const removeGuest = (index) => {
    setGuests(guests.filter((_, i) => i !== index));
  };

  // --- 2. MANEJO DEL MAPA Y FORMULARIO ---
  const setLocation = (lat, lng) => {
    setFormData(prev => ({ ...prev, lat, lng }));
    // Truco: Limpiamos el error visual si ya seleccionó ubicación
    if(error) setError(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const setEventType = (type) => {
    setFormData(prev => ({ ...prev, type }));
  };

  // --- 3. GUARDAR EN FIREBASE ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones simples
    if (!formData.name.trim()) return setError("Falta el nombre del evento");
    if (!formData.date) return setError("Selecciona la fecha");
    if (!formData.time) return setError("Selecciona la hora");
    if (!formData.lat) return setError("Por favor toca el mapa para indicar dónde es.");

    setLoading(true);
    try {
      await addDoc(collection(db, 'events'), {
        ...formData,
        creatorId: user.uid,
        creatorName: user.displayName || 'Anónimo',
        creatorPhoto: user.photoURL || null,
        attendees: guests, // Guardamos la lista de contactos elegidos
        createdAt: serverTimestamp()
      });
      onBack();
    } catch (error) {
      console.error(error);
      setError("Error al guardar. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const eventTypes = ['Fiesta', 'Reunión', 'Cena', 'Deportes', 'Viaje', 'Trabajo'];

  return (
    <div className="flex flex-col h-screen bg-gray-50 animate-fade-in font-sans">
      
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-[1000] border-b border-gray-100">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-4 text-lg font-bold text-gray-800">Nuevo Evento</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-3 text-sm font-medium">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {/* Datos Principales */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detalles</h3>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
            <Type className="text-purple-500" size={20} />
            <input name="name" value={formData.name} onChange={handleChange} placeholder="Nombre del evento..." className="w-full outline-none text-gray-700 font-medium placeholder-gray-400" />
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto py-3 no-scrollbar flex gap-2">
             {eventTypes.map(type => (
               <button key={type} type="button" onClick={() => setEventType(type)} 
                 className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all ${formData.type === type ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                 {type}
               </button>
             ))}
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

        {/* Mapa y Ubicación */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ubicación</h3>
          <div className="bg-white p-4 rounded-t-2xl shadow-sm border border-gray-100 flex items-center gap-3">
            <MapPin className="text-purple-500" size={20} />
            <input name="locationName" value={formData.locationName} onChange={handleChange} placeholder="Nombre del lugar (Ej. Casa)" className="w-full outline-none text-gray-700 font-medium placeholder-gray-400" />
          </div>
          
          {/* Mapa Leaflet */}
          <div className="h-64 rounded-b-2xl overflow-hidden shadow-inner border border-gray-200 relative z-0">
            <MapContainer center={[-0.1807, -78.4678]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <LocationSelector onLocationSelected={setLocation} position={formData.lat ? [formData.lat, formData.lng] : null} />
            </MapContainer>
            {!formData.lat && (
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-purple-600 shadow-lg pointer-events-none z-[400]">
                📍 Toca el mapa para marcar
              </div>
            )}
          </div>
        </div>

        {/* Invitados (BOTÓN AGENDA) */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Invitados</h3>
            <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">{guests.length}</span>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button 
              type="button"
              onClick={handleAddGuest}
              className="w-full p-4 flex items-center justify-center gap-2 text-purple-600 font-bold hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <UserPlus size={20} />
              Seleccionar de Agenda
            </button>
            
            {guests.length > 0 ? (
              <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {guests.map((guest, idx) => (
                  <div key={idx} className="p-3 flex justify-between items-center hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                        {guest.name.charAt(0)}
                      </div>
                      <div>
                         <p className="text-sm font-bold text-gray-800">{guest.name}</p>
                         <p className="text-xs text-gray-400">{guest.phone}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeGuest(idx)} className="text-gray-300 hover:text-red-500">
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400 text-xs italic">
                Aún no has invitado a nadie.
              </div>
            )}
          </div>
        </div>

        {/* Descripción */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-3">
          <AlignLeft className="text-gray-400 mt-1" size={20} />
          <textarea name="description" value={formData.description} onChange={handleChange} rows="3" placeholder="Notas extra..." className="w-full outline-none text-gray-700 text-sm resize-none placeholder-gray-400"></textarea>
        </div>

        <button disabled={loading} className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2">
          {loading ? 'Guardando...' : 'Publicar Evento'}
        </button>

      </form>
    </div>
  );
}