import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

const CreateUserModal = ({ isOpen, onClose, onSuccess, editUser = null }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        id_card: '',
        phone: '',
        email: '',
        role: 'OPERADOR',
        owner_id: ''
    });
    const [owners, setOwners] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchOwners();
            if (editUser) {
                setFormData({
                    first_name: editUser.first_name || '',
                    last_name: editUser.last_name || '',
                    id_card: editUser.id_card || '',
                    phone: editUser.phone || '',
                    email: editUser.email || '',
                    role: editUser.role || 'OPERADOR',
                    owner_id: editUser.owner_id || ''
                });
            } else {
                setFormData({
                    first_name: '',
                    last_name: '',
                    id_card: '',
                    phone: '',
                    email: '',
                    role: 'OPERADOR',
                    owner_id: ''
                });
            }
        }
    }, [isOpen, editUser]);

    const fetchOwners = async () => {
        const { data, error } = await supabase
            .from('owners')
            .select('id, full_name, doc_id')
            .order('full_name');
        if (!error) setOwners(data);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editUser) {
                // Modo Edición: Actualizar perfil directamente en user_profiles
                const { error: profileError } = await supabase
                    .from('user_profiles')
                    .update({
                        first_name: formData.first_name,
                        last_name: formData.last_name,
                        id_card: formData.id_card,
                        phone: formData.phone,
                        role: formData.role,
                        owner_id: formData.owner_id || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editUser.id);

                if (profileError) throw profileError;
                
                alert('Usuario actualizado exitosamente.');
                onSuccess();
                onClose();
            } else {
                // Modo Creación: Registrar en Auth y crear perfil
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.id_card,
                    options: {
                        data: {
                            first_name: formData.first_name,
                            last_name: formData.last_name,
                        }
                    }
                });

                if (authError) throw authError;

                if (authData.user) {
                    const { error: profileError } = await supabase
                        .from('user_profiles')
                        .upsert([{
                            id: authData.user.id,
                            first_name: formData.first_name,
                            last_name: formData.last_name,
                            id_card: formData.id_card,
                            phone: formData.phone,
                            email: formData.email,
                            role: formData.role,
                            owner_id: formData.owner_id || null,
                            must_change_password: true,
                            updated_at: new Date().toISOString()
                        }], { onConflict: 'id' });

                    if (profileError) throw profileError;

                    alert('Usuario creado exitosamente. Se ha enviado un correo de confirmación (si está habilitado en Supabase).');
                    onSuccess();
                    onClose();
                }
            }
        } catch (error) {
            console.error('Error processing user:', error);
            alert('Error al procesar usuario: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-900/10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
                            <span className="material-icons">{editUser ? 'edit' : 'person_add'}</span>
                        </div>
                        <div>
                            <h3 className="font-display-black text-slate-900 dark:text-white text-xl">
                                {editUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h3>
                            <p className="text-xs font-display-medium text-slate-500">
                                {editUser ? 'Modifica los datos del perfil' : 'Registra un nuevo operador del sistema'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        <span className="material-icons text-slate-400">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest px-1">Nombres</label>
                            <input
                                required
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="Ej: Juan"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest px-1">Apellidos</label>
                            <input
                                required
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="Ej: Pérez"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest px-1">Cédula</label>
                            <input
                                required
                                name="id_card"
                                value={formData.id_card}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="Ej: 12345678"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest px-1">Celular</label>
                            <input
                                required
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="Ej: 04121234567"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest px-1">Correo Electrónico</label>
                        <input
                            required
                            type="email"
                            name="email"
                            disabled={!!editUser}
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50"
                            placeholder="correo@ejemplo.com"
                        />
                        {editUser && <p className="text-[9px] text-slate-400 px-2">El correo electrónico no puede ser modificado.</p>}
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest px-1">Rol Inicial</label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                            >
                                <option value="VISOR">VISOR (Solo Lectura)</option>
                                <option value="OPERADOR">OPERADOR (Gestión)</option>
                                <option value="REPRESENTANTE">REPRESENTANTE (Comité/Torre)</option>
                                <option value="PROPIETARIO">PROPIETARIO (Portal)</option>
                                <option value="MASTER">MASTER (Administrador)</option>
                            </select>
                        </div>

                        {(formData.role === 'PROPIETARIO' || formData.role === 'REPRESENTANTE') && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-display-black text-emerald-600 uppercase tracking-widest px-1">Vincular con Propietario</label>
                                <select
                                    name="owner_id"
                                    value={formData.owner_id}
                                    onChange={handleChange}
                                    className="w-full bg-emerald-50/50 dark:bg-emerald-900/10 border-2 border-emerald-100 dark:border-emerald-900/30 rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                                >
                                    <option value="">-- Seleccionar Propietario --</option>
                                    {owners.map(owner => (
                                        <option key={owner.id} value={owner.id}>
                                            {owner.full_name} ({owner.doc_id})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-500 px-2 leading-tight">
                                    Esto permitirá que el usuario vea sus apartamentos y estados de cuenta en el portal.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-display-bold text-sm transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="material-icons animate-spin">sync</span>
                            ) : (
                                <span className="material-icons text-sm">{editUser ? 'save' : 'person_add'}</span>
                            )}
                            {loading ? 'Procesando...' : editUser ? 'Guardar Cambios' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;
