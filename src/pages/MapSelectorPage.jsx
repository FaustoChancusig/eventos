import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation'; 
import { ArrowLeft, MapPin, Search, Crosshair, Loader2, CheckCircle, Map as MapIcon } from 'lucide-react';

export default function MapSelectorPage({ onClose, onConfirm, initialLat, initialLng }) {
    const mapRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [address, setAddress] = useState('');
    const [currentCenter, setCurrentCenter] = useState({
        lat: initialLat || -0.1807,
        lng: initialLng || -78.4678
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isGeocoding, setIsGeocoding] = useState(false);
    
    // 🆕 ESTADO PARA EL BOTÓN DE GPS
    const [isLocating, setIsLocating] = useState(false);

    // CSS Transparencia
    useEffect(() => {
        document.body.classList.add('transparent-body');
        document.documentElement.classList.add('transparent-body');
        return () => {
            document.body.classList.remove('transparent-body');
            document.documentElement.classList.remove('transparent-body');
            if (mapInstance) mapInstance.destroy();
        };
    }, [mapInstance]);

    useEffect(() => {
        const createMap = async () => {
            if (!mapRef.current) return;
            try {
                const newMap = await GoogleMap.create({
                    id: 'google-map-selector',
                    element: mapRef.current,
                    apiKey: 'TU_API_KEY_AQUI', 
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

                    setIsGeocoding(true);
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
                        const data = await res.json();
                        if (data?.display_name) {
                            const shortName = data.address.road || data.address.suburb || data.display_name.split(',')[0];
                            setAddress(shortName);
                        }
                    } catch (e) {
                        setAddress("Ubicación seleccionada");
                    } finally {
                        setIsGeocoding(false);
                    }
                });

                setMapInstance(newMap);
            } catch (e) {
                console.error("Error creando mapa", e);
            }
        };
        setTimeout(createMap, 200);
    }, []);

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

    // --- 🆕 UBICACIÓN ACTUAL MEJORADA ---
    const locateMe = async () => {
        // 1. Evitamos clicks múltiples si ya está cargando
        if (isLocating) return;
        
        setIsLocating(true); // Activamos el spinner
        
        try {
            // 2. VERIFICACIÓN SILENCIOSA
            // Esto NO muestra nada al usuario, solo pregunta al sistema.
            const permissionStatus = await Geolocation.checkPermissions();
            
            // Solo si NO tenemos permiso, entramos aquí
            if (permissionStatus.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                // Si el usuario dice que NO en la ventana emergente, lanzamos error
                if (request.location !== 'granted') {
                    throw new Error("Permiso denegado");
                }
            }

            // 3. OBTENER COORDENADAS
            // Si llegamos aquí, es porque ya tenemos permiso (nuevo o antiguo).
            // Android no molestará al usuario.
            const coordinates = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true, // Usa el GPS real (más preciso)
                timeout: 10000,           // Espera hasta 10 seg si la señal es débil (evita el error rápido)
                maximumAge: 3000          // Si ya buscó hace poco, usa ese dato (más rápido)
            });

            const { latitude, longitude } = coordinates.coords;

            // Mover la cámara
            if (mapInstance) {
                await mapInstance.setCamera({
                    coordinate: { lat: latitude, lng: longitude },
                    zoom: 17,
                    animate: true
                });
            }

        } catch (error) {
            console.error("Error GPS:", error);
            // Tip: A veces el error no es de permisos, sino que el GPS está apagado
            alert("No pudimos ubicarte. Verifica que tu GPS esté encendido y tengas señal.");
        } finally {
            setIsLocating(false); // Apagamos el spinner pase lo que pase
        }
    };

    const confirmSelection = () => {
        onConfirm({
            lat: currentCenter.lat,
            lng: currentCenter.lng,
            address: address
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[3000] bg-transparent flex flex-col h-screen w-screen">
            
            {/* BARRA SUPERIOR */}
            <div className="absolute top-0 left-0 right-0 z-50 p-4 pt-12 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                    {/* FORZAMOS FONDO BLANCO CON STYLE PARA QUE NO FALLE */}
                    <button onClick={onClose} className="p-3 rounded-full shadow-xl text-gray-700 active:scale-95 transition border border-gray-100" style={{ backgroundColor: 'white' }}>
                        <ArrowLeft size={24} />
                    </button>

                    <div className="flex-1 rounded-full shadow-xl flex items-center px-4 py-3 border border-gray-100 relative" style={{ backgroundColor: 'white' }}>
                        <Search size={20} className="text-gray-400 mr-2" />
                        <input
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Buscar calle o zona..."
                            className="w-full outline-none text-sm font-medium text-gray-700 bg-transparent placeholder-gray-400"
                        />
                        {isGeocoding && <Loader2 size={16} className="animate-spin text-purple-600 ml-2" />}
                    </div>
                </div>

                {/* SUGERENCIAS BLANCAS SÓLIDAS */}
                {suggestions.length > 0 && (
                    <div className="mt-2 mx-2 rounded-2xl shadow-2xl border border-gray-100 pointer-events-auto overflow-hidden flex flex-col max-h-60" style={{ backgroundColor: 'white' }}>
                        <div className="overflow-y-auto">
                            {suggestions.map((item, idx) => (
                                <div key={idx} onClick={() => selectSuggestion(item)} className="p-4 border-b border-gray-50 hover:bg-purple-50 active:bg-purple-100 transition flex items-center gap-3 text-sm text-gray-700">
                                    <MapIcon size={16} className="text-gray-400 shrink-0" />
                                    <span className="truncate font-medium">{item.display_name.split(',')[0]} <span className="text-xs text-gray-400 font-normal block">{item.display_name.split(',').slice(1).join(',')}</span></span>
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
                    <div className="px-4 py-2 rounded-full shadow-2xl text-xs font-bold mb-2 border border-gray-100 whitespace-nowrap max-w-[240px] truncate flex items-center gap-2 animate-bounce-small" style={{ backgroundColor: 'white' }}>
                        <div className={`w-2 h-2 rounded-full ${isGeocoding ? 'bg-gray-300 animate-pulse' : 'bg-green-500'}`}></div>
                        {address || "Ubicando..."}
                    </div>
                    <MapPin size={44} className="text-purple-600 drop-shadow-2xl fill-current" />
                    <div className="w-3 h-1.5 bg-black/20 rounded-[100%] blur-[2px]"></div>
                </div>

                {/* 🆕 BOTÓN UBICACIÓN ACTUAL CON CARGA */}
                <button
                    onClick={locateMe}
                    disabled={isLocating} // Deshabilita mientras carga
                    className="absolute bottom-28 right-6 p-3 rounded-full shadow-xl text-gray-700 z-50 active:scale-95 border border-gray-100 flex items-center justify-center transition-all"
                    style={{ backgroundColor: 'white', width: '50px', height: '50px' }}
                >
                    {isLocating ? (
                        <Loader2 size={24} className="animate-spin text-purple-600" />
                    ) : (
                        <Crosshair size={24} />
                    )}
                </button>

                {/* BOTÓN CONFIRMAR */}
                <div className="absolute bottom-8 left-6 right-6 z-50">
                    <button
                        onClick={confirmSelection}
                        className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl shadow-2xl shadow-purple-500/40 active:scale-95 flex justify-center items-center gap-2 border-2 border-white/20 transition-transform"
                    >
                        <CheckCircle size={20} /> Confirmar Ubicación
                    </button>
                </div>
            </div>
        </div>
    );
}