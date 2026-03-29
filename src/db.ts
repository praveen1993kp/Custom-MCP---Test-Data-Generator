/**
 * Database Connection Module
 * 
 * This module provides a MySQL connection pool for the MCP server.
 * It uses mysql2/promise for async/await support and connection pooling.
 * 
 * Configuration is loaded from environment variables via dotenv.
 */

import mysql from 'mysql2/promise';
import { Pool, PoolConnection } from 'mysql2/promise';

// Database configuration interface
interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
}

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get the database configuration from environment variables.
 * Throws an error if required variables are missing.
 */
function getDbConfig(): DbConfig {
  const host = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  // Validate required environment variables
  if (!host || !user || !password || !database) {
    throw new Error(
      'Missing required database environment variables. ' +
      'Please ensure DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME are set.'
    );
  }

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

/**
 * Initialize and return the MySQL connection pool.
 * Uses a singleton pattern to reuse the same pool across requests.
 */
export function getPool(): Pool {
  if (!pool) {
    const config = getDbConfig();
    pool = mysql.createPool(config);
    console.error('[DB] Connection pool created for database:', config.database);
  }
  return pool;
}

/**
 * Get a connection from the pool.
 * Remember to release the connection when done!
 * 
 * @example
 * const conn = await getConnection();
 * try {
 *   const [rows] = await conn.query('SELECT * FROM table');
 *   return rows;
 * } finally {
 *   conn.release();
 * }
 */
export async function getConnection(): Promise<PoolConnection> {
  const pool = getPool();
  return pool.getConnection();
}

/**
 * Execute a query using the pool directly (auto-releases connection).
 * This is the recommended way for simple queries.
 * 
 * @param sql - The SQL query string
 * @param params - Optional query parameters for prepared statements
 * @returns The query results
 */
export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  const pool = getPool();
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

/**
 * Close the connection pool gracefully.
 * Call this when shutting down the server.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.error('[DB] Connection pool closed');
  }
}
