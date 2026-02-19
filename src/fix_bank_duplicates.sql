-- 1. Eliminar duplicados manteniendo solo una instancia (la más antigua por id o created_at)
DELETE FROM bank_transactions
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
        ROW_NUMBER() OVER (
            PARTITION BY transaction_date, amount, reference, description
            ORDER BY created_at ASC
        ) as row_num
        FROM bank_transactions
    ) t
    WHERE t.row_num > 1
);

-- 2. Añadir restricción de unicidad para evitar que ocurra de nuevo
-- Nota: Si reference es NULL, la restricción UNIQUE estándar en PostgreSQL no lo trata como duplicado.
-- Por eso usamos COALESCE o simplemente aceptamos que registros sin referencia podrían duplicarse si el resto coincide,
-- o usamos un UNIQUE index con COALESCE.

ALTER TABLE bank_transactions 
DROP CONSTRAINT IF EXISTS unique_bank_tx;

CREATE UNIQUE INDEX unique_bank_tx ON bank_transactions (
    transaction_date, 
    amount, 
    COALESCE(reference, ''), 
    COALESCE(description, '')
);

-- 3. Verificar resultados
SELECT count(*), transaction_date, amount, reference, description
FROM bank_transactions
GROUP BY transaction_date, amount, reference, description
HAVING count(*) > 1;
