
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';

let db: Database | null = null;

// Helper function to check if a column exists
async function columnExists(db: Database, tableName: string, columnName: string): Promise<boolean> {
    try {
        const result = await db.get(`PRAGMA table_info(${tableName})`);
        // PRAGMA table_info returns an array of objects, one for each column.
        // If we find an object where the 'name' property matches columnName, it exists.
        // However, simple check by trying to select it is often easier and less error-prone
        // Let's try altering instead and catch the error if it exists.
        // A more robust check:
        const columns = await db.all(`PRAGMA table_info(${tableName})`);
        return columns.some(col => col.name === columnName);
    } catch (error) {
        console.error(`Error checking column ${columnName} in table ${tableName}:`, error);
        return false; // Assume it doesn't exist on error
    }
}

// Helper function to add a column if it doesn't exist
async function addColumnIfNotExists(db: Database, tableName: string, columnName: string, columnDefinition: string) {
    const exists = await columnExists(db, tableName, columnName);
    if (!exists) {
        try {
            await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            console.log(`Added column ${columnName} to table ${tableName}`);
        } catch (error: any) {
            // It's possible the column exists even if PRAGMA failed, or another race condition.
            // SQLite often throws error like "duplicate column name" if it exists.
             if (!error.message.includes('duplicate column name')) {
               console.error(`Failed to add column ${columnName} to table ${tableName}:`, error);
               // Rethrow if it's not the expected "duplicate column" error
               throw error;
             } else {
                console.log(`Column ${columnName} already exists in table ${tableName}.`);
             }
        }
    }
}


export async function getDb(): Promise<Database> {
  if (!db) {
    db = await open({
      filename: './cloudwise.db', // Use a file for persistence
      driver: sqlite3.Database,
    });

    // Enable foreign key support *first*
    await db.run('PRAGMA foreign_keys = ON;');


    // Create tables if they don't exist (Original Schema)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        -- updated_at initially omitted, will be added by ALTER TABLE
      );

      CREATE TABLE IF NOT EXISTS cost_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        business_line_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        -- updated_at initially omitted
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
        -- updated_at initially omitted
        FOREIGN KEY (business_line_id) REFERENCES business_lines(id) ON DELETE SET NULL,
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
      );
    `);

    // Add 'updated_at' columns if they don't exist
    await addColumnIfNotExists(db, 'business_lines', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfNotExists(db, 'cost_centers', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfNotExists(db, 'budgets', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');


     // Create triggers *after* ensuring columns exist
    await db.exec(`
       -- Trigger to update 'updated_at' timestamp for budgets table
      CREATE TRIGGER IF NOT EXISTS update_budgets_updated_at
      AFTER UPDATE ON budgets
      FOR EACH ROW
      WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL -- Avoid infinite loop if trigger updates the row
      BEGIN
          UPDATE budgets SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

       -- Trigger to update 'updated_at' timestamp for business_lines table
      CREATE TRIGGER IF NOT EXISTS update_business_lines_updated_at
      AFTER UPDATE ON business_lines
      FOR EACH ROW
       WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
          UPDATE business_lines SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

       -- Trigger to update 'updated_at' timestamp for cost_centers table
      CREATE TRIGGER IF NOT EXISTS update_cost_centers_updated_at
      AFTER UPDATE ON cost_centers
      FOR EACH ROW
      WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
          UPDATE cost_centers SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;
    `);

    console.log("Database schema and triggers initialized/verified.");

  }
  return db;
}

// Helper function to close the database connection (optional, e.g., for testing or graceful shutdown)
export async function closeDb(): Promise<void> {
    if (db) {
        try {
            await db.close();
            console.log("Database connection closed.");
            db = null;
        } catch (error) {
            console.error("Error closing database connection:", error);
        }
    }
}
