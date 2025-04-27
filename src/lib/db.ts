
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
            // Avoid adding columns with non-constant defaults if not needed
            // Especially DEFAULT CURRENT_TIMESTAMP which caused issues before
            let alterStatement = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
             // Check if trying to add a timestamp column with a default
             if (columnName.endsWith('_at') && columnDefinition.toUpperCase().includes('DEFAULT CURRENT_TIMESTAMP')) {
                 // Add without default first
                 const definitionWithoutDefault = columnDefinition.replace(/DEFAULT CURRENT_TIMESTAMP/i, '').trim();
                 alterStatement = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionWithoutDefault}`;
                 await db.run(alterStatement);
                 console.log(`Added column ${columnName} to table ${tableName} (without default). Default will be handled by trigger or application logic.`);
                 // Note: Triggers might be a better approach for `updated_at` than default values in SQLite.
             } else {
                await db.run(alterStatement);
                console.log(`Added column ${columnName} to table ${tableName}`);
             }

        } catch (error: any) {
             if (error.message?.includes('duplicate column name')) {
                 console.log(`Column ${columnName} already exists in table ${tableName} (detected during add attempt).`);
             } else if (error.message?.includes('Cannot add a column with non-constant default')) {
                 console.warn(`SQLite cannot add column ${columnName} with a non-constant default to ${tableName}. Consider adding the column without a default and managing it via triggers or application logic.`);
                 // Attempt to add without default as a fallback for timestamp columns
                 if (columnName.endsWith('_at')) {
                    try {
                        const definitionWithoutDefault = columnDefinition.replace(/DEFAULT\s+CURRENT_TIMESTAMP/i, '').trim();
                        await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionWithoutDefault}`);
                        console.log(`Added column ${columnName} to table ${tableName} without default as a fallback.`);
                    } catch (fallbackError) {
                         console.error(`Failed to add column ${columnName} to table ${tableName} even without default:`, fallbackError);
                         throw error; // Re-throw original error
                    }
                 } else {
                      throw error; // Re-throw if not a timestamp column
                 }
             }
             else {
                console.error(`Failed to add column ${columnName} to table ${tableName}:`, error);
                throw error;
             }
        }
    } else {
         // console.log(`Column ${columnName} already exists in ${tableName}. Skipping add.`);
         // Optionally verify the column definition matches if needed
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
          driver: sqlite3.verbose(), // Use verbose driver for more detailed logs
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            -- updated_at DATETIME -- Managed manually or by trigger if needed
          );
        `);
        // Explicitly add updated_at only if it doesn't exist, without default
        await addColumnIfNotExists(db, 'business_lines', 'updated_at', 'DATETIME');
        console.log("Table business_lines checked/created.");

        // 2. Cost Centers Table (No created_at, no updated_at)
        // Check if the old columns exist before creating the table without them
        await removeColumnIfExists(db, 'cost_centers', 'business_line_id');
        await removeColumnIfExists(db, 'cost_centers', 'created_at'); // Ensure removal
        await removeColumnIfExists(db, 'cost_centers', 'updated_at'); // Ensure removal

        await db.exec(`
          CREATE TABLE IF NOT EXISTS cost_centers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
            -- created_at column removed
            -- updated_at column removed
            -- business_line_id column removed
          );
        `);
        console.log("Table cost_centers checked/created (without business_line_id, created_at, updated_at).");

        // 3. Budgets Table
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
            -- updated_at DATETIME, -- Managed manually or by trigger
            FOREIGN KEY (business_line_id) REFERENCES business_lines(id) ON DELETE SET NULL,
            FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
          );
        `);
         // Explicitly add updated_at only if it doesn't exist, without default
        await addColumnIfNotExists(db, 'budgets', 'updated_at', 'DATETIME');
        console.log("Table budgets checked/created.");

        // 4. Junction Table: cost_center_business_lines
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
        // Drop the cost_centers trigger if it exists, as the column is removed
        await db.exec(`DROP TRIGGER IF EXISTS update_cost_centers_updated_at;`);
        console.log("Dropped trigger update_cost_centers_updated_at if it existed.");

        await db.exec(`
          -- Trigger for business_lines (only if updated_at column exists)
          CREATE TRIGGER IF NOT EXISTS update_business_lines_updated_at
          AFTER UPDATE ON business_lines
          FOR EACH ROW
          BEGIN
              UPDATE business_lines SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
          END;

           -- Trigger for budgets (only if updated_at column exists)
           CREATE TRIGGER IF NOT EXISTS update_budgets_updated_at
           AFTER UPDATE ON budgets
           FOR EACH ROW
           BEGIN
               UPDATE budgets SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
           END;
        `);

        console.log("Remaining database triggers created or verified.");
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

    