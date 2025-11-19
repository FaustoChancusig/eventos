import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Importamos funciones de Storage
import { auth, db, storage } from '../config/firebase';
import { AlertCircle, CheckCircle, User, Mail, Lock, Phone, Camera, X } from 'lucide-react';

export default function AuthPage() {
  const [view, setView] = useState('login'); 
  
  // Estados del formulario
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState(''); 
  const [username, setUsername] = useState('');       
  const [phone, setPhone] = useState(''); 
  const [photoFile, setPhotoFile] = useState(null); // Estado para el archivo de foto
  const [photoPreview, setPhotoPreview] = useState(null); // Para mostrar la previsualización
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' }); 

  // --- MANEJO DE FOTO ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      // Crear URL temporal para previsualizar
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  // --- VALIDACIONES ---
  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ text: "El formato del correo es incorrecto.", type: 'error' });
      return false;
    }

    if (view === 'register') {
      if (!username.trim()) {
        setMessage({ text: "El nombre de usuario es obligatorio.", type: 'error' });
        return false;
      }
      if (phone.length > 0 && !/^\d+$/.test(phone)) {
        setMessage({ text: "El teléfono solo debe contener números.", type: 'error' });
        return false;
      }
      if (pass.length < 6) {
        setMessage({ text: "La contraseña es muy corta.", type: 'error' });
        return false;
      }
      if (pass !== confirmPass) {
        setMessage({ text: "Las contraseñas no coinciden.", type: 'error' });
        return false;
      }
    }
    return true;
  };

  // --- SUBMIT ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (view === 'login') {
        await signInWithEmailAndPassword(auth, email, pass);
      
      } else if (view === 'register') {
        // 1. Crear usuario
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        let photoURL = ""; // Por defecto vacía

        // 2. Si seleccionó foto, subirla a Firebase Storage
        if (photoFile) {
          // Creamos una referencia: carpeta 'avatars' / id_usuario
          const storageRef = ref(storage, `avatars/${user.uid}`);
          await uploadBytes(storageRef, photoFile);
          // Obtenemos la URL pública de internet
          photoURL = await getDownloadURL(storageRef);
        }

        // 3. Actualizar perfil de Auth (ahora con foto)
        await updateProfile(user, { 
          displayName: username,
          photoURL: photoURL // Guardamos la URL aquí
        });

        // 4. Guardar datos en Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          username: username,
          email: email,
          phone: phone,
          photoURL: photoURL, // Y también aquí para fácil acceso
          createdAt: new Date().toISOString()
        });

        setMessage({ text: "¡Registro exitoso!", type: 'success' });
      }
    } catch (error) {
      console.error(error);
      let msg = "Ocurrió un error.";
      if (error.code === 'auth/email-already-in-use') msg = "El correo ya está registrado.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') msg = "Credenciales incorrectas.";
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ... (Lógica de Reset igual)
  const handleResetSubmit = async (e) => {
      e.preventDefault();
      // ... (misma lógica que tenías antes)
      if (!email) { setMessage({text: "Ingresa tu correo", type: 'error'}); return; }
      setLoading(true);
      try {
          await sendPasswordResetEmail(auth, email);
          setMessage({text: "Enlace enviado.", type: 'success'});
          setTimeout(() => setView('login'), 4000);
      } catch(e) { setMessage({text: "Error enviando correo", type: 'error'}); }
      finally { setLoading(false); }
  };

  const isRegister = view === 'register';
  const isReset = view === 'reset';
  const msgStyle = message.type === 'success' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-purple-700 via-purple-600 to-blue-600 font-sans animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-white tracking-tight">EventMaster</h1>
        <p className="text-purple-200">Tu comunidad de eventos</p>
      </div>
      
      {message.text && (
        <div className={`w-full max-w-md p-3 mb-4 rounded-lg border text-sm text-center font-medium ${msgStyle}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4 border-gray-100">
          {isReset ? 'Recuperar Contraseña' : (isRegister ? 'Crear Cuenta' : 'Iniciar Sesión')}
        </h2>

        <form onSubmit={isReset ? handleResetSubmit : handleAuthSubmit} className="space-y-4">
          
          {/* --- SECCIÓN FOTO DE PERFIL (Solo Registro) --- */}
          {isRegister && (
            <div className="flex flex-col items-center mb-4">
              <div className="relative w-24 h-24 mb-2">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full rounded-full object-cover border-2 border-purple-200 shadow-md" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400">
                    <Camera size={32} />
                  </div>
                )}
                {/* Input oculto trucado con etiqueta */}
                <label htmlFor="photo-upload" className="absolute bottom-0 right-0 bg-purple-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-purple-700 shadow-sm">
                  <Camera size={14} />
                </label>
                <input 
                  id="photo-upload" 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </div>
              <p className="text-xs text-gray-400">Foto de perfil (Opcional)</p>
            </div>
          )}

          {isRegister && (
            <>
              {/* Inputs de Registro (Igual que antes) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Usuario</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border outline-none focus:border-purple-500 transition-all" placeholder="Ej. gamer_pro" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input type="tel" value={phone} onChange={e => { if(e.target.value === '' || /^\d+$/.test(e.target.value)) setPhone(e.target.value) }} className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border outline-none focus:border-purple-500 transition-all" placeholder="Solo números" maxLength={10} />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Correo</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border outline-none focus:border-purple-500 transition-all" placeholder="tu@correo.com" />
            </div>
          </div>

          {!isReset && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border outline-none focus:border-purple-500 transition-all" placeholder="••••••••" />
                </div>
              </div>
              {isRegister && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Confirmar</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className={`w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border outline-none transition-all ${confirmPass && pass !== confirmPass ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-purple-500"}`} placeholder="Repite contraseña" />
                  </div>
                </div>
              )}
            </>
          )}

          <button disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 mt-4">
            {loading ? 'Procesando...' : (isReset ? 'Enviar' : (isRegister ? 'Registrarme' : 'Ingresar'))}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 text-center space-y-3">
          {!isReset && !isRegister && (
             <button onClick={() => {setMessage({text:'',type:''}); setView('reset')}} className="text-sm text-purple-600 hover:underline block w-full">¿Olvidaste tu contraseña?</button>
          )}
          <button onClick={() => {setMessage({text:'',type:''}); setView(isRegister || isReset ? 'login' : 'register')}} className="text-purple-700 font-bold uppercase text-sm tracking-wide">
            {isRegister || isReset ? 'Volver al Login' : 'Crear Cuenta Gratis'}
          </button>
        </div>
      </div>
    </div>
  );
}