import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Image, UploadCloud, Trash2, X, Download, User as UserIcon, AlertCircle } from 'lucide-react';

export default function EventGallery({ eventId, user, isConfirmed }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState(null); // Para el modal
  const [error, setError] = useState(null);

  // 1. Cargar fotos del evento en tiempo real
  useEffect(() => {
    if (!eventId) return;

    const q = query(collection(db, 'events', eventId, 'gallery'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Error al cargar galería:", err);
      setError("Error al cargar fotos.");
    });

    return () => unsubscribe();
  }, [eventId]);

  // 2. Subir una nueva foto
  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!isConfirmed) {
      setError("Solo los invitados confirmados pueden subir fotos.");
      return;
    }

    setLoading(true);
    setError(null);
    const uniqueId = Date.now();
    
    // Ruta en Storage: events/{eventId}/gallery/{timestamp}
    const storageRef = ref(storage, `event_galleries/${eventId}/${uniqueId}_${file.name}`);

    try {
      const snapshot = await uploadBytes(storageRef, file);
      // Nota: Para una app real se usaría uploadBytesResumable para trackear el progreso
      
      const photoURL = await getDownloadURL(snapshot.ref);

      // Guardar metadata en Firestore
      await addDoc(collection(db, 'events', eventId, 'gallery'), {
        url: photoURL,
        uploaderUid: user.uid,
        uploaderName: user.displayName || 'Anónimo',
        createdAt: serverTimestamp(),
      });
      
    } catch (err) {
      console.error("Error subiendo archivo:", err);
      setError("Fallo al subir la foto. Intenta más tarde.");
    } finally {
      setLoading(false);
      e.target.value = null; // Limpiar input file
    }
  };
  
  // 3. Descargar Foto (Usar un enlace temporal si es necesario, o directamente abrir la URL)
  const handleDownload = (url, name) => {
    // Esto funciona en web, pero en móvil con Capacitor se usa Filesystem/Browser
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `event_${name}.jpg`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // 4. Eliminar Foto (Solo el dueño o el creador del evento principal)
  const handleDeletePhoto = async (photoId, uploaderUid) => {
      if (uploaderUid !== user.uid && !user.uid === eventId) { // Restricción básica: solo quien subió o el creador del evento
          alert("No tienes permiso para borrar esta foto.");
          return;
      }
      if (!window.confirm("¿Estás seguro de eliminar esta foto?")) return;

      try {
          // El borrado de Storage y Firestore se recomienda hacer con Cloud Functions 
          // en producción, pero aquí borramos solo el registro de Firestore por simplicidad.
          await deleteDoc(doc(db, 'events', eventId, 'gallery', photoId));
          alert("Foto eliminada.");

      } catch (err) {
          console.error("Error al borrar:", err);
          setError("Fallo al eliminar.");
      }
  };

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-3 text-sm font-medium"><AlertCircle size={20} /> {error}</div>}

      {/* --- BOTÓN DE SUBIDA --- */}
      <label className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 cursor-pointer 
        ${isConfirmed && !loading ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
      >
        {loading ? (
          <>
            <span className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></span>
            Subiendo...
          </>
        ) : (
          <>
            <UploadCloud size={20} /> 
            {isConfirmed ? 'Subir Foto a la Galería' : 'Confirma Asistencia para Subir'}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleUploadFile} 
              disabled={!isConfirmed || loading}
            />
          </>
        )}
      </label>

      {/* --- GALERÍA DE FOTOS --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.length === 0 && !loading && (
          <p className="col-span-full text-center text-gray-400 italic mt-6">Aún no hay fotos en este evento.</p>
        )}
        
        {photos.map((photo) => (
          <div 
            key={photo.id} 
            className="relative overflow-hidden aspect-square rounded-xl shadow-md cursor-pointer group"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img 
              src={photo.url} 
              alt={`Foto de ${photo.uploaderName}`} 
              className="w-full h-full object-cover transition duration-300 group-hover:scale-105" 
            />
            
            {/* Overlay inferior con uploader name */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/40 text-white text-xs font-medium truncate">
                <UserIcon size={12} className="inline mr-1" />
                {photo.uploaderName.split(' ')[0]}
            </div>
            
          </div>
        ))}
      </div>
      
      {/* --- MODAL DE VISTA DE FOTO --- */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <button onClick={() => setSelectedPhoto(null)} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 z-50">
            <X size={24} />
          </button>
          
          <img 
            src={selectedPhoto.url} 
            alt="Foto en detalle" 
            className="max-w-full max-h-full object-contain" 
          />
          
          <div className="absolute bottom-0 w-full p-4 bg-black/50 flex justify-between items-center text-white">
             <div className="text-sm">
                Subido por: <span className="font-bold">{selectedPhoto.uploaderName}</span>
             </div>
             <div className="flex gap-3">
                <button 
                    onClick={() => handleDownload(selectedPhoto.url, selectedPhoto.id)}
                    className="flex items-center gap-1 text-sm bg-white/10 px-3 py-1 rounded-full hover:bg-white/20 transition"
                >
                    <Download size={16} /> Descargar
                </button>
                {selectedPhoto.uploaderUid === user.uid && (
                  <button 
                      onClick={() => handleDeletePhoto(selectedPhoto.id, selectedPhoto.uploaderUid)}
                      className="flex items-center gap-1 text-sm bg-red-600/80 px-3 py-1 rounded-full hover:bg-red-700 transition"
                  >
                      <Trash2 size={16} /> Borrar
                  </button>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}