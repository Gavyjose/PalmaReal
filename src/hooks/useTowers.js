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

            // AUTO-REPAIR LOGIC
            if (!data || data.length === 0) {
                console.warn('Towers table is empty! Auto-repairing from units table...');
                const { data: unitsData, error: uError } = await supabase.from('units').select('tower');
                if (!uError && unitsData) {
                    const uniqueNames = [...new Set(unitsData.map(u => u.tower))];
                    if (uniqueNames.length > 0) {
                        const newTowers = uniqueNames.map(name => ({ name, is_active: true }));
                        await supabase.from('towers').upsert(newTowers, { onConflict: 'name' });
                        // Refetch after repair
                        const { data: repairedData } = await supabase.from('towers').select('*').order('name');
                        setTowers(repairedData || []);
                        return;
                    }
                }
            }

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

    const [lastSelectedTower, setLastSelectedTowerState] = useState(() => {
        return localStorage.getItem('palmareal_last_tower') || '';
    });

    const setLastSelectedTower = (towerName) => {
        if (towerName && towerName !== 'Todas las Torres') {
            localStorage.setItem('palmareal_last_tower', towerName);
            setLastSelectedTowerState(towerName);
        }
    };

    return {
        towers,
        activeTowers,
        loading,
        fetchTowers,
        toggleTowerStatus,
        lastSelectedTower,
        setLastSelectedTower
    };
};
