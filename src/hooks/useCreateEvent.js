import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Contacts } from '@capacitor-community/contacts';

export const useCreateEvent = (user, onSuccess) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Datos del formulario
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

  // Estados para Mapa y Búsqueda
  const [suggestions, setSuggestions] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  // Estados para Etiquetas y Contactos
  const defaultTags = ['Fiesta', 'Reunión', 'Cena', 'Deportes', 'Viaje', 'Trabajo'];
  const [customTags, setCustomTags] = useState([]);
  const [guests, setGuests] = useState([]);

  // --- 1. CARGAR ETIQUETAS ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'tags'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // --- 2. LÓGICA DE MAPA (GEOCODIFICACIÓN) ---
  const searchAddress = async (text) => {
    if (!text || text.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ec&q=${encodeURIComponent(text)}`
      );
      const data = await response.json();
      setSuggestions(data);
    } catch (err) {
      console.error("Error buscando:", err);
    }
  };

  const getAddressFromCoords = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await res.json();
      if (data?.display_name) {
        const shortName = data.address.road || data.address.suburb || data.display_name.split(',')[0];
        setFormData(prev => ({ ...prev, locationName: shortName || data.display_name }));
      }
    } catch (err) {
      console.error("Error reverse geocoding:", err);
    }
  };

  // --- 3. MANEJADORES DE ACCIONES (HANDLERS) ---
  
  // Texto y Ubicación
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'locationName') {
      setIsTyping(true);
      searchAddress(value);
    }
  };

  const selectLocationSuggestion = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setFormData(prev => ({
      ...prev,
      locationName: item.display_name.split(',')[0],
      lat,
      lng
    }));
    setSuggestions([]);
    setIsTyping(false);
  };

  const setMapLocation = (lat, lng) => {
    setFormData(prev => ({ ...prev, lat, lng }));
    if (error) setError(null);
    getAddressFromCoords(lat, lng);
  };

  // Etiquetas
  const addNewTag = async (tagText) => {
    const cleanTag = tagText.trim();
    if (!cleanTag) return;
    if (defaultTags.includes(cleanTag) || customTags.some(t => t.name === cleanTag)) {
      alert("Etiqueta repetida");
      return;
    }
    try {
      await addDoc(collection(db, 'users', user.uid, 'tags'), { name: cleanTag, createdAt: serverTimestamp() });
      setFormData(prev => ({ ...prev, type: cleanTag }));
    } catch (err) { console.error(err); }
  };

  const removeTag = async (tagId) => {
    if (!window.confirm("¿Borrar etiqueta?")) return;
    await deleteDoc(doc(db, 'users', user.uid, 'tags', tagId));
  };

  const setType = (type) => setFormData(prev => ({ ...prev, type }));

  // Contactos
  const pickContact = async () => {
    try {
      const perm = await Contacts.requestPermissions();
      if (perm.contacts === 'granted') {
        const res = await Contacts.pickContact({ projection: { name: true, phones: true } });
        if (res && res.contact) {
          const name = res.contact.name?.display || "Sin nombre";
          const phone = res.contact.phones?.[0]?.number?.replace(/[^0-9+]/g, '') || "";
          if (phone && !guests.some(g => g.phone === phone)) {
            setGuests(prev => [...prev, { name, phone }]);
          }
        }
      }
    } catch (err) { console.log("Cancelado"); }
  };

  const removeGuest = (index) => setGuests(prev => prev.filter((_, i) => i !== index));

  // Submit Final
  const saveEvent = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError("Falta nombre");
    if (!formData.lat) return setError("Falta ubicación");
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'events'), {
        ...formData,
        creatorId: user.uid,
        creatorName: user.displayName || 'Anónimo',
        creatorPhoto: user.photoURL || null,
        attendees: guests,
        createdAt: serverTimestamp()
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError("Error al guardar");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Exportamos todo lo que la vista necesita
  return {
    formData, loading, error, guests,
    suggestions, isTyping, defaultTags, customTags,
    handleInputChange, selectLocationSuggestion, setMapLocation,
    addNewTag, removeTag, setType,
    pickContact, removeGuest, saveEvent
  };
};