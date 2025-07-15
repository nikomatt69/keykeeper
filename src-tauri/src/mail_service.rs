// mail_service.rs
// Simple, secure SMTP mail service for KeyKeeper
// Uses lettre (MIT, free) for SMTP email sending
// Only stores config in memory, never logs credentials

use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use lettre::transport::smtp::client::Tls;

pub struct SmtpConfig {
    pub server: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
}

/// Send an email using SMTP (TLS, secure, free)
pub fn send_mail(
    config: &SmtpConfig,
    to: &str,
    subject: &str,
    body: &str,
) -> Result<(), String> {
    let email = Message::builder()
        .from(config.from.parse().map_err(|e| format!("Invalid from: {}", e))?)
        .to(to.parse().map_err(|e| format!("Invalid to: {}", e))?)
        .subject(subject)
        .body(body.to_string())
        .map_err(|e| format!("Failed to build email: {}", e))?;

    let creds = Credentials::new(config.username.clone(), config.password.clone());
    let mailer = SmtpTransport::starttls_relay(&config.server)
        .map_err(|e| format!("SMTP setup error: {}", e))?
        .port(config.port)
        .credentials(creds)
        .build();

    mailer.send(&email)
        .map_err(|e| format!("Failed to send email: {}", e))?;
    Ok(())
}

// Usage example (do not hardcode credentials in production):
// let config = SmtpConfig { ... };
// send_mail(&config, "dest@example.com", "Subject", "Body").unwrap(); 