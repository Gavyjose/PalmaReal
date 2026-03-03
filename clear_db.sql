-- 1. Limpiar TODAS las asignaciones (distribucion del pago a las cuotas)
DELETE FROM unit_payment_allocations;

-- 2. Limpiar TODOS los recibos de pago principales
DELETE FROM unit_payments;

-- 3. Limpiar TODOS los pagos directos a cuotas especiales
DELETE FROM special_quota_payments;

-- 4. Reiniciar TODAS las deudas iniciales (Saldo Anterior Histórico) a cero
UPDATE units SET initial_debt = 0;
