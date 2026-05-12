const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

class EncryptionService {
  /**
   * Generate a random encryption key
   * @returns {string} Base64 encoded encryption key
   */
  static generateKey() {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Encrypt a message
   * @param {string} plaintext - Message to encrypt
   * @param {string} keyBase64 - Base64 encoded encryption key
   * @returns {object} Encrypted message with iv, authTag, and ciphertext
   */
  static encrypt(plaintext, keyBase64) {
    try {
      const key = Buffer.from(keyBase64, 'base64');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        iv: iv.toString('hex'),
        ciphertext: encrypted,
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypt a message
   * @param {object} encryptedData - Object with iv, ciphertext, authTag
   * @param {string} keyBase64 - Base64 encoded encryption key
   * @returns {string} Decrypted message
   */
  static decrypt(encryptedData, keyBase64) {
    try {
      const key = Buffer.from(keyBase64, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      const ciphertext = encryptedData.ciphertext;
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  /**
   * Hash a string using SHA256
   * @param {string} input - String to hash
   * @returns {string} Hex encoded hash
   */
  static hash(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}

module.exports = EncryptionService;