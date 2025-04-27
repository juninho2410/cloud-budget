'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import type { BusinessLine, CostCenter, Budget, BudgetEntry } from '@/types';
import * as XLSX from 'xlsx';
import { z } from 'zod';

// --- Validation Schemas ---
const BusinessLineSchema = z.object({
  name: z.string().min(1, { message: 'Business line name cannot be empty' }),
});

const CostCenterSchema = z.object({
  name: z.string().min(1, { message: 'Cost center name cannot be empty' }),
  business_line_id: z.number().positive().nullable(),
});

const BudgetSchema = z.object({
    id: z.number().optional(), // Optional for update
    description: z.string().min(1, 'Description cannot be empty'),
    amount: z.number().positive('Amount must be a positive number'),
    year: z.number().int().min(1900).max(2100, 'Enter a valid year'),
    month: z.number().int().min(1).max(12, 'Enter a valid month (1-12)'),
    type: z.enum(['CAPEX', 'OPEX']),
    business_line_id: z.number().positive().nullable(),
    cost_center_id: z.number().positive().nullable(),
});


// Helper function for database operations
async function runDbOperation(operation: (db: any) => Promise<any>) {
  const db = await getDb();
  try {
    return await operation(db);
  } catch (error) {
    console.error('Database operation failed:', error);
    // Consider more specific error handling or re-throwing
    throw new Error('An error occurred during the database operation.');
  }
}

// --- Business Line Actions ---

export async function addBusinessLine(formData: FormData) {
  const name = formData.get('name') as string;

  try {
    BusinessLineSchema.parse({ name });
    await runDbOperation(async (db) => {
      await db.run('INSERT INTO business_lines (name) VALUES (?)', name);
    });
    revalidatePath('/business-lines');
    revalidatePath('/budgets');
    revalidatePath('/');
    return { success: true, message: 'Business line added successfully.' };
  } catch (error: any) {
     if (error instanceof z.ZodError) {
       return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
     }
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, message: `Business line "${name}" already exists.` };
      }
    console.error('Failed to add business line:', error);
    return { success: false, message: 'Failed to add business line.' };
  }
}

export async function getBusinessLines(): Promise<BusinessLine[]> {
  return runDbOperation(async (db) => {
    return db.all('SELECT id, name FROM business_lines ORDER BY name');
  });
}

export async function updateBusinessLine(id: number, formData: FormData) {
    const name = formData.get('name') as string;
    try {
      BusinessLineSchema.parse({ name });
        await runDbOperation(async (db) => {
        await db.run('UPDATE business_lines SET name = ? WHERE id = ?', [name, id]);
        });
        revalidatePath('/business-lines');
        revalidatePath('/budgets');
         revalidatePath('/');
        return { success: true, message: 'Business line updated successfully.' };
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        if (error.message.includes('UNIQUE constraint failed')) {
            return { success: false, message: `Business line "${name}" already exists.` };
        }
        console.error('Failed to update business line:', error);
        return { success: false, message: 'Failed to update business line.' };
    }
}


export async function deleteBusinessLine(id: number) {
  try {
    await runDbOperation(async (db) => {
      // Optionally, check if the business line is in use before deleting, or handle cascades
      await db.run('DELETE FROM business_lines WHERE id = ?', id);
    });
    revalidatePath('/business-lines');
    revalidatePath('/cost-centers'); // Cost centers might be affected
    revalidatePath('/budgets'); // Budgets might be affected
    revalidatePath('/');
    return { success: true, message: 'Business line deleted successfully.' };
  } catch (error) {
    console.error('Failed to delete business line:', error);
    return { success: false, message: 'Failed to delete business line.' };
  }
}

// --- Cost Center Actions ---

export async function addCostCenter(formData: FormData) {
  const name = formData.get('name') as string;
  const businessLineIdStr = formData.get('business_line_id') as string | null;
  const business_line_id = businessLineIdStr ? parseInt(businessLineIdStr, 10) : null;

  try {
      const parsedData = CostCenterSchema.parse({ name, business_line_id });
    await runDbOperation(async (db) => {
      await db.run('INSERT INTO cost_centers (name, business_line_id) VALUES (?, ?)', [parsedData.name, parsedData.business_line_id]);
    });
    revalidatePath('/cost-centers');
    revalidatePath('/budgets');
     revalidatePath('/');
    return { success: true, message: 'Cost center added successfully.' };
  } catch (error: any) {
      if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, message: `Cost center "${name}" already exists.` };
      }
    console.error('Failed to add cost center:', error);
    return { success: false, message: 'Failed to add cost center.' };
  }
}

