import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PREFIX = 'v1:';

/**
 * Cifra las credenciales (API keys de IA, tokens de routines, keys de ingesta)
 * antes de guardarlas en SQLite, con AES-256-GCM.
 *
 * La clave maestra sale de SECRETS_KEY. Si no está definida se genera una en
 * DATA_DIR/secret.key: en ese caso quien tenga la carpeta data/ puede leer los secretos,
 * así que en producción conviene setear SECRETS_KEY fuera del disco (secret manager, env del host).
 */
@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const fromEnv = config.get<string>('secretsKey');
    if (fromEnv) {
      this.key = createHash('sha256').update(fromEnv).digest();
      return;
    }

    const dir = resolve(config.get<string>('dataDir')!);
    const file = join(dir, 'secret.key');
    if (!existsSync(file)) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, randomBytes(32).toString('base64'), { mode: 0o600 });
      this.logger.warn(`SECRETS_KEY no definida: se generó ${file}. No lo pierdas o no vas a poder leer las credenciales.`);
    }
    this.key = createHash('sha256').update(readFileSync(file, 'utf8').trim()).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }

  decrypt(enc: string): string {
    if (!enc.startsWith(PREFIX)) throw new Error('Formato de secreto desconocido');
    const raw = Buffer.from(enc.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }

  encryptOpt(plain: string | undefined | null): string | null {
    return plain ? this.encrypt(plain) : null;
  }

  decryptOpt(enc: string | undefined | null): string | undefined {
    return enc ? this.decrypt(enc) : undefined;
  }
}

/** Muestra sólo el principio y el final de un secreto. */
export function maskSecret(secret: string | undefined): string | null {
  if (!secret) return null;
  if (secret.length <= 10) return '••••';
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}
