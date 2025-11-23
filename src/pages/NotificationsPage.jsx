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
    <div className="flex flex-col h-screen bg-surface-50 font-sans animate-fade-in">

      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10 border-b border-surface-200">
        <button
          onClick={onBack}
          className="p-2 hover:bg-surface-100 rounded-full transition text-ink/70 active:scale-90"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-4 text-lg font-bold text-ink">Notificaciones</h2>
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* SIN NOTIFICACIONES */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-gray-400 animate-fade-in">
            <div className="bg-white p-6 rounded-full shadow-sm border mb-4">
              <Bell size={36} className="text-gray-300" />
            </div>
            <p className="font-medium text-sm">No tienes notificaciones pendientes.</p>
          </div>
        ) : (
          <div className="space-y-4 animate-slide-up">

            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="bg-white p-5 rounded-3xl shadow-sm border border-surface-200 animate-fade-in"
              >
                {/* CABECERA */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 border-2 border-white shadow flex items-center justify-center overflow-hidden">
                    {notif.fromPhoto ? (
                      <img
                        src={notif.fromPhoto}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="text-primary-700" size={20} />
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-xs text-ink/60 mb-1 leading-tight">
                      <span className="font-bold text-ink">
                        {notif.fromName || "Alguien"}
                      </span>{" "}
                      te invitó a:
                    </p>

                    <h3 className="font-extrabold text-lg text-primary-700 leading-tight">
                      {notif.eventName}
                    </h3>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-ink/50 uppercase tracking-widest">
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
                    className="bg-green-50 border border-green-200 text-green-700 rounded-xl py-3 font-bold text-xs flex flex-col items-center gap-1 active:scale-95 transition hover:bg-green-100"
                  >
                    <div className="bg-green-200 p-1.5 rounded-full">
                      <Check size={16} />
                    </div>
                    Asistiré
                  </button>

                  {/* TAL VEZ */}
                  <button
                    onClick={() => handleResponse(notif, "maybe")}
                    className="bg-orange-50 border border-orange-200 text-orange-700 rounded-xl py-3 font-bold text-xs flex flex-col items-center gap-1 active:scale-95 transition hover:bg-orange-100"
                  >
                    <div className="bg-orange-200 p-1.5 rounded-full">
                      <HelpCircle size={16} />
                    </div>
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
                    className="bg-gray-50 border border-gray-200 text-gray-600 rounded-xl py-3 font-bold text-xs flex flex-col items-center gap-1 active:scale-95 transition hover:bg-gray-100"
                  >
                    <div className="bg-gray-200 p-1.5 rounded-full">
                      <X size={16} />
                    </div>
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
