const nodemailer = require('nodemailer');

// Ensure you have these configured in your environment or .env
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' or configure custom SMTP host
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD // Generate an "App Password" in Google Account
    }
});

const sendEmail = async (to, subject, textMsg, base64Data, filename) => {
    try {
        const mailOptions = {
            from: `"Conjunto Residencial Palma Real" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: textMsg, // Fallback text
            html: `
                <div style="font-family: monospace; padding: 20px; border: 1px solid #ccc;">
                    <h2 style="color: #059669;">NOTIFICACIÓN PALMA REAL</h2>
                    <p>${textMsg.replace(/\n/g, '<br>')}</p>
                    <p style="font-size: 10px; color: #666; margin-top: 30px;">
                        Este es un mensaje automático generado por el Mantenimiento del Sistema Social VIVO.<br>
                        Por favor, no responder directamente a esta dirección.
                    </p>
                </div>
            `,
        };

        // Attach PDF if base64 provided
        if (base64Data && filename) {
            mailOptions.attachments = [
                {
                    filename: filename,
                    content: base64Data,
                    encoding: 'base64'
                }
            ];
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Email Dispatch Error:', error);
        throw error;
    }
};

module.exports = {
    sendEmail
};
