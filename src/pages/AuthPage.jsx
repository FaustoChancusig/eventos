import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import { 
  User, Mail, Lock, Phone, Camera, X, 
  Eye, EyeOff, AlertTriangle, CheckCircle2 
} from 'lucide-react';

export default function AuthPage() {
  const [view, setView] = useState('login'); 
  
  // Estados del formulario
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState(''); 
  const [username, setUsername] = useState('');       
  const [phone, setPhone] = useState(''); 
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Estados para visibilidad de contraseña
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // --- AUTO-OCULTAR ALERTA ---
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // --- MANEJO DE FOTO ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  // --- VALIDACIONES ---
  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ text: 'El formato del correo es inválido.', type: 'error' });
      return false;
    }

    if (view === 'register') {
      if (!username.trim()) {
        setMessage({ text: 'El nombre de usuario es obligatorio.', type: 'error' });
        return false;
      }
      if (phone.length > 0 && !/^\d+$/.test(phone)) {
        setMessage({ text: 'El teléfono solo debe contener números.', type: 'error' });
        return false;
      }
      if (pass.length < 6) {
        setMessage({ text: 'La contraseña debe tener al menos 6 caracteres.', type: 'error' });
        return false;
      }
      if (pass !== confirmPass) {
        setMessage({ text: 'Las contraseñas no coinciden.', type: 'error' });
        return false;
      }
    }
    return true;
  };

  // --- SUBMIT LOGIN / REGISTER ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      if (view === 'login') {
        await signInWithEmailAndPassword(auth, email, pass);
        // Login exitoso (App se redirige por onAuthStateChanged)
      } else if (view === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        let photoURL = '';

        if (photoFile) {
          const storageRef = ref(storage, `avatars/${user.uid}`);
          await uploadBytes(storageRef, photoFile);
          photoURL = await getDownloadURL(storageRef);
        }

        await updateProfile(user, { 
          displayName: username,
          photoURL: photoURL 
        });

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          username: username,
          email: email,
          phone: phone,
          photoURL: photoURL,
          createdAt: new Date().toISOString()
        });

        setMessage({ text: '¡Cuenta creada exitosamente! Bienvenido.', type: 'success' });
      }
    } catch (error) {
      console.error(error);
      let msg = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/email-already-in-use') msg = 'Este correo ya está registrado.';
      if (
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential'
      ) msg = 'Credenciales incorrectas.';
      if (error.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Intenta más tarde.';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- SUBMIT RESET ---
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!email) { 
      setMessage({ text: 'Ingresa tu correo para continuar.', type: 'error' }); 
      return; 
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage({ text: 'Hemos enviado un enlace de recuperación a tu correo.', type: 'success' });
      setTimeout(() => {
        setView('login');
      }, 3500);
    } catch (e) { 
      setMessage({ text: 'No pudimos enviar el correo. Verifica que sea correcto.', type: 'error' }); 
    } finally { 
      setLoading(false); 
    }
  };

  const isRegister = view === 'register';
  const isReset = view === 'reset';

  const switchView = (targetView) => {
    setMessage({ text: '', type: '' });
    setView(targetView);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-orange-700 via-orange-600 to-amber-400 font-sans relative overflow-hidden">
      
      {/* Glow decorativo móvil */}
      <div className="absolute -bottom-24 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-20 -left-10 w-56 h-56 bg-black/10 rounded-full blur-3xl pointer-events-none" />

      {/* --- ALERTA FLOTANTE (TOAST) --- */}
      {message.text && (
        <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 animate-[slideDown_0.5s_ease-out]">
          <div
            className={`w-full max-w-md flex items-start gap-3 p-4 rounded-xl shadow-2xl border-l-4 backdrop-blur-md transition-all ${
              message.type === 'success'
                ? 'bg-white/95 border-green-500 text-gray-800'
                : 'bg-white/95 border-red-500 text-gray-800'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {message.type === 'success' ? (
                <CheckCircle2 className="text-green-500" size={22} />
              ) : (
                <AlertTriangle className="text-red-500" size={22} />
              )}
            </div>
            <div className="flex-1">
              <h4
                className={`font-bold text-sm ${
                  message.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {message.type === 'success' ? '¡Excelente!' : 'Atención'}
              </h4>
              <p className="text-sm font-medium mt-0.5 leading-snug">
                {message.text}
              </p>
            </div>
            <button
              onClick={() => setMessage({ text: '', type: '' })}
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Branding */}
      <div className="text-center mb-8 animate-fade-in-down">
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-black/20 border border-white/20 mb-3 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          <span className="text-xs font-semibold text-orange-100 uppercase tracking-[0.2em]">
            Comunidad Privada
          </span>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
          EventMaster
        </h1>
        <p className="text-orange-100 text-sm mt-1 font-light">
          Organiza, invita y comparte tus mejores momentos
        </p>
      </div>
      
      {/* Card principal */}
      <div className="bg-white/95 backdrop-blur-sm w-full max-w-md rounded-3xl p-7 shadow-2xl border border-white/30 animate-slide-up">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
  {isReset ? 'Recuperar acceso' : isRegister ? 'Crear cuenta' : 'Bienvenido de nuevo'}
</h2>


        <form
          onSubmit={isReset ? handleResetSubmit : handleAuthSubmit}
          className="space-y-4"
        >
          {/* Avatar solo en registro */}
          {isRegister && (
            <div className="flex flex-col items-center mb-2 animate-fade-in">
              <div className="relative w-24 h-24 mb-2">
                <label
                  htmlFor="photo-upload"
                  className="block w-full h-full rounded-full cursor-pointer group relative hover:opacity-90 transition-opacity"
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full rounded-full object-cover border-4 border-orange-100 shadow-md group-hover:border-orange-200 transition-all"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400 group-hover:bg-gray-100 transition-all">
                      <Camera size={32} />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 bg-orange-600 text-white p-2 rounded-full shadow-lg transition-transform group-hover:scale-110">
                    <Camera size={16} />
                  </div>
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <p className="text-xs font-medium text-gray-400">
                Sube tu foto (opcional)
              </p>
            </div>
          )}

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                  Usuario
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-3.5 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    placeholder="Ej. AlexGamer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                  Teléfono
                </label>
                <div className="relative">
                  <Phone
                    className="absolute left-3 top-3.5 text-gray-400"
                    size={18}
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                        setPhone(e.target.value);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    placeholder="Solo números"
                    maxLength={10}
                  />
                </div>
              </div>
            </>
          )}

          {/* Correo */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-3.5 text-gray-400"
                size={18}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                placeholder="nombre@ejemplo.com"
              />
            </div>
          </div>

          {/* Passwords (no en reset) */}
          {!isReset && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-3.5 text-gray-400"
                    size={18}
                  />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-orange-600 transition-colors p-1"
                  >
                    {showPass ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>
              </div>

              {isRegister && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-3.5 text-gray-400"
                      size={18}
                    />
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      className={`w-full pl-10 pr-12 py-3 rounded-xl bg-gray-50 border outline-none focus:ring-2 transition-all text-sm ${
                        confirmPass && pass !== confirmPass
                          ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-200 focus:border-orange-500 focus:bg-white focus:ring-orange-100'
                      }`}
                      placeholder="Repite la contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-orange-600 transition-colors p-1"
                    >
                      {showConfirmPass ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                  {confirmPass && pass !== confirmPass && (
                    <p className="text-xs text-red-500 mt-1 ml-1 font-medium">
                      Las contraseñas no coinciden
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Botón principal */}
          <button
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-500/30 transition-all active:scale-[0.97] disabled:opacity-70 disabled:cursor-not-allowed mt-2 flex justify-center items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              isReset
                ? 'Enviar enlace'
                : isRegister
                  ? 'Registrarme ahora'
                  : 'Iniciar sesión'
            )}
          </button>
        </form>

        {/* Enlaces inferiores */}
        <div className="mt-4 text-center space-y-2">
          {!isReset && !isRegister && (
            <button
              onClick={() => switchView('reset')}
              className="text-xs text-gray-500 hover:text-orange-600 hover:underline transition-colors block w-full font-medium"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          <button
            onClick={() => switchView(isRegister || isReset ? 'login' : 'register')}
            className="w-full py-3 rounded-xl border-2 border-orange-100 text-orange-700 font-bold text-xs uppercase tracking-wide hover:bg-orange-50 hover:border-orange-200 transition-all active:scale-[0.97]"
          >
            {isRegister || isReset ? 'Volver al login' : 'Crear cuenta nueva'}
          </button>
        </div>
      </div>
    </div>
  );
}
