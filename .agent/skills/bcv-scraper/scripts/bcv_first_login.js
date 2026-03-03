/**
 * BCV First Login — Ejecutar UNA sola vez para generar TELEGRAM_SESSION
 * Uso: node scripts/bcv_first_login.js
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
const apiHash = process.env.TELEGRAM_API_HASH || '';

if (!apiId || !apiHash) {
    console.error('❌ Faltan TELEGRAM_API_ID y TELEGRAM_API_HASH en el .env');
    process.exit(1);
}

const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
});

console.log('🔑 BCV Scraper — Primer Login de Telegram');
console.log('─'.repeat(50));

await client.start({
    phoneNumber: async () => await input.text('📱 Ingresa tu número de teléfono (ej: +58412...): '),
    password: async () => await input.text('🔐 Contraseña 2FA (deja vacío si no tienes): '),
    phoneCode: async () => await input.text('💬 Código recibido por Telegram/SMS: '),
    onError: (err) => console.error('Error:', err),
});

const sessionString = client.session.save();

console.log('\n✅ ¡Login exitoso!');
console.log('─'.repeat(50));
console.log('📋 Copia esta línea en tu .env:\n');
console.log(`TELEGRAM_SESSION=${sessionString}`);
console.log('\n─'.repeat(50));

await client.disconnect();
process.exit(0);
