require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import Modules
const { initializeWhatsApp, sendMessage, sendDocument } = require('./whatsapp/client');
const { sendEmail } = require('./email/transporter');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large PDFs in base64

// Initialize specialized clients
initializeWhatsApp();

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Notification Server is running' });
});

// Main Notification Endpoint
app.post('/api/notify', async (req, res) => {
    try {
        const { targetType, destination, message, documentBase64, documentName, subject } = req.body;

        if (!targetType || !destination) {
            return res.status(400).json({ error: 'Missing required fields (targetType, destination)' });
        }

        let result = null;

        if (targetType === 'WHATSAPP') {
            if (documentBase64) {
                result = await sendDocument(destination, documentBase64, documentName || 'Documento.pdf', message);
            } else {
                result = await sendMessage(destination, message);
            }
        } else if (targetType === 'EMAIL') {
            result = await sendEmail(destination, subject || 'Notificación Palma Real', message, documentBase64, documentName);
        } else {
            return res.status(400).json({ error: 'Invalid targetType. Use WHATSAPP or EMAIL' });
        }

        res.json({ success: true, result });
    } catch (error) {
        console.error('Notification Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Notification Server running on http://localhost:${PORT}`);
    console.log(`Waiting for WhatsApp QR Scan (if not already authenticated)...`);
});
