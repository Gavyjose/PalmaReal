/**
 * BCV Historical Loader — Palma Real App
 * Carga masiva de los últimos ~60 días de tasas BCV desde Telegram.
 * Ejecutar UNA SOLA VEZ: npm run bcv:history
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { createWorker } from 'tesseract.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// ── Configuración ─────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Usamos service_role clave para el scraper si está disponible, sino anon (pero service_role es mejor para bypass RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
const apiHash = process.env.TELEGRAM_API_HASH || '';
const session = new StringSession(process.env.TELEGRAM_SESSION || '');

// BCV publica ~1 vez por día hábil; 80 mensajes cubre bien 60 días calendario
const MESSAGES_LIMIT = 80;
const BCV_CHANNEL = 'DolarOficialBCV';

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

// ── Main ──────────────────────────────────────────────────────────────────────
async function loadHistory() {
    console.log('🏢 BCV Historical Loader');
    console.log(`📥 Descargando últimos ${MESSAGES_LIMIT} mensajes de @${BCV_CHANNEL}...`);
    console.log('─'.repeat(55));

    const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
    });

    let worker = null;

    try {
        await client.connect();
        console.log('✅ Conectado a Telegram\n');

        const messages = await client.getMessages(BCV_CHANNEL, { limit: MESSAGES_LIMIT });
        console.log(`📨 ${messages.length} mensajes obtenidos. Procesando...\n`);

        worker = await createWorker('spa');

        let saved = 0, skipped = 0, failed = 0;

        for (const msg of messages) {
            if (!msg.media) { skipped++; continue; }

            const buffer = await client.downloadMedia(msg.media);
            const tempPath = path.join(process.cwd(), `scripts/bcv/_hist_${msg.id}.jpg`);
            fs.writeFileSync(tempPath, buffer);

            const { data: { text } } = await worker.recognize(tempPath);
            fs.unlinkSync(tempPath);

            const { fecha, valor } = parseTextBCV(text);
            if (!fecha || !valor) { skipped++; continue; }

            const { error } = await supabase
                .from('exchange_rates')
                .upsert({
                    rate_date: fecha,
                    rate_value: valor,
                    provider: 'BCV',
                    metadata: { msg_id: msg.id }
                }, { onConflict: 'rate_date,provider' });

            if (error) {
                console.error(`  ❌ [${fecha}] Bs. ${valor} — ${error.message}`);
                failed++;
            } else {
                console.log(`  ✅ [${fecha}] Bs. ${valor}`);
                saved++;
            }
        }

        console.log('\n' + '─'.repeat(55));
        console.log('📊 Resumen:');
        console.log(`   ✅ Guardadas : ${saved}`);
        console.log(`   ⏭️  Saltadas  : ${skipped} (sin imagen o sin datos)`);
        console.log(`   ❌ Errores   : ${failed}`);
        console.log('─'.repeat(55));
        console.log('🎉 Carga histórica completada.');

    } catch (err) {
        console.error('❌ Error fatal:', err.message);
    } finally {
        if (worker) await worker.terminate();
        setTimeout(async () => {
            await client.disconnect();
            process.exit(0);
        }, 1000);
    }
}

loadHistory();
