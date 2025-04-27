import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await open({
      filename: './cloudwise.db',
      driver: sqlite3.Database,
    });

    // Enable foreign key support
    await db.run('PRAGMA foreign_keys = ON;');


    // Create tables if they don't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP -- Added updated_at
      );

      CREATE TABLE IF NOT EXISTS cost_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        business_line_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Added updated_at
        -- Set business_line_id to NULL when the referenced business line is deleted
        FOREIGN KEY (business_line_id) REFERENCES business_lines(id) ON DELETE SET NULL
      );


      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        type TEXT CHECK(type IN ('CAPEX', 'OPEX')) NOT NULL,
        business_line_id INTEGER,
        cost_center_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        -- Set foreign keys to NULL when the referenced entity is deleted
        FOREIGN KEY (business_line_id) REFERENCES business_lines(id) ON DELETE SET NULL,
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
      );

       -- Trigger to update 'updated_at' timestamp for budgets table
      CREATE TRIGGER IF NOT EXISTS update_budgets_updated_at
      AFTER UPDATE ON budgets
      FOR EACH ROW
      BEGIN
          UPDATE budgets SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

       -- Trigger to update 'updated_at' timestamp for business_lines table
      CREATE TRIGGER IF NOT EXISTS update_business_lines_updated_at
      AFTER UPDATE ON business_lines
      FOR EACH ROW
      BEGIN
          UPDATE business_lines SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

       -- Trigger to update 'updated_at' timestamp for cost_centers table
      CREATE TRIGGER IF NOT EXISTS update_cost_centers_updated_at
      AFTER UPDATE ON cost_centers
      FOR EACH ROW
      BEGIN
          UPDATE cost_centers SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

    `);
  }
  return db;
}

// Helper function to close the database connection (optional, e.g., for testing or graceful shutdown)
export async function closeDb(): Promise<void> {
    if (db) {
        await db.close();
        db = null;
    }
}
