-- Migración: Agregar campo is_bank_commission a period_expenses
-- Objetivo: Identificar gastos de comisión bancaria automática

ALTER TABLE period_expenses 
ADD COLUMN IF NOT EXISTS is_bank_commission BOOLEAN DEFAULT FALSE;
