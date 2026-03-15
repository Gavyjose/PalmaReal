import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { usePermissions } from '../../hooks/usePermissions';
import CreateUserModal from './CreateUserModal';

const MODULES = [
    { key: 'apartamentos', label: 'Apartamentos' },
    { key: 'pagos', label: 'Pagos y Recibos' },
    { key: 'estado_cuenta', label: 'Estado de Cuenta' },
    { key: 'cobranzas', label: 'Libro de Cobranzas' },
    { key: 'libro_caja', label: 'Libro de Caja' },
    { key: 'reportes', label: 'Reportes Financieros' },
    { key: 'comunicados', label: 'Comunicados' },
    { key: 'asambleas', label: 'Asambleas' },
    { key: 'alicuotas', label: 'Configuración de Alícuotas' },
    { key: 'cuotas_especiales', label: 'Cuotas Especiales' },
    { key: 'propietarios', label: 'Directorio de Propietarios' },
    { key: 'portal_propietario', label: 'Vista Propietario' },
];

const UserManagement = () => {
    const { isMaster } = usePermissions();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userPermissions, setUserPermissions] = useState([]);
    const [saving, setSaving] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .order('full_name');

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario ${user.full_name}? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', user.id);

            if (error) throw error;
            
            // Nota: Borrar de Auth requiere privilegios de admin/service_role
            // Por ahora solo borramos el perfil. El usuario no podrá loguearse si el perfil no existe
            // o si implementamos validación de perfil en el login.

            alert('Usuario eliminado correctamente');
            fetchUsers();
            if (selectedUser?.id === user.id) setSelectedUser(null);
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error al eliminar usuario: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditUser = (user) => {
        setUserToEdit(user);
        setIsCreateModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsCreateModalOpen(false);
        setUserToEdit(null);
    };

    const fetchUserPermissions = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('module_permissions')
                .select('*')
                .eq('profile_id', userId);

            if (error) throw error;

            // Normalizar permisos para todos los módulos
            const normalized = MODULES.map(mod => {
                const existing = data?.find(p => p.module_key === mod.key);
                return existing || {
                    module_key: mod.key,
                    can_view: false,
                    can_create: false,
                    can_update: false,
                    can_delete: false,
                };
            });

            setUserPermissions(normalized);
        } catch (error) {
            console.error('Error fetching user permissions:', error);
        }
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        fetchUserPermissions(user.id);
    };

    const togglePermission = (moduleKey, field) => {
        setUserPermissions(prev => prev.map(p =>
            p.module_key === moduleKey ? { ...p, [field]: !p[field] } : p
        ));
    };

    const handleSavePermissions = async () => {
        if (!selectedUser) return;
        try {
            setSaving(true);

            // Preparar datos para upsert
            const upsertData = userPermissions.map(p => ({
                profile_id: selectedUser.id,
                module_key: p.module_key,
                can_view: p.can_view,
                can_create: p.can_create,
                can_update: p.can_update,
                can_delete: p.can_delete
            }));

            const { error } = await supabase
                .from('module_permissions')
                .upsert(upsertData, { onConflict: 'profile_id,module_key' });

            if (error) throw error;
            alert('Permisos actualizados correctamente');
        } catch (error) {
            console.error('Error saving permissions:', error);
            alert('Error al guardar permisos: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            if (selectedUser?.id === userId) {
                setSelectedUser(prev => ({ ...prev, role: newRole }));
            }
        } catch (error) {
            console.error('Error updating role:', error);
            alert('Error al actualizar rol');
        }
    };

    if (!isMaster) {
        return (
            <div className="p-10 text-center">
                <span className="material-icons text-6xl text-slate-300 mb-4">lock</span>
                <p className="text-slate-500 font-display-medium">Acceso restringido solo para administradores Master.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            {/* Lista de Usuarios */}
            <div className="lg:col-span-4 space-y-4">
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-white dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-900/10 flex items-center justify-between">
                        <h3 className="font-display-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-icons text-emerald-500">people</span>
                            Usuarios
                        </h3>
                        <button
                            onClick={() => {
                                setUserToEdit(null);
                                setIsCreateModalOpen(true);
                            }}
                            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center"
                            title="Nuevo Usuario"
                        >
                            <span className="material-icons text-sm">person_add</span>
                        </button>
                    </div>
                    <div className="p-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center animate-pulse text-slate-400 font-display-medium">Cargando usuarios...</div>
                        ) : users.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 font-display-medium">No hay otros usuarios.</div>
                        ) : (
                            users.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => handleSelectUser(user)}
                                    className={`w-full text-left p-4 rounded-2xl transition-all duration-300 flex items-center gap-4 group ${selectedUser?.id === user.id
                                        ? 'bg-emerald-500/10 border-emerald-500/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                            alt="avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-display-bold text-sm truncate ${selectedUser?.id === user.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {user.first_name ? `${user.first_name} ${user.last_name}` : user.full_name}
                                        </p>
                                        <p className="text-[10px] font-display-medium text-slate-400 truncate">
                                            {user.email}
                                        </p>
                                    </div>
<div className={`flex items-center gap-2 transition-all ${selectedUser?.id === user.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditUser(user);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                            title="Editar Perfil"
                                        >
                                            <span className="material-icons text-sm">edit</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteUser(user);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                            title="Eliminar Usuario"
                                        >
                                            <span className="material-icons text-sm">delete</span>
                                        </button>
                                        <span className={`material-icons text-sm transition-all ${selectedUser?.id === user.id ? 'text-emerald-500 translate-x-1' : 'text-slate-300'}`}>chevron_right</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Matriz de Permisos */}
            <div className="lg:col-span-8">
                {selectedUser ? (
                    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white dark:border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-900/10">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
                                    <span className="material-icons text-2xl">security</span>
                                </div>
                                <div>
                                    <h3 className="font-display-black text-slate-900 dark:text-white text-lg leading-tight">{selectedUser.full_name}</h3>
                                    <p className="text-xs font-display-medium text-slate-500">Configuración de accesos y privilegios</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedUser.role}
                                    onChange={(e) => handleUpdateRole(selectedUser.id, e.target.value)}
                                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-display-bold outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="VISOR">VISOR (Solo Lectura)</option>
                                    <option value="OPERADOR">OPERADOR (Gestión)</option>
                                    <option value="REPRESENTANTE">REPRESENTANTE (Comité/Torre)</option>
                                    <option value="PROPIETARIO">PROPIETARIO (Portal)</option>
                                    <option value="MASTER">MASTER (Total)</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-8">
                            {selectedUser.role === 'MASTER' ? (
                                <div className="p-12 text-center bg-emerald-50/50 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-800/30">
                                    <span className="material-icons text-5xl text-emerald-500 mb-4">verified_user</span>
                                    <h4 className="font-display-black text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.2em] text-sm mb-2">Administrador Master</h4>
                                    <p className="text-slate-500 text-sm max-w-sm mx-auto">Este usuario tiene acceso total a todos los módulos y configuraciones del sistema. No es necesario configurar permisos granulares.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-separate border-spacing-y-2">
                                            <thead>
                                                <tr>
                                                    <th className="px-4 pb-2 text-[10px] font-display-black text-slate-400 uppercase tracking-widest">Módulo</th>
                                                    <th className="px-4 pb-2 text-[10px] font-display-black text-slate-400 uppercase tracking-widest text-center">Ver</th>
                                                    <th className="px-4 pb-2 text-[10px] font-display-black text-slate-400 uppercase tracking-widest text-center">Crear</th>
                                                    <th className="px-4 pb-2 text-[10px] font-display-black text-slate-400 uppercase tracking-widest text-center">Editar</th>
                                                    <th className="px-4 pb-2 text-[10px] font-display-black text-slate-400 uppercase tracking-widest text-center">Borrar</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {userPermissions.map((perm) => (
                                                    <tr key={perm.module_key} className="group">
                                                        <td className="px-4 py-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-l-2xl border-l border-y border-slate-100 dark:border-slate-800 group-hover:bg-emerald-500/5 transition-colors">
                                                            <span className="font-display-bold text-sm text-slate-700 dark:text-slate-200">
                                                                {MODULES.find(m => m.key === perm.module_key)?.label || perm.module_key}
                                                            </span>
                                                        </td>
                                                        {['can_view', 'can_create', 'can_update', 'can_delete'].map((field) => (
                                                            <td key={field} className="px-4 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-y border-slate-100 dark:border-slate-800 group-hover:bg-emerald-500/5 transition-colors text-center">
                                                                <button
                                                                    onClick={() => togglePermission(perm.module_key, field)}
                                                                    className={`w-10 h-6 rounded-full relative transition-all duration-300 ${perm[field] ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                                >
                                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${perm[field] ? 'left-5' : 'left-1'}`}></div>
                                                                </button>
                                                            </td>
                                                        ))}
                                                        {/* Celda fantasma para redondear el final */}
                                                        <td className="w-0 p-0 rounded-r-2xl border-r border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 group-hover:bg-emerald-500/5 transition-colors"></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="pt-6 flex justify-end">
                                        <button
                                            onClick={handleSavePermissions}
                                            disabled={saving}
                                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                                        >
                                            <span className="material-icons text-sm">{saving ? 'sync' : 'save'}</span>
                                            {saving ? 'Guardando...' : 'Aplicar Matriz de Permisos'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 bg-slate-50/30 dark:bg-slate-900/30 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 mb-6">
                            <span className="material-icons text-4xl">touch_app</span>
                        </div>
                        <h4 className="font-display-black text-slate-400 uppercase tracking-widest text-sm mb-2">Editor de Permisos</h4>
                        <p className="text-slate-400 text-sm font-display-medium text-center max-w-xs">Selecciona un usuario de la lista lateral para gestionar sus accesos granulares.</p>
                    </div>
                )}
            </div>

            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={handleCloseModal}
                onSuccess={fetchUsers}
                editUser={userToEdit}
            />
        </div>
    );
};

export default UserManagement;
