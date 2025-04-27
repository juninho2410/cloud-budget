
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
  business_line_id: z.number().int().positive().nullable(), // Changed to number().int()
});

const BudgetSchema = z.object({
    id: z.number().optional(), // Optional for update
    description: z.string().min(1, 'Description cannot be empty'),
    amount: z.number().positive('Amount must be a positive number'),
    year: z.number().int().min(1900).max(2100, 'Enter a valid year'),
    month: z.number().int().min(1).max(12, 'Enter a valid month (1-12)'),
    type: z.enum(['CAPEX', 'OPEX']),
    business_line_id: z.number().int().positive().nullable(), // Changed to number().int()
    cost_center_id: z.number().int().positive().nullable(), // Changed to number().int()
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
    revalidatePath('/cost-centers'); // Adding revalidation for cost centers as they might be affected
    revalidatePath('/');
    return { success: true, message: 'Business line added successfully.' };
  } catch (error: any) {
     if (error instanceof z.ZodError) {
       return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
     }
      if (error.message?.includes('UNIQUE constraint failed')) {
        return { success: false, message: `Business line "${name}" already exists.` };
      }
    console.error('Failed to add business line:', error);
    return { success: false, message: 'Failed to add business line. Please check logs.' };
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
        revalidatePath('/cost-centers'); // Adding revalidation for cost centers as they might be affected
        revalidatePath('/');
        return { success: true, message: 'Business line updated successfully.' };
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        if (error.message?.includes('UNIQUE constraint failed')) {
            return { success: false, message: `Business line "${name}" already exists.` };
        }
        // More detailed logging for unexpected errors during update
        console.error(`Failed to update business line with ID ${id}:`, error);
        return { success: false, message: `Failed to update business line (ID: ${id}). Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
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
  } catch (error: any) {
    // Consider specific error handling for foreign key constraints if not handled by cascade
    console.error(`Failed to delete business line with ID ${id}:`, error);
    return { success: false, message: `Failed to delete business line (ID: ${id}). It might be in use. Reason: ${error.message || 'Unknown error'}.` };
  }
}

// --- Cost Center Actions ---

export async function addCostCenter(formData: FormData) {
  const name = formData.get('name') as string;
  const businessLineIdStr = formData.get('business_line_id') as string | null;
  // Ensure null is passed if the string is empty or null, otherwise parse as integer
  const business_line_id = businessLineIdStr ? parseInt(businessLineIdStr, 10) : null;

   // Validate parsed ID is a number if not null
   if (businessLineIdStr && isNaN(business_line_id as number)) {
       return { success: false, message: 'Invalid Business Line ID provided.' };
   }


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
      if (error.message?.includes('UNIQUE constraint failed')) {
        return { success: false, message: `Cost center "${name}" already exists.` };
      }
       if (error.message?.includes('FOREIGN KEY constraint failed')) {
          return { success: false, message: `Invalid Business Line selected.` };
       }
    console.error('Failed to add cost center:', error);
    return { success: false, message: 'Failed to add cost center. Please check logs.' };
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

    // Validate parsed ID is a number if not null
    if (businessLineIdStr && isNaN(business_line_id as number)) {
        return { success: false, message: 'Invalid Business Line ID provided.' };
    }

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
        if (error.message?.includes('UNIQUE constraint failed')) {
            return { success: false, message: `Cost center "${name}" already exists.` };
        }
         if (error.message?.includes('FOREIGN KEY constraint failed')) {
            return { success: false, message: `Invalid Business Line selected.` };
         }
        console.error(`Failed to update cost center with ID ${id}:`, error);
        return { success: false, message: `Failed to update cost center (ID: ${id}). Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
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
  } catch (error: any) {
     // Consider specific error handling for foreign key constraints if not handled by cascade
    console.error(`Failed to delete cost center with ID ${id}:`, error);
    return { success: false, message: `Failed to delete cost center (ID: ${id}). It might be in use. Reason: ${error.message || 'Unknown error'}.` };
  }
}

// --- Budget Actions ---

export async function addBudgetEntry(formData: FormData) {
    const businessLineIdStr = formData.get('business_line_id') as string | null;
    const costCenterIdStr = formData.get('cost_center_id') as string | null;

    const rawData = {
        description: formData.get('description') as string,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
        year: formData.get('year') ? parseInt(formData.get('year') as string, 10) : undefined,
        month: formData.get('month') ? parseInt(formData.get('month') as string, 10) : undefined,
        type: formData.get('type') as 'CAPEX' | 'OPEX' | undefined, // Allow undefined initially
        // Parse IDs only if they are not null/empty strings
        business_line_id: businessLineIdStr ? parseInt(businessLineIdStr, 10) : null,
        cost_center_id: costCenterIdStr ? parseInt(costCenterIdStr, 10) : null,
    };

     // Validate parsed IDs are numbers if not null
     if (businessLineIdStr && isNaN(rawData.business_line_id as number)) {
       return { success: false, message: 'Invalid Business Line ID.' };
     }
     if (costCenterIdStr && isNaN(rawData.cost_center_id as number)) {
       return { success: false, message: 'Invalid Cost Center ID.' };
     }


    try {
        // Use .omit({ id: true }) as we are adding, not updating
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
         if (error.message?.includes('FOREIGN KEY constraint failed')) {
             // Check which foreign key failed (more specific message)
             if (rawData.business_line_id && rawData.cost_center_id) {
                 return { success: false, message: 'Invalid Business Line or Cost Center selected.' };
             } else if (rawData.business_line_id) {
                  return { success: false, message: 'Invalid Business Line selected.' };
             } else if (rawData.cost_center_id) {
                  return { success: false, message: 'Invalid Cost Center selected.' };
             } else {
                 return { success: false, message: 'Invalid Business Line or Cost Center.' }; // Fallback
             }
         }
        console.error('Failed to add budget entry:', error);
        return { success: false, message: `Failed to add budget entry. Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
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
    return result || null; // Ensure null is returned if not found
}


export async function updateBudgetEntry(id: number, formData: FormData) {
    const businessLineIdStr = formData.get('business_line_id') as string | null;
    const costCenterIdStr = formData.get('cost_center_id') as string | null;

    const rawData = {
        id: id, // Include id for validation context
        description: formData.get('description') as string,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
        year: formData.get('year') ? parseInt(formData.get('year') as string, 10) : undefined,
        month: formData.get('month') ? parseInt(formData.get('month') as string, 10) : undefined,
        type: formData.get('type') as 'CAPEX' | 'OPEX' | undefined,
        business_line_id: businessLineIdStr ? parseInt(businessLineIdStr, 10) : null,
        cost_center_id: costCenterIdStr ? parseInt(costCenterIdStr, 10) : null,
    };

    // Validate parsed IDs are numbers if not null
    if (businessLineIdStr && isNaN(rawData.business_line_id as number)) {
       return { success: false, message: 'Invalid Business Line ID.' };
     }
    if (costCenterIdStr && isNaN(rawData.cost_center_id as number)) {
       return { success: false, message: 'Invalid Cost Center ID.' };
     }

  try {
      // Use the full BudgetSchema for updates as ID is present
      const validatedData = BudgetSchema.parse(rawData);
      await runDbOperation(async (db) => {
        await db.run(
            'UPDATE budgets SET description = ?, amount = ?, year = ?, month = ?, type = ?, business_line_id = ?, cost_center_id = ? WHERE id = ?',
            [validatedData.description, validatedData.amount, validatedData.year, validatedData.month, validatedData.type, validatedData.business_line_id, validatedData.cost_center_id, id]
        );
        });
        revalidatePath('/budgets');
        revalidatePath(`/budgets/${id}/edit`); // Revalidate specific edit page
        revalidatePath('/');
        return { success: true, message: 'Budget entry updated successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        if (error.message?.includes('FOREIGN KEY constraint failed')) {
             // Check which foreign key failed (more specific message)
             if (rawData.business_line_id && rawData.cost_center_id) {
                 return { success: false, message: 'Invalid Business Line or Cost Center selected.' };
             } else if (rawData.business_line_id) {
                  return { success: false, message: 'Invalid Business Line selected.' };
             } else if (rawData.cost_center_id) {
                  return { success: false, message: 'Invalid Cost Center selected.' };
             } else {
                 return { success: false, message: 'Invalid Business Line or Cost Center.' }; // Fallback
             }
         }
        console.error(`Failed to update budget entry with ID ${id}:`, error);
        return { success: false, message: `Failed to update budget entry (ID: ${id}). Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
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
  } catch (error: any) {
    console.error(`Failed to delete budget entry with ID ${id}:`, error);
    return { success: false, message: `Failed to delete budget entry (ID: ${id}). Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
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
        // Explicitly define header row if necessary, e.g., { header: 1 }
        const data = XLSX.utils.sheet_to_json<any>(worksheet);

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
        const processedRows: any[] = []; // Track rows being processed

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Assuming header is row 1, data starts row 2
            const rowErrors: string[] = []; // Errors specific to this row

            // Normalize column names (lowercase, trim) and handle potential undefined values
            const normalizedRow: { [key: string]: any } = {};
            for (const key in row) {
                 // Only process own properties and non-empty keys
                if (Object.prototype.hasOwnProperty.call(row, key) && key.trim()) {
                     normalizedRow[key.toLowerCase().trim()] = row[key];
                }
            }

             // Skip empty rows entirely
            if (Object.keys(normalizedRow).length === 0 || Object.values(normalizedRow).every(v => v === null || v === undefined || String(v).trim() === '')) {
                 console.log(`Skipping empty row ${rowNum}`);
                 continue; // Skip to next iteration
            }

             processedRows.push(normalizedRow); // Add row for processing


            // --- Column Name Consistency Checks ---
            const expectedColumns = ['description', 'amount', 'year', 'month', 'type'];
            const optionalColumns = ['business line', 'cost center'];
            const actualColumns = Object.keys(normalizedRow);

            expectedColumns.forEach(col => {
                if (!actualColumns.includes(col)) {
                     rowErrors.push(`Missing required column: '${col}'.`);
                }
            });


            // Extract and validate data (adjust column names as needed)
            const description = normalizedRow['description'];
            const amountStr = normalizedRow['amount'];
            const yearStr = normalizedRow['year'];
            const monthStr = normalizedRow['month'];
            const type = (normalizedRow['type'] as string)?.toUpperCase().trim();
            const businessLineName = (normalizedRow['business line'] as string)?.toLowerCase().trim();
            const costCenterName = (normalizedRow['cost center'] as string)?.toLowerCase().trim();


            // --- Basic Validation ---
            if (!description || typeof description !== 'string' || description.trim() === '') rowErrors.push(`Invalid or missing Description.`);

            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) rowErrors.push(`Invalid or missing positive Amount (value: '${amountStr}').`);

            const year = parseInt(yearStr, 10);
             if (isNaN(year) || year < 1900 || year > 2100) rowErrors.push(`Invalid or missing Year (1900-2100, value: '${yearStr}').`);

            const month = parseInt(monthStr, 10);
            if (isNaN(month) || month < 1 || month > 12) rowErrors.push(`Invalid or missing Month (1-12, value: '${monthStr}').`);

            if (!type || (type !== 'CAPEX' && type !== 'OPEX')) rowErrors.push(`Invalid or missing Type (must be 'CAPEX' or 'OPEX', value: '${normalizedRow['type']}').`);


             let businessLineId: number | null = null;
             let costCenterId: number | null = null;

             // --- Business Line Lookup ---
             // Only perform lookup if the column exists and has a non-empty value
             if (actualColumns.includes('business line') && businessLineName) {
                 if (businessLineMap.has(businessLineName)) {
                     businessLineId = businessLineMap.get(businessLineName)!;
                 } else {
                     rowErrors.push(`Business Line "${normalizedRow['business line']}" not found.`);
                 }
             }

              // --- Cost Center Lookup & Validation ---
             // Only perform lookup if the column exists and has a non-empty value
              if (actualColumns.includes('cost center') && costCenterName) {
                  if (costCenterMap.has(costCenterName)) {
                      costCenterId = costCenterMap.get(costCenterName)!;
                      // Validate Cost Center belongs to the specified Business Line (if both provided)
                      if (businessLineId !== null) {
                           const expectedBusinessLineId = costCenterBusinessLineMap.get(costCenterName);
                           // Allow if cost center has no business line assigned OR if it matches the row's business line
                           if (expectedBusinessLineId !== null && expectedBusinessLineId !== businessLineId) {
                               const actualBLNameResult = businessLines.find(bl => bl.id === expectedBusinessLineId);
                               const actualBLName = actualBLNameResult ? `"${actualBLNameResult.name}"` : 'an unassigned Business Line'; // Handle case where BL name might not be found (shouldn't happen ideally)
                               const providedBLName = normalizedRow['business line'] || 'the provided Business Line';
                               rowErrors.push(`Cost Center "${normalizedRow['cost center']}" belongs to ${actualBLName}, not ${providedBLName}.`);
                           }
                      }
                  } else {
                      rowErrors.push(`Cost Center "${normalizedRow['cost center']}" not found.`);
                  }
             }


             // If errors occurred for this row, add them to the main errors list with row number
             if (rowErrors.length > 0) {
                 errors.push(`Row ${rowNum}: ${rowErrors.join('; ')}`);
             } else {
                // If no errors for this row, try creating the budget entry object
                 try {
                     const budgetEntry: BudgetEntry = {
                         description: description.trim(),
                         amount: amount,
                         year: year,
                         month: month,
                         type: type as 'CAPEX' | 'OPEX', // Type assertion safe here due to prior validation
                         business_line_id: businessLineId,
                         cost_center_id: costCenterId,
                     };
                     // Validate with Zod before adding to the list
                     BudgetSchema.omit({ id: true }).parse(budgetEntry);
                     budgetEntries.push(budgetEntry);
                 } catch (zodError: any) {
                      if (zodError instanceof z.ZodError) {
                         errors.push(`Row ${rowNum}: Validation Error - ${zodError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
                     } else {
                         errors.push(`Row ${rowNum}: Unexpected error creating entry - ${zodError.message}`);
                     }
                 }
            }

        } // End of row loop


        if (errors.length > 0) {
            console.error("Spreadsheet Errors:", errors);
            return { success: false, message: `Spreadsheet contains errors:\n- ${errors.join('\n- ')}\nPlease fix and re-upload.` };
        }


         // --- Check if any valid rows were processed ---
        if (budgetEntries.length === 0) {
             if (processedRows.length === 0) {
                 return { success: false, message: 'Spreadsheet is empty or contains no processable data rows.' };
             } else {
                 return { success: false, message: 'No valid budget entries found in the spreadsheet after validation.' };
             }
        }


        // --- Database Insertion (Transaction) ---
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
        } catch (dbError: any) {
            await db.run('ROLLBACK');
            console.error('Database insertion error during spreadsheet upload:', dbError);
             // Provide more specific feedback if possible (e.g., constraint violations)
             let userMessage = 'Error inserting data into the database during spreadsheet import.';
             if (dbError.message?.includes('UNIQUE constraint failed')) {
                 userMessage += ' There might be duplicate entries.';
             } else if (dbError.message?.includes('FOREIGN KEY constraint failed')) {
                 userMessage += ' Check if Business Lines or Cost Centers referenced in the sheet exist.';
             }
            return { success: false, message: `${userMessage} Reason: ${dbError.message}` };
        }


    } catch (error: any) {
        console.error('Error processing spreadsheet:', error);
         // Check for specific XLSX parsing errors if possible
         if (error.message?.includes('File is not a zip file')) {
            return { success: false, message: 'Failed to process spreadsheet: The file is corrupted or not a valid XLSX format.' };
         }
        return { success: false, message: `Failed to process spreadsheet file. Ensure it is a valid Excel (.xlsx) file. Error: ${error.message}` };
    }
}


// --- Chart Data Actions ---

export async function getBudgetDataForCharts() {
    return runDbOperation(async (db) => {
        // Fetch data needed for charts
        // Consider filtering or aggregating here if datasets become large
        return db.all(`
      SELECT
        b.amount, b.type,
        COALESCE(bl.name, 'Unassigned') as business_line_name,
        COALESCE(cc.name, 'Unassigned') as cost_center_name
      FROM budgets b
      LEFT JOIN business_lines bl ON b.business_line_id = bl.id
      LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
    `);
    });
}
