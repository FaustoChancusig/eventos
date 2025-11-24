import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  Bell,
  Check,
  X,
  User,
  ArrowLeft,
  HelpCircle,
  ChevronRight,
} from "lucide-react";

export default function NotificationsPage({ user, onBack }) {
  const [notifications, setNotifications] = useState([]);

  // === CARGAR NOTIFICACIONES ===
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      notifs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user]);

  // === RESPONDER INVITACIÓN ===
  const handleResponse = async (notif, status) => {
    try {
      const eventRef = doc(db, "events", notif.eventId);

      const guestData = {
        uid: user.uid,
        name: user.displayName || "Usuario",
        phone: user.phoneNumber || "App",
        status,
        respondedAt: new Date().toISOString(),
      };

      let updates = {
        attendees: arrayUnion(guestData),
      };

      if (status === "confirmed" || status === "maybe") {
        updates.guestIds = arrayUnion(user.uid);
      }

      await updateDoc(eventRef, updates);

      await deleteDoc(
        doc(db, "users", user.uid, "notifications", notif.id)
      );

      if (status === "declined") {
        alert("Has rechazado la invitación.");
      } else {
        alert(
          `Respuesta registrada: ${
            status === "confirmed" ? "Asistiré" : "Tal vez"
          }`
        );
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un error, intenta nuevamente.");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-surface-50 font-sans animate-fade-in dark:bg-gray-900">

      {/* HEADER */}
      <div className="p-4 shadow-sm flex items-center sticky top-0 z-10 border-b bg-white dark:bg-gray-800 border-surface-200 dark:border-gray-700">
        <button onClick={onBack} className="p-2 rounded-full transition active:scale-90 hover:bg-surface-100 dark:hover:bg-gray-700 text-ink/70 dark:text-gray-300">
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-4 text-lg font-bold text-ink dark:text-gray-100">Notificaciones</h2>
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* SIN NOTIFICACIONES */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-gray-400 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-full shadow-sm border border-surface-200 dark:border-gray-700 mb-4">
              <Bell size={36} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="font-medium text-sm text-gray-500 dark:text-gray-400">No tienes notificaciones pendientes.</p>
          </div>
        ) : (
          <div className="space-y-4 animate-slide-up">

            {notifications.map((notif) => (
              <div key={notif.id} className="p-5 rounded-3xl shadow-sm border animate-fade-in bg-white dark:bg-gray-800 border-surface-200 dark:border-gray-700">

                {/* CABECERA */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full border-2 shadow bg-primary-100 dark:bg-primary-300 border-white dark:border-gray-700 flex items-center justify-center overflow-hidden">
                    {notif.fromPhoto ? <img src={notif.fromPhoto} className="w-full h-full object-cover" /> : <User size={20} className="text-primary-700" />}
                  </div>

                  <div className="flex-1">
                    <p className="text-xs text-ink/60 dark:text-gray-400 mb-1 leading-tight">
                      <span className="font-bold text-ink dark:text-gray-100">{notif.fromName || "Alguien"}</span> te invitó a:
                    </p>

                    <h3 className="font-extrabold text-lg leading-tight text-primary-700 dark:text-primary-400">{notif.eventName}</h3>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-ink/50 dark:text-gray-500 uppercase tracking-widest">
                      <span>Invitación</span>
                      <ChevronRight size={12} />
                    </div>
                  </div>
                </div>

                {/* ACCIONES */}
                <div className="grid grid-cols-3 gap-2 mt-5">

                  {/* ASISTIRÉ */}
                  <button
                    onClick={() => handleResponse(notif, "confirmed")}
                    className="py-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 bg-green-50 dark:bg-green-800/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 active:scale-95 transition hover:bg-green-100 dark:hover:bg-green-800/50"
                  >
                    <div className="bg-green-200 dark:bg-green-600 p-1.5 rounded-full"><Check size={16} /></div>
                    Asistiré
                  </button>

                  {/* TAL VEZ */}
                  <button
                    onClick={() => handleResponse(notif, "maybe")}
                    className="py-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 bg-orange-50 dark:bg-orange-800/30 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 active:scale-95 transition hover:bg-orange-100 dark:hover:bg-orange-800/50"
                  >
                    <div className="bg-orange-200 dark:bg-orange-600 p-1.5 rounded-full"><HelpCircle size={16} /></div>
                    Tal vez
                  </button>

                  {/* NO IRÉ */}
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Seguro que deseas rechazar esta invitación?"
                        )
                      ) {
                        handleResponse(notif, "declined");
                      }
                    }}
                    className="py-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 active:scale-95 transition hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="bg-gray-200 dark:bg-gray-500 p-1.5 rounded-full"><X size={16} /></div>
                    No iré
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
