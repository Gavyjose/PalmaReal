/**
 * Formatea un número al estándar venezolano (punto para miles, coma para decimales)
 * @param {number} amount - El monto a formatear
 * @returns {string} - El monto formateado con símbolo de $
 */
export const formatCurrency = (amount) => {
    const val = typeof amount === 'number' ? amount : parseFloat(amount || 0);
    return val.toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * Formatea un número sin símbolo de moneda pero con el estándar es-VE
 * @param {number} num 
 * @returns {string}
 */
export const formatNumber = (num) => {
    const val = typeof num === 'number' ? num : parseFloat(num || 0);
    return val.toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
