import { useState, useEffect } from 'react';
import { ocrService } from '../utils/ocrService';
import { supabase } from '../supabase';

/**
 * Hook personalizado para manejar la lógica de validación OCR y carga de comprobantes.
 * @param {string} reference - El número de referencia ingresado manualmente.
 * @returns {Object} Estados y funciones para el manejo de OCR.
 */
export const usePaymentOcr = (reference) => {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [ocrValidation, setOcrValidation] = useState(null); // { match: boolean, found: string[] }

    // Reactividad para validación OCR al cambiar la referencia manualmente
    useEffect(() => {
        // Solo re-validar si ya procesamos el OCR previamente
        if (ocrValidation && ocrValidation.found) {
            const isValid = ocrService.validateReference(reference, ocrValidation.found);
            // Solo actualizar si el resultado cambió para evitar renders infinitos
            if (isValid !== ocrValidation.match) {
                setOcrValidation(prev => ({ ...prev, match: isValid }));
            }
        }
    }, [reference, ocrValidation?.found]);

    /**
     * Maneja la selección de archivo y dispara el proceso OCR.
     */
    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        
        // Limpiar URL previa si existe
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(selectedFile));
        
        setOcrProcessing(true);
        setOcrValidation(null);

        try {
            const foundNumbers = await ocrService.extractNumbers(selectedFile);
            const isValid = ocrService.validateReference(reference, foundNumbers);
            setOcrValidation({ match: isValid, found: foundNumbers });
        } catch (error) {
            console.error('OCR Error:', error);
            // En caso de error, permitimos continuar pero sin validación positiva
            setOcrValidation({ match: false, found: [] });
        } finally {
            setOcrProcessing(false);
        }
    };

    /**
     * Limpia todos los estados del OCR.
     */
    const resetOcr = () => {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setOcrProcessing(false);
        setOcrValidation(null);
    };

    /**
     * Sube el comprobante al storage de Supabase.
     * @param {string} bucket - Nombre del bucket.
     * @param {string} path - Prefijo de la ruta (ej: unit_id o owner_id).
     */
    const uploadReceipt = async (bucket, path) => {
        if (!file) return null;
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${path}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);
            
            return publicUrl;
        } catch (error) {
            console.error('Storage Upload Error:', error);
            throw error;
        }
    };

    return {
        file,
        previewUrl,
        ocrProcessing,
        ocrValidation,
        handleFileChange,
        resetOcr,
        uploadReceipt
    };
};
