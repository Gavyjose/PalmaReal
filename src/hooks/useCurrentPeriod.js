import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export const useCurrentPeriod = () => {
    const [currentPeriod, setCurrentPeriod] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchCurrentPeriod = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('condo_periods')
                .select('*')
                .eq('status', 'ACTIVE')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                // Ignore PGRST116 (0 rows returned)
                if (error.code !== 'PGRST116') throw error;
            }

            // AUTO-REPAIR LOGIC
            if (!data) {
                console.warn('No active period found! Auto-creating one...');
                const date = new Date();
                const month = date.toLocaleString('es-VE', { month: 'long' });
                const year = date.getFullYear();
                const periodName = `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;

                const newPeriod = {
                    period_name: periodName,
                    amount_bs: 0.00,
                    amount_usd: 0.00,
                    bcv_rate: 0.00,
                    status: 'ACTIVE'
                };

                const { data: insertedPeriod, error: insertError } = await supabase
                    .from('condo_periods')
                    .insert([newPeriod])
                    .select()
                    .single();

                if (insertError) throw insertError;
                setCurrentPeriod(insertedPeriod);
            } else {
                setCurrentPeriod(data);
            }
        } catch (error) {
            console.error('Error fetching/creating current period:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrentPeriod();
    }, []);

    return { currentPeriod, loading, fetchCurrentPeriod };
};
