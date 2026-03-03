/**
 * BCV Scheduler — Scraper diario automático
 * Corre cada hora en días hábiles (L-V, 8am-5pm, hora Venezuela)
 * Uso: node scripts/bcv_scheduler.js
 * PM2: pm2 start scripts/bcv_scheduler.js --name bcv-scheduler
 */

import cron from 'node-cron';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { createWorker } from 'tesseract.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// ── Configuración ─────────────────────────────────────────────────────────────
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  Usando anon key — agrega SUPABASE_SERVICE_ROLE_KEY al .env para evitar errores RLS');
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, supabaseKey);

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
const apiHash = process.env.TELEGRAM_API_HASH || '';
const session = new StringSession(process.env.TELEGRAM_SESSION || '');

const BCV_CHANNEL = 'DolarOficialBCV';
const MESSAGES_LIMIT = 5; // Solo los últimos (son publicaciones diarias)

// ── Parsing del texto OCR ─────────────────────────────────────────────────────
function parseTextBCV(text) {
    const valorMatch =
        text.match(/USD\s+([\d,.]+)/i) ||
        text.match(/Bs\s*\/\s*USD\s+([\d,.]+)/i);

    let valor = null;
    if (valorMatch?.[1]) {
        valor = parseFloat(valorMatch[1].replace(',', '.'));
    }

    const fechaMatch = text.match(/(\d{2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s+(\d{4})/i);
    let fecha = null;
    if (fechaMatch) {
        const meses = {
            'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
        };
        const key = Object.keys(meses).find(k => fechaMatch[2].toLowerCase().startsWith(k));
        if (key) fecha = `${fechaMatch[3]}-${meses[key]}-${fechaMatch[1]}`;
    }

    return { fecha, valor };
}

// ── Lógica principal ──────────────────────────────────────────────────────────
async function fetchBCVRate() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Dom, 6=Sab

    // Saltar fines de semana (el cron ya lo controla, pero por seguridad)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log('📅 Fin de semana — Sin publicación BCV. La app usará la tasa del último día hábil.');
        return;
    }

    const timestamp = now.toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    console.log(`\n[${timestamp}] 🔄 Consultando tasa BCV...`);

    if (!apiId || !apiHash || !process.env.TELEGRAM_SESSION) {
        console.error('❌ Faltan credenciales de Telegram en el .env');
        return;
    }

    const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 3 });
    let worker = null;

    try {
        await client.connect();

        const messages = await client.getMessages(BCV_CHANNEL, { limit: MESSAGES_LIMIT });
        worker = await createWorker('spa');

        let saved = 0;

        for (const msg of messages) {
            if (!msg.media) continue;

            const buffer = await client.downloadMedia(msg.media);
            const tempPath = path.join(process.cwd(), `_temp_bcv_${msg.id}.jpg`);
            fs.writeFileSync(tempPath, buffer);

            const { data: { text } } = await worker.recognize(tempPath);
            fs.unlinkSync(tempPath);

            const { fecha, valor } = parseTextBCV(text);
            if (!fecha || !valor) continue;

            console.log(`  📊 Tasa encontrada: Bs. ${valor} (${fecha})`);

            const { error } = await supabase
                .from('exchange_rates')
                .upsert({
                    rate_date: fecha,
                    rate_value: valor,
                    provider: 'BCV',
                    metadata: { msg_id: msg.id }
                }, { onConflict: 'rate_date,provider' });

            if (error) {
                console.error(`  ❌ Error Supabase: ${error.message}`);
            } else {
                console.log(`  ✅ Guardado en Supabase`);
                saved++;
            }
        }

        if (saved === 0) console.log('  ⚠️  Sin tasas nuevas.');

    } catch (err) {
        console.error('❌ Error en scraper:', err.message);
    } finally {
        if (worker) await worker.terminate();
        await client.disconnect();
    }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
// Cada hora en punto, L-V, 8am-5pm, hora Venezuela
const CRON_SCHEDULE = '0 8-17 * * 1-5';

console.log('📡 BCV Scheduler iniciado');
console.log(`⏰ Horario: ${CRON_SCHEDULE} (L-V 8am-5pm, America/Caracas)`);
console.log('─'.repeat(50));

// Ejecutar inmediatamente al arrancar
fetchBCVRate();

// Luego según el cron
cron.schedule(CRON_SCHEDULE, fetchBCVRate, {
    timezone: 'America/Caracas'
});

console.log('✅ Scheduler corriendo... (Ctrl+C para detener)\n');
