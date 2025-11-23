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

    const locateMe = async () => {
        if (isLocating) return;
        
        setIsLocating(true);
        
        try {
            const permissionStatus = await Geolocation.checkPermissions();
            if (permissionStatus.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') throw new Error("Permiso denegado");
            }

            const coordinates = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 3000
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
            alert("No pudimos ubicarte. Verifica tu GPS.");
        } finally {
            setIsLocating(false);
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
                <div className={`flex items-center gap-2 pointer-events-auto transition-opacity duration-300 ${isLocating ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    
                    {/* BOTÓN ATRÁS (Bloqueado si carga) */}
                    <button 
                        onClick={onClose} 
                        disabled={isLocating}
                        className="p-3 rounded-full shadow-xl text-gray-700 active:scale-95 transition border border-gray-100 bg-white" 
                        style={{ backgroundColor: 'white' }}
                    >
                        <ArrowLeft size={24} />
                    </button>

                    {/* BUSCADOR (Bloqueado si carga) */}
                    <div className="flex-1 rounded-full shadow-xl flex items-center px-4 py-3 border border-gray-100 relative bg-white" style={{ backgroundColor: 'white' }}>
                        <Search size={20} className="text-gray-400 mr-2" />
                        <input
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={isLocating ? "Obteniendo GPS..." : "Buscar calle o zona..."}
                            disabled={isLocating}
                            className="w-full outline-none text-sm font-medium text-gray-700 bg-transparent placeholder-gray-400 disabled:text-gray-400"
                        />
                        {isGeocoding && <Loader2 size={16} className="animate-spin text-orange-600 ml-2" />}
                    </div>
                </div>

                {suggestions.length > 0 && !isLocating && (
                    <div className="mt-2 mx-2 rounded-2xl shadow-2xl border border-gray-100 pointer-events-auto overflow-hidden flex flex-col max-h-60 bg-white" style={{ backgroundColor: 'white' }}>
                        <div className="overflow-y-auto">
                            {suggestions.map((item, idx) => (
                                <div key={idx} onClick={() => selectSuggestion(item)} className="p-4 border-b border-gray-50 hover:bg-orange-50 active:bg-orange-100 transition flex items-center gap-3 text-sm text-gray-700">
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
                    <div className="px-4 py-2 rounded-full shadow-2xl text-xs font-bold mb-2 border border-gray-100 whitespace-nowrap max-w-[240px] truncate flex items-center gap-2 animate-bounce-small bg-white" style={{ backgroundColor: 'white' }}>
                        <div className={`w-2 h-2 rounded-full ${isGeocoding || isLocating ? 'bg-gray-300 animate-pulse' : 'bg-green-500'}`}></div>
                        {isLocating ? "Buscando GPS..." : (address || "Ubicando...")}
                    </div>
                    <MapPin size={44} className={`drop-shadow-2xl fill-current transition-colors duration-300 ${isLocating ? 'text-gray-400' : 'text-orange-600'}`} />
                    <div className="w-3 h-1.5 bg-black/20 rounded-[100%] blur-[2px]"></div>
                </div>

                {/* BOTÓN UBICACIÓN ACTUAL */}
                <button
                    onClick={locateMe}
                    disabled={isLocating}
                    className={`absolute bottom-28 right-6 p-3 rounded-full shadow-xl text-gray-700 z-50 border border-gray-100 flex items-center justify-center transition-all bg-white ${isLocating ? 'scale-110 ring-4 ring-orange-100' : 'active:scale-95'}`}
                    style={{ backgroundColor: 'white', width: '50px', height: '50px' }}
                >
                    {isLocating ? (
                        <Loader2 size={24} className="animate-spin text-orange-600" />
                    ) : (
                        <Crosshair size={24} />
                    )}
                </button>

                {/* BOTÓN CONFIRMAR (Bloqueado si carga) */}
                <div className="absolute bottom-8 left-6 right-6 z-50">
                    <button
                        onClick={confirmSelection}
                        disabled={isLocating || !address} // Se bloquea si carga o no hay dirección
                        className={`w-full text-white font-bold py-4 rounded-2xl shadow-2xl active:scale-95 flex justify-center items-center gap-2 border-2 border-white/20 transition-all duration-300
                            ${isLocating ? 'bg-gray-400 cursor-not-allowed grayscale opacity-80 scale-100' : 'bg-orange-600 shadow-orange-500/40'}
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