import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export const useTowers = () => {
    const [towers, setTowers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTowers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('towers')
                .select('*')
                .order('name');

            if (error) throw error;
            setTowers(data || []);
        } catch (error) {
            console.error('Error fetching towers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTowers();
    }, []);

    const toggleTowerStatus = async (name, currentStatus) => {
        try {
            const { error } = await supabase
                .from('towers')
                .update({ is_active: !currentStatus })
                .eq('name', name);

            if (error) throw error;
            await fetchTowers();
            return true;
        } catch (error) {
            console.error('Error updating tower status:', error);
            return false;
        }
    };

    const activeTowers = towers.filter(t => t.is_active);

    return {
        towers,
        activeTowers,
        loading,
        fetchTowers,
        toggleTowerStatus
    };
};
