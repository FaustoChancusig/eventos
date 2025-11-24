import React, { useState, useEffect } from 'react';
import ThemeToggle from "../components/ThemeToggle";
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
  AlertTriangle, CheckCircle2, Edit2, Mail, X, LogOut,
  Eye, EyeOff, HelpCircle
} from 'lucide-react';

export default function ProfilePage({ user, onBack }) {
  const [loading, setLoading] = useState(false);

  // --- NOTIFICACIONES (TOAST) ---
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // --- 🆕 ESTADO PARA EL MODAL DE CONFIRMACIÓN ---
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    action: null, // 'logout', 'password', 'reset'
    title: '',
    message: '',
    isDangerous: false // Para poner botones rojos si es algo peligroso
  });

  const [name, setName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL || null);

  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [showFullImage, setShowFullImage] = useState(false);

  // --- HELPER: TOAST ---
  const showToast = (message, type = 'error') => {
    setNotification({ show: true, message, type });
  };

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

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

  // --- LÓGICA DE CONFIRMACIÓN ---
  const handleConfirmAction = async () => {
    // Cerramos el modal primero
    setConfirmModal(prev => ({ ...prev, show: false }));

    const action = confirmModal.action;

    if (action === 'logout') {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error al salir:", error);
      }
    }
    else if (action === 'password') {
      await executeChangePassword();
    }
    else if (action === 'reset') {
      await executeForgotPassword();
    }
  };

  // --- FUNCIONES PRINCIPALES ---

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      if (!isEditing) setIsEditing(true);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
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
      await updateDoc(userRef, { username: name, phone: phone, photoURL: photoURL });
      showToast("¡Perfil actualizado correctamente!", 'success');
      setIsEditing(false);
    } catch (error) {
      showToast("Error al actualizar perfil.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // 1. PREPARAR CAMBIO DE CONTRASEÑA (Abre Modal)
  const prepareChangePassword = (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      return showToast("Debes llenar ambos campos.", 'error');
    }
    // Abrir modal personalizado
    setConfirmModal({
      show: true,
      action: 'password',
      title: 'Cambiar Contraseña',
      message: '¿Estás seguro de que deseas cambiar tu contraseña actual?',
      isDangerous: false
    });
  };

  // 2. EJECUTAR CAMBIO (Llamado por el Modal)
  const executeChangePassword = async () => {
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      showToast("¡Contraseña actualizada!", 'success');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setShowCurrentPass(false);
      setShowNewPass(false);
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        showToast("Contraseña actual incorrecta.", 'error');
      } else {
        showToast("Error al cambiar contraseña.", 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // 1. PREPARAR OLVIDÉ CONTRASEÑA
  const prepareForgotPassword = () => {
    setConfirmModal({
      show: true,
      action: 'reset',
      title: 'Enviar Correo',
      message: `Enviaremos un enlace de recuperación a ${user.email}. ¿Continuar?`,
      isDangerous: false
    });
  };

  // 2. EJECUTAR OLVIDÉ CONTRASEÑA
  const executeForgotPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast("Correo enviado. Revisa tu bandeja.", 'success');
      setShowPasswordChange(false);
    } catch {
      showToast("No se pudo enviar el correo.", 'error');
    }
  };

  // 1. PREPARAR CERRAR SESIÓN
  const prepareSignOut = () => {
    setConfirmModal({
      show: true,
      action: 'logout',
      title: 'Cerrar Sesión',
      message: '¿Quieres salir de tu cuenta ahora?',
      isDangerous: true // Botón rojo
    });
  };

  return (
    <>
      {/* --- TOAST DE NOTIFICACIÓN --- */}
      {notification.show && (
        <div className="fixed top-6 left-0 right-0 z-[3000] flex justify-center px-4 animate-[slideDown_0.4s_ease-out] font-sans">
          <div className={`shadow-2xl border-l-4 rounded-xl p-4 flex items-start gap-3 backdrop-blur-md w-full max-w-sm transition-all duration-300 
              ${notification.type === 'success'
                ? 'bg-white/95 dark:bg-gray-900/95 border-green-500 text-gray-800 dark:text-green-300'
                : 'bg-white/95 dark:bg-gray-900/95 border-red-500 text-gray-800 dark:text-red-300'
              }`}>
            <div className="shrink-0 mt-0.5">
              {notification.type === 'success'
                ? <CheckCircle2 className="text-green-500 dark:text-green-400" size={20} />
                : <AlertTriangle className="text-red-500 dark:text-red-400" size={20} />}
            </div>

            <div className="flex-1">
              <h4 className={`text-sm font-bold 
                ${notification.type === 'success'
                  ? 'text-green-600 dark:text-green-300'
                  : 'text-red-600 dark:text-red-300'
                }`}>
                {notification.type === 'success' ? '¡Éxito!' : 'Atención'}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-tight mt-0.5">
                {notification.message}
              </p>
            </div>

            <button onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* --- 🆕 MODAL DE CONFIRMACIÓN PROFESIONAL --- */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-xs rounded-3xl shadow-2xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-center text-center">
              <div className={`p-4 rounded-full mb-4 
                ${confirmModal.isDangerous
                  ? 'bg-red-50 dark:bg-red-900/40 text-red-500 dark:text-red-300'
                  : 'bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300'
                }`}>
                {confirmModal.isDangerous
                  ? <LogOut size={32} />
                  : <HelpCircle size={32} />}
              </div>

              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
                {confirmModal.title}
              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-300 font-medium mb-6 leading-relaxed">
                {confirmModal.message}
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition active:scale-95"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleConfirmAction}
                  className={`flex-1 py-3 rounded-xl text-white font-bold text-sm shadow-lg transition active:scale-95 
                    ${confirmModal.isDangerous
                      ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-600 shadow-red-500/30'
                      : 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 shadow-orange-500/30'
                    }`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 font-sans animate-fade-in">

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 p-4 shadow-sm flex items-center sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition text-gray-600 dark:text-gray-300"
          >
            <ArrowLeft size={24} />
          </button>

          <h2 className="ml-4 text-lg font-bold text-gray-800 dark:text-gray-100">Mi Perfil</h2>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />

            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="ml-auto text-orange-600 dark:text-orange-400 font-bold text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition"
              >
                <Edit2 size={16} /> Editar
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-24">

          {/* FOTO DE PERFIL */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              {isEditing ? (
                <label htmlFor="photo-edit" className="cursor-pointer block relative transition-transform active:scale-95">
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-orange-200 dark:border-orange-700 shadow-lg bg-gray-200 dark:bg-gray-700 transition hover:opacity-90">
                    {photoPreview
                      ? (<img src={photoPreview} className="w-full h-full object-cover" alt="Perfil" />)
                      : (<div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-300">
                          <User size={48} />
                        </div>)
                    }
                  </div>

                  <div className="absolute bottom-0 right-0 bg-orange-600 dark:bg-orange-700 text-white p-2 rounded-full shadow-md border-2 border-white dark:border-gray-900 transition-transform group-hover:scale-110">
                    <Camera size={18} />
                  </div>
                </label>
              ) : (
                <div
                  className="cursor-zoom-in active:scale-95 transition-transform"
                  onClick={() => photoPreview && setShowFullImage(true)}
                >
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg bg-gray-200 dark:bg-gray-700">
                    {photoPreview
                      ? (<img src={photoPreview} className="w-full h-full object-cover" alt="Perfil" />)
                      : (<div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-300">
                          <User size={48} />
                        </div>)
                    }
                  </div>
                </div>
              )}
              {isEditing && <input id="photo-edit" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />}
            </div>
            <p className="mt-3 text-gray-500 dark:text-gray-300 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 flex items-center gap-2 font-medium">
              <Mail size={14} /> {user.email}
            </p>
          </div>

          {/* FORMULARIO */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className={`p-3 rounded-xl border flex items-center gap-3 
              ${isEditing
                ? 'bg-white dark:bg-gray-800 border-orange-300 dark:border-orange-600 ring-1 ring-orange-100 dark:ring-orange-900/40'
                : 'border-transparent'
              }`}>
              <User size={20} className={isEditing ? "text-orange-600 dark:text-orange-400" : "text-gray-400 dark:text-gray-500"} />

              <div className="flex-1">
                {isEditing ? (
                  <>
                    <label className="block text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase mb-0.5 font-sans">Nombre</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full outline-none font-bold text-gray-800 dark:text-gray-100 bg-transparent font-sans"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs text-gray-400 dark:text-gray-500 font-sans">Nombre</label>
                    <p className="text-gray-800 dark:text-gray-100 font-bold text-lg font-sans">{name || 'Sin nombre'}</p>
                  </>
                )}
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex items-center gap-3 
              ${isEditing
                ? 'bg-white dark:bg-gray-800 border-orange-300 dark:border-orange-600 ring-1 ring-orange-100 dark:ring-orange-900/40'
                : 'border-transparent'
              }`}>
              <Phone size={20} className={isEditing ? "text-orange-600 dark:text-orange-400" : "text-gray-400 dark:text-gray-500"} />
              <div className="flex-1">
                {isEditing ? (
                  <>
                    <label className="block text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase mb-0.5 font-sans">Teléfono</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => /^\d*$/.test(e.target.value) && setPhone(e.target.value)}
                      className="w-full outline-none font-bold text-gray-800 dark:text-gray-100 bg-transparent font-sans"
                      placeholder="099..."
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs text-gray-400 dark:text-gray-500 font-sans">Teléfono</label>
                    <p className="text-gray-800 dark:text-gray-100 font-bold text-lg font-sans">{phone || 'Sin teléfono'}</p>
                  </>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 font-sans"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-orange-600 dark:bg-orange-700 text-white font-bold hover:bg-orange-700 dark:hover:bg-orange-600 shadow-md active:scale-95 disabled:opacity-70 font-sans"
                >
                  {loading
                    ? 'Guardando...'
                    : <span className="flex items-center justify-center gap-2">
                        <Save size={18} /> Guardar
                      </span>
                  }
                </button>
              </div>
            )}
          </form>

          {/* SEGURIDAD */}
          {!isEditing && (
            <div className="mt-10 space-y-6">
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-4 font-sans">Seguridad</h3>

                {!showPasswordChange ? (
                  <button onClick={() => setShowPasswordChange(true)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm font-sans">
                    <Lock size={18} /> Cambiar Contraseña
                  </button>
                ) : (
                  <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-orange-100 dark:border-orange-900/30 shadow-lg">
                    <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-gray-700 pb-2">
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 font-sans">
                        <Lock size={18} className="text-orange-600 dark:text-orange-400" /> Cambiar Contraseña
                      </h4>
                      <button
                        onClick={() => setShowPasswordChange(false)}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4 mb-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 font-sans">
                          Contraseña Actual
                        </label>

                        <div className="relative">
                          <input
                            type={showCurrentPass ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full p-3 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-orange-500 outline-none font-sans"
                            placeholder="••••••••"
                          />

                          <button
                            type="button"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                            className="absolute right-3 top-3 text-gray-400 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400"
                          >
                            {showCurrentPass ? <EyeOff size={23} /> : <Eye size={23} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 font-sans">
                          Nueva Contraseña
                        </label>

                        <div className="relative">
                          <input
                            type={showNewPass ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full p-3 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-orange-500 outline-none font-sans"
                            placeholder="Mínimo 6 caracteres"
                          />

                          <button
                            type="button"
                            onClick={() => setShowNewPass(!showNewPass)}
                            className="absolute right-3 top-3 text-gray-400 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400"
                          >
                            {showNewPass ? <EyeOff size={23} /> : <Eye size={23} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={prepareChangePassword}
                      className="w-full bg-orange-600 dark:bg-orange-700 text-white font-bold py-3 rounded-xl hover:bg-orange-700 dark:hover:bg-orange-600 shadow-md active:scale-95 font-sans"
                    >
                      Confirmar Cambio
                    </button>

                    <button
                      onClick={prepareForgotPassword}
                      className="w-full text-center text-orange-600 dark:text-orange-400 text-xs mt-3 hover:underline font-bold font-sans"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  onClick={prepareSignOut}
                  className="w-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-800 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/50 active:scale-95 font-sans"
                >
                  <LogOut size={20} /> Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL FOTO COMPLETA */}
      {showFullImage && photoPreview && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[999]"
          onClick={() => setShowFullImage(false)}
        >
          <div
            className="relative animate-fade-in p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photoPreview}
              className="max-w-[90vw] max-h-[80vh] rounded-2xl shadow-2xl object-contain bg-black"
              alt="Full Preview"
            />

            <button
              className="absolute top-0 right-0 m-6 bg-white/90 dark:bg-gray-800 p-2 rounded-full shadow-md hover:bg-white dark:hover:bg-gray-700 active:scale-90 transition"
              onClick={() => setShowFullImage(false)}
            >
              <X size={24} className="text-black dark:text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}