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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <nav className="flex text-slate-500 text-[10px] font-mono font-bold uppercase tracking-widest mb-2 items-center gap-2">
                        <Link to="/admin" className="hover:text-slate-900 dark:hover:text-white transition-colors">Inicio</Link>
                        <span>/</span>
                        <span className="text-slate-900 dark:text-white">Apartamentos</span>
                    </nav>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Directorio de Apartamentos</h1>
                    <p className="text-slate-500 text-sm mt-1 font-mono">Maestro de unidades y asignación de deudas.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTowerModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-none font-bold text-xs uppercase tracking-widest hover:border-slate-900 dark:hover:border-white transition-colors"
                    >
                        <span className="material-icons text-sm">settings</span>
                        Configurar
                    </button>
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setTower(selectedTower);
                            setFloor('PB');
                            setNumber('');
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-none font-bold text-xs uppercase tracking-widest hover:invert transition-all cursor-pointer border-2 border-transparent"
                    >
                        <span className="material-icons text-sm">add</span>
                        Nueva Unidad
                    </button>
                </div>
            </div>

            {/* Tower Selection */}
            <div className="flex flex-wrap gap-0 mb-8 border-b-2 border-slate-300 dark:border-slate-700">
                {activeTowers.map(t => (
                    <button
                        key={t.name}
                        onClick={() => {
                            setSelectedTower(t.name);
                            setLastSelectedTower(t.name);
                        }}
                        className={`px-6 py-3 rounded-none font-bold text-xs font-mono uppercase tracking-widest transition-all ${selectedTower === t.name
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-2 border-slate-900 dark:border-white border-b-0 -mb-[2px]'
                            : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-b-2 border-transparent hover:border-slate-400 -mb-[2px]'
                            }`}
                    >
                        Torre {t.name}
                    </button>
                ))}
            </div>

            {/* Grid of Apartments */}
            {loading ? (
                <div className="text-center py-20 text-slate-500 font-mono font-bold uppercase tracking-widest text-xs">Sincronizando maestro de unidades...</div>
            ) : sortedFloors.length === 0 ? (
                <div className="text-center py-20 text-slate-500 font-mono font-bold uppercase tracking-widest text-xs">- Sin Apartamentos Registrados -</div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px border border-slate-300 dark:border-slate-700 bg-slate-300 dark:bg-slate-700 mt-2">
                    {sortedFloors.map(floor => (
                        <React.Fragment key={floor}>
                            {unitsByFloor[floor].map((unit) => (
                                <div key={unit.id} className="relative group bg-white dark:bg-slate-900 border border-transparent">
                                    <Link
                                        to={`/admin/apartamentos/${unit.id}`}
                                        className={`block p-4 transition-all h-full ${unit.status === 'Solvente'
                                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                            : 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 hover:border-red-300 dark:hover:bg-red-900/20'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Piso {unit.floor}</span>
                                            <span className={`inline-block px-1.5 border rounded-none text-[8px] font-bold uppercase tracking-widest ${unit.status === 'Solvente' ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800' : 'text-red-700 bg-white border-red-300 dark:bg-slate-900 dark:text-red-400 dark:border-red-800'}`}>{unit.status === 'Solvente' ? 'OK' : 'MORA'}</span>
                                        </div>
                                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors uppercase tracking-tighter">{unit.number}</h3>
                                        <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest truncate">{unit.owners?.full_name || 'Sin Propietario'}</p>
                                    </Link>

                                    {/* Action Menu - Hover */}
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm rounded-none">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleEditUnit(unit);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                                            title="Editar"
                                        >
                                            <span className="material-icons text-sm">edit</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (confirm('ELIMINACIÓN CRÍTICA: ¿Borrar del libro mayor?')) handleDeleteUnit(unit.id);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center border-l border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-500 transition-colors"
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

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-none border-2 border-slate-900 dark:border-white w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-900 dark:border-white">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                {editingId ? 'Editar Unidad' : 'Nueva Unidad'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500 dark:text-slate-400">Edificio / Torre</label>
                                <select
                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none px-4 py-3 outline-none focus:border-slate-900 dark:focus:border-white font-mono text-sm uppercase transition-colors"
                                    value={tower}
                                    onChange={(e) => setTower(e.target.value)}
                                >
                                    {activeTowers.map(t => (
                                        <option key={t.name} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500 dark:text-slate-400">Piso</label>
                                    <select
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none px-4 py-3 outline-none focus:border-slate-900 dark:focus:border-white font-mono text-sm uppercase transition-colors"
                                        value={floor}
                                        onChange={(e) => setFloor(e.target.value)}
                                    >
                                        <option value="PB">Planta Baja</option>
                                        <option value="1">Piso 1</option>
                                        <option value="2">Piso 2</option>
                                        <option value="3">Piso 3</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500 dark:text-slate-400">Letra</label>
                                    <select
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none px-4 py-3 outline-none focus:border-slate-900 dark:focus:border-white font-mono text-sm uppercase transition-colors"
                                        value={number}
                                        onChange={(e) => setNumber(e.target.value)}
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                    </select>
                                </div>
                            </div>

                            {/* Owner Selection or Creation */}
                            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2 mb-2">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Propietario Asignado</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsNewOwner(!isNewOwner)}
                                        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-blue-700 transition-colors bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded cursor-pointer"
                                    >
                                        {isNewOwner ? 'Seleccionar Existente' : '+ Crear Nuevo'}
                                    </button>
                                </div>

                                {isNewOwner ? (
                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700">
                                        <div>
                                            <input
                                                type="text"
                                                required={isNewOwner}
                                                placeholder="Nombre Completo *"
                                                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none px-3 py-2 outline-none focus:border-slate-900 dark:focus:border-white font-mono text-sm uppercase transition-colors"
                                                value={newOwnerData.full_name}
                                                onChange={(e) => setNewOwnerData({ ...newOwnerData, full_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                placeholder="Cédula / ID"
                                                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none px-3 py-2 outline-none focus:border-slate-900 dark:focus:border-white font-mono text-sm uppercase transition-colors"
                                                value={newOwnerData.doc_id}
                                                onChange={(e) => setNewOwnerData({ ...newOwnerData, doc_id: e.target.value })}
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Teléfono (Opc.)"
                                                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none px-3 py-2 outline-none focus:border-slate-900 dark:focus:border-white font-mono text-sm transition-colors"
                                                value={newOwnerData.phone}
                                                onChange={(e) => setNewOwnerData({ ...newOwnerData, phone: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="email"
                                                placeholder="Email (Opc.)"
                                                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none px-3 py-2 outline-none focus:border-slate-900 dark:focus:border-white font-mono text-sm transition-colors"
                                                value={newOwnerData.email}
                                                onChange={(e) => setNewOwnerData({ ...newOwnerData, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <select
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none px-4 py-3 outline-none focus:border-slate-900 dark:focus:border-white font-mono text-sm uppercase transition-colors cursor-pointer"
                                        value={ownerId || ''}
                                        onChange={(e) => setOwnerId(e.target.value || null)}
                                    >
                                        <option value="">-- Sin Asignar --</option>
                                        {ownersList
                                            .filter(owner => {
                                                const isAssigned = units.some(u => u.owner_id === owner.id);
                                                return !isAssigned || (editingId && owner.id === ownerId);
                                            })
                                            .map(owner => (
                                                <option key={owner.id} value={owner.id}>
                                                    {owner.full_name} {owner.doc_id ? `(${owner.doc_id})` : ''}
                                                </option>
                                            ))}
                                    </select>
                                )}
                            </div>

                            <div className="pt-6 flex gap-3 border-t border-slate-200 dark:border-slate-800 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-3 mt-4 rounded-none font-bold text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 px-4 py-3 mt-4 rounded-none font-bold text-xs uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 border-2 border-slate-900 dark:border-white transition-all disabled:opacity-50"
                                >
                                    {creating ? 'Guardando...' : (editingId ? 'Actualizar' : 'Registrar')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Tower Management Modal */}
            {showTowerModal && (
                <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-none border-2 border-slate-900 dark:border-white w-full max-w-lg p-6 shadow-none">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-900 dark:border-white">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Configuración de Torres</h3>
                                <p className="text-xs text-slate-500 font-mono mt-1">Habilita o deshabilita la visibilidad.</p>
                            </div>
                            <button onClick={() => setShowTowerModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                <span className="material-icons">close</span>
                            </button>
                        </div>

                        <div className="space-y-px border border-slate-300 dark:border-slate-700 bg-slate-300 dark:bg-slate-700 max-h-[60vh] overflow-y-auto">
                            {towers && towers.length > 0 ? towers.map(t => (
                                <div key={t.name} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-transparent">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 flex items-center justify-center border-2 border-slate-900 dark:border-white rounded-none font-bold text-xl uppercase tracking-widest ${t.is_active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-transparent text-slate-400 border-slate-300 dark:border-slate-700'}`}>
                                            {t.name}
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-sm">Registro {t.name}</span>
                                            <p className="text-[10px] text-slate-500 font-mono font-bold uppercase">{t.is_active ? 'Visible en Matriz' : 'Suspensión Oculta'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleTowerStatus(t.name, t.is_active)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-none border-2 border-slate-900 dark:border-white transition-colors cursor-pointer ${t.is_active ? 'bg-slate-900 dark:bg-white' : 'bg-transparent'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform bg-white dark:bg-slate-900 border border-slate-900 transition-transform ${t.is_active ? 'translate-x-6' : 'translate-x-0 border-transparent dark:bg-white'}`} />
                                    </button>
                                </div>
                            )) : (
                                <div className="p-4 bg-white dark:bg-slate-900 text-center text-slate-500 font-mono text-xs uppercase font-bold text-[10px]">Cargando torres...</div>
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setShowTowerModal(false)}
                                className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-none font-bold text-xs uppercase tracking-widest hover:invert border-2 border-slate-900 dark:border-white transition-all cursor-pointer"
                            >
                                Guardar y Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApartmentList;
