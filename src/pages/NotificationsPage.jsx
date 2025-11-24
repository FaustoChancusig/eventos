import React, { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Bell, Check, X, User, ArrowLeft, HelpCircle, ChevronRight } from "lucide-react";

export default function NotificationsPage({ user, onBack }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "notifications"), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      notifs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [user]);

  const handleResponse = async (notif, status) => {
    try {
      const eventRef = doc(db, "events", notif.eventId);

      // Esta estructura debe coincidir con lo que EventDetailPage espera
      const guestData = {
        uid: user.uid,
        name: user.displayName || "Usuario",
        phone: user.phoneNumber || "App",
        status: status,
        respondedAt: new Date().toISOString(),
      };

      // Agregamos al usuario a la lista de attendees del evento
      await updateDoc(eventRef, {
        attendees: arrayUnion(guestData),
      });

      // Borramos la notificación
      await deleteDoc(doc(db, "users", user.uid, "notifications", notif.id));

      // Feedback visual básico
      if (status === "declined") alert("Has rechazado la invitación.");
      else alert(`Respuesta registrada: ${status === "confirmed" ? "Asistiré" : "Tal vez"}`);
      
    } catch (err) {
      console.error(err);
      alert("Hubo un error al procesar la respuesta.");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-900 font-sans animate-fade-in">
      <div className="p-4 flex items-center sticky top-0 z-10 border-b bg-white dark:bg-slate-900 border-gray-100 dark:border-gray-800">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300">
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-4 text-lg font-bold text-gray-900 dark:text-white">Notificaciones</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-950">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-gray-400">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-full shadow-sm mb-4">
              <Bell size={36} className="text-gray-300" />
            </div>
            <p className="font-medium text-sm">No tienes notificaciones pendientes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <div key={notif.id} className="p-5 rounded-3xl shadow-sm bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full border-2 shadow bg-orange-100 border-white flex items-center justify-center overflow-hidden shrink-0">
                    {notif.fromPhoto ? (
                      <img src={notif.fromPhoto} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                      <User size={20} className="text-orange-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">
                      <span className="font-bold text-gray-900 dark:text-white">{notif.fromName || "Alguien"}</span> te invitó a:
                    </p>
                    <h3 className="font-extrabold text-lg text-gray-800 dark:text-white truncate">{notif.eventName}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-5">
                  <button onClick={() => handleResponse(notif, "confirmed")} className="py-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 bg-green-50 text-green-700 border border-green-200 active:scale-95 transition">
                    <div className="bg-green-200 p-1 rounded-full"><Check size={14} /></div> Asistiré
                  </button>
                  <button onClick={() => handleResponse(notif, "maybe")} className="py-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 active:scale-95 transition">
                    <div className="bg-orange-200 p-1 rounded-full"><HelpCircle size={14} /></div> Tal vez
                  </button>
                  <button onClick={() => handleResponse(notif, "declined")} className="py-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 bg-gray-50 text-gray-600 border border-gray-200 active:scale-95 transition">
                    <div className="bg-gray-200 p-1 rounded-full"><X size={14} /></div> No iré
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}