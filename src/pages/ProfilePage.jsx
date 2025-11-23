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

  const [name, setName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL || null);

  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // 🆕 Modal de imagen completa
  const [showFullImage, setShowFullImage] = useState(false);

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
      setIsEditing(true);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm("¿Estás seguro de que quieres cerrar sesión?")) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error al salir:", error);
      }
    }
  };

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
      setIsEditing(false);

    } catch (error) {
      console.error(error);
      setMessage({ text: "Error al actualizar perfil.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setMessage({ text: "Debes llenar ambos campos de contraseña.", type: 'error' });
      return;
    }

    if (!window.confirm("¿Confirmar cambio de contraseña?")) return;

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      setMessage({ text: "¡Contraseña cambiada con éxito!", type: 'success' });
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');

    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        setMessage({ text: "La contraseña actual es incorrecta.", type: 'error' });
      } else {
        setMessage({ text: "Error al cambiar contraseña.", type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!window.confirm(`Se enviará un enlace a ${user.email}. ¿Continuar?`)) return;
    
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage({ text: "Correo de recuperación enviado.", type: 'success' });
      setShowPasswordChange(false);
    } catch {
      setMessage({ text: "No se pudo enviar el correo.", type: 'error' });
    }
  };

  const msgStyle = message.type === 'success'
    ? "bg-green-50 text-green-700 border-green-200"
    : "bg-red-50 text-red-700 border-red-200";

  return (
    <>
      <div className="flex flex-col h-screen bg-gray-50 font-sans animate-fade-in">
        
        {/* Header */}
        <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10 border-b border-gray-100">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
            <ArrowLeft size={24} />
          </button>
          <h2 className="ml-4 text-lg font-bold text-gray-800">Mi Perfil</h2>

          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="ml-auto text-orange-600 font-bold text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition"
            >
              <Edit2 size={16} /> Editar
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-24">
          
          {/* FOTO DE PERFIL */}
          <div className="flex flex-col items-center mb-8">
            <div 
              className="relative group cursor-pointer"
              onClick={() => !isEditing && photoPreview && setShowFullImage(true)}
            >
              <div className={`w-28 h-28 rounded-full overflow-hidden border-4 ${
                isEditing ? 'border-orange-200' : 'border-white'
              } shadow-lg bg-gray-200 transition`}>
                {photoPreview ? (
                  <img src={photoPreview} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <User size={48} />
                  </div>
                )}
              </div>

              {isEditing && (
                <>
                  <label htmlFor="photo-edit" className="absolute bottom-0 right-0 bg-orange-600 text-white p-2 rounded-full cursor-pointer shadow-md border-2 border-white">
                    <Camera size={18} />
                  </label>
                  <input id="photo-edit" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </>
              )}
            </div>

            <p className="mt-3 text-gray-500 text-sm bg-gray-100 px-3 py-1 rounded-full border border-gray-200 flex items-center gap-2">
              <Mail size={14}/> {user.email}
            </p>
          </div>

          {message.text && (
            <div className={`p-3 mb-6 rounded-xl border text-sm font-medium flex gap-2 items-start ${msgStyle}`}>
              {message.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle size={18}/>}
              {message.text}
            </div>
          )}

          {/* FORMULARIO */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Nombre */}
            <div className={`p-3 rounded-xl border flex items-center gap-3 ${isEditing ? 'bg-white border-orange-300 ring-1 ring-orange-100' : 'border-transparent'}`}>
              <User size={20} className={isEditing ? "text-orange-600" : "text-gray-400"} />
              <div className="flex-1">
                {isEditing ? (
                  <>
                    <label className="block text-[10px] text-orange-600 font-bold uppercase mb-0.5">Nombre</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full outline-none font-medium bg-transparent"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs text-gray-400">Nombre</label>
                    <p className="text-gray-800 font-medium text-lg">{name || 'Sin nombre'}</p>
                  </>
                )}
              </div>
            </div>

            {/* Teléfono */}
            <div className={`p-3 rounded-xl border flex items-center gap-3 ${isEditing ? 'bg-white border-orange-300 ring-1 ring-orange-100' : 'border-transparent'}`}>
              <Phone size={20} className={isEditing ? "text-orange-600" : "text-gray-400"} />
              <div className="flex-1">
                {isEditing ? (
                  <>
                    <label className="block text-[10px] text-orange-600 font-bold uppercase mb-0.5">Teléfono</label>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => /^\d*$/.test(e.target.value) && setPhone(e.target.value)}
                      className="w-full outline-none font-medium bg-transparent"
                      placeholder="099..."
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs text-gray-400">Teléfono</label>
                    <p className="text-gray-800 font-medium text-lg">{phone || 'Sin teléfono'}</p>
                  </>
                )}
              </div>
            </div>

            {/* Botones guardar/cancelar */}
            {isEditing && (
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 active:scale-95"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 shadow-md active:scale-95 disabled:opacity-70"
                >
                  {loading ? 'Guardando...' : <span className="flex items-center justify-center gap-2"><Save size={18}/> Guardar</span>}
                </button>
              </div>
            )}
          </form>

          {/* CAMBIO DE CONTRASEÑA + CERRAR SESIÓN */}
          {!isEditing && (
            <div className="mt-10 space-y-6">
              {/* Cambio de contraseña */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Seguridad</h3>

                {!showPasswordChange ? (
                  <button
                    onClick={() => setShowPasswordChange(true)}
                    className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 shadow-sm"
                  >
                    <Lock size={18}/> Cambiar Contraseña
                  </button>
                ) : (
                  <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-lg">
                    <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-2">
                      <h4 className="font-bold text-gray-800 flex items-center gap-2"><Lock size={18} className="text-orange-600"/> Cambiar Contraseña</h4>
                      <button onClick={() => setShowPasswordChange(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4 mb-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Contraseña Actual</label>
                        <input 
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500"
                          placeholder="••••••••"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Nueva Contraseña</label>
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-orange-500"
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleChangePassword}
                      className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 shadow-md active:scale-95"
                    >
                      Confirmar Cambio
                    </button>

                    <button 
                      onClick={handleForgotPassword}
                      className="w-full text-center text-orange-600 text-xs mt-3 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </div>

              {/* Cerrar sesión */}
              <div className="pt-4">
                <button
                  onClick={handleSignOut}
                  className="w-full bg-red-50 text-red-600 border border-red-100 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 active:scale-95"
                >
                  <LogOut size={20}/> Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🖼️ MODAL FOTO COMPLETA */}
      {showFullImage && photoPreview && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[999]"
          onClick={() => setShowFullImage(false)}
        >
          <div 
            className="relative animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={photoPreview}
              className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-xl object-cover"
            />

            <button
              className="absolute top-2 right-2 bg-white/90 p-2 rounded-full shadow-md hover:bg-white active:scale-90 transition"
              onClick={() => setShowFullImage(false)}
            >
              <X size={24} className="text-black" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
