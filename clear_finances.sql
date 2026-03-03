-- Limpiar asignaciones de cuotas base y especiales
DELETE FROM unit_payment_allocations;
-- Limpiar pagos principales
DELETE FROM unit_payments;
-- Limpiar pagos directos de cuotas especiales
DELETE FROM special_quota_payments;
-- Reiniciar las deudas iniciales/arrastres históricos a cero
UPDATE units SET initial_debt = 0;
