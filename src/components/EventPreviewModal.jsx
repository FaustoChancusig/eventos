import React, { useState } from 'react';
import { X, UserPlus, Plus, Save, Send, Image as ImageIcon, Check, PartyPopper, Cake, Calendar, Clock, MapPin } from 'lucide-react';

// Fondos predeterminados (Gradientes)
const GRADIENTS = [
  { name: 'Naranja', class: 'from-orange-400 to-orange-600' },
  { name: 'Azul', class: 'from-blue-500 to-cyan-400' },
  { name: 'Morado', class: 'from-purple-600 to-indigo-600' },
  { name: 'Oscuro', class: 'from-slate-800 to-black' },
  { name: 'Rosa', class: 'from-pink-500 to-rose-500' },
];

export default function EventPreviewModal({ 
  formData, 
  guests, 
  isEditing, 
  loading, 
  onClose, 
  onPublish, 
  onAddGuest, 
  onRemoveGuest,
  onBackgroundChange 
}) {
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].class);
  const [customImagePreview, setCustomImagePreview] = useState(null);

  // Seleccionar Gradiente
  const selectGradient = (gradClass) => {
    setSelectedGradient(gradClass);
    setCustomImagePreview(null);
    onBackgroundChange({ type: 'gradient', value: gradClass });
  };

  // Seleccionar Imagen de Galería
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomImagePreview(url);
      onBackgroundChange({ type: 'image', file: file });
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-gray-100 flex flex-col animate-slide-up">
      
      {/* Header Modal */}
      <div className="bg-white p-4 shadow-sm flex items-center justify-between shrink-0">
         <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><X size={24}/></button>
         <h2 className="text-lg font-bold text-gray-800">Personalizar & Confirmar</h2>
         <div className="w-10"></div> 
      </div>

      <div className="flex-1 overflow-y-auto p-6">      
        
        {/* SECCIÓN: SELECTOR DE FONDO */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Estilo de la Tarjeta</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            
            {/* Botón Subir Foto */}
            <label className="shrink-0 w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-purple-500 hover:text-purple-500 transition bg-white">
              <ImageIcon size={20} />
              <span className="text-[10px] font-bold mt-1">Galeria</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>

            {/* Botones Gradientes */}
            {GRADIENTS.map((grad, idx) => (
              <button 
                key={idx}
                onClick={() => selectGradient(grad.class)}
                className={`shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${grad.class} relative shadow-sm border-2 ${selectedGradient === grad.class && !customImagePreview ? 'border-black transform scale-105' : 'border-transparent'}`}
              >
                {selectedGradient === grad.class && !customImagePreview && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check size={20} className="text-white drop-shadow-md" strokeWidth={3} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* TARJETA VISUAL (Vista Previa) */}
        <div 
            className={`relative overflow-hidden w-full min-h-[480px] rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col justify-between border-2 border-white/10 transition-all duration-500 bg-cover bg-center
            ${!customImagePreview ? `bg-gradient-to-br ${selectedGradient}` : ''}`}
            style={customImagePreview ? { backgroundImage: `url(${customImagePreview})` } : {}}
        >
          {/* Overlay oscuro si hay foto */}
          {customImagePreview && <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>}

          {/* Decoración (solo en gradientes) */}
          {!customImagePreview && (
            <>
              <PartyPopper className="absolute top-8 left-6 text-white opacity-20 rotate-[-15deg]" size={48} />
              <Cake className="absolute bottom-24 right-[-10px] text-white opacity-20 rotate-[10deg]" size={80} />
              <div className="absolute top-0 right-0 w-56 h-56 bg-white opacity-10 rounded-bl-full pointer-events-none blur-2xl"></div>
            </>
          )}

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
          
          <div className="relative z-10 flex flex-col gap-3 text-white text-base font-medium w-full mt-auto">
            <div className="flex items-center justify-center gap-3 bg-black/20 px-6 py-4 rounded-3xl backdrop-blur-md border border-white/10 w-full shadow-inner">
              <Calendar size={20} className="shrink-0 text-white" />
              <span className="capitalize">{formData.date}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
                <div className="flex items-center justify-center gap-2 bg-black/20 px-4 py-3.5 rounded-3xl backdrop-blur-md border border-white/10 shadow-inner">
                    <Clock size={18} className="shrink-0 text-white" />
                    <span>{formData.time}</span>
                </div>
                <div className="flex items-center justify-center gap-2 bg-black/20 px-4 py-3.5 rounded-3xl backdrop-blur-md border border-white/10 shadow-inner overflow-hidden">
                    <MapPin size={18} className="shrink-0 text-white" />
                    <span className="truncate text-sm">{formData.locationName || "Mapa"}</span>
                </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN INVITADOS (Igual que antes) */}
        {!isEditing && (
          <div className="mt-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2"><UserPlus size={20} className="text-purple-600"/> Invitar Amigos</h3>
             
             <button onClick={onAddGuest} className="w-full py-3 border-2 border-dashed border-purple-200 text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition flex justify-center items-center gap-2 mb-4">
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
                     <button onClick={() => onRemoveGuest(idx)} className="text-gray-400 hover:text-red-500"><X size={16}/></button>
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-center text-gray-400 text-sm italic">Aún no has seleccionado invitados.</p>
             )}
          </div>
        )}
      </div>

      {/* Botón Final */}
      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        <button 
          onClick={onPublish}
          disabled={loading}
          className={`w-full text-white font-bold py-4 rounded-xl shadow-xl active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70 ${isEditing ? 'bg-blue-600' : 'bg-green-600'}`}
        >
          {loading ? 'Procesando...' : (isEditing ? <><Save size={20} /> Guardar Cambios</> : <><Send size={20} /> Publicar y Enviar</>)}
        </button>
      </div>
    </div>
  );
}