import React, { useState, useEffect } from 'react';
import { 
  updateProfile, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  sendPasswordResetEmail,
  signOut 
} from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import { 
  User, Phone, Lock, Camera, Save, ArrowLeft, 
  AlertCircle, CheckCircle, Edit2, Mail, X, LogOut 
} from 'lucide-react';

export default function ProfilePage({ user, onBack }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Estados de datos
  const [name, setName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL || null);

  // Estados de UI
  const [isEditing, setIsEditing] = useState(false); // Controla si se pueden editar los datos
  const [showPasswordChange, setShowPasswordChange] = useState(false); // Controla la sección de contraseña

  // Estados de Contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const loadUserData = async () => {
      if (user?.uid) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPhone(docSnap.data().phone || '');
        }
      }
    };
    loadUserData();
  }, [user]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setIsEditing(true); // Activar modo edición al cambiar foto
    }
  };

  // --- CERRAR SESIÓN ---
  const handleSignOut = async () => {
    if (window.confirm("¿Estás seguro de que quieres cerrar sesión?")) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error al salir:", error);
      }
    }
  };

  // --- GUARDAR DATOS BÁSICOS ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      let photoURL = user.photoURL;
      if (photoFile) {
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      if (user.displayName !== name || photoURL !== user.photoURL) {
        await updateProfile(user, { displayName: name, photoURL });
      }

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        username: name,
        phone: phone,
        photoURL: photoURL
      });

      setMessage({ text: "¡Perfil actualizado correctamente!", type: 'success' });
      setIsEditing(false); // Salir de modo edición
    } catch (error) {
      console.error(error);
      setMessage({ text: "Error al actualizar perfil.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- CAMBIAR CONTRASEÑA ---
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setMessage({ text: "Debes llenar ambos campos de contraseña.", type: 'error' });
      return;
    }

    if (!window.confirm("¿Estás seguro de que quieres cambiar tu contraseña?")) return;

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      // 1. Re-autenticar
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // 2. Actualizar
      await updatePassword(user, newPassword);
      
      setMessage({ text: "¡Contraseña cambiada con éxito!", type: 'success' });
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');

    } catch (error) {
      console.error(error);
      if (error.code === 'auth/wrong-password') {
        setMessage({ text: "La contraseña actual es incorrecta.", type: 'error' });
      } else {
        setMessage({ text: "Error al cambiar contraseña.", type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  // --- RECUPERAR CONTRASEÑA (Si no se acuerda) ---
  const handleForgotPassword = async () => {
    if (!window.confirm(`Enviaremos un enlace a ${user.email} para restablecer tu contraseña. ¿Continuar?`)) return;
    
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage({ text: "Correo de recuperación enviado. Revisa tu bandeja.", type: 'success' });
      setShowPasswordChange(false);
    } catch (error) {
      setMessage({ text: "No se pudo enviar el correo.", type: 'error' });
    }
  };

  const msgStyle = message.type === 'success' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans animate-fade-in">
      
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-4 text-lg font-bold text-gray-800">Mi Perfil</h2>
        
        {/* Botón Editar (Toggle) */}
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="ml-auto text-purple-600 font-bold text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition"
          >
            <Edit2 size={16} /> Editar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24">
        
        {/* Foto */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            <div className={`w-28 h-28 rounded-full overflow-hidden border-4 ${isEditing ? 'border-purple-200' : 'border-white'} shadow-lg bg-gray-200 transition-all`}>
              {photoPreview ? (
                <img src={photoPreview} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400"><User size={48}/></div>
              )}
            </div>
            
            {isEditing && (
              <>
                <label htmlFor="photo-edit" className="absolute bottom-0 right-0 bg-purple-600 text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-purple-700 border-2 border-white animate-pop-in">
                  <Camera size={18} />
                </label>
                <input id="photo-edit" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </>
            )}
          </div>
          <p className="mt-3 text-gray-500 text-sm">{user.email}</p>
        </div>

        {message.text && (
          <div className={`p-3 mb-6 rounded-xl border text-sm font-medium flex gap-2 items-start ${msgStyle}`}>
            {message.type === 'error' ? <AlertCircle size={18} className="shrink-0 mt-0.5"/> : <CheckCircle size={18} className="shrink-0 mt-0.5"/>}
            {message.text}
          </div>
        )}

        {/* FORMULARIO DATOS */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Datos Personales</h3>
            
            {/* Correo (Solo Lectura) */}
            <div className="bg-gray-100 p-3 rounded-xl border border-transparent flex items-center gap-2 opacity-70">
                <Mail size={18} className="text-gray-400 ml-1" />
                <input 
                  type="text" 
                  value={user.email} 
                  readOnly 
                  className="w-full outline-none bg-transparent text-gray-500 font-medium cursor-not-allowed" 
                />
                <span className="text-xs text-gray-400 px-2">Fijo</span>
            </div>

            {/* Nombre */}
            <div className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${isEditing ? 'bg-white border-purple-200 ring-2 ring-purple-50' : 'bg-white border-gray-200'}`}>
                <User size={18} className={isEditing ? "text-purple-500 ml-1" : "text-gray-400 ml-1"} />
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  readOnly={!isEditing}
                  className="w-full outline-none text-gray-800 font-medium bg-transparent" 
                  placeholder="Nombre" 
                />
            </div>

            {/* Teléfono */}
            <div className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${isEditing ? 'bg-white border-purple-200 ring-2 ring-purple-50' : 'bg-white border-gray-200'}`}>
                <Phone size={18} className={isEditing ? "text-purple-500 ml-1" : "text-gray-400 ml-1"} />
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={(e) => { if (/^\d*$/.test(e.target.value)) setPhone(e.target.value) }} 
                  readOnly={!isEditing}
                  className="w-full outline-none text-gray-800 font-medium bg-transparent" 
                  placeholder="Teléfono" 
                />
            </div>
          </div>

          {/* Botones Acción Edición */}
          {isEditing && (
            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => { setIsEditing(false); setMessage({text:'',type:''}); }}
                className="flex-1 py-3 rounded-xl text-gray-600 font-bold bg-gray-200 hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-white font-bold bg-purple-600 hover:bg-purple-700 shadow-lg transition flex justify-center items-center gap-2"
              >
                {loading ? '...' : <><Save size={18}/> Guardar</>}
              </button>
            </div>
          )}
        </form>

        {/* SECCIÓN CAMBIO DE CONTRASEÑA */}
        {!isEditing && (
          <div className="mt-8 pt-6 border-t border-gray-200 space-y-6">
            
            {/* Cambio de Contraseña */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Seguridad</h3>
              
              {!showPasswordChange ? (
                <button 
                  onClick={() => setShowPasswordChange(true)}
                  className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition"
                >
                  <Lock size={18} /> Cambiar Contraseña
                </button>
              ) : (
                <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm animate-slide-down">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-gray-800">Cambiar Contraseña</h4>
                    <button onClick={() => setShowPasswordChange(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Contraseña Actual</label>
                      <input 
                        type="password" 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-lg outline-none border border-gray-200 focus:border-purple-500 transition"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nueva Contraseña</label>
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-lg outline-none border border-gray-200 focus:border-purple-500 transition"
                        placeholder="Nueva contraseña"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleChangePassword}
                    disabled={loading}
                    className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition mb-3"
                  >
                    {loading ? 'Actualizando...' : 'Confirmar Cambio'}
                  </button>

                  <button 
                    onClick={handleForgotPassword}
                    className="w-full text-xs text-purple-600 hover:underline text-center"
                  >
                    ¿Olvidaste tu contraseña actual?
                  </button>
                </div>
              )}
            </div>

            {/* --- BOTÓN CERRAR SESIÓN (NUEVO) --- */}
            <div>
              <button 
                onClick={handleSignOut}
                className="w-full bg-red-50 border border-red-100 text-red-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition active:scale-95"
              >
                <LogOut size={18} /> Cerrar Sesión
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}