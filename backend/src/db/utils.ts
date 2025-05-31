// Database utility functions
// Common database operations, query builders, and helpers

import { DatabaseConnection, TransactionConnection, withConnection, withTransaction } from './connection';

// ==================== Query Builder Utilities ====================

export interface WhereCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
  value: any;
}

export interface QueryOptions {
  where?: WhereCondition[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
  offset?: number;
}

/**
 * Build WHERE clause from conditions
 */
export function buildWhereClause(conditions: WhereCondition[]): { sql: string; params: any[] } {
  if (conditions.length === 0) {
    return { sql: '', params: [] };
  }

  const clauses: string[] = [];
  const params: any[] = [];

  for (const condition of conditions) {
    if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
      const placeholders = Array.isArray(condition.value) 
        ? condition.value.map(() => '?').join(', ')
        : '?';
      clauses.push(`${condition.field} ${condition.operator} (${placeholders})`);
      if (Array.isArray(condition.value)) {
        params.push(...condition.value);
      } else {
        params.push(condition.value);
      }
    } else {
      clauses.push(`${condition.field} ${condition.operator} ?`);
      params.push(condition.value);
    }
  }

  return {
    sql: `WHERE ${clauses.join(' AND ')}`,
    params
  };
}

/**
 * Build ORDER BY clause
 */
export function buildOrderByClause(orderBy: { field: string; direction: 'ASC' | 'DESC' }[]): string {
  if (orderBy.length === 0) {
    return '';
  }

  const clauses = orderBy.map(order => `${order.field} ${order.direction}`);
  return `ORDER BY ${clauses.join(', ')}`;
}

/**
 * Build LIMIT and OFFSET clause
 */
export function buildLimitClause(limit?: number, offset?: number): string {
  let clause = '';
  if (limit !== undefined) {
    clause += `LIMIT ${limit}`;
    if (offset !== undefined) {
      clause += ` OFFSET ${offset}`;
    }
  }
  return clause;
}

// ==================== Generic CRUD Operations ====================

/**
 * Generic insert operation
 */
export async function insert<T extends Record<string, any>>(
  tableName: string,
  data: T,
  connection?: DatabaseConnection
): Promise<string> {
  const operation = async (conn: DatabaseConnection) => {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(data);

    const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    const result = await conn.run(sql, values);
    
    return result.lastID?.toString() || '';
  };

  if (connection) {
    return await operation(connection);
  } else {
    return await withConnection(operation);
  }
}

/**
 * Generic update operation
 */
export async function update<T extends Record<string, any>>(
  tableName: string,
  data: T,
  conditions: WhereCondition[],
  connection?: DatabaseConnection
): Promise<number> {
  const operation = async (conn: DatabaseConnection) => {
    const fields = Object.keys(data);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = Object.values(data);

    const { sql: whereClause, params: whereParams } = buildWhereClause(conditions);
    
    const sql = `UPDATE ${tableName} SET ${setClause} ${whereClause}`;
    const allParams = [...values, ...whereParams];
    
    const result = await conn.run(sql, allParams);
    return result.changes || 0;
  };

  if (connection) {
    return await operation(connection);
  } else {
    return await withConnection(operation);
  }
}

/**
 * Generic delete operation
 */
export async function deleteRecords(
  tableName: string,
  conditions: WhereCondition[],
  connection?: DatabaseConnection
): Promise<number> {
  const operation = async (conn: DatabaseConnection) => {
    const { sql: whereClause, params } = buildWhereClause(conditions);
    
    if (conditions.length === 0) {
      throw new Error('Delete operation requires at least one WHERE condition for safety');
    }
    
    const sql = `DELETE FROM ${tableName} ${whereClause}`;
    const result = await conn.run(sql, params);
    return result.changes || 0;
  };

  if (connection) {
    return await operation(connection);
  } else {
    return await withConnection(operation);
  }
}

/**
 * Generic select operation
 */
export async function select<T = any>(
  tableName: string,
  options: QueryOptions = {},
  connection?: DatabaseConnection
): Promise<T[]> {
  const operation = async (conn: DatabaseConnection) => {
    let sql = `SELECT * FROM ${tableName}`;
    let params: any[] = [];

    // Add WHERE clause
    if (options.where && options.where.length > 0) {
      const { sql: whereClause, params: whereParams } = buildWhereClause(options.where);
      sql += ` ${whereClause}`;
      params = [...params, ...whereParams];
    }

    // Add ORDER BY clause
    if (options.orderBy && options.orderBy.length > 0) {
      sql += ` ${buildOrderByClause(options.orderBy)}`;
    }

    // Add LIMIT and OFFSET
    if (options.limit !== undefined) {
      sql += ` ${buildLimitClause(options.limit, options.offset)}`;
    }

    return await conn.all<T>(sql, params);
  };

  if (connection) {
    return await operation(connection);
  } else {
    return await withConnection(operation);
  }
}

/**
 * Get a single record by ID
 */
