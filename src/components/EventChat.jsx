import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Send, Lock, MessageCircle } from 'lucide-react';

// Agregamos 'className' a las props para que reciba los estilos del padre
export default function EventChat({ eventId, user, isConfirmed, className }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!eventId) return;

    if (!isConfirmed) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'events', eventId, 'chat'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(msgs);
        setLoading(false);
        setTimeout(scrollToBottom, 80);
      },
      (err) => {
        console.error("Error cargando chat:", err);
        setError("No se pudo cargar el chat.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId, isConfirmed]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'events', eventId, 'chat'), {
        text: newMessage,
        senderId: user.uid,
        senderName: user.displayName || 'Usuario',
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
      alert("Error al enviar mensaje.");
    }
  };

  if (!isConfirmed) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-500 mt-10">
        <div className="bg-gray-200 dark:bg-gray-700 p-6 rounded-full mb-4 shadow">
          <Lock size={40} className="text-gray-400 dark:text-gray-300" />
        </div>
        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-100">Chat bloqueado</h3>
        <p className="text-sm mt-2 max-w-xs text-gray-500 dark:text-gray-400">
          Debes confirmar tu asistencia para usar el chat.
        </p>
      </div>
    );
  }

  return (
    // CORRECCIÓN 1: Quitamos el calc(...) y usamos h-full para llenar el hueco exacto que deja el padre
    // También aceptamos 'className' por si el padre manda estilos extra
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className || ''}`}>

      {/* LISTA MENSAJES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
        {loading ? (
          <p className="text-center text-xs text-gray-400 mt-4">Cargando chat...</p>
        ) : error ? (
          <div className="text-center text-red-500 text-sm mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10 flex flex-col items-center animate-fade-in">
            <MessageCircle size={34} className="mb-2 opacity-50" />
            <p className="text-sm text-gray-500 dark:text-gray-400">¡El chat está vacío! Di hola 👋</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user.uid;

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                
                <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-sm transition 
                  ${isMe
                    ? "bg-orange-600 text-white rounded-tr-sm"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm"
                  }`}
                >
                  
                  {!isMe && (
                    <p className="text-[10px] font-bold text-orange-600 dark:text-orange-300 mb-1">
                      {msg.senderName}
                    </p>
                  )}

                  <p>{msg.text}</p>

                  <p
                    className={`text-[9px] mt-1 text-right ${
                      isMe ? "text-orange-200" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {msg.createdAt?.seconds
                      ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : ""}
                  </p>

                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT MENSAJE */}
      {/* CORRECCIÓN 2: Quitamos 'pb-20'. Dejamos solo p-3 para que quede compacto abajo */}
      <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="
              flex-1 bg-gray-100 dark:bg-gray-700 
              text-gray-900 dark:text-gray-100 
              rounded-full px-4 py-3 text-sm outline-none
              focus:ring-2 focus:ring-orange-300 dark:focus:ring-orange-600
            "
          />

          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="
              bg-orange-600 hover:bg-orange-700
              dark:bg-orange-700 dark:hover:bg-orange-800
              text-white p-3 rounded-full shadow 
              active:scale-95 transition
              disabled:opacity-40
              shrink-0
            "
          >
            <Send size={18} />
          </button>
        </form>
      </div>

    </div>
  );
}