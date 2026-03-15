/**
 * BCV Recent Scraper — Palma Real App
 * Scrapea los últimos 10 mensajes del canal de Telegram del BCV.
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
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Faltan variables de entorno esenciales (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
const apiHash = process.env.TELEGRAM_API_HASH || '';
const session = new StringSession(process.env.TELEGRAM_SESSION || '');

const MESSAGES_LIMIT = 10;
const BCV_CHANNEL = 'DolarOficialBCV';

// ── Parsing del texto OCR ─────────────────────────────────────────────────────
function parseTextBCV(text) {
    const valorMatch =
        text.match(/USD[^\d,.]*([\d,.]+)/i) ||
        text.match(/Bs\s*\/\s*USD[^\d,.]*([\d,.]+)/i);

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
async function loadRecent() {
    console.log('🏢 BCV Recent Scraper');
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
            const tempPath = path.join(process.cwd(), `scripts/bcv/_recent_${msg.id}.jpg`);
            fs.writeFileSync(tempPath, buffer);

            const { data: { text } } = await worker.recognize(tempPath);
            fs.unlinkSync(tempPath);

            const { fecha, valor } = parseTextBCV(text);
            if (!fecha || !valor) { skipped++; continue; }

            const roundedValor = Math.round(valor * 100) / 100;
            const { error } = await supabase
                .from('exchange_rates')
                .upsert({
                    rate_date: fecha,
                    rate_value: roundedValor,
                    provider: 'BCV',
                    metadata: { msg_id: msg.id }
                }, { onConflict: 'rate_date,provider' });

            if (error) {
                console.error(`  ❌ [${fecha}] Bs. ${roundedValor} (Original: ${valor}) — ${error.message}`);
                failed++;
            } else {
                console.log(`  ✅ [${fecha}] Bs. ${roundedValor} (Original: ${valor})`);
                saved++;
            }
        }

        console.log('\n' + '─'.repeat(55));
        console.log('📊 Resumen:');
        console.log(`   ✅ Guardadas : ${saved}`);
        console.log(`   ⏭️  Saltadas  : ${skipped} (sin imagen o sin datos)`);
        console.log(`   ❌ Errores   : ${failed}`);
        console.log('─'.repeat(55));
        console.log('🎉 Scraping completado.');

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

loadRecent();
