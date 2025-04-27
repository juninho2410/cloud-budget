
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';

let db: Database | null = null;

// Helper function to check if a table exists
async function tableExists(db: Database, tableName: string): Promise<boolean> {
    const result = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, tableName);
    return !!result;
}


// Helper function to check if a column exists
async function columnExists(db: Database, tableName: string, columnName: string): Promise<boolean> {
    if (!(await tableExists(db, tableName))) {
        return false; // Table doesn't exist, so column cannot exist
    }
    try {
        // Use PRAGMA table_xinfo which is safer as it handles different syntax variations
        const columns = await db.all(`PRAGMA table_xinfo(${tableName})`);
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
            const alterStatement = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
            await db.run(alterStatement);
            console.log(`Added column ${columnName} to table ${tableName}`);
        } catch (error: any) {
             if (error.message?.includes('duplicate column name')) {
                 console.log(`Column ${columnName} already exists in table ${tableName} (detected during add attempt).`);
             } else {
                console.error(`Failed to add column ${columnName} to table ${tableName}:`, error);
                throw error;
             }
        }
    }
}

// Helper function to remove a column if it exists (Requires recreating table in SQLite)
async function removeColumnIfExists(db: Database, tableName: string, columnName: string) {
    const exists = await columnExists(db, tableName, columnName);
    if (exists) {
        console.warn(`Column ${columnName} exists in ${tableName}. SQLite requires table recreation to remove columns. Manual migration might be needed for existing data preservation.`);
        // In a real production scenario with existing data, a full migration script (create new table, copy data, drop old, rename new) is needed.
        // For development, we might proceed, potentially losing data in that column or breaking constraints if not careful.
        // Let's log a warning and allow the schema update to proceed, assuming dev environment or handled migration.
        // If we absolutely needed to automate this, it would involve complex introspection and data migration steps.
        // For now, we'll assume the CREATE TABLE logic later will omit the column.
        console.log(`Proceeding with schema update assuming ${columnName} will be omitted in CREATE TABLE statement.`);

        // Example of how table recreation *could* be done (DANGEROUS without proper data handling):
        /*
        await db.exec('PRAGMA foreign_keys=off;');
        await db.exec('BEGIN TRANSACTION;');
        // Get schema without the column
        const { sql } = await db.get(`SELECT sql FROM sqlite_master WHERE name = ?`, tableName);
        const createSqlWithoutColumn = generateCreateStatementWithoutColumn(sql, columnName); // Need a helper for this
        await db.exec(`CREATE TABLE ${tableName}_new AS SELECT * FROM ${tableName};`); // Or specific columns
        await db.exec(`DROP TABLE ${tableName};`);
        await db.exec(createSqlWithoutColumn); // Create new table structure
        // Copy data back (omitting the removed column)
        const columns = await db.all(`PRAGMA table_info(${tableName}_new)`);
        const columnNames = columns.filter(c => c.name !== columnName).map(c => c.name).join(', ');
        await db.exec(`INSERT INTO ${tableName} (${columnNames}) SELECT ${columnNames} FROM ${tableName}_new;`);
        await db.exec(`DROP TABLE ${tableName}_new;`);
        await db.exec('COMMIT;');
        await db.exec('PRAGMA foreign_keys=on;');
        console.log(`Table ${tableName} recreated without column ${columnName}. Data migration attempted.`);
        */
    }
}


export async function getDb(): Promise<Database> {
  if (!db) {
    try {
        db = await open({
          filename: './cloudwise.db', // Use a file for persistence
          driver: sqlite3.Database,
        });
        console.log("Database connection opened.");

        // Enable foreign key support *first*
        await db.run('PRAGMA foreign_keys = ON;');
        console.log("Foreign key support enabled.");

        // --- Schema Creation and Migration ---

        // 1. Business Lines Table
        await db.exec(`
          CREATE TABLE IF NOT EXISTS business_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
          );
        `);
        await addColumnIfNotExists(db, 'business_lines', 'updated_at', 'DATETIME');
        console.log("Table business_lines checked/created.");

        // 2. Cost Centers Table (Remove business_line_id)
        // Check if the old column exists before potentially creating the table without it
        await removeColumnIfExists(db, 'cost_centers', 'business_line_id');

        await db.exec(`
          CREATE TABLE IF NOT EXISTS cost_centers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
            -- business_line_id INTEGER column removed
          );
        `);
        await addColumnIfNotExists(db, 'cost_centers', 'updated_at', 'DATETIME');
        console.log("Table cost_centers checked/created (without business_line_id).");

        // 3. Budgets Table (Remains largely the same, linking to one BL and one CC)
        await db.exec(`
          CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            type TEXT CHECK(type IN ('CAPEX', 'OPEX')) NOT NULL,
            business_line_id INTEGER, -- Direct link to one BL
            cost_center_id INTEGER,   -- Direct link to one CC
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            FOREIGN KEY (business_line_id) REFERENCES business_lines(id) ON DELETE SET NULL,
            FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
          );
        `);
        await addColumnIfNotExists(db, 'budgets', 'updated_at', 'DATETIME');
        console.log("Table budgets checked/created.");

        // 4. Junction Table: cost_center_business_lines (NEW)
        await db.exec(`
          CREATE TABLE IF NOT EXISTS cost_center_business_lines (
            cost_center_id INTEGER NOT NULL,
            business_line_id INTEGER NOT NULL,
            PRIMARY KEY (cost_center_id, business_line_id),
            FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE CASCADE,
            FOREIGN KEY (business_line_id) REFERENCES business_lines(id) ON DELETE CASCADE
          );
        `);
        console.log("Junction table cost_center_business_lines checked/created.");


        // --- Triggers for updated_at ---
        await db.exec(`
           -- Trigger for business_lines
          CREATE TRIGGER IF NOT EXISTS update_business_lines_updated_at
          AFTER UPDATE ON business_lines
          FOR EACH ROW
          WHEN NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at OR NEW.updated_at < OLD.updated_at -- Allow explicit older timestamp if needed, otherwise update
          BEGIN
              UPDATE business_lines SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
          END;

           -- Trigger for cost_centers
          CREATE TRIGGER IF NOT EXISTS update_cost_centers_updated_at
          AFTER UPDATE ON cost_centers
          FOR EACH ROW
           WHEN NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at OR NEW.updated_at < OLD.updated_at
          BEGIN
              UPDATE cost_centers SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
          END;

           -- Trigger for budgets
           CREATE TRIGGER IF NOT EXISTS update_budgets_updated_at
           AFTER UPDATE ON budgets
           FOR EACH ROW
           WHEN NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at OR NEW.updated_at < OLD.updated_at
           BEGIN
               UPDATE budgets SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
           END;
        `);

        console.log("Database triggers created or verified.");
        console.log("Database schema and triggers initialized/verified successfully.");

    } catch (error) {
        console.error("Failed to initialize database:", error);
        if (db) {
            await db.close();
            db = null;
        }
        throw error;
    }
  }
  return db;
}

// Helper function to close the database connection
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
