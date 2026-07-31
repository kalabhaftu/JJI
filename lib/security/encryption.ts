import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length === 64) return Buffer.from(envKey, 'hex');
    if (envKey.length === 32) return Buffer.from(envKey, 'utf-8');
    return crypto.scryptSync(envKey, 'salt', 32);
  }
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY environment variable is missing.');
  }
  
  return crypto.scryptSync('fallback_dev_key', 'salt', 32);
}

export function encrypt(text: string | null | undefined): string | null {
  if (!text) return text as null;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    return text; // Fallback to raw string if crypto fails (e.g., edge runtimes)
  }
}

export function decrypt(hash: string | null | undefined): string | null {
  if (!hash) return hash as null;
  if (!hash.includes(':')) return hash; // Support legacy plaintext
  
  try {
    const parts = hash.split(':');
    if (parts.length !== 3) return hash;
    
    const iv = Buffer.from(parts[0] as string, 'hex');
    const authTag = Buffer.from(parts[1] as string, 'hex');
    const encryptedText = Buffer.from(parts[2] as string, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption failed, returning potentially legacy string');
    return hash; 
  }
}
