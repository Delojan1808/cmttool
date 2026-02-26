const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text, html }) => {
    try {
        // Create an ethereal test account on the fly if no credentials are provided
        let transporter;

        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        } else {
            console.warn('⚠️ SMTP credentials not found in .env. Falling back to Ethereal Mail for testing.');
            const testAccount = await nodemailer.createTestAccount();

            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: testAccount.user, // generated ethereal user
                    pass: testAccount.pass, // generated ethereal password
                },
            });
        }

        // Send mail with defined transport object
        const info = await transporter.sendMail({
            from: process.env.FROM_EMAIL || '"CMT System" <noreply@cmtsystem.com>',
            to,
            subject,
            text,
            html,
        });

        console.log('Message sent: %s', info.messageId);

        // Preview only available when sending through an Ethereal account
        if (!process.env.SMTP_HOST) {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        console.error('Email could not be sent. Error:', error);
        // Do not throw error upwards to prevent application crashing if email fails, 
        // just log it. Depending on strictness required, you could throw it.
    }
};

module.exports = {
    sendEmail
};
