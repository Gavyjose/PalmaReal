const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function cleanup() {
    console.log('--- Iniciando Saneamiento de Base de Datos ---');

    // 1. Obtener todos los periodos
    const { data: periods, error: pError } = await supabase
        .from('condo_periods')
        .select('*');

    if (pError) {
        console.error('Error al obtener periodos:', pError);
        return;
    }

    console.log(`Analizando ${periods.length} registros...`);

    // 2. Agrupar por torre y periodo (normalizado a uppercase)
    const groups = {};
    periods.forEach(p => {
        const key = `${p.tower_id}_${p.period_name.trim().toUpperCase()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
    });

    for (const key in groups) {
        const group = groups[key];

        // Si hay duplicados O si el nombre no está en uppercase
        if (group.length > 1 || group[0].period_name !== group[0].period_name.toUpperCase()) {
            console.log(`\nProcesando grupo: ${key} (${group.length} registros)`);

            // Ordenar por ID para quedarnos con el más reciente (asumiendo que IDs incrementales o UUIDs ordenables)
            // Mejor ordenar por updated_at
            group.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

            const survivor = group[0];
            const victims = group.slice(1);

            // Actualizar el sobreviviente a mayúsculas
            const { error: upError } = await supabase
                .from('condo_periods')
                .update({
                    period_name: survivor.period_name.toUpperCase(),
                    status: survivor.status.toUpperCase()
                })
                .eq('id', survivor.id);

            if (upError) console.error(`Error actualizando ${survivor.id}:`, upError);
            else console.log(`✓ Registro conservado y normalizado: ${survivor.id}`);

            // Eliminar las víctimas
            for (const victim of victims) {
                // Primero eliminar gastos asociados para evitar restricción FK
                const { error: delExpError } = await supabase
                    .from('period_expenses')
                    .delete()
                    .eq('period_id', victim.id);

                if (delExpError) {
                    console.error(`Error eliminando gastos de ${victim.id}:`, delExpError);
                    continue;
                }

                const { error: delError } = await supabase
                    .from('condo_periods')
                    .delete()
                    .eq('id', victim.id);

                if (delError) console.error(`Error eliminando duplicado ${victim.id}:`, delError);
                else console.log(`✗ Duplicado eliminado: ${victim.id}`);
            }
        }
    }

    console.log('\n--- Saneamiento completado ---');
    console.log('NOTA: La restricción UNIQUE se debe aplicar vía SQL Editor en Supabase para máxima seguridad.');
}

cleanup();
