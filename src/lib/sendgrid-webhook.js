import { EventWebhook } from '@sendgrid/eventwebhook';

const eventWebhook = new EventWebhook();

/**
 * Verifica la firma de SendGrid
 */
export function verifySendGridSignature(publicKey, payload, signature, timestamp) {
  try {
    const ecPublicKey = eventWebhook.convertPublicKeyToECDSA(publicKey);
    return eventWebhook.verifySignature(ecPublicKey, payload, signature, timestamp);
  } catch (error) {
    console.error('SendGrid signature verification error:', error);
    return false;
  }
}
