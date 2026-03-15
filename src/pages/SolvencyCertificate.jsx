import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const SolvencyCertificate = () => {
    const { unitId } = useParams();
    const navigate = useNavigate();
    const [unit, setUnit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState('');

    useEffect(() => {
        const fetchUnit = async () => {
            try {
                const { data, error: dbError } = await supabase
                    .from('units')
                    .select(`
                        id,
                        number,
                        tower,
                        owners (full_name, doc_id)
                    `)
                    .eq('id', unitId)
                    .single();

                if (dbError) throw dbError;
                setUnit(data);
                
                // Formatear la fecha actual ej: La Victoria, 13 de marzo de 2026
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                const formattedDate = new Date().toLocaleDateString('es-VE', options);
                setCurrentDate(`La Victoria, ${formattedDate}`);
                
            } catch (err) {
                console.error("Error fetching unit:", err);
                setError("No se pudo cargar la información de la unidad.");
            } finally {
                setLoading(false);
            }
        };

        fetchUnit();
    }, [unitId]);

    if (loading) return <div className="p-10 text-center font-mono text-slate-500">Generando constancia...</div>;
    if (error) return <div className="p-10 text-center text-rose-500 font-bold">{error}</div>;

    const ownerName = unit?.owners?.full_name || "Propietario";
    const identityDoc = unit?.owners?.doc_id || "N/A";
    const towerName = unit?.tower || "";
    const unitNumber = unit?.number || "";

    return (
        <div className="bg-white font-sans printable-document">
            {/* Solo visible en pantalla (para volver e imprimir manual) */}
            <div className="print:hidden p-4 bg-slate-100 flex justify-between items-center shadow-md mb-8">
                <button 
                    onClick={() => navigate('/portal')} 
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                    <span className="material-icons text-lg">arrow_back</span>
                    Volver al Portal
                </button>
                <button 
                    onClick={() => window.print()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold shadow flex items-center gap-2"
                >
                    <span className="material-icons text-lg">print</span>
                    Imprimir Constancia
                </button>
            </div>

            {/* Documento Principal (Tamaño Carta aprox) */}
            <div className="max-w-4xl mx-auto p-16 md:p-24 bg-white print:p-0 print:shadow-none print:max-w-none shadow-xl border border-slate-200">
                
                <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-emerald-800 pb-8 mb-12">
                    <div>
                        <h1 className="text-2xl font-black text-emerald-900 tracking-tight uppercase">Conjunto Residencial Palma Real</h1>
                        <h2 className="text-xl font-bold text-emerald-800 uppercase tracking-tight">"Araguaney 9"</h2>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-1">Junta de Condominio</p>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                        <p>Residencias Palma Real, Torre A9</p>
                        <p>La Victoria - Aragua - Venezuela</p>
                    </div>
                </div>

                <div className="text-center mb-16 space-y-2">
                    <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-900">Constancia de Solvencia</h2>
                    <p className="text-slate-500 font-mono text-sm">Ref. {Math.random().toString(36).substring(2, 10).toUpperCase()}-{new Date().getFullYear()}</p>
                </div>

                <div className="text-lg text-slate-800 leading-relaxed text-justify mb-16 space-y-6">
                    <p>
                        Quien suscribe, la administración del complejo urbanístico <strong>Residencias Palma Real</strong>, hace constar por medio del presente documento que el ciudadano(a) <strong>{ownerName}</strong>, titular de la C.I. / RIF <strong>{identityDoc}</strong>, en su carácter de propietario(a) y responsable de la unidad residencial descrita como <strong>{towerName} - Apartamento {unitNumber}</strong>, se encuentra a la fecha totalmente <strong>AL DÍA (SOLVENTE)</strong> con los compromisos correspondientes al condominio, alícuotas ordinarias, aportes de fondo de reserva y cuotas especiales aprobadas en asamblea, presentando un saldo deudor equivalente a <strong>$0.00</strong>.
                    </p>
                    
                    <p>
                        Documento que se expide a petición de la parte interesada, en {currentDate}.
                    </p>
                </div>

                <div className="mt-16 pt-10 flex flex-col items-center border-t border-slate-300 break-inside-avoid">
                    <div className="w-64 border-b border-slate-800 mb-4"></div>
                    <p className="font-bold text-slate-900 uppercase tracking-widest text-sm">Administración</p>
                    <p className="text-slate-500 text-sm mt-1">Junta de Condominio - Residencias Palma Real</p>
                </div>

                <style>{`
                    @media print {
                        body { background: white !important; }
                        .print\\:hidden { display: none !important; }
                        .print\\:p-0 { padding: 0 !important; }
                        .print\\:shadow-none { box-shadow: none !important; }
                        .print\\:border-none { border: none !important; }
                        .print\\:bg-transparent { background: transparent !important; }
                        .print\\:max-w-none { max-width: none !important; }
                        @page { margin: 2.5cm; size: letter; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        .printable-document { min-height: auto !important; }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default SolvencyCertificate;
