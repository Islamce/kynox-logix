import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateProductionConfig } from './config';

const managedKeys = ['NODE_ENV', 'JWT_SECRET', 'DB_CLIENT', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'CORS_ORIGIN'];
const original = new Map(managedKeys.map((key) => [key, process.env[key]]));

function restoreEnvironment() {
  for (const key of managedKeys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setProductionDatabase(client: 'mysql2' | 'pg' | 'better-sqlite3') {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'test-only-jwt-secret-with-at-least-32-characters';
  process.env.DB_CLIENT = client;
  process.env.DB_HOST = 'validation-db.invalid';
  process.env.DB_NAME = 'kynox_logix_validation';
  process.env.DB_USER = 'logix_validation';
  process.env.DB_PASSWORD = 'not-a-production-secret';
  process.env.CORS_ORIGIN = 'https://logix.kynox.io';
}

describe('production database startup guards', () => {
  beforeEach(() => setProductionDatabase('mysql2'));
  afterEach(restoreEnvironment);

  it('accepts a complete MySQL production configuration', () => {
    expect(validateProductionConfig()).toEqual([]);
  });

  it('accepts a complete PostgreSQL production configuration', () => {
    setProductionDatabase('pg');
    expect(validateProductionConfig()).toEqual([]);
  });

  it('rejects SQLite in production', () => {
    setProductionDatabase('better-sqlite3');
    expect(validateProductionConfig()).toContain('DB_CLIENT=better-sqlite3 is not supported in production; use pg or mysql2.');
  });

  it('rejects an unset production DB_CLIENT instead of falling back to SQLite', () => {
    delete process.env.DB_CLIENT;
    expect(validateProductionConfig()).toContain('DB_CLIENT=better-sqlite3 is not supported in production; use pg or mysql2.');
  });

  it('rejects incomplete production database credentials', () => {
    delete process.env.DB_PASSWORD;
    expect(validateProductionConfig()).toContain('DB_PASSWORD is not set (required for DB_CLIENT=mysql2).');
  });
});
