import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation'; 
import { ArrowLeft, Search, Crosshair, Loader2, CheckCircle, MapPin, Map as MapIcon, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export default function MapSelectorPage({ onClose, onConfirm, initialLat, initialLng }) {
    const mapRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [address, setAddress] = useState('');
    
    // Estado para notificaciones (Toast)
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });

    const [currentCenter, setCurrentCenter] = useState({
        lat: initialLat || -0.1807,
        lng: initialLng || -78.4678
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isLocating, setIsLocating] = useState(false);

    // --- HELPER: MOSTRAR NOTIFICACIÓN ---
    const showToast = (message, type = 'error') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
    };

    // 1. Manejo de Transparencia
    useEffect(() => {
        document.body.classList.add('transparent-body');
        document.documentElement.classList.add('transparent-body');
        
        return () => {
            document.body.classList.remove('transparent-body');
            document.documentElement.classList.remove('transparent-body');
            if (mapInstance) {
                mapInstance.destroy();
            }
        };
    }, [mapInstance]);

    // 2. Crear el Mapa
    useEffect(() => {
        const createMap = async () => {
            if (!mapRef.current) return;
            try {
                const newMap = await GoogleMap.create({
                    id: 'google-map-selector',
                    element: mapRef.current,
                    apiKey: 'AIzaSyA1RMAz7idXEWcH3j4aBbslfbUoCPxES7g', // ⚠️ TU API KEY
                    config: {
                        center: currentCenter,
                        zoom: 16,
                        androidLiteMode: false,
                        uiSettings: {
                            myLocationButton: false,
                            zoomControls: false,
                            compassButton: false
                        }
                    },
                });

                await newMap.setOnCameraIdleListener(async (event) => {
                    const lat = event.latitude;
                    const lng = event.longitude;
                    setCurrentCenter({ lat, lng });
                    getAddressFromCoords(lat, lng);
                });

                setMapInstance(newMap);
            } catch (e) {
                console.error("Error creando mapa", e);
                showToast("Error al cargar el mapa. Revisa tu API Key.", "error");
            }
        };
        
        setTimeout(createMap, 200);
    }, []);

    // 3. Geocodificación Inversa
    const getAddressFromCoords = async (lat, lng) => {
        setIsGeocoding(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
            const data = await res.json();
            if (data?.display_name) {
                const shortName = data.address.road || data.address.suburb || data.address.city || data.display_name.split(',')[0];
                setAddress(shortName);
            } else {
                setAddress("Ubicación seleccionada");
            }
        } catch (e) {
            setAddress("Ubicación marcada");
        } finally {
            setIsGeocoding(false);
        }
    };

    // 4. Búsqueda
    const handleSearch = async (text) => {
        setSearchQuery(text);
        if (text.length < 3) {
            setSuggestions([]);
            return;
        }
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ec&q=${encodeURIComponent(text)}`);
            const data = await response.json();
            setSuggestions(data);
        } catch (e) { console.error(e); }
    };

    const selectSuggestion = async (item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        setSearchQuery('');
        setSuggestions([]); 

        if (mapInstance) {
            await mapInstance.setCamera({
                coordinate: { lat, lng },
                zoom: 18,
                animate: true
            });
        }
    };

    // 5. Ubícame
    const locateMe = async () => {
        if (isLocating) return;
        setIsLocating(true);
        
        try {
            const permissionStatus = await Geolocation.checkPermissions();
            
            if (permissionStatus.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    throw new Error("Permiso de ubicación denegado.");
                }
            }

            const coordinates = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000, 
                maximumAge: 0 
            });

            const { latitude, longitude } = coordinates.coords;

            if (mapInstance) {
                await mapInstance.setCamera({
                    coordinate: { lat: latitude, lng: longitude },
                    zoom: 17,
                    animate: true
                });
            }

        } catch (error) {
            console.error("Error GPS:", error);
            showToast("No pudimos ubicarte. Verifica que tu GPS esté encendido.", "error");
        } finally {
            setIsLocating(false);
        }
    };

    const confirmSelection = () => {
        if (!address) return showToast("Espera a que cargue la dirección", "error");
        onConfirm({
            lat: currentCenter.lat,
            lng: currentCenter.lng,
            address: address || "Ubicación personalizada"
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[3000] bg-transparent flex flex-col h-screen w-screen font-sans">
            
            {/* --- NOTIFICACIÓN (TOAST) --- */}
            {notification.show && (
                <div className="absolute top-20 left-0 right-0 z-[3100] flex justify-center px-4 animate-[slideDown_0.4s_ease-out]">
                    <div className={`shadow-2xl border-l-4 rounded-xl p-4 flex items-start gap-3 backdrop-blur-md w-full max-w-xs transition-all duration-300 ${
                        notification.type === 'success' 
                            ? 'bg-white/95 border-green-500 text-gray-800' 
                            : 'bg-white/95 border-red-500 text-gray-800'
                    }`}>
                        <div className="shrink-0 mt-0.5">
                            {notification.type === 'success' ? (
                                <CheckCircle2 className="text-green-500" size={20} />
                            ) : (
                                <AlertTriangle className="text-red-500" size={20} />
                            )}
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-sm font-bold font-sans ${notification.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {notification.type === 'success' ? '¡Éxito!' : 'Error'}
                            </h4>
                            <p className="text-sm text-gray-600 font-medium leading-tight mt-0.5 font-sans">
                                {notification.message}
                            </p>
                        </div>
                        <button onClick={() => setNotification(prev => ({...prev, show: false}))} className="text-gray-400 hover:text-gray-600">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* BARRA SUPERIOR */}
            <div className="absolute top-0 left-0 right-0 z-50 p-4 pt-12 pointer-events-none">
                <div className={`flex items-center gap-2 pointer-events-auto transition-opacity duration-300 ${isLocating ? 'opacity-80 pointer-events-none' : 'opacity-100'}`}>
                    
                    {/* BOTÓN ATRÁS */}
                    <button 
                        onClick={onClose} 
                        disabled={isLocating}
                        className="p-3 rounded-full shadow-xl text-gray-700 active:scale-95 transition border border-gray-100 bg-white" 
                    >
                        <ArrowLeft size={24} />
                    </button>

                    {/* BUSCADOR */}
                    <div className="flex-1 rounded-full shadow-xl flex items-center px-4 py-3 border border-gray-100 relative bg-white">
                        <Search size={20} className="text-gray-400 mr-2" />
                        <input
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={isLocating ? "Obteniendo GPS..." : "Buscar calle o zona..."}
                            disabled={isLocating}
                            className="w-full outline-none text-sm font-medium text-gray-700 bg-transparent placeholder-gray-400 disabled:text-gray-400 font-sans"
                        />
                        {/* LOADER NARANJA */}
                        {isGeocoding && <Loader2 size={16} className="animate-spin text-orange-600 ml-2" />}
                    </div>
                </div>

                {/* SUGERENCIAS */}
                {suggestions.length > 0 && !isLocating && (
                    <div className="mt-2 mx-2 rounded-2xl shadow-2xl border border-gray-100 pointer-events-auto overflow-hidden flex flex-col max-h-60 bg-white">
                        <div className="overflow-y-auto">
                            {suggestions.map((item, idx) => (
                                // HOVER NARANJA
                                <div key={idx} onClick={() => selectSuggestion(item)} className="p-4 border-b border-gray-50 hover:bg-orange-50 active:bg-orange-100 transition flex items-center gap-3 text-sm text-gray-700 cursor-pointer font-sans">
                                    <MapIcon size={16} className="text-gray-400 shrink-0" />
                                    <span className="truncate font-medium">
                                        {item.display_name.split(',')[0]} 
                                        <span className="text-xs text-gray-400 font-normal block truncate font-sans">
                                            {item.display_name}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MAPA */}
            <div className="flex-1 relative">
                <capacitor-google-map
                    ref={mapRef}
                    style={{ display: 'block', width: '100%', height: '100%' }}
                ></capacitor-google-map>

                {/* PIN CENTRAL */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center pb-[38px] z-10">
                    <div className="px-4 py-2 rounded-full shadow-2xl text-xs font-bold mb-2 border border-gray-100 whitespace-nowrap max-w-[240px] truncate flex items-center gap-2 animate-bounce-small bg-white text-gray-800 font-sans">
                        <div className={`w-2 h-2 rounded-full ${isGeocoding || isLocating ? 'bg-gray-300 animate-pulse' : 'bg-green-500'}`}></div>
                        {isLocating ? "Buscando GPS..." : (address || "Mueve el mapa")}
                    </div>
                    {/* PIN NARANJA */}
                    <MapPin size={48} className={`drop-shadow-2xl fill-current transition-colors duration-300 ${isLocating ? 'text-gray-400' : 'text-orange-600'}`} />
                    <div className="w-3 h-1.5 bg-black/20 rounded-[100%] blur-[2px]"></div>
                </div>

                {/* BOTÓN UBICACIÓN ACTUAL */}
                <button
                    onClick={locateMe}
                    disabled={isLocating}
                    // RING NARANJA
                    className={`absolute bottom-32 right-6 p-3 rounded-full shadow-xl text-gray-700 z-50 border border-gray-100 flex items-center justify-center transition-all bg-white ${isLocating ? 'scale-110 ring-4 ring-orange-100' : 'active:scale-95'}`}
                    style={{ width: '50px', height: '50px' }}
                >
                    {isLocating ? (
                        <Loader2 size={24} className="animate-spin text-orange-600" />
                    ) : (
                        <Crosshair size={24} className="text-blue-600" />
                    )}
                </button>

                {/* BOTÓN CONFIRMAR */}
                <div className="absolute bottom-8 left-6 right-6 z-50">
                    <button
                        onClick={confirmSelection}
                        disabled={isLocating || !address} 
                        // BOTÓN NARANJA
                        className={`w-full text-white font-bold py-4 rounded-2xl shadow-2xl active:scale-95 flex justify-center items-center gap-2 border-2 border-white/20 transition-all duration-300 font-sans
                            ${(isLocating || !address) ? 'bg-gray-400 cursor-not-allowed grayscale opacity-80 scale-100' : 'bg-orange-600 shadow-orange-500/40 hover:bg-orange-700'}
                        `}
                    >
                        {isLocating ? (
                            <> <Loader2 size={20} className="animate-spin" /> Esperando GPS... </>
                        ) : (
                            <> <CheckCircle size={20} /> Confirmar Ubicación </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}