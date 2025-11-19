import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const useCreateEvent = (user, onSuccess) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estado del formulario (incluyendo coordenadas lat/lng)
  const [formData, setFormData] = useState({
    name: '',
    type: 'Fiesta', // Valor por defecto
    date: '',
    time: '',
    description: '',
    locationName: '', // Nombre del lugar (ej: "Casa")
    lat: null,        // Latitud (GPS)
    lng: null         // Longitud (GPS)
  });

  // Actualizar textos normales
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  // Actualizar tipo de evento (etiquetas)
  const setEventType = (type) => {
    setFormData(prev => ({ ...prev, type }));
  };

  // Actualizar coordenadas desde el mapa
  const setLocation = (lat, lng) => {
    setFormData(prev => ({ ...prev, lat, lng }));
    if (error) setError(null);
  };

  // Función de guardado con validaciones
  const submitEvent = async (e) => {
    e.preventDefault();
    
    // 1. Validaciones (Lo que pediste: que no quede nada vacío)
    if (!formData.name.trim()) return setError("Falta el nombre del evento.");
    if (!formData.date) return setError("Selecciona una fecha.");
    if (!formData.time) return setError("Selecciona una hora.");
    if (!formData.locationName.trim()) return setError("Escribe el nombre del lugar.");
    if (!formData.lat) return setError("¡Toca el mapa para fijar la ubicación exacta!");

    setLoading(true);
    setError(null);

    try {
      // 2. Guardar en Firebase (Colección 'events' para compatibilidad con Home)
      await addDoc(collection(db, 'events'), {
        ...formData,
        creatorId: user.uid,
        creatorName: user.displayName || 'Anónimo',
        creatorPhoto: user.photoURL || null,
        attendees: [],
        createdAt: serverTimestamp()
      });
      
      if (onSuccess) onSuccess();
      
    } catch (err) {
      console.error(err);
      setError("Error al guardar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Devolvemos solo lo necesario para la vista
  return {
    formData,
    loading,
    error,
    handleChange,
    setEventType,
    setLocation,
    submitEvent
  };
};