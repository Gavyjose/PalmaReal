import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';

const CSVImporter = ({ onImportSuccess }) => {
    const [importing, setImporting] = useState(false);

    const processTransactions = async (rawData) => {
        try {
            // Map fields to DB columns
            const transactions = rawData.map(row => {
                // Intelligent mapping attempts (Excel keys might differ depending on headers)
                // Normalize keys to lowercase for easier matching
                const normalizedRow = {};
                Object.keys(row).forEach(key => {
                    const normalizedKey = key.toLowerCase().trim();
                    normalizedRow[normalizedKey] = row[key];
                });

                const date = normalizedRow['date'] || normalizedRow['fecha'] || normalizedRow['transaction date'] || normalizedRow['f. valor'] || normalizedRow['f.valor'];
                // 'Monto Bs.' is the exact column name from Venezuelan bank exports
                const amount = normalizedRow['monto bs.'] || normalizedRow['monto bs'] || normalizedRow['amount'] || normalizedRow['monto'] || normalizedRow['importe'] || normalizedRow['valor'];

                const desc = normalizedRow['description'] || normalizedRow['descripción'] || normalizedRow['descripcion'] || normalizedRow['concepto'] || normalizedRow['detalle'];
                const ref = normalizedRow['reference'] || normalizedRow['referencia'] || normalizedRow['ref'] || normalizedRow['nro. ref.'] || normalizedRow['numero de referencia'];

                if (!date) return null; // Skip invalid rows

                // Skip summary/header rows (e.g. 'SALDO FINAL', 'SALDO ANTERIOR')
                const descStr = (desc || '').toString().toUpperCase();
                if (descStr.includes('SALDO FINAL') || descStr.includes('SALDO ANTERIOR') || descStr.includes('SALDO INICIAL')) return null;

                // Amount parsing logic
                let parsedAmount = 0;

                const credit = normalizedRow['crédito'] || normalizedRow['abono'] || normalizedRow['haber'] || 0;
                const debit = normalizedRow['débito'] || normalizedRow['cargo'] || normalizedRow['debe'] || 0;

                if (amount !== undefined && amount !== null && amount !== '') {
                    if (typeof amount === 'number') {
                        parsedAmount = amount;
                    } else if (typeof amount === 'string') {
                        parsedAmount = parseFloat(amount.replace(/[^0-9.-]+/g, ""));
                    }
                } else if (credit || debit) {
                    let creditVal = 0;
                    let debitVal = 0;
                    if (credit) creditVal = typeof credit === 'string' ? parseFloat(credit.replace(/[^0-9.-]+/g, "")) : credit;
                    if (debit) debitVal = typeof debit === 'string' ? parseFloat(debit.replace(/[^0-9.-]+/g, "")) : debit;

                    parsedAmount = creditVal - debitVal;
                } else {
                    return null;
                }

                if (isNaN(parsedAmount)) return null;

                // Date parsing - handle multiple formats
                let parsedDate;
                if (typeof date === 'number') {
                    // Convert Excel serial date to JS Date
                    const excelDate = new Date(Math.round((date - 25569) * 86400 * 1000));
                    parsedDate = excelDate.toISOString().split('T')[0]; // Store as YYYY-MM-DD
                } else if (typeof date === 'string') {
                    const dateStr = date.trim();
                    // DD/MM/YYYY (Venezuelan bank format)
                    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                        const [day, month, year] = dateStr.split('/');
                        parsedDate = `${year}-${month}-${day}`;
                    }
                    // DD-MM-YYYY
                    else if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
                        const [day, month, year] = dateStr.split('-');
                        parsedDate = `${year}-${month}-${day}`;
                    }
                    // YYYY-MM-DD (already correct)
                    else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        parsedDate = dateStr;
                    }
                    // Fallback: try native parsing
                    else {
                        const d = new Date(dateStr);
                        parsedDate = isNaN(d) ? null : d.toISOString().split('T')[0];
                    }
                } else {
                    parsedDate = null;
                }

                if (!parsedDate) return null;

                return {
                    transaction_date: parsedDate,  // Store as YYYY-MM-DD string
                    amount: parsedAmount,
                    description: desc || 'Importado',
                    reference: ref || '',
                    status: 'PENDING'
                };
            }).filter(tx => tx !== null);

            if (transactions.length > 0) {
                const { error } = await supabase
                    .from('bank_transactions')
                    .upsert(transactions, {
                        onConflict: ['transaction_date', 'amount', 'reference', 'description'],
                        ignoreDuplicates: true
                    });

                if (error) throw error;

                alert(`Se importaron ${transactions.length} registros exitosamente.`);
                if (onImportSuccess) onImportSuccess();
            } else {
                // Debugging Aid: Show what columns were found
                const headers = Object.keys(rawData[0] || {}).join(', ');
                const sampleRow = JSON.stringify(rawData[0] || {}, null, 2);
                alert(`No se encontraron registros válidos.\n\nColumnas detectadas: ${headers}\n\nFila de Ejemplo:\n${sampleRow}`);
            }
        } catch (error) {
            console.error('Error processing data:', error);
            alert('Error al procesar datos: ' + error.message);
        } finally {
            setImporting(false);
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImporting(true);
        const fileExt = file.name.split('.').pop().toLowerCase();

        if (fileExt === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => processTransactions(results.data),
                error: (error) => {
                    setImporting(false);
                    alert('Error CSV: ' + error.message);
                }
            });
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Convert to array of arrays first to find header row
                    const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                    let headerRowIndex = 0;
                    let foundHeader = false;

                    // Scan first 20 rows for header keywords
                    for (let i = 0; i < Math.min(jsonSheet.length, 20); i++) {
                        const row = jsonSheet[i].map(cell => (cell ? cell.toString().toLowerCase() : ""));
                        const hasDate = row.some(cell => cell.includes('fecha') || cell.includes('date'));
                        const hasAmount = row.some(cell => cell.includes('monto') || cell.includes('importe') || cell.includes('valor') || cell.includes('cargo') || cell.includes('abono') || cell.includes('amount'));

                        if (hasDate && hasAmount) {
                            headerRowIndex = i;
                            foundHeader = true;
                            break;
                        }
                    }

                    if (!foundHeader) {
                        console.warn("Could not auto-detect header row. Using first row.");
                    }

                    // Re-parse using the found header row
                    // range: headerRowIndex instructs XLSX to start reading from that row
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: "" });

                    console.log("Detected Header Row:", headerRowIndex);

                    processTransactions(jsonData);
                } catch (error) {
                    setImporting(false);
                    alert('Error Excel: ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            setImporting(false);
            alert('Formato no soportado. Use .csv, .xlsx o .xls');
        }

        event.target.value = null;
    };

    return (
        <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors shadow-sm">
            <span className="material-icons text-sm">{importing ? 'hourglass_top' : 'upload_file'}</span>
            <span>{importing ? 'Procesando...' : 'Cargar Extracto (Excel/CSV)'}</span>
            <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
            />
        </label>
    );
};

export default CSVImporter;
