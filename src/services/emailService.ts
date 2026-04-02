import nodemailer from "nodemailer";
import { config } from "../config";

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (!config.smtp.user || !config.smtp.pass) {
    throw new Error(
      "SMTP credentials are not configured. Please set SMTP_USER and SMTP_PASS environment variables."
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  return transporter;
};

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

const emailService = {
  sendMail: async (options: SendMailOptions): Promise<void> => {
    const mailer = getTransporter();
    await mailer.sendMail({
      from: `"Your Site Name" <${config.smtp.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  },

  sendPasswordResetEmail: async (
    to: string,
    fullname: string,
    resetToken: string
  ): Promise<void> => {
    const resetUrl = `${config.frontendUrl}/login/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);">
                
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #eee;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #2d3a2e; letter-spacing: -0.3px;">
                      Your SIte
                    </h1>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #8a8a8a; text-transform: uppercase; letter-spacing: 1px;">
                      Content Management System
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 32px;">
                    <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #2d3a2e;">
                      Reset Your Password
                    </h2>
                    <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #555;">
                      Hi <strong>${fullname}</strong>, we received a request to reset your password. Click the button below to create a new password.
                    </p>

                    <!-- Button -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td align="center" style="padding: 4px 0 24px;">
                          <a href="${resetUrl}" 
                             style="display: inline-block; padding: 12px 32px; background-color: #2d3a2e; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; letter-spacing: 0.2px;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.6; color: #777;">
                      This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
                    </p>

                    <!-- Fallback URL -->
                    <div style="padding: 16px; background-color: #f8f8f8; border-radius: 8px; border: 1px solid #eee;">
                      <p style="margin: 0 0 6px; font-size: 12px; color: #888;">
                        If the button doesn't work, copy and paste this URL:
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #5a7a5e; word-break: break-all;">
                        ${resetUrl}
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 32px; border-top: 1px solid #eee; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: #aaa;">
                      © ${new Date().getFullYear()} Bumi Resources. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await emailService.sendMail({
      to,
      subject: "Reset Your Password — Bumi Resources CMS",
      html,
    });
  },
};

export default emailService;
