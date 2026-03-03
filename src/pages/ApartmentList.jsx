import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { sortUnits } from '../utils/unitSort';

const fetchDirectoryData = async () => {
    const [unitsRes, ownersRes] = await Promise.all([
        supabase.from('units').select('*, owners(full_name)'),
        supabase.from('owners').select('id, full_name, doc_id').order('full_name')
    ]);
    return {
        units: sortUnits(unitsRes.data || []),
        owners: ownersRes.data || []
    };
};

const ApartmentList = () => {
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [tower, setTower] = useState('A1');
    const [floor, setFloor] = useState('PB');
    const [number, setNumber] = useState('');
    const [ownerId, setOwnerId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isNewOwner, setIsNewOwner] = useState(false);
    const [newOwnerData, setNewOwnerData] = useState({ full_name: '', doc_id: '', email: '', phone: '' });

    const { data: directoryData, isLoading: isDataLoading, mutate: mutateDirectory } = useSWR('directoryData', fetchDirectoryData);
    const units = directoryData?.units || [];
    const ownersList = directoryData?.owners || [];

    const { towers, activeTowers, toggleTowerStatus, loading: towersLoading, lastSelectedTower, setLastSelectedTower } = useTowers();
    const [selectedTower, setSelectedTower] = useState(lastSelectedTower || '');
    const [showTowerModal, setShowTowerModal] = useState(false);

    // Set initial selected tower when towers are loaded
    useEffect(() => {
        if (activeTowers.length > 0 && !selectedTower) {
            const defaultTower = activeTowers.find(t => t.name === lastSelectedTower)?.name || activeTowers[0].name;
            setSelectedTower(defaultTower);
            setTower(defaultTower);
            if (!lastSelectedTower) setLastSelectedTower(defaultTower);
        }
    }, [activeTowers, selectedTower, lastSelectedTower, setLastSelectedTower]);

    const loading = isDataLoading || towersLoading || creating;

    const handleDeleteUnit = async (id) => {
        try {
            setCreating(true);
            const { error } = await supabase
                .from('units')
                .delete()
                .eq('id', id);

            if (error) throw error;
            mutateDirectory();
        } catch (error) {
            console.error('Error deleting unit:', error);
            alert('Error al eliminar el apartamento');
        } finally {
            setCreating(false);
        }
    };

    const handleEditUnit = (unit) => {
        setTower(unit.tower);
        setFloor(unit.floor);
        const parts = unit.number.split('-');
        // If format is like "1-A", parts[1] is "A". If PB-A, parts[1] is "A".
        setNumber(parts.length > 1 ? parts[1] : '');
        setOwnerId(unit.owner_id);
        setEditingId(unit.id);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingId(null);
        setTower('A1');
        setFloor('PB');
        setNumber('');
        setOwnerId(null);
        setIsNewOwner(false);
        setNewOwnerData({ full_name: '', doc_id: '', email: '', phone: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tower || !floor || !number) return;
        if (isNewOwner && !newOwnerData.full_name) {
            alert('El nombre del nuevo propietario es obligatorio.');
            return;
        }

        // Construct unit identifier, e.g., "3-D" or "PB-A"
        // 'number' state currently holds the Letter (A, B, C, D)
        const fullUnitNumber = `${floor}-${number}`;

        try {
            setCreating(true);
            let finalOwnerId = ownerId;

            if (isNewOwner) {
                const { data: newOwnerRes, error: ownerError } = await supabase
                    .from('owners')
                    .insert([{
                        full_name: newOwnerData.full_name.toUpperCase(),
                        doc_id: newOwnerData.doc_id.toUpperCase(),
                        email: newOwnerData.email,
                        phone: newOwnerData.phone
                    }])
                    .select()
                    .single();

                if (ownerError) throw new Error('Error al crear el propietario: ' + ownerError.message);
                finalOwnerId = newOwnerRes.id;
            }

            if (editingId) {
                const { data, error } = await supabase
                    .from('units')
                    .update({
                        tower,
                        floor,
                        number: fullUnitNumber,
                        owner_id: finalOwnerId
                    })
                    .eq('id', editingId)
                    .select(); // Return data to verify

                if (error) throw error;
                if (!data || data.length === 0) throw new Error('No se pudo actualizar (posible error de permisos)');
            } else {
                const { error } = await supabase
                    .from('units')
                    .insert([{
                        tower,
                        floor,
                        number: fullUnitNumber,
                        owner_id: finalOwnerId
                    }]);
                if (error) throw error;
            }

            handleCloseModal();
            mutateDirectory();
            // alert('Operación exitosa'); // Optional: feedback
        } catch (error) {
            console.error('Error saving unit:', error);
            alert(error.message || 'Error al guardar el apartamento');
        } finally {
            setCreating(false);
        }
    };

    // Group units by floor for the selected tower
    const unitsByFloor = units
        .filter(u => u.tower === selectedTower)
        .reduce((acc, unit) => {
            if (!acc[unit.floor]) acc[unit.floor] = [];
            acc[unit.floor].push(unit);
            return acc;
        }, {});

    const floorOrder = { 'PB': 0, '1': 1, '2': 2, '3': 3 };
    const sortedFloors = Object.keys(unitsByFloor).sort((a, b) => floorOrder[a] - floorOrder[b]);

    return (
        <div className="max-w-[1600px] mx-auto p-4 lg:p-8 pb-32 font-display">
            {/* Header - Social VIVO Premium */}
            <div className="relative mb-12 animate-fade-in text-left">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 relative z-10">
                    <div className="space-y-4">
                        <nav className="flex items-center gap-3 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400">
                            <Link to="/admin" className="hover:text-emerald-500 transition-colors">Inicio</Link>
                            <span className="material-icons text-[10px]">chevron_right</span>
                            <span className="text-emerald-500">Comunidad</span>
                            <span className="material-icons text-[10px]">chevron_right</span>
                            <span className="text-slate-900 dark:text-white">Apartamentos</span>
                        </nav>
                        <div className="flex items-center gap-6">
                            <div className="w-2 h-12 bg-gradient-to-b from-emerald-400 to-teal-600 rounded-full shadow-lg shadow-emerald-500/20"></div>
                            <div>
                                <h1 className="text-5xl font-display-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">
                                    Directorio <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">Unidades</span>
                                </h1>
                                <p className="text-xs font-display-medium text-slate-500 uppercase tracking-[0.3em]">Maestro de Inmuebles y Asignación</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowTowerModal(true)}
                            className="group relative px-6 py-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 text-slate-900 dark:text-white rounded-2xl font-display-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-all active:scale-95 flex items-center gap-2"
                        >
                            <span className="material-icons text-lg">settings</span>
                            <span>Torres</span>
                        </button>
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setTower(selectedTower);
                                setFloor('PB');
                                setNumber('');
                                setShowModal(true);
                            }}
                            className="group relative px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
                        >
                            <span className="material-icons text-lg">add_location</span>
                            <span>Nueva Unidad</span>
                        </button>
                    </div>
                </div>
                {/* Decorative background element */}
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-emerald-500/5 blur-[100px] -z-10 rounded-full"></div>
            </div>

            {/* Tower Selection - Social Tab System */}
            <div className="relative mb-12 group/tabs animate-fade-in text-left">
                <div className="absolute inset-0 bg-emerald-500/5 blur-3xl opacity-0 group-hover/tabs:opacity-100 transition-opacity"></div>
                <div className="relative flex flex-wrap gap-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-3xl p-2 shadow-2xl overflow-hidden">
                    {activeTowers.map(t => (
                        <button
                            key={t.name}
                            onClick={() => {
                                setSelectedTower(t.name);
                                setLastSelectedTower(t.name);
                            }}
                            className={`px-8 py-3 rounded-2xl font-display-black text-[10px] uppercase tracking-[0.25em] transition-all relative overflow-hidden ${selectedTower === t.name
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/30'
                                : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/5'
                                }`}
                        >
                            {selectedTower === t.name && (
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            )}
                            <span className="relative z-10">Torre {t.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid of Apartments - Social Board Style */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-[10px] font-display-black uppercase tracking-[0.3em] text-slate-400">Sincronizando Unidades...</p>
                </div>
            ) : sortedFloors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-[2.5rem]">
                    <span className="material-icons text-6xl text-slate-300 mb-4">location_off</span>
                    <p className="text-[10px] font-display-black uppercase tracking-[0.3em] text-slate-400">- Sin Unidades Registradas -</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 animate-fade-in">
                    {sortedFloors.map(floor => (
                        <React.Fragment key={floor}>
                            {unitsByFloor[floor].map((unit) => (
                                <div key={unit.id} className="group relative">
                                    <Link
                                        to={`/admin/apartamentos/${unit.id}`}
                                        className={`block relative overflow-hidden rounded-[2rem] border transition-all duration-500 h-full ${unit.status === 'Solvente'
                                            ? 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-white/20 dark:border-white/5 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10'
                                            : 'bg-red-500/5 backdrop-blur-xl border-red-500/20 hover:border-red-500/50 hover:shadow-2xl hover:shadow-red-500/10'
                                            }`}
                                    >
                                        <div className="p-6">
                                            <div className="flex justify-between items-center mb-6">
                                                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                    <span className="text-[9px] font-display-black text-slate-500 uppercase tracking-widest">NIVEL {unit.floor}</span>
                                                </div>
                                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg ${unit.status === 'Solvente'
                                                    ? 'bg-emerald-500/10 text-emerald-500'
                                                    : 'bg-red-500/10 text-red-500'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${unit.status === 'Solvente' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                    <span className="text-[9px] font-display-black uppercase tracking-widest">{unit.status === 'Solvente' ? 'VIVO' : 'MORA'}</span>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <h3 className="text-4xl font-display-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors uppercase tracking-tighter">
                                                    {unit.number}
                                                </h3>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center overflow-hidden">
                                                    <span className="material-icons text-[12px] text-slate-500 dark:text-slate-400">person</span>
                                                </div>
                                                <p className="text-[10px] font-display-bold text-slate-500 uppercase tracking-wider truncate max-w-[120px]">
                                                    {unit.owners?.full_name || 'Sin Asignar'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Hover Overlay Gradient */}
                                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                                    </Link>

                                    {/* Premium Action Menu */}
                                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleEditUnit(unit);
                                            }}
                                            className="w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/20 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all shadow-lg active:scale-90"
                                            title="Editar"
                                        >
                                            <span className="material-icons text-sm">edit</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (confirm('¿ELIMINAR UNIDAD?')) handleDeleteUnit(unit.id);
                                            }}
                                            className="w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/20 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-lg active:scale-90"
                                            title="Eliminar"
                                        >
                                            <span className="material-icons text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Create Modal - Social VIVO Premium */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 dark:border-white/5 w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="relative p-8 pb-0">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-8 bg-gradient-to-b from-emerald-400 to-teal-600 rounded-full"></div>
                                    <h3 className="text-2xl font-display-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                        {editingId ? 'Editar' : 'Nueva'} <span className="text-emerald-500">Unidad</span>
                                    </h3>
                                </div>
                                <button onClick={handleCloseModal} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-emerald-500 hover:text-white transition-all active:scale-95">
                                    <span className="material-icons">close</span>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 pt-0 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400 ml-1">Edificio / Torre</label>
                                    <div className="relative group">
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50 font-display-bold text-sm uppercase tracking-wider transition-all appearance-none text-slate-900 dark:text-white"
                                            value={tower}
                                            onChange={(e) => setTower(e.target.value)}
                                        >
                                            {activeTowers.map(t => (
                                                <option key={t.name} value={t.name} className="dark:bg-slate-900">Torre {t.name}</option>
                                            ))}
                                        </select>
                                        <span className="material-icons absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-emerald-500 transition-colors">expand_more</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400 ml-1">Piso</label>
                                        <div className="relative group">
                                            <select
                                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50 font-display-bold text-sm uppercase transition-all appearance-none text-slate-900 dark:text-white"
                                                value={floor}
                                                onChange={(e) => setFloor(e.target.value)}
                                            >
                                                <option value="PB" className="dark:bg-slate-900">P. Baja</option>
                                                <option value="1" className="dark:bg-slate-900">Piso 1</option>
                                                <option value="2" className="dark:bg-slate-900">Piso 2</option>
                                                <option value="3" className="dark:bg-slate-900">Piso 3</option>
                                            </select>
                                            <span className="material-icons absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-emerald-500 transition-colors">layers</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400 ml-1">Letra</label>
                                        <div className="relative group">
                                            <select
                                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50 font-display-bold text-sm uppercase transition-all appearance-none text-slate-900 dark:text-white"
                                                value={number}
                                                onChange={(e) => setNumber(e.target.value)}
                                            >
                                                <option value="" className="dark:bg-slate-900">-</option>
                                                <option value="A" className="dark:bg-slate-900">A</option>
                                                <option value="B" className="dark:bg-slate-900">B</option>
                                                <option value="C" className="dark:bg-slate-900">C</option>
                                                <option value="D" className="dark:bg-slate-900">D</option>
                                            </select>
                                            <span className="material-icons absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-emerald-500 transition-colors">sort_by_alpha</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Owner Selection - Social Insight Style */}
                            <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-[2rem] p-6 border border-slate-200/50 dark:border-white/5">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons text-lg text-emerald-500">assignment_ind</span>
                                        <label className="text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400">Propietario Asignado</label>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsNewOwner(!isNewOwner)}
                                        className={`px-4 py-1.5 rounded-xl text-[9px] font-display-black uppercase tracking-widest transition-all ${isNewOwner
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                            : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
                                    >
                                        {isNewOwner ? 'Seleccionar Existente' : '+ Crear Nuevo'}
                                    </button>
                                </div>

                                {isNewOwner ? (
                                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                required={isNewOwner}
                                                placeholder="Nombre Completo *"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-display-bold text-sm uppercase tracking-wider transition-all shadow-sm"
                                                value={newOwnerData.full_name}
                                                onChange={(e) => setNewOwnerData({ ...newOwnerData, full_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Cédula / ID"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-display-bold text-sm uppercase transition-all shadow-sm"
                                                value={newOwnerData.doc_id}
                                                onChange={(e) => setNewOwnerData({ ...newOwnerData, doc_id: e.target.value })}
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Teléfono"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-display-bold text-sm transition-all shadow-sm"
                                                value={newOwnerData.phone}
                                                onChange={(e) => setNewOwnerData({ ...newOwnerData, phone: e.target.value })}
                                            />
                                        </div>
                                        <input
                                            type="email"
                                            placeholder="Email institucional / personal"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-display-bold text-sm transition-all shadow-sm"
                                            value={newOwnerData.email}
                                            onChange={(e) => setNewOwnerData({ ...newOwnerData, email: e.target.value })}
                                        />
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <select
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-display-bold text-sm uppercase tracking-wider transition-all shadow-sm appearance-none text-slate-900 dark:text-white"
                                            value={ownerId || ''}
                                            onChange={(e) => setOwnerId(e.target.value || null)}
                                        >
                                            <option value="" className="dark:bg-slate-900">-- Sin Asignar --</option>
                                            {ownersList
                                                .filter(owner => {
                                                    const isAssigned = units.some(u => u.owner_id === owner.id);
                                                    return !isAssigned || (editingId && owner.id === ownerId);
                                                })
                                                .map(owner => (
                                                    <option key={owner.id} value={owner.id} className="dark:bg-slate-900">
                                                        {owner.full_name} {owner.doc_id ? `(${owner.doc_id})` : ''}
                                                    </option>
                                                ))}
                                        </select>
                                        <span className="material-icons absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-emerald-500 transition-colors">search</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-display-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-3 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {creating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons text-sm">{editingId ? 'save' : 'add_circle'}</span>
                                            <span>{editingId ? 'Actualizar Registro' : 'Registrar Unidad'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Tower Management Modal - Social VIVO Premium */}
            {showTowerModal && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 dark:border-white/5 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 pb-4">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-8 bg-gradient-to-b from-emerald-400 to-teal-600 rounded-full"></div>
                                    <div>
                                        <h3 className="text-2xl font-display-black text-slate-900 dark:text-white uppercase tracking-tighter">Torres de <span className="text-emerald-500">Control</span></h3>
                                        <p className="text-[9px] font-display-bold text-slate-400 uppercase tracking-widest">Habilitar visibilidad en matriz</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowTowerModal(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-emerald-500 hover:text-white transition-all active:scale-95">
                                    <span className="material-icons">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 pt-0 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                            {towers && towers.length > 0 ? towers.map(t => (
                                <div key={t.name} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200/50 dark:border-white/5 transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/20 group">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-12 h-12 flex items-center justify-center rounded-2xl font-display-black text-xl transition-all ${t.is_active
                                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                            {t.name}
                                        </div>
                                        <div>
                                            <span className="font-display-black text-slate-900 dark:text-white uppercase tracking-widest text-sm italic">REGISTRO {t.name}</span>
                                            <p className={`text-[9px] font-display-black uppercase tracking-widest mt-0.5 ${t.is_active ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                {t.is_active ? 'VISIBLE EN MATRIZ' : 'SUSPENSIÓN OCULTA'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleTowerStatus(t.name, t.is_active)}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none ${t.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                        <div className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${t.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            )) : (
                                <div className="p-12 text-center">
                                    <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest">Sincronizando torres...</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 pt-4">
                            <button
                                onClick={() => setShowTowerModal(false)}
                                className="w-full py-5 bg-gradient-to-r from-slate-800 to-slate-950 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 rounded-[1.5rem] font-display-black text-[10px] uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <span className="material-icons text-sm">check_circle</span>
                                    <span>Guardar y Finalizar</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApartmentList;
