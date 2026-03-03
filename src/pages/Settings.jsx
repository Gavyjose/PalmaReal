import React, { useState, useEffect } from 'react';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { supabase } from '../supabase';
import { formatNumber } from '../utils/formatters';
import { usePermissions } from '../hooks/usePermissions';
import UserManagement from '../components/settings/UserManagement';

const Settings = () => {
    const { isMaster, loading: permissionsLoading } = usePermissions();
    const [activeTab, setActiveTab] = useState('building'); // 'building' | 'users'
    const [buildingData, setBuildingData] = useState({
        id: null,
        header_fullname: BUILDING_CONFIG.fullName,
        header_address: BUILDING_CONFIG.address,
        bank_name: '',
        account_number: '',
        account_holder: '',
        pm_bank_code: '',
        pm_id: '',
        pm_phone: '',
        tower_name_prefix: 'Torre Araguaney'
    });

    const [bcvRate, setBcvRate] = useState(null);
    const [loadingRate, setLoadingRate] = useState(false);

    useEffect(() => {
        fetchCurrentRate();
        fetchBuildingSettings();
    }, []);

    const fetchBuildingSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('building_settings')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (data) {
                setBuildingData(data);
            }
        } catch (error) {
            console.error('Error fetching building settings:', error);
        }
    };

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
        alert('La sincronización de la tasa oficial ahora está totalmente automatizada mediante Inteligencia Artificial (OCR) conectada al canal de Telegram oficial del BCV.\n\nEl sistema busca y carga la tasa todos los días hábiles a las 6:00 PM.');
    };

    const handleSaveBuilding = async (e) => {
        e.preventDefault();
        try {
            const { id, updated_at, ...dataToSave } = buildingData;

            if (id) {
                const { error } = await supabase
                    .from('building_settings')
                    .update({ ...dataToSave, updated_at: new Date().toISOString() })
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('building_settings')
                    .insert([{ ...dataToSave }]);
                if (error) throw error;
            }
            alert('Configuración actualizada exitosamente');
            fetchBuildingSettings();
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error al guardar: ' + error.message);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 relative">
            {/* Elementos Decorativos de Fondo */}
            <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 left-0 -z-10 w-96 h-96 bg-teal-500/10 blur-[120px] rounded-full"></div>

            <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-display-black uppercase tracking-widest">Panel de Control</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-emerald-100 to-transparent dark:from-emerald-900/30"></div>
                </div>
                <h1 className="text-4xl md:text-5xl font-display-black text-slate-900 dark:text-white mb-3 tracking-tight">
                    Configuración <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Premium</span>
                </h1>

                {/* Tabs de Navegación */}
                <div className="flex items-center gap-4 mt-8">
                    <button
                        onClick={() => setActiveTab('building')}
                        className={`px-6 py-3 rounded-2xl font-display-bold text-sm transition-all duration-300 flex items-center gap-2 ${activeTab === 'building'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-white/40 dark:bg-slate-900/40 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/60'}`}
                    >
                        <span className="material-icons text-lg">domain</span>
                        Edificio
                    </button>
                    {isMaster && (
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-6 py-3 rounded-2xl font-display-bold text-sm transition-all duration-300 flex items-center gap-2 ${activeTab === 'users'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-white/40 dark:bg-slate-900/40 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/60'}`}
                        >
                            <span className="material-icons text-lg">admin_panel_settings</span>
                            Usuarios y Permisos
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'building' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
                    {/* Perfil del Edificio - Col 7 */}
                    <div className="lg:col-span-7 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white dark:border-slate-800 shadow-2xl shadow-emerald-500/5 overflow-hidden">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/10">
                            <h2 className="text-xl font-display-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                    <span className="material-icons text-emerald-600">domain</span>
                                </div>
                                Perfil del Edificio
                            </h2>
                        </div>
                        <div className="p-8">
                            <form onSubmit={handleSaveBuilding} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nombre en Cabecera</label>
                                        <input
                                            type="text"
                                            value={buildingData.header_fullname}
                                            onChange={e => setBuildingData({ ...buildingData, header_fullname: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">Prefijo de Torre</label>
                                        <input
                                            type="text"
                                            value={buildingData.tower_name_prefix}
                                            onChange={e => setBuildingData({ ...buildingData, tower_name_prefix: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
                                            placeholder="Ej: Torre Araguaney"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">Dirección en Cabecera</label>
                                    <textarea
                                        rows="1"
                                        value={buildingData.header_address}
                                        onChange={e => setBuildingData({ ...buildingData, header_address: e.target.value })}
                                        className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-3 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm resize-none"
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
                                    <h3 className="text-xs font-display-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <span className="material-icons text-sm">account_balance</span> Datos de Facturación / Pago
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">Banco</label>
                                            <input
                                                type="text"
                                                value={buildingData.bank_name}
                                                onChange={e => setBuildingData({ ...buildingData, bank_name: e.target.value })}
                                                className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">Número de Cuenta</label>
                                            <input
                                                type="text"
                                                value={buildingData.account_number}
                                                onChange={e => setBuildingData({ ...buildingData, account_number: e.target.value })}
                                                className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">Titular de la Cuenta</label>
                                            <input
                                                type="text"
                                                value={buildingData.account_holder}
                                                onChange={e => setBuildingData({ ...buildingData, account_holder: e.target.value })}
                                                className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">PM Banco (4 dígitos)</label>
                                            <input
                                                type="text"
                                                value={buildingData.pm_bank_code}
                                                onChange={e => setBuildingData({ ...buildingData, pm_bank_code: e.target.value })}
                                                className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                placeholder="Ej: 0102"
                                                maxLength={4}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">PM Cédula / RIF</label>
                                            <input
                                                type="text"
                                                value={buildingData.pm_id}
                                                onChange={e => setBuildingData({ ...buildingData, pm_id: e.target.value })}
                                                className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                placeholder="V-12345678"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] ml-2">PM Celular</label>
                                            <input
                                                type="text"
                                                value={buildingData.pm_phone}
                                                onChange={e => setBuildingData({ ...buildingData, pm_phone: e.target.value })}
                                                className="w-full bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-display-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                placeholder="04121234567"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6">
                                    <button type="submit" className="w-full md:w-auto px-10 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl font-display-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3">
                                        <span className="material-icons text-sm">save_as</span>
                                        Actualizar Parámetros Globales
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Tasa de Cambio & Prefs - Col 5 */}
                    <div className="lg:col-span-5 space-y-8">
                        {/* Tarjeta: Tasa de Cambio */}
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-emerald-500/20 overflow-hidden relative group">
                            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 text-white"></div>

                            <div className="flex justify-between items-start mb-10 relative">
                                <div>
                                    <h3 className="font-display-black text-[10px] uppercase tracking-[0.3em] opacity-80 mb-2 text-white">Activo Financiero</h3>
                                    <h2 className="text-2xl font-display-bold flex items-center gap-2 text-white">
                                        Tasa de Cambio <span className="material-icons opacity-50">api</span>
                                    </h2>
                                </div>
                                <button
                                    onClick={handleUpdateRate}
                                    className="w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl flex items-center justify-center transition-all active:scale-90"
                                    title="Información de Sincronización"
                                >
                                    <span className={`material-icons text-xl text-white`}>info_outline</span>
                                </button>
                            </div>

                            <div className="flex flex-col items-center justify-center py-6 relative">
                                {loadingRate ? (
                                    <div className="h-16 w-48 bg-white/20 rounded-2xl animate-pulse"></div>
                                ) : (
                                    <>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-display-medium opacity-60 text-white">Bs.</span>
                                            <span className="text-6xl font-display-black tracking-tighter text-white">
                                                {bcvRate ? formatNumber(bcvRate.rate_value) : '--,--'}
                                            </span>
                                        </div>
                                        <div className="mt-4 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-display-bold uppercase tracking-wider text-white">
                                            BCV Oficial • {bcvRate ? new Date(bcvRate.rate_date).toLocaleDateString('es-VE') : 'PENDIENTE'}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="mt-8 pt-8 border-t border-white/10 flex flex-col gap-2 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center shrink-0">
                                        <span className="material-icons text-[10px] text-emerald-900">smart_toy</span>
                                    </div>
                                    <p className="text-[10px] font-display-black uppercase tracking-widest opacity-90 text-white">
                                        Scraping Automático Inteligente
                                    </p>
                                </div>
                                <div className="pl-9">
                                    <p className="text-[10px] font-display-medium leading-relaxed opacity-70 text-white/90">
                                        Sincronización activa: Lunes a Viernes • 18:00 HRS.
                                        <br />Fuente Neural: Telegram @DolarOficialBCV
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tarjeta: Preferencias (Muro Estilo) */}
                        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white dark:border-slate-800 shadow-xl shadow-slate-500/5 opacity-80">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="material-icons text-slate-400">tune</span>
                                </div>
                                <h3 className="font-display-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Avanzado</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[11px] font-display-medium text-slate-500 dark:text-slate-400 leading-relaxed italic">
                                        Facturación automática, gestión de multas por mora y reportes inteligentes próximamente en la v2.0
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <UserManagement />
            )}
        </div>
    );
};

export default Settings;
