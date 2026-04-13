import { createSupabaseAdminClient } from '@/lib/supabase-server';

const BUCKET_NAME = 'ticket-attachments';
const SIGNED_URL_EXPIRY_SECONDS = 6 * 60 * 60; // 6 horas

/**
 * Genera un path único para un archivo, basado en ticket y timestamp.
 * Formato: tickets/{ticketId}/messages/{messageId}/{timestamp}-{sanitizedFileName}
 */
function buildStoragePath(ticketId, messageId, fileName) {
  // Sanitizar nombre de archivo: remover caracteres especiales, mantener ext
  const sanitized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-zA-Z0-9.\-_]/g, '_') // Solo alfanuméricos, punto, guión, underscore
    .substring(0, 100); // Limitar longitud
  const timestamp = Date.now();
  return `tickets/${ticketId}/messages/${messageId}/${timestamp}-${sanitized}`;
}

/**
 * Sube un archivo a Supabase Storage.
 * @param {File|Blob} file - Archivo a subir (del FormData del webhook)
 * @param {number} ticketId - ID del ticket asociado
 * @param {number} messageId - ID del mensaje asociado
 * @returns {Promise<{success: boolean, storagePath?: string, error?: string}>}
 */
export async function uploadAttachment(file, ticketId, messageId) {
  try {
    const supabase = createSupabaseAdminClient();
    const storagePath = buildStoragePath(ticketId, messageId, file.name);

    // Convertir File/Blob a ArrayBuffer para Supabase
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (error) {
      console.error('[Storage] Error subiendo archivo:', error);
      return { success: false, error: error.message };
    }

    return { success: true, storagePath: data.path };
  } catch (error) {
    console.error('[Storage] Excepción al subir archivo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Genera una URL firmada temporal para acceder a un archivo.
 * @param {string} storagePath - Path del archivo en el bucket
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getSignedUrl(storagePath) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (error) {
      console.error('[Storage] Error generando URL firmada:', error);
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error) {
    console.error('[Storage] Excepción al generar URL firmada:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Descarga un archivo de Storage y lo devuelve como base64.
 * Usado para reenviar adjuntos al cliente vía SendGrid.
 * @param {string} storagePath - Path del archivo en el bucket
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export async function downloadAsBase64(storagePath) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error) {
      console.error('[Storage] Error descargando archivo:', error);
      return { success: false, error: error.message };
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    return { success: true, content: base64 };
  } catch (error) {
    console.error('[Storage] Excepción al descargar:', error);
    return { success: false, error: error.message };
  }
}
