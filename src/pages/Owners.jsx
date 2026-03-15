import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

const Owners = () => {
    const { userRole } = useAuth();
    const [owners, setOwners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        full_name: '', // Mantener para compatibilidad en tabla
        email: '',
        phone: '',
        doc_id: '',
        enable_portal: false
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchOwners();
    }, []);

    const fetchOwners = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('owners')
                .select(`
                    *,
                    units (status, number)
                `)
                .order('full_name', { ascending: true });

            if (error) throw error;
            setOwners(data || []);
        } catch (error) {
            console.error('Error fetching owners:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOwner = async (e) => {
        e.preventDefault();
        console.log("1. Iniciando handleSaveOwner");
        if (!formData.full_name) {
            console.log("Error: Nombre vacío");
            return;
        }

        try {
            console.log("2. Estableciendo saving = true");
            setSaving(true);
            let ownerId = editingId;
            const computedFullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
            const ownerPayload = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                full_name: computedFullName,
                email: formData.email,
                phone: formData.phone,
                doc_id: formData.doc_id,
                enable_portal: formData.enable_portal
            };

            if (editingId) {
                console.log("3a. Actualizando owner existente. ID:", editingId);
                const { error } = await supabase
                    .from('owners')
                    .update(ownerPayload)
                    .eq('id', editingId);
                if (error) throw error;
                console.log("4a. Update exitoso");
            } else {
                console.log("3b. Insertando nuevo owner");
                const { data, error } = await supabase
                    .from('owners')
                    .insert([ownerPayload])
                    .select()
                    .single();
                if (error) throw error;
                ownerId = data.id;
                console.log("4b. Insert exitoso. ID:", ownerId);
            }
            // 2. Gestionar Acceso Digital Automático
            console.log("5. Evaluando creación de usuario Auth. enable_portal:", formData.enable_portal);
            
            if (formData.enable_portal) {
                // Validación estricta para Acceso Digital
                if (!formData.email || !formData.doc_id) {
                    console.warn("⚠️ Acceso Digital activado pero falta Email o Cédula. Omitiendo creación de usuario.");
                    alert("Para activar el Acceso Digital, el residente debe tener un Correo Electrónico y una Cédula registrados.");
                    return; // Detener aquí para que el usuario corrija
                }

                const numericPassword = formData.doc_id.replace(/\D/g, '');
                console.log("6. Preparando registro Auth. Email:", formData.email, "Pass (numérica):", numericPassword);

                if (numericPassword.length < 6) {
                    console.warn("⚠️ La cédula tiene menos de 6 números, es posible que el registro falle por requisitos de password.");
                }

                const firstName = formData.first_name.trim();
                const lastName = formData.last_name.trim();
                const fullName = `${firstName} ${lastName}`.trim();

                console.log("7. Ejecutando signUp...");
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: numericPassword,
                    options: {
                        data: {
                            first_name: firstName,
                            last_name: lastName,
                            full_name: fullName,
                            email: formData.email,
                            id_card: formData.doc_id,
                            phone: formData.phone,
                            role: 'PROPIETARIO',
                            owner_id: ownerId,
                            must_change_password: true
                        }
                    }
                });
                console.log("8. Resultado signUp:", { success: !!authData?.user, alreadyReg: authError?.message?.includes('already registered'), error: authError });

                // Lógica de Sincronización de Perfil
                if ((authData?.user || (authError && authError.message.includes('already registered'))) && formData.email) {
                    let userId = authData?.user?.id;

                    if (!userId) {
                        console.log("9. Usuario ya en Auth, intentando localizar perfil por email:", formData.email);
                        const { data: profileCheck } = await supabase
                            .from('user_profiles')
                            .select('id')
                            .eq('email', formData.email)
                            .single();
                        userId = profileCheck?.id;
                    }

                    if (userId) {
                        console.log("10. Ejecutando upsert en user_profiles para ID:", userId);
                        const { error: profileError } = await supabase
                            .from('user_profiles')
                            .upsert({
                                id: userId,
                                first_name: firstName,
                                last_name: lastName,
                                full_name: fullName,
                                email: formData.email,
                                id_card: formData.doc_id,
                                phone: formData.phone,
                                role: 'PROPIETARIO',
                                owner_id: ownerId,
                                must_change_password: true,
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'id' });
                        
                        if (profileError) {
                            console.error("❌ Error en upsert de perfil:", profileError);
                            alert(`Error al crear el perfil de acceso: ${profileError.message}`);
                        } else {
                            console.log("11. Perfil sincronizado correctamente.");
                        }
                    } else {
                        console.warn("⚠️ No se pudo determinar el ID de Auth. El usuario existe pero no tiene perfil y no podemos obtener su UUID sin sesión.");
                        alert("El usuario ya existe en el sistema de autenticación pero no tiene un perfil vinculado. Intenta crearlo manualmente en Configuración > Usuarios.");
                    }
                }

                if (authError && !authError.message.includes('already registered')) {
                    throw authError;
                }
            } else {
                console.log("12. Saltando SignUp. Condiciones no cumplidas o portal desactivado.");
            }

            console.log("13. Cerrando modal y actualizando tabla");
            setShowModal(false);
            resetForm();
            fetchOwners();
        } catch (error) {
            console.error('❌ Error saving owner:', error);
            alert('Error al guardar el propietario: ' + error.message);
        } finally {
            console.log("14. Finalizando saving = false");
            setSaving(false);
        }
    };

    const handleDeleteOwner = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este propietario?')) return;

        try {
            const { error } = await supabase
                .from('owners')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchOwners();
        } catch (error) {
            console.error('Error deleting owner:', error);
            alert('Error al eliminar. Asegúrate de que no tenga apartamentos asignados.');
        }
    };

    const handleEdit = (owner) => {
        setEditingId(owner.id);
        setFormData({
            first_name: owner.first_name || (owner.full_name ? owner.full_name.split(' ')[0] : ''),
            last_name: owner.last_name || (owner.full_name ? owner.full_name.split(' ').slice(1).join(' ') : ''),
            full_name: owner.full_name || '',
            email: owner.email || '',
            phone: owner.phone || '',
            doc_id: owner.doc_id || '',
            enable_portal: owner.enable_portal || false
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ first_name: '', last_name: '', full_name: '', email: '', phone: '', doc_id: '', enable_portal: false });
    };

    const filteredOwners = owners.filter(owner =>
        owner.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (owner.doc_id && owner.doc_id.includes(searchTerm))
    );

    return (
        <div className="max-w-[1600px] mx-auto p-4 lg:p-8 pb-32 font-display">
            {/* Header - Social VIVO Premium */}
            <div className="relative mb-12 animate-fade-in">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 relative z-10">
                    <div className="space-y-4">
                        <nav className="flex items-center gap-3 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400">
                            <Link to="/admin" className="hover:text-emerald-500 transition-colors">Inicio</Link>
                            <span className="material-icons text-[10px]">chevron_right</span>
                            <span className="text-emerald-500">Comunidad</span>
                            <span className="material-icons text-[10px]">chevron_right</span>
                            <span className="text-slate-900 dark:text-white">Propietarios</span>
                        </nav>
                        <div className="flex items-center gap-6">
                            <div className="w-2 h-12 bg-gradient-to-b from-emerald-400 to-teal-600 rounded-full shadow-lg shadow-emerald-500/20"></div>
                            <div>
                                <h1 className="text-5xl font-display-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">
                                    Directorio <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">VIVO</span>
                                </h1>
                                <p className="text-xs font-display-medium text-slate-500 uppercase tracking-[0.3em]">Gestión de Capital Humano y Residentes</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {userRole !== 'VISOR' && (
                            <button
                                onClick={() => { resetForm(); setShowModal(true); }}
                                className="group relative px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
                            >
                                <span className="material-icons text-lg">person_add</span>
                                <span>Nuevo Propietario</span>
                            </button>
                        )}
                    </div>
                </div>
                {/* Decorative background element */}
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-emerald-500/5 blur-[100px] -z-10 rounded-full"></div>
            </div>

            {/* Search - Social Insight Style */}
            <div className="relative mb-10 group/search animate-fade-in">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 blur-2xl opacity-0 group-hover/search:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-3xl p-2 flex items-center shadow-2xl active-premium-card">
                    <div className="flex-1 flex items-center px-6">
                        <span className="material-icons text-emerald-500 mr-4">search</span>
                        <input
                            type="text"
                            placeholder="LOCALIZAR POR NOMBRE O DOCUMENTO..."
                            className="w-full bg-transparent border-none focus:outline-none font-display-bold text-sm tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-display-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                        />
                    </div>
                    <div className="hidden md:flex items-center gap-2 px-6 border-l border-white/10 dark:border-white/5">
                        <span className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest">Resultados:</span>
                        <span className="text-sm font-display-black text-emerald-500">{filteredOwners.length}</span>
                    </div>
                </div>
            </div>

            {/* Table - Social Board Aesthetic */}
            <div className="relative group/table animate-fade-in-up">
                <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-[3rem] -z-10"></div>
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <div className="max-h-[600px] overflow-y-auto overflow-x-auto custom-scrollbar relative">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-emerald-900 dark:bg-black/60 border-b border-white/10 sticky top-0 z-20">
                                    <th className="px-8 py-6 text-[10px] font-display-black text-emerald-400 uppercase tracking-[0.2em]">Residente / Identificación</th>
                                    <th className="px-8 py-6 text-[10px] font-display-black text-emerald-400 uppercase tracking-[0.2em]">Información de Contacto</th>
                                    <th className="px-8 py-6 text-[10px] font-display-black text-emerald-400 uppercase tracking-[0.2em]">Unidades Vinculadas</th>
                                    <th className="px-8 py-6 text-[10px] font-display-black text-emerald-400 uppercase tracking-[0.2em] text-right">Gestión</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 dark:divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                                                <span className="text-xs font-display-black text-slate-400 uppercase tracking-widest">Sincronizando Directorio...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredOwners.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-40">
                                                <span className="material-icons text-6xl text-slate-400">person_off</span>
                                                <span className="text-xs font-display-black text-slate-400 uppercase tracking-widest">No se detectaron registros</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOwners.map((owner) => (
                                        <tr key={owner.id} className="group/row hover:bg-emerald-500/5 transition-all duration-300">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-display-black text-lg shadow-lg shadow-emerald-500/20 group-hover/row:scale-110 transition-transform">
                                                            {owner.full_name.charAt(0)}
                                                        </div>
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm"></div>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-display-bold text-slate-900 dark:text-white text-base tracking-tight group-hover/row:text-emerald-500 transition-colors">
                                                            {owner.full_name}
                                                        </span>
                                                        <span className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-white/5 w-fit px-2 py-0.5 rounded-md mt-1">
                                                            ID: {owner.doc_id || 'NO REGISTRADO'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                        <span className="material-icons text-xs text-emerald-500/60">email</span>
                                                        <span className="text-xs font-display-medium lowercase tracking-wider">{owner.email || 'SIN EMAIL'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-400">
                                                        <span className="material-icons text-xs text-emerald-500/60">phone_iphone</span>
                                                        <span className="text-[10px] font-display-bold tracking-widest">{owner.phone || 'SIN TELÉFONO'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-wrap gap-2">
                                                    {owner.units && owner.units.length > 0 ? (
                                                        owner.units.map((u, idx) => (
                                                            <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all ${u.status === 'Solvente'
                                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                                                : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                                                }`}>
                                                                <span className="text-[10px] font-display-black uppercase tracking-widest">{u.number}</span>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'Solvente' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest border border-dashed border-white/10 px-3 py-1.5 rounded-xl">LIBRE DE ASIGNACIÓN</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2 px-4 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                    {userRole !== 'VISOR' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(owner)}
                                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 border border-white/10 shadow-lg text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all transform hover:-translate-y-1"
                                                                title="Editar Perfil"
                                                            >
                                                                <span className="material-icons text-lg">edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteOwner(owner.id)}
                                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 border border-white/10 shadow-lg text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform hover:-translate-y-1"
                                                                title="Revocar Acceso"
                                                            >
                                                                <span className="material-icons text-lg">delete_sweep</span>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-300">
                                                            <span className="material-icons text-lg">lock</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal - Social VIVO Premium */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-300">
                        {/* Gradient Glow */}
                        <div className="absolute inset-x-0 -top-20 h-64 bg-emerald-500/20 blur-[100px] -z-10 rounded-full"></div>

                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-white/5 rounded-[3rem] p-10 shadow-3xl overflow-hidden relative">
                            {/* Close Button */}
                            <button
                                onClick={() => setShowModal(false)}
                                className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90"
                            >
                                <span className="material-icons">close</span>
                            </button>

                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-1.5 h-8 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/40"></div>
                                <h3 className="text-3xl font-display-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                    {editingId ? 'Editar' : 'Vincular'} <span className="text-emerald-500">Residente</span>
                                </h3>
                            </div>

                            <form onSubmit={handleSaveOwner} className="space-y-8">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="group/field">
                                            <label className="block text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-1 group-focus-within/field:text-emerald-500 transition-colors">Nombres</label>
                                            <div className="relative">
                                                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/field:text-emerald-500 transition-colors text-lg">person</span>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full bg-slate-100/50 dark:bg-black/20 border border-transparent focus:border-emerald-500/30 dark:focus:border-emerald-500/20 rounded-2xl pl-14 pr-6 py-4 outline-none font-display-bold text-sm tracking-wide text-slate-900 dark:text-white transition-all placeholder:text-slate-400/50"
                                                    placeholder="EJ. JUAN"
                                                    value={formData.first_name}
                                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value.toUpperCase() })}
                                                />
                                            </div>
                                        </div>

                                        <div className="group/field">
                                            <label className="block text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-1 group-focus-within/field:text-emerald-500 transition-colors">Apellidos</label>
                                            <div className="relative">
                                                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/field:text-emerald-500 transition-colors text-lg">person_outline</span>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full bg-slate-100/50 dark:bg-black/20 border border-transparent focus:border-emerald-500/30 dark:focus:border-emerald-500/20 rounded-2xl pl-14 pr-6 py-4 outline-none font-display-bold text-sm tracking-wide text-slate-900 dark:text-white transition-all placeholder:text-slate-400/50"
                                                    placeholder="EJ. PÉREZ"
                                                    value={formData.last_name}
                                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value.toUpperCase() })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="group/field">
                                            <label className="block text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-1 group-focus-within/field:text-emerald-500 transition-colors">Cédula / RIF</label>
                                            <div className="relative">
                                                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/field:text-emerald-500 transition-colors text-lg">badge</span>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full bg-slate-100/50 dark:bg-black/20 border border-transparent focus:border-emerald-500/30 dark:focus:border-emerald-500/20 rounded-2xl pl-14 pr-6 py-4 outline-none font-display-bold text-sm tracking-widest text-slate-900 dark:text-white transition-all placeholder:text-slate-400/50"
                                                    placeholder="V-12345678"
                                                    value={formData.doc_id}
                                                    onChange={(e) => setFormData({ ...formData, doc_id: e.target.value.toUpperCase() })}
                                                />
                                            </div>
                                        </div>

                                        <div className="group/field">
                                            <label className="block text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-1 group-focus-within/field:text-emerald-500 transition-colors">Celular</label>
                                            <div className="relative">
                                                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/field:text-emerald-500 transition-colors text-lg">smartphone</span>
                                                <input
                                                    type="tel"
                                                    className="w-full bg-slate-100/50 dark:bg-black/20 border border-transparent focus:border-emerald-500/30 dark:focus:border-emerald-500/20 rounded-2xl pl-14 pr-6 py-4 outline-none font-display-bold text-sm tracking-widest text-slate-900 dark:text-white transition-all placeholder:text-slate-400/50"
                                                    placeholder="04121234567"
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="group/field">
                                        <label className="block text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-1 group-focus-within/field:text-emerald-500 transition-colors">Correo Electrónico</label>
                                        <div className="relative">
                                            <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/field:text-emerald-500 transition-colors text-lg">alternate_email</span>
                                            <input
                                                type="email"
                                                className="w-full bg-slate-100/50 dark:bg-black/20 border border-transparent focus:border-emerald-500/30 dark:focus:border-emerald-500/20 rounded-2xl pl-14 pr-6 py-4 outline-none font-display-medium text-sm text-slate-900 dark:text-white transition-all placeholder:text-slate-400/50"
                                                placeholder="correo@ejemplo.com"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="group/field pt-2">
                                        <label className="flex items-center gap-4 cursor-pointer p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 transition-all">
                                            <div className="flex-1">
                                                <span className="block text-[10px] font-display-black text-emerald-600 uppercase tracking-widest mb-1">Acceso Digital</span>
                                                <p className="text-[10px] font-display-medium text-slate-500 leading-tight">Activar acceso automático al Portal del Propietario</p>
                                            </div>
                                            <div
                                                onClick={() => setFormData({ ...formData, enable_portal: !formData.enable_portal })}
                                                className={`w-12 h-6 rounded-full relative transition-all duration-300 ${formData.enable_portal ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${formData.enable_portal ? 'left-7' : 'left-1'}`}></div>
                                            </div>
                                        </label>
                                        {!editingId && formData.enable_portal && (
                                            <p className="mt-3 px-2 text-[9px] font-display-bold text-emerald-500/70 uppercase tracking-tighter">
                                                <span className="material-icons text-[10px] align-middle mr-1">info</span>
                                                Se usará la cédula como contraseña temporal
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-6 flex flex-col md:flex-row gap-4">
                                    <button
                                        type="button"
                                        onClick={() => { setShowModal(false); resetForm(); }}
                                        className="flex-1 px-8 py-4 rounded-2xl font-display-black text-[10px] uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-[2] relative group px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden"
                                    >
                                        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                                        {saving ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                <span>Procesando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons text-lg">save</span>
                                                <span>Confirmar Registro</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Owners;