export async function getCostCenters(): Promise<CostCenter[]> {
  return runDbOperation(async (db) => {
    return db.all(`
      SELECT cc.id, cc.name, cc.business_line_id, bl.name as business_line_name
      FROM cost_centers cc
      LEFT JOIN business_lines bl ON cc.business_line_id = bl.id
      ORDER BY cc.name
    `);
  });
}

export async function updateCostCenter(id: number, formData: FormData) {
    const name = formData.get('name') as string;
    const businessLineIdStr = formData.get('business_line_id') as string | null;
    const business_line_id = businessLineIdStr ? parseInt(businessLineIdStr, 10) : null;

    try {
        const parsedData = CostCenterSchema.parse({ name, business_line_id });
        await runDbOperation(async (db) => {
        await db.run('UPDATE cost_centers SET name = ?, business_line_id = ? WHERE id = ?', [parsedData.name, parsedData.business_line_id, id]);
        });
        revalidatePath('/cost-centers');
        revalidatePath('/budgets');
        revalidatePath('/');
        return { success: true, message: 'Cost center updated successfully.' };
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        if (error.message.includes('UNIQUE constraint failed')) {
            return { success: false, message: `Cost center "${name}" already exists.` };
        }
        console.error('Failed to update cost center:', error);
        return { success: false, message: 'Failed to update cost center.' };
    }
}

export async function deleteCostCenter(id: number) {
  try {
    await runDbOperation(async (db) => {
      await db.run('DELETE FROM cost_centers WHERE id = ?', id);
    });
    revalidatePath('/cost-centers');
    revalidatePath('/budgets'); // Budgets might be affected
    revalidatePath('/');
    return { success: true, message: 'Cost center deleted successfully.' };
  } catch (error) {
    console.error('Failed to delete cost center:', error);
    return { success: false, message: 'Failed to delete cost center.' };
  }
}

// --- Budget Actions ---

