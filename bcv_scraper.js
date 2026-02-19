
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import { createWorker } from 'tesseract.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || "");

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function parseTextBCV(text) {
    try {
        console.log("Parsing text...");
        // Regex for value
        const valorMatch = text.match(/USD\s+([\d,.]+)/i) || text.match(/Bs\s*\/\s*USD\s+([\d,.]+)/i);
        let valor = null;
        if (valorMatch && valorMatch[1]) {
            valor = parseFloat(valorMatch[1].replace(',', '.'));
        }

        // Regex for date
        const fechaMatch = text.match(/(\d{2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s+(\d{4})/i);
        let fecha = null;
        if (fechaMatch) {
            const dia = fechaMatch[1];
            const mesTexto = fechaMatch[2].toLowerCase();
            const anio = fechaMatch[3];
            const meses = {
                'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
                'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
                'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
            };
            const mesKey = Object.keys(meses).find(k => mesTexto.startsWith(k));
            const mes = mesKey ? meses[mesKey] : null;
            if (mes) fecha = `${anio}-${mes}-${dia}`;
        }
        return { fecha, valor };
    } catch (error) {
        console.error("Error parsing text:", error);
        return { fecha: null, valor: null };
    }
}

async function runScraper() {
    if (!apiId || !apiHash) {
        console.error("Error: TELEGRAM_API_ID y TELEGRAM_API_HASH son necesarios en el .env");
        return;
    }

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    console.log("Connecting to Telegram...");
    await client.start({
        phoneNumber: async () => await input.text("Por favor ingresa tu número de teléfono: "),
        password: async () => await input.text("Por favor ingresa tu contraseña (2FA): "),
        phoneCode: async () => await input.text("Por favor ingresa el código que recibiste: "),
        onError: (err) => console.log(err),
    });

    console.log("Connected. Session string:", client.session.save());
    console.log("Fetching messages from DolarOficialBCV (Deep Search)...");

    const messages = await client.getMessages("DolarOficialBCV", { limit: 30 });
    const worker = await createWorker('spa');

    for (const msg of messages) {
        if (msg.media) {
            console.log("Processing message ID:", msg.id);
            const buffer = await client.downloadMedia(msg.media);
            const tempPath = path.join(process.cwd(), `temp_${msg.id}.jpg`);
            fs.writeFileSync(tempPath, buffer);

            const { data: { text } } = await worker.recognize(tempPath);
            fs.unlinkSync(tempPath);

            const { fecha, valor } = await parseTextBCV(text);

            if (fecha && valor) {
                console.log(`[ID:${msg.id}] Found rate: ${valor} for date: ${fecha}`);
                const { error } = await supabase
                    .from('exchange_rates')
                    .upsert({
                        rate_date: fecha,
                        rate_value: valor,
                        metadata: { raw_text: text, msg_id: msg.id }
                    }, { onConflict: 'rate_date,provider' });

                if (error) console.error("Error saving to Supabase:", error);
                else console.log(`Rate for ${fecha} saved/updated.`);
            }
        }
    }
    await worker.terminate();

    await client.disconnect();
}

runScraper();
