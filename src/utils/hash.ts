import crypto from 'crypto';

// Function to create a hash
function createHash(algorithm: string, data: any): string {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

export function sha256(data: any): string {
  return createHash('sha256', data);
}