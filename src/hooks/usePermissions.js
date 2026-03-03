import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
    const { user } = useAuth();
    const [permissions, setPermissions] = useState([]);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [permissionsLoading, setPermissionsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setRole(null);
            setPermissions([]);
            setLoading(false);
            setPermissionsLoading(false);
            return;
        }

        const fetchAllUserData = async () => {
            try {
                setLoading(true);
                setPermissionsLoading(true);

                // 1. Obtener Perfil y Estado de Password
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('role, must_change_password')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profile) {
                    setRole(profile.role);

                    // Solo forzar cambio si NO es MASTER
                    if (profile.role !== 'MASTER' && profile.must_change_password) {
                        setMustChangePassword(true);
                    } else {
                        setMustChangePassword(false);
                    }
                }

                // BYPASS ABSOLUTO PARA EL DUEÑO (Gavy)
                // Usamos toLowerCase() para evitar problemas de capitalización
                if (user.email?.toLowerCase().trim() === 'gavyjose@gmail.com') {
                    setRole('MASTER');
                    setMustChangePassword(false);
                }

                // 2. Obtener Permisos Granulares
                const { data: perms } = await supabase
                    .from('module_permissions')
                    .select('*')
                    .eq('profile_id', user.id);

                if (perms) {
                    setPermissions(perms);
                }

            } catch (err) {
                console.error('RBAC: critical error:', err);
            } finally {
                setLoading(false);
                setPermissionsLoading(false);
            }
        };

        fetchAllUserData();
    }, [user]);

    // isMaster es true si el rol es MASTER o si el email es el del dueño
    const isMaster = role === 'MASTER' || user?.email?.toLowerCase().trim() === 'gavyjose@gmail.com';

    const hasPermission = (moduleKey, action = 'can_view') => {
        if (isMaster) return true;
        const modulePerm = permissions.find(p => p.module_key === moduleKey);
        if (!modulePerm) return false;
        return modulePerm[action] === true;
    };

    return {
        permissions,
        role,
        loading: loading || permissionsLoading,
        hasPermission,
        isMaster,
        mustChangePassword
    };
};