export async function addBudgetEntry(formData: FormData) {
    const rawData = {
        description: formData.get('description') as string,
        amount: parseFloat(formData.get('amount') as string),
        year: parseInt(formData.get('year') as string, 10),
        month: parseInt(formData.get('month') as string, 10),
        type: formData.get('type') as 'CAPEX' | 'OPEX',
        business_line_id: formData.get('business_line_id') ? parseInt(formData.get('business_line_id') as string, 10) : null,
        cost_center_id: formData.get('cost_center_id') ? parseInt(formData.get('cost_center_id') as string, 10) : null,
    };

    try {
        const validatedData = BudgetSchema.omit({ id: true }).parse(rawData);
        await runDbOperation(async (db) => {
        await db.run(
            'INSERT INTO budgets (description, amount, year, month, type, business_line_id, cost_center_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [validatedData.description, validatedData.amount, validatedData.year, validatedData.month, validatedData.type, validatedData.business_line_id, validatedData.cost_center_id]
        );
        });
        revalidatePath('/budgets');
        revalidatePath('/');
        return { success: true, message: 'Budget entry added successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        console.error('Failed to add budget entry:', error);
        return { success: false, message: 'Failed to add budget entry.' };
    }
}


export async function getBudgets(): Promise<Budget[]> {
  return runDbOperation(async (db) => {
    return db.all(`
      SELECT
        b.id, b.description, b.amount, b.year, b.month, b.type,
        b.business_line_id, b.cost_center_id,
        bl.name as business_line_name,
        cc.name as cost_center_name,
        b.created_at, b.updated_at
      FROM budgets b
      LEFT JOIN business_lines bl ON b.business_line_id = bl.id
      LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
      ORDER BY b.year DESC, b.month DESC, b.id DESC
    `);
  });
}

export async function getBudgetById(id: number): Promise<Budget | null> {
    const result = await runDbOperation(async (db) => {
        return db.get(`
            SELECT
                b.id, b.description, b.amount, b.year, b.month, b.type,
                b.business_line_id, b.cost_center_id,
                bl.name as business_line_name,
                cc.name as cost_center_name,
                b.created_at, b.updated_at
            FROM budgets b
            LEFT JOIN business_lines bl ON b.business_line_id = bl.id
            LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
            WHERE b.id = ?
        `, id);
    });
    return result || null;
}


export async function updateBudgetEntry(id: number, formData: FormData) {
    const rawData = {
        id: id, // Add id for validation context if needed, though not updated directly in DB call
        description: formData.get('description') as string,
        amount: parseFloat(formData.get('amount') as string),
        year: parseInt(formData.get('year') as string, 10),
        month: parseInt(formData.get('month') as string, 10),
        type: formData.get('type') as 'CAPEX' | 'OPEX',
        business_line_id: formData.get('business_line_id') ? parseInt(formData.get('business_line_id') as string, 10) : null,
        cost_center_id: formData.get('cost_center_id') ? parseInt(formData.get('cost_center_id') as string, 10) : null,
    };


  try {
      const validatedData = BudgetSchema.parse(rawData);
      await runDbOperation(async (db) => {
        await db.run(
            'UPDATE budgets SET description = ?, amount = ?, year = ?, month = ?, type = ?, business_line_id = ?, cost_center_id = ? WHERE id = ?',
            [validatedData.description, validatedData.amount, validatedData.year, validatedData.month, validatedData.type, validatedData.business_line_id, validatedData.cost_center_id, id]
        );
        });
        revalidatePath('/budgets');
        revalidatePath(`/budgets/${id}/edit`); // Revalidate specific edit page if exists
        revalidatePath('/');
        return { success: true, message: 'Budget entry updated successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        console.error('Failed to update budget entry:', error);
        return { success: false, message: 'Failed to update budget entry.' };
    }
}


export async function deleteBudgetEntry(id: number) {
  try {
    await runDbOperation(async (db) => {
      await db.run('DELETE FROM budgets WHERE id = ?', id);
    });
    revalidatePath('/budgets');
    revalidatePath('/');
    return { success: true, message: 'Budget entry deleted successfully.' };
  } catch (error) {
    console.error('Failed to delete budget entry:', error);
    return { success: false, message: 'Failed to delete budget entry.' };
  }
}

// --- Spreadsheet Upload Action ---

export async function uploadSpreadsheet(formData: FormData): Promise<{ success: boolean; message: string }> {
    const file = formData.get('spreadsheet') as File;

    if (!file || file.size === 0) {
        return { success: false, message: 'No file uploaded or file is empty.' };
    }

    try {
        const bytes = await file.arrayBuffer();
        const workbook = XLSX.read(bytes, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<any>(worksheet); // Use 'any' for flexibility initially

        const db = await getDb();
        const businessLines = await db.all('SELECT id, lower(name) as name FROM business_lines');
        const costCenters = await db.all('SELECT id, lower(name) as name, business_line_id FROM cost_centers');

        // Create maps for quick lookup (case-insensitive)
        const businessLineMap = new Map(businessLines.map(bl => [bl.name, bl.id]));
        const costCenterMap = new Map(costCenters.map(cc => [cc.name, cc.id]));
         // Map cost center name to its business line ID for validation
        const costCenterBusinessLineMap = new Map(costCenters.map(cc => [cc.name, cc.business_line_id]));


        const budgetEntries: BudgetEntry[] = [];
        const errors: string[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Assuming header is row 1, data starts row 2

            // Normalize column names (lowercase, trim)
            const normalizedRow: { [key: string]: any } = {};
            for (const key in row) {
                normalizedRow[key.toLowerCase().trim()] = row[key];
            }

            // Extract and validate data (adjust column names as needed)
            const description = normalizedRow['description'];
            const amount = parseFloat(normalizedRow['amount']);
            const year = parseInt(normalizedRow['year'], 10);
            const month = parseInt(normalizedRow['month'], 10);
            const type = (normalizedRow['type'] as string)?.toUpperCase() as 'CAPEX' | 'OPEX';
            const businessLineName = (normalizedRow['business line'] as string)?.toLowerCase().trim();
            const costCenterName = (normalizedRow['cost center'] as string)?.toLowerCase().trim();

            let businessLineId: number | null = null;
            let costCenterId: number | null = null;

            // --- Basic Validation ---
            if (!description || typeof description !== 'string') errors.push(`Row ${rowNum}: Invalid or missing Description.`);
            if (isNaN(amount) || amount <= 0) errors.push(`Row ${rowNum}: Invalid or missing positive Amount.`);
            if (isNaN(year) || year < 1900 || year > 2100) errors.push(`Row ${rowNum}: Invalid or missing Year (1900-2100).`);
            if (isNaN(month) || month < 1 || month > 12) errors.push(`Row ${rowNum}: Invalid or missing Month (1-12).`);
            if (!type || (type !== 'CAPEX' && type !== 'OPEX')) errors.push(`Row ${rowNum}: Invalid or missing Type (must be CAPEX or OPEX).`);

            // --- Business Line Lookup ---
            if (businessLineName) {
                if (businessLineMap.has(businessLineName)) {
                    businessLineId = businessLineMap.get(businessLineName)!;
                } else {
                    errors.push(`Row ${rowNum}: Business Line "${normalizedRow['business line']}" not found in the database.`);
                }
            }

            // --- Cost Center Lookup & Validation ---
            if (costCenterName) {
                if (costCenterMap.has(costCenterName)) {
                    costCenterId = costCenterMap.get(costCenterName)!;
                    // Validate Cost Center belongs to the specified Business Line (if both provided)
                    if (businessLineId !== null) {
                         const expectedBusinessLineId = costCenterBusinessLineMap.get(costCenterName);
                         // Allow if cost center has no business line assigned OR if it matches the row's business line
                         if (expectedBusinessLineId !== null && expectedBusinessLineId !== businessLineId) {
                             const actualBLName = businessLines.find(bl => bl.id === expectedBusinessLineId)?.name || 'Unknown';
                             errors.push(`Row ${rowNum}: Cost Center "${normalizedRow['cost center']}" belongs to Business Line "${actualBLName}", not "${normalizedRow['business line']}".`);
                         }
                    }
                } else {
                    errors.push(`Row ${rowNum}: Cost Center "${normalizedRow['cost center']}" not found in the database.`);
                }
            }


             // If no errors for this row so far, create the budget entry
             if (errors.length === 0 || errors[errors.length -1].startsWith(`Row ${rowNum + 1}`)) { // Check if the *last* error was *not* for the current row
                 const budgetEntry: BudgetEntry = {
                     description: description,
                     amount: amount,
                     year: year,
                     month: month,
                     type: type,
                     business_line_id: businessLineId,
                     cost_center_id: costCenterId,
                 };
                 budgetEntries.push(budgetEntry);
             }

        }

        if (errors.length > 0) {
            return { success: false, message: `Spreadsheet contains errors:\n- ${errors.join('\n- ')}\nPlease fix and re-upload.` };
        }


        // --- Database Insertion (Transaction) ---
        if (budgetEntries.length > 0) {
            await db.run('BEGIN TRANSACTION');
            try {
                const stmt = await db.prepare(
                    'INSERT INTO budgets (description, amount, year, month, type, business_line_id, cost_center_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
                );
                for (const entry of budgetEntries) {
                    await stmt.run(entry.description, entry.amount, entry.year, entry.month, entry.type, entry.business_line_id, entry.cost_center_id);
                }
                await stmt.finalize();
                await db.run('COMMIT');

                revalidatePath('/budgets');
                revalidatePath('/');
                return { success: true, message: `Successfully imported ${budgetEntries.length} budget entries.` };
            } catch (error) {
                await db.run('ROLLBACK');
                console.error('Database insertion error during spreadsheet upload:', error);
                return { success: false, message: 'Error inserting data into the database during spreadsheet import.' };
            }
        } else {
            return { success: false, message: 'No valid budget entries found in the spreadsheet to import.' };
        }

    } catch (error) {
        console.error('Error processing spreadsheet:', error);
        return { success: false, message: 'Failed to process spreadsheet file. Ensure it is a valid Excel (.xlsx) file.' };
    }
}


// --- Chart Data Actions ---

export async function getBudgetDataForCharts() {
    return runDbOperation(async (db) => {
        return db.all(`
      SELECT
        b.amount, b.type,
        bl.name as business_line_name,
        cc.name as cost_center_name
      FROM budgets b
      LEFT JOIN business_lines bl ON b.business_line_id = bl.id
      LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
    `);
    });
}