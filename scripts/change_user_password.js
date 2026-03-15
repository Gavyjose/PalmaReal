import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Asegurarnos de que dotenv cargue desde el directorio principal del proyecto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Falta VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE_KEY en .env');
    console.error('Asegúrate de ejecutar el script desde el directorio raíz (palma-real-app).');
    process.exit(1);
}

// Inicializar el cliente administrador (Service Role Key) para sortear RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function changeUserPassword(email, newPassword) {
    try {
        console.log(`Buscando usuario: ${email}...`);

        // 1. Obtener la lista de usuarios para encontrar el ID del email
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const user = users.find(u => u.email === email);
        if (!user) {
            console.log(`❌ Usuario no encontrado con correo electrónico: ${email}`);
            return;
        }

        console.log(`✅ Usuario encontrado (ID: ${user.id}). Actualizando contraseña...`);

        // 2. Actualizar el usuario por su ID
        const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: newPassword }
        );

        if (updateError) throw updateError;
        console.log(`🔑 ¡Éxito! La contraseña para **${email}** ha sido actualizada a: **${newPassword}**`);
        console.log('Ahora puedes intentar iniciar sesión en el entorno de pruebas.');

    } catch (error) {
        console.error('❌ Error general durante el cambio de contraseña:', error.message);
    }
}

// Recepción de argumentos (email, nuevaClave)
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('⚠️ Uso incorrecto. Por favor, especifica el email y la nueva contraseña.');
    console.log('➡️ Formato: node scripts/change_user_password.js <email> <nueva_clave>');
    console.log('👉 Ejemplo: node scripts/change_user_password.js admin@condominioselite.com MiNuevaClave123!');
    process.exit(1);
}

changeUserPassword(args[0], args[1]);
