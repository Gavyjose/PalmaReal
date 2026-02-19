import React, { useState, useEffect } from 'react';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { supabase } from '../supabase';
import { formatNumber } from '../utils/formatters';

const Settings = () => {
    const [buildingData, setBuildingData] = useState({
        name: BUILDING_CONFIG.fullName,
        rif: BUILDING_CONFIG.rif,
        address: BUILDING_CONFIG.address
    });

    const [bcvRate, setBcvRate] = useState(null);
    const [loadingRate, setLoadingRate] = useState(false);

    useEffect(() => {
        fetchCurrentRate();
    }, []);

    const fetchCurrentRate = async () => {
        try {
            setLoadingRate(true);
            const { data, error } = await supabase
                .from('exchange_rates')
                .select('*')
                .order('rate_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) setBcvRate(data);
        } catch (error) {
            console.error('Error fetching rate:', error);
        } finally {
            setLoadingRate(false);
        }
    };

    const handleUpdateRate = async () => {
        try {
            setLoadingRate(true);
            // 1. Obtener tasa de DolarAPI (Especializada en Venezuela)
            // Se usa el endpoint 'oficial' que representa al BCV
            const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            if (!response.ok) throw new Error(`Error al conectar con la fuente (Status: ${response.status})`);

            const data = await response.json();

            // Priorizamos 'promedio' o 'venta' según lo que devuelva la API
            const rate = parseFloat(data.promedio || data.venta);

            // La API devuelve fecha en ISO, extraemos YYYY-MM-DD
            const rateDate = data.fechaActualizacion.split('T')[0];

            if (!rate || isNaN(rate)) throw new Error('Dato de tasa inválido en la respuesta');

            // 2. Guardar en Supabase (Upsert para no duplicar si ya existe la fecha/proveedor)
            const { error: upsertError } = await supabase
                .from('exchange_rates')
                .upsert({
                    rate_date: rateDate,
                    rate_value: rate,
                    provider: 'BCV', // Proveedor consistente con el scraper
                    metadata: { source: 'DolarAPI/Manual', raw_response: data }
                }, { onConflict: 'rate_date,provider' });

            if (upsertError) throw upsertError;

            // 3. Refrescar UI
            await fetchCurrentRate();
            alert(`✅ Tasa actualizada correctamente:\nBs. ${formatNumber(rate)} (${rateDate})`);

        } catch (error) {
            console.error('Error forzando actualización:', error);
            alert('❌ Error al actualizar tasa: ' + error.message);
        } finally {
            setLoadingRate(false);
        }
    };

    const handleSaveBuilding = (e) => {
        e.preventDefault();
        alert('Funcionalidad de guardar configuración en desarrollo. (Requiere backend)');
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Configuración del Sistema</h1>
                <p className="text-slate-500 text-sm mt-1">Gestione los parámetros globales de la aplicación.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tarjeta: Datos del Edificio */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-icons text-primary">domain</span>
                            Perfil del Edificio
                        </h2>
                    </div>
                    <div className="p-6">
                        <form onSubmit={handleSaveBuilding} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Conjunto</label>
                                <input
                                    type="text"
                                    value={buildingData.name}
                                    onChange={e => setBuildingData({ ...buildingData, name: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RIF / Identificación Fiscal</label>
                                <input
                                    type="text"
                                    value={buildingData.rif}
                                    onChange={e => setBuildingData({ ...buildingData, rif: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección Fiscal</label>
                                <textarea
                                    rows="3"
                                    value={buildingData.address}
                                    onChange={e => setBuildingData({ ...buildingData, address: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-primary transition-colors resize-none"
                                />
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase rounded-lg hover:opacity-90 transition-opacity">
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Tarjeta: Tasa de Cambio */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-icons text-green-600">currency_exchange</span>
                            Tasa de Cambio BCV
                        </h2>
                        <button
                            onClick={handleUpdateRate}
                            disabled={loadingRate}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                            <span className={`material-icons text-xs ${loadingRate ? 'animate-spin' : ''}`}>refresh</span>
                            {loadingRate ? 'Sincronizando...' : 'Actualizar'}
                        </button>
                    </div>
                    <div className="p-6 flex flex-col items-center justify-center text-center">
                        <p className="text-sm text-slate-500 font-medium mb-2 uppercase tracking-wide">Tasa Actual del Sistema</p>
                        {loadingRate ? (
                            <div className="h-12 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                        ) : (
                            <>
                                <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                    Bs. {bcvRate ? formatNumber(bcvRate.rate_value) : '--,--'}
                                </p>
                                <p className="text-xs text-slate-400 mt-2 font-mono">
                                    Última actualización: {bcvRate ? new Date(bcvRate.rate_date).toLocaleDateString('es-VE') : 'Desconocida'}
                                </p>
                            </>
                        )}

                        <div className="mt-8 w-full p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg text-left">
                            <div className="flex gap-3">
                                <span className="material-icons text-yellow-600 text-sm mt-0.5">info</span>
                                <div>
                                    <p className="text-xs font-bold text-yellow-800 dark:text-yellow-200 uppercase mb-1">Sincronización Automática</p>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300/80 leading-relaxed">
                                        El sistema intenta obtener la tasa oficial del BCV automáticamente todos los días a las 6:00 PM.
                                        Si la tasa mostrada es incorrecta, puede forzar una actualización manual ejecutando el script en el servidor.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tarjeta: Preferencias del Sistema (Placeholder) */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden opacity-50">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-icons text-slate-400">tune</span>
                            Preferencias de Facturación
                        </h2>
                    </div>
                    <div className="p-6 text-center text-slate-400 text-sm italic">
                        Funcionalidades avanzadas próximamente (Día de corte, Fondo de reserva dinámico).
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
