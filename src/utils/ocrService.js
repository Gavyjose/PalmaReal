import { createWorker } from 'tesseract.js';

/**
 * Servicio de OCR para extraer referencias de capturas de pago.
 */
export const ocrService = {
    /**
     * Extrae todos los grupos de dígitos de una imagen.
     * @param {File|string} imageSource - Archivo o URL de la imagen.
     * @returns {Promise<string[]>} - Lista de cadenas numéricas encontradas.
     */
    async extractNumbers(imageSource) {
        const worker = await createWorker('spa'); // Usamos español por defecto
        try {
            const { data: { text } } = await worker.recognize(imageSource);
            
            // Extraer grupos de números de al menos 4 dígitos (comunes en referencias)
            const numbers = text.match(/\d{4,}/g) || [];
            
            return numbers;
        } catch (error) {
            console.error('Error en OCR:', error);
            throw new Error('No se pudo procesar la imagen');
        } finally {
            await worker.terminate();
        }
    },

    /**
     * Verifica si una referencia manual coincide con los últimos 6 dígitos 
     * de algún número encontrado en la imagen.
     * @param {string} manualRef - Referencia ingresada por el usuario.
     * @param {string[]} foundNumbers - Números extraídos por el OCR.
     * @returns {boolean} - True si hay coincidencia.
     */
    validateReference(manualRef, foundNumbers) {
        if (!manualRef || foundNumbers.length === 0) return false;
        
        // Limpiamos la referencia manual para quedarnos solo con dígitos
        const cleanManual = manualRef.replace(/\D/g, '');
        const last6Manual = cleanManual.slice(-6);

        if (last6Manual.length < 4) return false; // Demasiado corta para validar con precisión

        return foundNumbers.some(num => {
            const cleanFound = num.replace(/\D/g, '');
            return cleanFound.endsWith(last6Manual);
        });
    }
};
