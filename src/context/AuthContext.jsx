import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                setProfile(null);
            } else {
                setProfile(data);
            }
        } catch (err) {
            console.error('Unexpected error fetching profile:', err);
            setProfile(null);
        }
    };

    useEffect(() => {
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const currentUser = session?.user ?? null;
                setUser(currentUser);
                // No esperamos fetchProfile: liberamos loading de inmediato para que
                // las páginas rendericen. El perfil llega en paralelo y actualiza el estado.
                if (currentUser) {
                    fetchProfile(currentUser.id); // <-- sin await
                }
            } catch (error) {
                console.error('AuthContext: Critical initialization error:', error);
            } finally {
                setLoading(false);
            }
        };

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
                fetchProfile(currentUser.id); // <-- sin await
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email, password) => {
        console.log('AuthContext: Iniciando signInWithPassword con Supabase', email);
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        console.log('AuthContext: signInWithPassword finalizado. Error:', error ? error.message : 'Ninguno');
        if (error) {
            console.error('AuthContext: Error real en signInWithPassword:', error);
            throw error;
        }
        console.log('AuthContext: Autenticación exitosa en signInWithPassword');
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const value = {
        signIn,
        signOut,
        user,
        profile,
        loading,
        role: profile?.role || 'VISOR' // Default to safest role if not found
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
