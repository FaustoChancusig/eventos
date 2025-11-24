import React, { useState, useEffect } from "react";
// import { Contacts } from "@capacitor-community/contacts";
import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  ArrowLeft,
  Search,
  Smartphone,
  Share2,
  CheckCircle,
  Users,
} from "lucide-react";

export default function InvitePage({
  onBack,
  eventLink = "https://miapp.com/event/123",
}) {
  const [contacts, setContacts] = useState([]);
  const [registered, setRegistered] = useState({});
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState([]); // Contactos seleccionados
  const [loading, setLoading] = useState(false);

  // 📌 SIMULACIÓN PARA WEB
  const loadContacts = async () => {
    setLoading(true);

    setTimeout(async () => {
      const mock = [
        { name: "Juan Pérez", phone: "0991234567" },
        { name: "María López", phone: "0987654321" },
        { name: "Carlos Tech", phone: "0955554444" },
        { name: "Ana Eventos", phone: "0999999999" },
      ];

      setContacts(mock);
      setFiltered(mock);
      setLoading(false);

      await detectRegisteredUsers(mock);
    }, 800);
  };

  // 🔍 BUSCAR EN FIREBASE SI ALGÚN CONTACTO ESTÁ REGISTRADO
  const detectRegisteredUsers = async (contactList) => {
    const map = {};

    for (const c of contactList) {
      const cleanPhone = c.phone.replace(/\D/g, "");

      const q = query(
        collection(db, "users"),
        where("phone", "==", cleanPhone)
      );

      const snap = await getDocs(q);

      map[cleanPhone] = snap.size > 0;
    }

    setRegistered(map);
  };

  // 🔎 FILTRO SEARCH
  useEffect(() => {
    const q = search.toLowerCase();
    const f = contacts.filter((c) =>
      c.name.toLowerCase().includes(q)
    );
    setFiltered(f);
  }, [search]);

  // ✔️ SELECCIONAR CONTACTO
  const toggleSelect = (phone) => {
    setSelected((prev) =>
      prev.includes(phone)
        ? prev.filter((p) => p !== phone)
        : [...prev, phone]
    );
  };

  // ▶️ ENVIAR INVITACIONES MASIVAS POR WHATSAPP
  const sendWhatsAppToSelected = () => {
    if (selected.length === 0) return alert("Selecciona contactos primero");

    const message = encodeURIComponent(
      `¡Hola! 👋\nTe invito a mi evento:\n${eventLink}`
    );

    selected.forEach((phone) => {
      window.open(`https://wa.me/${phone}?text=${message}`, "_system");
    });
  };

  // 🔔 ENVIAR NOTIFICACIONES INTERNAS (solo registrados)
  const notifyRegisteredUsers = () => {
    const regUsers = contacts.filter((c) =>
      registered[c.phone.replace(/\D/g, "")]
    );

    if (regUsers.length === 0)
      return alert("Ninguno está registrado en la app");

    alert(
      "Notificaciones enviadas a:\n" +
        regUsers.map((u) => `• ${u.name}`).join("\n")
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-950 font-sans animate-fade-in">

      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 dark:text-white p-4 shadow-sm flex items-center sticky top-0 z-10 border-b border-gray-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-600 dark:text-gray-300"
        >
          <ArrowLeft size={24} />
        </button>

        <h2 className="ml-4 text-lg font-bold text-gray-800">
          Invitar Amigos
        </h2>

        <button
          onClick={() =>
            navigator.share
              ? navigator.share({ url: eventLink })
              : alert(eventLink)
          }
          className="ml-auto p-2 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 rounded-full"
        >
          <Share2 size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* INICIO */}
        {contacts.length === 0 && !loading && (
          <div className="text-center flex flex-col items-center justify-center h-64">
             <div className="bg-orange-200 dark:bg-orange-900/40 p-6 rounded-full mb-4 animate-bounce">
              <Users size={48} className="text-orange-600 dark:text-orange-300" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Importa tus contactos para enviar invitaciones masivas.
            </p>
            <button
              onClick={loadContacts}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl font-bold"
            >
              Ver contactos
            </button>
          </div>
        )}

        {/* CARGANDO */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="h-8 w-8 border-t-2 border-orange-600 dark:border-orange-300 rounded-full animate-spin"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-3">Cargando...</p>
          </div>
        )}

        {/* BUSCADOR */}
        {contacts.length > 0 && (
          <div className="mb-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-3 text-gray-400 dark:text-gray-500"
              />
              <input
                type="text"
                placeholder="Buscar contacto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-400 outline-none"
              />
            </div>
          </div>
        )}

        {/* LISTA */}
        <div className="space-y-3 mb-20">
          {filtered.map((c, i) => {
            const cleanPhone = c.phone.replace(/\D/g, "");
            const isAppUser = registered[cleanPhone];
            const isSelected = selected.includes(cleanPhone);

            return (
              <div
                key={i}
                className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between cursor-pointer
                  bg-white dark:bg-slate-900
                  border-gray-200 dark:border-slate-800
                  transition
                  ${isSelected ? "ring-2 ring-orange-400 dark:ring-orange-300" : ""}
                `}
                onClick={() => toggleSelect(cleanPhone)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 dark:from-orange-800 dark:to-orange-600 flex items-center justify-center text-white font-bold">
                    {c.name.charAt(0)}
                  </div>

                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{c.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.phone}</p>

                    {isAppUser && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full mt-1 inline-flex items-center gap-1">
                        <CheckCircle size={12} /> En la App
                      </span>
                    )}
                  </div>
                </div>

                <Smartphone className="text-gray-500 dark:text-gray-300" />
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER ACCIONES */}
      {contacts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 p-4 fixed bottom-0 left-0 right-0 flex gap-3">
          <button
            onClick={sendWhatsAppToSelected}
            className="flex-1 py-3 bg-green-600 dark:bg-green-700 text-white rounded-xl font-bold"
          >
            WhatsApp ({selected.length})
          </button>

          <button
            onClick={notifyRegisteredUsers}
            className="flex-1 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-xl font-bold"
          >
            Notificar (App)
          </button>
        </div>
      )}
    </div>
  );
}
