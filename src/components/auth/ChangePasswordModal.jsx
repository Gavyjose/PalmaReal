import React, { useState } from 'react';
import { supabase } from '../../supabase';

const ChangePasswordModal = ({ isOpen, userEmail }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            // 1. Actualizar contraseña en Supabase Auth
            const { error: authError } = await supabase.auth.updateUser({
                password: formData.newPassword
            });

            if (authError) throw authError;

            // 2. Marcar must_change_password como false en el perfil
            const { data: { user } } = await supabase.auth.getUser();
            const { error: profileError } = await supabase
                .from('user_profiles')
                .update({ must_change_password: false })
                .eq('id', user.id);

            if (profileError) throw profileError;

            alert('Contraseña actualizada exitosamente. Ya puedes usar el sistema.');
            window.location.reload(); // Recargar para limpiar estados y permitir acceso
        } catch (err) {
            console.error('Error changing password:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 p-8 animate-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-3xl flex items-center justify-center text-emerald-600 mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                        <span className="material-icons text-4xl">lock_reset</span>
                    </div>
                    <h2 className="text-2xl font-display-black text-slate-900 dark:text-white mb-2">¡Bienvenido al sistema!</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Por seguridad, debes establecer una contraseña privada antes de continuar.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest px-1">Nueva Contraseña</label>
                        <input
                            required
                            type="password"
                            value={formData.newPassword}
                            onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest px-1">Confirmar Contraseña</label>
                        <input
                            required
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-4 text-sm font-display-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                            placeholder="Repite tu clave"
                        />
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
                            <span className="material-icons text-sm">error</span>
                            <p className="text-xs font-display-medium">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                    >
                        {loading ? (
                            <span className="material-icons animate-spin">sync</span>
                        ) : (
                            <span className="material-icons text-sm">verified_user</span>
                        )}
                        {loading ? 'Actualizando...' : 'Definir mi Contraseña'}
                    </button>

                    <p className="text-[10px] text-center text-slate-400 font-display-medium mt-4">
                        Tu nombre de usuario es: <span className="text-emerald-500">{userEmail}</span>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