export async function findById<T = any>(
  tableName: string,
  id: string,
  connection?: DatabaseConnection
): Promise<T | undefined> {
  const results = await select<T>(tableName, {
    where: [{ field: 'id', operator: '=', value: id }],
    limit: 1
  }, connection);
  
  return results[0];
}

/**
 * Check if a record exists
 */
export async function exists(
  tableName: string,
  conditions: WhereCondition[],
  connection?: DatabaseConnection
): Promise<boolean> {
  const operation = async (conn: DatabaseConnection) => {
    const { sql: whereClause, params } = buildWhereClause(conditions);
    const sql = `SELECT 1 FROM ${tableName} ${whereClause} LIMIT 1`;
    
    const result = await conn.get(sql, params);
    return !!result;
  };

  if (connection) {
    return await operation(connection);
  } else {
    return await withConnection(operation);
  }
}

/**
 * Count records
 */
export async function count(
  tableName: string,
  conditions: WhereCondition[] = [],
  connection?: DatabaseConnection
): Promise<number> {
  const operation = async (conn: DatabaseConnection) => {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    let params: any[] = [];

    if (conditions.length > 0) {
      const { sql: whereClause, params: whereParams } = buildWhereClause(conditions);
      sql += ` ${whereClause}`;
      params = whereParams;
    }

    const result = await conn.get<{ count: number }>(sql, params);
    return result?.count || 0;
  };

  if (connection) {
    return await operation(connection);
  } else {
    return await withConnection(operation);
  }
}

// ==================== Batch Operations ====================

/**
 * Batch insert records
 */
export async function batchInsert<T extends Record<string, any>>(
  tableName: string,
  records: T[],
  batchSize: number = 100
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  await withTransaction(async (transaction) => {
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        await insert(tableName, record, transaction);
      }
    }
  });
}

/**
 * Upsert (insert or update) operation
 */
export async function upsert<T extends Record<string, any>>(
  tableName: string,
  data: T,
  conflictFields: string[],
  connection?: DatabaseConnection
): Promise<void> {
  const operation = async (conn: DatabaseConnection) => {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(data);

    // Build UPDATE clause for ON CONFLICT
    const updateFields = fields.filter(field => !conflictFields.includes(field));
    const updateClause = updateFields.map(field => `${field} = excluded.${field}`).join(', ');

    const sql = `
      INSERT INTO ${tableName} (${fields.join(', ')}) 
      VALUES (${placeholders})
      ON CONFLICT(${conflictFields.join(', ')}) 
      DO UPDATE SET ${updateClause}
    `;

    await conn.run(sql, values);
  };

  if (connection) {
    return await operation(connection);
  } else {
    return await withConnection(operation);
  }
}

// ==================== Database Maintenance ====================

/**
 * Vacuum database to reclaim space
 */
export async function vacuum(): Promise<void> {
  await withConnection(async (connection) => {
    await connection.exec('VACUUM');
    console.log('Database vacuum completed');
  });
}

/**
 * Analyze database for query optimization
 */
export async function analyze(): Promise<void> {
  await withConnection(async (connection) => {
    await connection.exec('ANALYZE');
    console.log('Database analysis completed');
  });
}

/**
 * Get table information
 */
export async function getTableInfo(tableName: string): Promise<any[]> {
  return await withConnection(async (connection) => {
    return await connection.all(`PRAGMA table_info(${tableName})`);
  });
}

/**
 * Get foreign key information
 */
export async function getForeignKeyInfo(tableName: string): Promise<any[]> {
  return await withConnection(async (connection) => {
    return await connection.all(`PRAGMA foreign_key_list(${tableName})`);
  });
}

/**
 * Get index information
 */
export async function getIndexInfo(tableName: string): Promise<any[]> {
  return await withConnection(async (connection) => {
    return await connection.all(`PRAGMA index_list(${tableName})`);
  });
}

// ==================== Query Logging and Performance ====================

interface QueryLog {
  sql: string;
  params: any[];
  executionTime: number;
  timestamp: Date;
}

class QueryLogger {
  private static logs: QueryLog[] = [];
  private static maxLogs = 1000;

  static log(sql: string, params: any[], executionTime: number): void {
    this.logs.push({
      sql,
      params,
      executionTime,
      timestamp: new Date()
    });

    // Keep only the latest logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  static getLogs(): QueryLog[] {
    return [...this.logs];
  }

  static getSlowQueries(thresholdMs: number = 100): QueryLog[] {
    return this.logs.filter(log => log.executionTime > thresholdMs);
  }

  static clear(): void {
    this.logs = [];
  }
}

/**
 * Execute query with logging
 */
export async function executeWithLogging<T>(
  connection: DatabaseConnection,
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const startTime = Date.now();
  try {
    const result = await connection.all<T>(sql, params);
    const executionTime = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      QueryLogger.log(sql, params, executionTime);
    }
    
    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    QueryLogger.log(sql, params, executionTime);
    throw error;
  }
}

export { QueryLogger };