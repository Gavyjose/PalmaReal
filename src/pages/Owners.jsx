import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';

const Owners = () => {
    const [owners, setOwners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        doc_id: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchOwners();
    }, []);

    const fetchOwners = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('owners')
                .select(`
                    *,
                    units (status, number)
                `)
                .order('full_name', { ascending: true });

            if (error) throw error;
            setOwners(data || []);
        } catch (error) {
            console.error('Error fetching owners:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOwner = async (e) => {
        e.preventDefault();
        if (!formData.full_name) return;

        try {
            setSaving(true);
            console.log('🔍 DEBUG Save Owner - Editing ID:', editingId);
            console.log('🔍 DEBUG Save Owner - Form Data:', formData);

            if (editingId) {
                const { data, error } = await supabase
                    .from('owners')
                    .update(formData)
                    .eq('id', editingId)
                    .select();

                console.log('🔍 DEBUG Save Owner - Update Response:', { data, error });
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('owners')
                    .insert([formData])
                    .select();

                console.log('🔍 DEBUG Save Owner - Insert Response:', { data, error });
                if (error) throw error;
            }
            setShowModal(false);
            resetForm();
            fetchOwners();
        } catch (error) {
            console.error('❌ Error saving owner:', error);
            alert('Error al guardar el propietario: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteOwner = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este propietario?')) return;

        try {
            const { error } = await supabase
                .from('owners')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchOwners();
        } catch (error) {
            console.error('Error deleting owner:', error);
            alert('Error al eliminar. Asegúrate de que no tenga apartamentos asignados.');
        }
    };

    const handleEdit = (owner) => {
        setEditingId(owner.id);
        setFormData({
            full_name: owner.full_name,
            email: owner.email || '',
            phone: owner.phone || '',
            doc_id: owner.doc_id || ''
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ full_name: '', email: '', phone: '', doc_id: '' });
    };

    const filteredOwners = owners.filter(owner =>
        owner.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (owner.doc_id && owner.doc_id.includes(searchTerm))
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <nav className="flex text-slate-500 text-xs mb-2 items-center gap-1">
                        <Link to="/admin" className="hover:text-primary">Inicio</Link>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">Propietarios</span>
                    </nav>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Directorio de Propietarios</h1>
                    <p className="text-slate-500 text-sm mt-1">Gestión y control de información de los residentes.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                        <span className="material-icons text-sm mr-2">person_add</span>
                        Nuevo Propietario
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-6 shadow-sm">
                <div className="relative w-full">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o cédula..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Propietario / Cédula</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Apartamentos</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Cargando propietarios...</td>
                                </tr>
                            ) : filteredOwners.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No se encontraron propietarios.</td>
                                </tr>
                            ) : (
                                filteredOwners.map((owner) => (
                                    <tr key={owner.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                    {owner.full_name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 dark:text-white text-sm">{owner.full_name}</span>
                                                    <span className="text-xs text-slate-400">{owner.doc_id || 'S/I'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            <div className="flex flex-col">
                                                <span>{owner.email || '-'}</span>
                                                <span className="text-xs text-slate-400">{owner.phone || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {owner.units && owner.units.length > 0 ? (
                                                    owner.units.map((u, idx) => (
                                                        <span key={idx} className={`px-2 py-0.5 rounded text-[10px] font-bold border ${u.status === 'Solvente' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                            {u.number}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Sin asignar</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleEdit(owner)}
                                                className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors mr-2"
                                                title="Editar"
                                            >
                                                <span className="material-icons text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOwner(owner.id)}
                                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <span className="material-icons text-lg">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingId ? 'Editar Propietario' : 'Nuevo Propietario'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSaveOwner} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 outline-none"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Cédula / ID</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 outline-none"
                                    value={formData.doc_id}
                                    onChange={(e) => setFormData({ ...formData, doc_id: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 outline-none"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 outline-none"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold bg-primary text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Owners;
