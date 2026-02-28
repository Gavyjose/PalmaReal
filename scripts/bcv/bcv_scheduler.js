/**
 * BCV Daily Scheduler — Palma Real App
 * Revisa automáticamente el canal de Telegram cada hora.
 * Corre cada hora, L-V, 8am-5pm (VET).
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

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
const apiHash = process.env.TELEGRAM_API_HASH || '';
const session = new StringSession(process.env.TELEGRAM_SESSION || '');

const BCV_CHANNEL = 'DolarOficialBCV';

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

async function checkBCV() {
    const now = new Date().toLocaleString("en-US", { timeZone: "America/Caracas" });
    console.log(`\n[${now}] 🤖 Iniciando chequeo BCV...`);

    const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
    let worker = null;

    try {
        await client.connect();
        const messages = await client.getMessages(BCV_CHANNEL, { limit: 5 });
        worker = await createWorker('spa');

        for (const msg of messages) {
            if (!msg.media) continue;

            const buffer = await client.downloadMedia(msg.media);
            const tempPath = path.join(process.cwd(), `scripts/bcv/_sync_${msg.id}.jpg`);
            fs.writeFileSync(tempPath, buffer);

            const { data: { text } } = await worker.recognize(tempPath);
            fs.unlinkSync(tempPath);

            const { fecha, valor } = parseTextBCV(text);
            if (!fecha || !valor) continue;

            const { error } = await supabase
                .from('exchange_rates')
                .upsert({
                    rate_date: fecha,
                    rate_value: valor,
                    provider: 'BCV',
                    metadata: { msg_id: msg.id, synced_at: new Date().toISOString() }
                }, { onConflict: 'rate_date,provider' });

            if (!error) {
                console.log(`✅ Tasa detectada para ${fecha}: Bs. ${valor}`);
                // Basta con encontrar la más reciente
                break;
            }
        }
    } catch (err) {
        console.error('❌ Error en el scheduler:', err.message);
    } finally {
        if (worker) await worker.terminate();
        await client.disconnect();
        console.log(`[${new Date().toLocaleString()}] 💤 Fin del chequeo.`);
    }
}

// Programación: Cada hora (0), de Lunes a Viernes (1-5), entre 8am y 5pm (8-17)
// Formato: minute hour day-of-month month day-of-week
cron.schedule('0 8-17 * * 1-5', () => {
    checkBCV();
}, {
    timezone: "America/Caracas"
});

console.log('🚀 BCV Scheduler activo (L-V 8am-5pm VET)');
console.log('Presiona Ctrl+C para detener.');

// Ejecutar un chequeo inicial al arrancar
checkBCV();
