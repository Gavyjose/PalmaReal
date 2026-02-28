-- Funciones SQL para la integración de tasas BCV automatizadas

-- 1. Función para obtener la tasa de cambio BCV más reciente a una fecha dada
--    (Maneja fines de semana y feriados buscando la última tasa registrada antes de la fecha)
CREATE OR REPLACE FUNCTION get_bcv_rate(p_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
    SELECT rate_value
    FROM exchange_rates
    WHERE rate_date <= p_date
      AND provider = 'BCV'
    ORDER BY rate_date DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Ejecuta esto en el SQL Editor de Supabase
