import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';

const ApartmentList = () => {
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [tower, setTower] = useState('A1');
    const [floor, setFloor] = useState('PB');
    const [number, setNumber] = useState('');
    const [ownerId, setOwnerId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [ownersList, setOwnersList] = useState([]);

    const [selectedTower, setSelectedTower] = useState('');
    const [showTowerModal, setShowTowerModal] = useState(false);

    // Tower management hook
    const { towers, activeTowers, toggleTowerStatus, loading: towersLoading } = useTowers();

    // Set initial selected tower when towers are loaded
    useEffect(() => {
        if (activeTowers.length > 0 && !selectedTower) {
            setSelectedTower(activeTowers[0].name);
            setTower(activeTowers[0].name);
        }
    }, [activeTowers]);

    useEffect(() => {
        fetchUnits();
        fetchOwners();
    }, []);

    const fetchOwners = async () => {
        const { data } = await supabase.from('owners').select('id, full_name, doc_id').order('full_name');
        setOwnersList(data || []);
    };

    const fetchUnits = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('units')
                .select(`
                    *,
                    owners (full_name)
                `)
                .order('tower', { ascending: true })
                .order('floor', { ascending: true })
                .order('number', { ascending: true });

            if (error) throw error;
            setUnits(data || []);
        } catch (error) {
            console.error('Error fetching units:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUnit = async (id) => {
        try {
            const { error } = await supabase
                .from('units')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchUnits();
        } catch (error) {
            console.error('Error deleting unit:', error);
            alert('Error al eliminar el apartamento');
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
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tower || !floor || !number) return;

        // Construct unit identifier, e.g., "3-D" or "PB-A"
        // 'number' state currently holds the Letter (A, B, C, D)
        const fullUnitNumber = `${floor}-${number}`;

        try {
            setCreating(true);

            if (editingId) {
                const { data, error } = await supabase
                    .from('units')
                    .update({
                        tower,
                        floor,
                        number: fullUnitNumber,
                        owner_id: ownerId
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
                        owner_id: ownerId
                    }]);
                if (error) throw error;
            }

            handleCloseModal();
            fetchUnits();
            // alert('Operación exitosa'); // Optional: feedback
        } catch (error) {
            console.error('Error saving unit:', error);
            alert('Error al guardar el apartamento');
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
                    <nav className="flex text-slate-500 text-xs mb-2 items-center gap-1">
                        <Link to="/admin" className="hover:text-primary">Inicio</Link>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">Apartamentos</span>
                    </nav>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Directorio de Apartamentos</h1>
                    <p className="text-slate-500 text-sm mt-1">Selecciona una unidad para ver su detalle, historial y deuda.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTowerModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-bold shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <span className="material-icons">settings</span>
                        Configurar Torres
                    </button>
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setTower(selectedTower); // Prepare with current tower
                            setFloor('PB');
                            setNumber('');
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/25 hover:bg-blue-600 transition-colors cursor-pointer"
                    >
                        <span className="material-icons">add</span>
                        Nuevo Apartamento
                    </button>
                </div>
            </div>

            {/* Tower Selection */}
            <div className="flex flex-wrap gap-3 mb-8">
                {activeTowers.map(t => (
                    <button
                        key={t.name}
                        onClick={() => setSelectedTower(t.name)}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 ${selectedTower === t.name
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        {t.name}
                    </button>
                ))}
            </div>

            {/* Grid of Apartments */}
            {loading ? (
                <div className="text-center py-20 text-slate-500">Cargando apartamentos...</div>
            ) : sortedFloors.length === 0 ? (
                <div className="text-center py-20 text-slate-500">No hay apartamentos registrados en este edificio.</div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {sortedFloors.map(floor => (
                        <React.Fragment key={floor}>
                            {unitsByFloor[floor].map((unit) => (
                                <div key={unit.id} className="relative group">
                                    <Link
                                        to={`/admin/apartamentos/${unit.id}`}
                                        className={`block p-4 rounded-xl border-2 transition-all hover:-translate-y-1 ${unit.status === 'Solvente'
                                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                            : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:border-red-500/50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Piso {unit.floor}</span>
                                            <div className={`w-2 h-2 rounded-full ${unit.status === 'Solvente' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        </div>
                                        <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-colors">{unit.number}</h3>
                                        <p className="text-xs text-slate-500 truncate">{unit.owners?.full_name || 'Sin Propietario'}</p>
                                    </Link>

                                    {/* Action Menu - Desktop hover / Mobile tap */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleEditUnit(unit);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full shadow-md text-slate-400 hover:text-blue-500 transition-colors"
                                            title="Editar"
                                        >
                                            <span className="material-icons text-sm">edit</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (confirm('¿Estás seguro de eliminar este apartamento?')) handleDeleteUnit(unit.id);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full shadow-md text-slate-400 hover:text-red-500 transition-colors"
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingId ? 'Editar Apartamento' : 'Nuevo Apartamento'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Edificio</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 outline-none"
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
                                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Piso</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 outline-none"
                                        value={floor}
                                        onChange={(e) => {
                                            setFloor(e.target.value);
                                        }}
                                    >
                                        <option value="PB">Planta Baja</option>
                                        <option value="1">Piso 1</option>
                                        <option value="2">Piso 2</option>
                                        <option value="3">Piso 3</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Letra</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 outline-none"
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

                            {/* Owner Selection */}
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Propietario Asignado</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 outline-none"
                                    value={ownerId || ''}
                                    onChange={(e) => setOwnerId(e.target.value || null)}
                                >
                                    <option value="">-- Sin Asignar --</option>
                                    {ownersList
                                        .filter(owner => {
                                            // Check if owner is assigned to any unit
                                            const isAssigned = units.some(u => u.owner_id === owner.id);
                                            // Show if not assigned OR if it's the owner of the unit currently being edited
                                            return !isAssigned || (editingId && owner.id === ownerId);
                                        })
                                        .map(owner => (
                                            <option key={owner.id} value={owner.id}>
                                                {owner.full_name} {owner.doc_id ? `(${owner.doc_id})` : ''}
                                            </option>
                                        ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    ¿No encuentras al propietario? <Link to="/admin/propietarios" className="text-primary hover:underline">Créalo aquí primero</Link>.
                                </p>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold bg-primary text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                                >
                                    {creating ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear Apartamento')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Tower Management Modal */}
            {showTowerModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Configuración de Torres</h3>
                                <p className="text-sm text-slate-500">Habilita o deshabilita la visibilidad en el sistema.</p>
                            </div>
                            <button onClick={() => setShowTowerModal(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-icons">close</span>
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
                            {towers.map(t => (
                                <div key={t.name} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold ${t.is_active ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-400'}`}>
                                            {t.name}
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-900 dark:text-white">{t.name}</span>
                                            <p className="text-xs text-slate-500">{t.is_active ? 'Habilitada' : 'Deshabilitada'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleTowerStatus(t.name, t.is_active)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${t.is_active ? 'bg-primary' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${t.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={() => setShowTowerModal(false)}
                                className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApartmentList;
