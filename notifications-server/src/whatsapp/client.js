const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Initialize the client with LocalAuth for session persistence
// This prevents needing to scan the QR code every time the server restarts
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'palma-real-bot'
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let isReady = false;

const initializeWhatsApp = () => {
    console.log('Iniciando cliente de WhatsApp...');

    client.on('qr', (qr) => {
        console.log('📌 Escanea este código QR con el WhatsApp del condominio:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ Cliente de WhatsApp autenticado y listo!');
        isReady = true;
    });

    client.on('authenticated', () => {
        console.log('✅ Autenticación de WhatsApp exitosa.');
    });

    client.on('auth_failure', msg => {
        console.error('❌ Fallo de autenticación en WhatsApp:', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('❌ WhatsApp se ha desconectado:', reason);
        isReady = false;
        // Opcional: client.initialize() para reintentar
    });

    // Start client
    client.initialize();
};

const formatPhone = (phone) => {
    // Basic formatting: ensure it ends with @c.us and only contains numbers
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.endsWith('@c.us')) {
        cleaned = `${cleaned}@c.us`;
    }
    return cleaned;
};

const sendMessage = async (phone, text) => {
    if (!isReady) throw new Error('WhatsApp client is not ready yet.');
    const formatted = formatPhone(phone);
    return await client.sendMessage(formatted, text);
};

const sendDocument = async (phone, base64Data, filename, caption = '') => {
    if (!isReady) throw new Error('WhatsApp client is not ready yet.');
    const formatted = formatPhone(phone);

    // Create MessageMedia from base64
    // Assume application/pdf for now, can be parameterized
    const media = new MessageMedia('application/pdf', base64Data, filename);

    return await client.sendMessage(formatted, media, { caption });
};

module.exports = {
    initializeWhatsApp,
    sendMessage,
    sendDocument,
    isReady: () => isReady
};
