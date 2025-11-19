    import React, { useState } from 'react';
// import { Contacts } from '@capacitor-community/contacts'; // <--- Descomentar esto en VS Code
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ArrowLeft, Search, Smartphone, Share2, User } from 'lucide-react';

export default function InvitePage({ onBack, eventLink = "https://miapp.com/evento/123" }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- MODO SIMULACIÓN PARA WEB ---
  // En tu celular, este código será reemplazado por el de Capacitor
  const loadContacts = async () => {
    setLoading(true);
    
    // Simulamos una espera de lectura de agenda
    setTimeout(() => {
      setContacts([
        { name: { display: "Juan Pérez" }, phones: [{ number: "0991234567" }] },
        { name: { display: "María López" }, phones: [{ number: "0987654321" }] },
        { name: { display: "Carlos Tech" }, phones: [{ number: "+5939999999" }] },
        { name: { display: "Ana Eventos" }, phones: [{ number: "0955555555" }] },
      ]);
      setLoading(false);
    }, 1000);
  };

  const handleContactClick = async (contact) => {
    // Lógica para limpiar el número
    const rawPhone = contact.phones[0].number;
    const cleanPhone = rawPhone.replace(/\D/g, ''); 

    // Verificación simulada en Firebase
    // (En web real esto funcionará si tienes los datos en la BD)
    alert(`Abriendo chat con ${contact.name.display} (${cleanPhone})...`);
    
    // En el celular, esto abrirá WhatsApp real:
    // const whatsappUrl = `https://wa.me/${cleanPhone}?text=Hola...`;
    // window.open(whatsappUrl, '_system');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 animate-fade-in font-sans">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-4 text-lg font-bold text-gray-800">Invitar Amigos</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        
        {/* Estado Inicial */}
        {contacts.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="bg-purple-100 p-6 rounded-full mb-4 animate-bounce-slow">
              <Share2 size={48} className="text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Sincroniza tu agenda</h3>
            <p className="text-gray-500 mb-6 px-8 text-sm">
              Busca en tus contactos para enviar invitaciones directas por WhatsApp o notificación.
            </p>
            <button 
              onClick={loadContacts}
              className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
            >
              Ver Contactos
            </button>
          </div>
        )}

        {/* Estado de Carga */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
            <p>Leyendo contactos...</p>
          </div>
        )}

        {/* Lista de Contactos */}
        <div className="space-y-2">
          {contacts.map((contact, index) => (
            <div 
              key={index}
              onClick={() => handleContactClick(contact)}
              className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between active:bg-purple-50 transition-colors cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-purple-600 font-bold text-lg">
                  {contact.name.display?.charAt(0) || '#'}
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">{contact.name.display}</h4>
                  <p className="text-xs text-gray-400 font-mono">{contact.phones[0]?.number}</p>
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded-full text-gray-400">
                <Smartphone size={18} />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}