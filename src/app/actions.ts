
'use server';

import type { Database } from 'sqlite';
import { open } from 'sqlite'; // Import open directly
import sqlite3 from 'sqlite3'; // Import sqlite3 driver
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import type { BusinessLine, CostCenter, Budget, BudgetEntry, CostCenterWithBusinessLines } from '@/types';
import * as XLSX from 'xlsx';
import { z } from 'zod';

// --- Validation Schemas ---
const BusinessLineSchema = z.object({
  name: z.string().min(1, { message: 'Business line name cannot be empty' }),
});

// Cost Center Schema - Updated (no business_line_id)
const CostCenterSchema = z.object({
  id: z.number().optional(), // For updates
  name: z.string().min(1, { message: 'Cost center name cannot be empty' }),
  // business_line_id removed
});

// Schema for associating a single BL to a CC
const AssociateBusinessLineSchema = z.object({
    cost_center_id: z.number().int().positive(),
    business_line_id: z.number().int().positive(),
});

// Schema for associating multiple BLs to a CC
const AssociateMultipleBusinessLinesSchema = z.object({
    cost_center_id: z.number().int().positive(),
    business_line_ids: z.array(z.number().int().positive()).min(0), // Allow empty array to disassociate all
});


const BudgetSchema = z.object({
    id: z.number().optional(), // Optional for update
    description: z.string().min(1, 'Description cannot be empty'),
    amount: z.number().positive('Amount must be a positive number'),
    year: z.number().int().min(1900).max(2100, 'Enter a valid year'),
    month: z.number().int().min(1).max(12, 'Enter a valid month (1-12)'),
    type: z.enum(['CAPEX', 'OPEX']),
    business_line_id: z.number().int().positive().nullable(), // Keep this for the budget line item itself
    cost_center_id: z.number().int().positive().nullable(), // Keep this for the budget line item itself
});


async function runDbOperation<T>(operation: (db: Database) => Promise<T>): Promise<T> {
  const db = await getDb();
  try {
    // Enable foreign keys for this operation if not already enabled globally
    // await db.run('PRAGMA foreign_keys = ON;');
    return await operation(db);
  } catch (error) {
      console.error('An error occurred during the database operation:', error);
      // Re-throw a generic error or a more specific one if needed
      throw new Error(`An error occurred during the database operation. Please check server logs.`);
  }
  // Note: We don't close the DB here, as it's managed globally in getDb
}


// --- Business Line Actions ---

export async function addBusinessLine(formData: FormData) {
  const name = formData.get('name') as string;

  try {
    BusinessLineSchema.parse({ name });
    await runDbOperation(async (db) => {
      // Insert and manually set updated_at
      await db.run('INSERT INTO business_lines (name, updated_at) VALUES (?, CURRENT_TIMESTAMP)', name);
    });
    revalidatePath('/business-lines');
    revalidatePath('/cost-centers');
    revalidatePath('/cost-center-associations');
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
    return { success: false, message: `Failed to add business line. Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
  }
}

export async function getBusinessLines(): Promise<BusinessLine[]> {
   try {
       return await runDbOperation(async (db) => {
           return db.all('SELECT id, name, created_at, updated_at FROM business_lines ORDER BY name');
       });
   } catch (error: any) {
        console.error('Failed to get business lines:', error);
        return [];
   }
}

export async function updateBusinessLine(id: number, formData: FormData) {
    const name = formData.get('name') as string;
    try {
        BusinessLineSchema.parse({ name });
        await runDbOperation(async (db) => {
            // Manually set updated_at on update
            const result = await db.run('UPDATE business_lines SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
            if (result.changes === 0) {
                 console.warn(`Attempted to update business line ID ${id}, but it was not found.`);
                 // Optionally throw an error or return a specific message
                 // throw new Error(`Business line with ID ${id} not found.`);
             }
        });
        revalidatePath('/business-lines');
        revalidatePath('/cost-centers');
        revalidatePath('/cost-center-associations');
        revalidatePath('/');
        return { success: true, message: 'Business line updated successfully.' };
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        if (error.message?.includes('UNIQUE constraint failed')) {
            return { success: false, message: `Business line "${name}" already exists.` };
        }
        console.error(`Failed to update business line with ID ${id}:`, error);
        return { success: false, message: `Failed to update business line (ID: ${id}). Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
    }
}


export async function deleteBusinessLine(id: number) {
  try {
    await runDbOperation(async (db) => {
      // The CASCADE constraint on cost_center_business_lines handles removing associations
       const result = await db.run('DELETE FROM business_lines WHERE id = ?', id);
        if (result.changes === 0) {
            console.warn(`Attempted to delete business line ID ${id}, but it was not found.`);
        }
        // Also need to potentially update budgets linked to this BL (set to NULL) due to ON DELETE SET NULL
        // This is handled by the FK constraint itself.
    });
    revalidatePath('/business-lines');
    revalidatePath('/cost-centers');
    revalidatePath('/cost-center-associations');
    revalidatePath('/budgets'); // Budgets might be affected
    revalidatePath('/');
    return { success: true, message: 'Business line deleted successfully.' };
  } catch (error: any) {
     // Foreign key errors on budgets should be handled by SET NULL,
     // but maybe other unexpected constraints exist.
     if (error.message?.includes('FOREIGN KEY constraint failed')) {
          return { success: false, message: `Cannot delete business line (ID: ${id}) due to an unexpected constraint.` };
     }
    console.error(`Failed to delete business line with ID ${id}:`, error);
    return { success: false, message: `Failed to delete business line (ID: ${id}). Reason: ${error.message || 'Unknown error'}.` };
  }
}

// --- Cost Center Actions (Updated for M2M) ---

export async function addCostCenter(formData: FormData) {
  const name = formData.get('name') as string;

  try {
      // Use the updated schema without business_line_id
      const parsedData = CostCenterSchema.omit({id: true}).parse({ name });
    await runDbOperation(async (db) => {
      // Insert only the name, timestamps are not managed for cost centers
      await db.run('INSERT INTO cost_centers (name) VALUES (?)', [parsedData.name]);
    });
    revalidatePath('/cost-centers');
    revalidatePath('/cost-center-associations');
    revalidatePath('/budgets'); // Budgets might refer to CCs
    revalidatePath('/');
    return { success: true, message: 'Cost center added successfully.' };
  } catch (error: any) {
      if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
      if (error.message?.includes('UNIQUE constraint failed')) {
        return { success: false, message: `Cost center "${name}" already exists.` };
      }
    console.error('Failed to add cost center:', error);
    return { success: false, message: `Failed to add cost center. Reason: ${error.message || 'Unknown error'}. Please check logs.` };
  }
}

// Get Cost Centers *without* their associated business lines initially
export async function getCostCentersSimple(): Promise<CostCenter[]> {
   try {
       return await runDbOperation(async (db) => {
           // Select basic cost center info - REMOVED created_at, updated_at
           return db.all(`
             SELECT cc.id, cc.name
             FROM cost_centers cc
             ORDER BY cc.name
           `);
       });
    } catch (error: any) {
         console.error('Failed to get simple cost centers:', error);
         return [];
    }
}

// Get Cost Centers *with* their associated business lines (more complex query)
export async function getCostCentersWithBusinessLines(): Promise<CostCenterWithBusinessLines[]> {
   try {
       return await runDbOperation(async (db) => {
           // Fetch all cost centers - REMOVED created_at, updated_at
           const costCenters = await db.all<CostCenter[]>(`
             SELECT id, name
             FROM cost_centers
             ORDER BY name
           `);

            if (!costCenters || costCenters.length === 0) {
                return [];
            }

           // Fetch all associations
           const associations = await db.all<{ cost_center_id: number; business_line_id: number; business_line_name: string }>(`
             SELECT
               ccbl.cost_center_id,
               ccbl.business_line_id,
               bl.name as business_line_name
             FROM cost_center_business_lines ccbl
             JOIN business_lines bl ON ccbl.business_line_id = bl.id
           `);

           // Create a map for efficient lookup
           const associationsMap = new Map<number, { id: number; name: string }[]>();
           associations.forEach(assoc => {
               const currentAssociations = associationsMap.get(assoc.cost_center_id) || [];
               currentAssociations.push({ id: assoc.business_line_id, name: assoc.business_line_name });
               associationsMap.set(assoc.cost_center_id, currentAssociations);
           });

           // Combine the data
           const results: CostCenterWithBusinessLines[] = costCenters.map(cc => ({
               ...cc,
               businessLines: associationsMap.get(cc.id) || [] // Get associated BLs or empty array
           }));

           return results;
       });
    } catch (error: any) {
         console.error('Failed to get cost centers with business lines:', error);
         return [];
    }
}


export async function updateCostCenter(id: number, formData: FormData) {
    const name = formData.get('name') as string;

    try {
        const parsedData = CostCenterSchema.parse({ id, name }); // Use full schema for update context
        await runDbOperation(async (db) => {
             // Update only the name, associations are handled separately. No timestamp update.
             const result = await db.run('UPDATE cost_centers SET name = ? WHERE id = ?', [parsedData.name, id]);
             if (result.changes === 0) {
                 console.warn(`Attempted to update cost center ID ${id}, but it was not found.`);
             }
        });
        revalidatePath('/cost-centers');
        revalidatePath('/cost-center-associations');
        revalidatePath('/budgets'); // Budgets might refer to CCs
        revalidatePath('/');
        return { success: true, message: 'Cost center updated successfully.' };
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        if (error.message?.includes('UNIQUE constraint failed')) {
            return { success: false, message: `Cost center "${name}" already exists.` };
        }
        console.error(`Failed to update cost center with ID ${id}:`, error);
        return { success: false, message: `Failed to update cost center (ID: ${id}). Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
    }
}

export async function deleteCostCenter(id: number) {
  try {
    await runDbOperation(async (db) => {
       // CASCADE on cost_center_business_lines handles associations
       const result = await db.run('DELETE FROM cost_centers WHERE id = ?', id);
        if (result.changes === 0) {
             console.warn(`Attempted to delete cost center ID ${id}, but it was not found.`);
        }
        // Budgets linked via FK with SET NULL will be updated automatically
    });
    revalidatePath('/cost-centers');
    revalidatePath('/cost-center-associations');
    revalidatePath('/budgets'); // Budgets might be affected
    revalidatePath('/');
    return { success: true, message: 'Cost center deleted successfully.' };
  } catch (error: any) {
      // FK errors on budgets should be handled by SET NULL
      if (error.message?.includes('FOREIGN KEY constraint failed')) {
         return { success: false, message: `Cannot delete cost center (ID: ${id}) due to an unexpected constraint.` };
      }
    console.error(`Failed to delete cost center with ID ${id}:`, error);
    return { success: false, message: `Failed to delete cost center (ID: ${id}). Reason: ${error.message || 'Unknown error'}.` };
  }
}

// --- Cost Center <-> Business Line Association Actions (NEW) ---

export async function associateBusinessLineToCostCenter(costCenterId: number, businessLineId: number) {
    try {
        AssociateBusinessLineSchema.parse({ cost_center_id: costCenterId, business_line_id: businessLineId });
        await runDbOperation(async (db) => {
            // Use INSERT OR IGNORE to avoid errors if the association already exists
            await db.run(
                'INSERT OR IGNORE INTO cost_center_business_lines (cost_center_id, business_line_id) VALUES (?, ?)',
                [costCenterId, businessLineId]
            );
        });
        revalidatePath('/cost-centers'); // Update display if needed
        revalidatePath('/cost-center-associations');
        return { success: true, message: 'Business line associated successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        if (error.message?.includes('FOREIGN KEY constraint failed')) {
            return { success: false, message: 'Invalid Cost Center or Business Line ID.' };
        }
        console.error(`Failed to associate BL ${businessLineId} to CC ${costCenterId}:`, error);
        return { success: false, message: `Association failed. Reason: ${error.message || 'Unknown error'}.` };
    }
}

export async function disassociateBusinessLineFromCostCenter(costCenterId: number, businessLineId: number) {
    try {
        AssociateBusinessLineSchema.parse({ cost_center_id: costCenterId, business_line_id: businessLineId });
        await runDbOperation(async (db) => {
            await db.run(
                'DELETE FROM cost_center_business_lines WHERE cost_center_id = ? AND business_line_id = ?',
                [costCenterId, businessLineId]
            );
        });
        revalidatePath('/cost-centers');
        revalidatePath('/cost-center-associations');
        return { success: true, message: 'Business line disassociated successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        // FK errors shouldn't occur on DELETE unless IDs are wrong
        console.error(`Failed to disassociate BL ${businessLineId} from CC ${costCenterId}:`, error);
        return { success: false, message: `Disassociation failed. Reason: ${error.message || 'Unknown error'}.` };
    }
}

// Action to set *all* associations for a cost center at once
export async function setCostCenterAssociations(costCenterId: number, businessLineIds: number[]) {
     try {
        AssociateMultipleBusinessLinesSchema.parse({ cost_center_id: costCenterId, business_line_ids: businessLineIds });
        await runDbOperation(async (db) => {
             // Use a transaction for atomicity
            await db.run('BEGIN TRANSACTION');
            try {
                // 1. Remove all existing associations for this cost center
                await db.run('DELETE FROM cost_center_business_lines WHERE cost_center_id = ?', costCenterId);

                // 2. Insert the new associations
                if (businessLineIds.length > 0) {
                    const stmt = await db.prepare('INSERT INTO cost_center_business_lines (cost_center_id, business_line_id) VALUES (?, ?)');
                    for (const blId of businessLineIds) {
                        // Add OR IGNORE in case of duplicate IDs in input array, though validation should prevent this
                        await stmt.run(costCenterId, blId);
                    }
                    await stmt.finalize();
                }
                await db.run('COMMIT');
            } catch (innerError: any) {
                await db.run('ROLLBACK');
                console.error(`Transaction failed during setting associations for CC ${costCenterId}:`, innerError);
                 // Re-throw the inner error to be caught by the outer catch block
                 throw innerError;
            }
        });
        revalidatePath('/cost-centers');
        revalidatePath('/cost-center-associations');
        return { success: true, message: 'Cost center associations updated successfully.' };
    } catch (error: any) {
        if (error instanceof z.ZodError) {
           return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
       }
        if (error.message?.includes('FOREIGN KEY constraint failed')) {
           // This could happen if one of the businessLineIds is invalid
           return { success: false, message: 'Update failed: One or more selected Business Lines do not exist.' };
        }
       console.error(`Failed to set associations for CC ${costCenterId}:`, error);
       return { success: false, message: `Failed to update associations. Reason: ${error.message || 'Unknown error'}.` };
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
        type: formData.get('type') as 'CAPEX' | 'OPEX' | undefined,
        business_line_id: businessLineIdStr && businessLineIdStr !== '__NONE__' ? parseInt(businessLineIdStr, 10) : null,
        cost_center_id: costCenterIdStr && costCenterIdStr !== '__NONE__' ? parseInt(costCenterIdStr, 10) : null,
    };

     if (businessLineIdStr && businessLineIdStr !== '__NONE__' && isNaN(rawData.business_line_id as number)) {
       return { success: false, message: 'Invalid Business Line ID format.' };
     }
     if (costCenterIdStr && costCenterIdStr !== '__NONE__' && isNaN(rawData.cost_center_id as number)) {
       return { success: false, message: 'Invalid Cost Center ID format.' };
     }


    try {
        const validatedData = BudgetSchema.omit({ id: true }).parse(rawData);
        await runDbOperation(async (db) => {
        // Manually set updated_at on insert
        await db.run(
            'INSERT INTO budgets (description, amount, year, month, type, business_line_id, cost_center_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
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
             if (rawData.business_line_id && !(await runDbOperation(db => db.get('SELECT 1 FROM business_lines WHERE id = ?', rawData.business_line_id)))) {
                 return { success: false, message: 'Invalid Business Line selected.' };
             }
             if (rawData.cost_center_id && !(await runDbOperation(db => db.get('SELECT 1 FROM cost_centers WHERE id = ?', rawData.cost_center_id)))) {
                 return { success: false, message: 'Invalid Cost Center selected.' };
             }
             return { success: false, message: 'Invalid reference to Business Line or Cost Center.' };
         }
        console.error('Failed to add budget entry:', error);
        return { success: false, message: `Failed to add budget entry. Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
    }
}


export async function getBudgets(): Promise<Budget[]> {
   try {
       return await runDbOperation(async (db) => {
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
    } catch (error: any) {
       console.error('Failed to get budgets:', error);
       return [];
    }
}

export async function getBudgetById(id: number): Promise<Budget | null> {
   try {
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
   } catch (error: any) {
       console.error(`Failed to get budget with ID ${id}:`, error);
       return null; // Return null on error
   }
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
        business_line_id: businessLineIdStr && businessLineIdStr !== '__NONE__' ? parseInt(businessLineIdStr, 10) : null,
        cost_center_id: costCenterIdStr && costCenterIdStr !== '__NONE__' ? parseInt(costCenterIdStr, 10) : null,
    };

    if (businessLineIdStr && businessLineIdStr !== '__NONE__' && isNaN(rawData.business_line_id as number)) {
       return { success: false, message: 'Invalid Business Line ID format.' };
     }
    if (costCenterIdStr && costCenterIdStr !== '__NONE__' && isNaN(rawData.cost_center_id as number)) {
       return { success: false, message: 'Invalid Cost Center ID format.' };
     }

  try {
      const validatedData = BudgetSchema.parse(rawData);
      await runDbOperation(async (db) => {
         // Manually set updated_at on update
         const result = await db.run(
            'UPDATE budgets SET description = ?, amount = ?, year = ?, month = ?, type = ?, business_line_id = ?, cost_center_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [validatedData.description, validatedData.amount, validatedData.year, validatedData.month, validatedData.type, validatedData.business_line_id, validatedData.cost_center_id, id]
        );
         if (result.changes === 0) {
              console.warn(`Attempted to update budget entry ID ${id}, but it was not found.`);
         }
        });
        revalidatePath('/budgets');
        revalidatePath(`/budgets/${id}/edit`);
        revalidatePath('/');
        return { success: true, message: 'Budget entry updated successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        if (error.message?.includes('FOREIGN KEY constraint failed')) {
             if (rawData.business_line_id && !(await runDbOperation(db => db.get('SELECT 1 FROM business_lines WHERE id = ?', rawData.business_line_id)))) {
                 return { success: false, message: 'Invalid Business Line selected.' };
             }
             if (rawData.cost_center_id && !(await runDbOperation(db => db.get('SELECT 1 FROM cost_centers WHERE id = ?', rawData.cost_center_id)))) {
                 return { success: false, message: 'Invalid Cost Center selected.' };
             }
             return { success: false, message: 'Invalid reference to Business Line or Cost Center.' };
         }
        console.error(`Failed to update budget entry with ID ${id}:`, error);
        return { success: false, message: `Failed to update budget entry (ID: ${id}). Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
    }
}


export async function deleteBudgetEntry(id: number) {
  try {
    await runDbOperation(async (db) => {
       const result = await db.run('DELETE FROM budgets WHERE id = ?', id);
       if (result.changes === 0) {
           console.warn(`Attempted to delete budget entry ID ${id}, but it was not found.`);
       }
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
        const data = XLSX.utils.sheet_to_json<any>(worksheet);

        // Fetch existing BLs and CCs for validation
        const { businessLines, costCenters } = await runDbOperation(async (db) => {
           const businessLines = await db.all('SELECT id, lower(name) as name FROM business_lines');
           const costCenters = await db.all('SELECT id, lower(name) as name FROM cost_centers');
           return { businessLines, costCenters };
        });

        const businessLineMap = new Map(businessLines.map(bl => [bl.name, bl.id]));
        const costCenterMap = new Map(costCenters.map(cc => [cc.name, cc.id]));

        const budgetEntries: BudgetEntry[] = [];
        const errors: string[] = [];
        const processedRows: any[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2;
            const rowErrors: string[] = [];

            const normalizedRow: { [key: string]: any } = {};
            for (const key in row) {
                if (Object.prototype.hasOwnProperty.call(row, key) && key.trim()) {
                     normalizedRow[key.toLowerCase().trim()] = row[key];
                }
            }

            if (Object.keys(normalizedRow).length === 0 || Object.values(normalizedRow).every(v => v === null || v === undefined || String(v).trim() === '')) {
                 console.log(`Skipping empty row ${rowNum}`);
                 continue;
            }

            processedRows.push(normalizedRow);

            const expectedColumns = ['description', 'amount', 'year', 'month', 'type'];
            const optionalColumns = ['business line', 'cost center'];
            const actualColumns = Object.keys(normalizedRow);

            expectedColumns.forEach(col => {
                if (!actualColumns.includes(col)) {
                     rowErrors.push(`Missing required column: '${col}'.`);
                }
            });

            // Extract budget data
            const description = normalizedRow['description'];
            const amountStr = normalizedRow['amount'];
            const yearStr = normalizedRow['year'];
            const monthStr = normalizedRow['month'];
            const type = (normalizedRow['type'] as string)?.toUpperCase().trim();
            const budgetBusinessLineName = (normalizedRow['business line'] as string)?.toLowerCase().trim();
            const budgetCostCenterName = (normalizedRow['cost center'] as string)?.toLowerCase().trim();


            // --- Basic Validation ---
            if (!description || typeof description !== 'string' || description.trim() === '') rowErrors.push(`Invalid or missing Description.`);
            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) rowErrors.push(`Invalid or missing positive Amount (value: '${amountStr}').`);
            const year = parseInt(yearStr, 10);
             if (isNaN(year) || year < 1900 || year > 2100) rowErrors.push(`Invalid or missing Year (1900-2100, value: '${yearStr}').`);
            const month = parseInt(monthStr, 10);
            if (isNaN(month) || month < 1 || month > 12) rowErrors.push(`Invalid or missing Month (1-12, value: '${monthStr}').`);
            if (!type || (type !== 'CAPEX' && type !== 'OPEX')) rowErrors.push(`Invalid or missing Type (must be 'CAPEX' or 'OPEX', value: '${normalizedRow['type']}').`);

            // --- Lookup IDs for Budget Line ---
            let budgetBusinessLineId: number | null = null;
            if (actualColumns.includes('business line') && budgetBusinessLineName) {
                if (businessLineMap.has(budgetBusinessLineName)) {
                    budgetBusinessLineId = businessLineMap.get(budgetBusinessLineName)!;
                } else {
                    rowErrors.push(`Budget's Business Line "${normalizedRow['business line']}" not found.`);
                }
            }

            let budgetCostCenterId: number | null = null;
            if (actualColumns.includes('cost center') && budgetCostCenterName) {
                if (costCenterMap.has(budgetCostCenterName)) {
                    budgetCostCenterId = costCenterMap.get(budgetCostCenterName)!;
                } else {
                    rowErrors.push(`Budget's Cost Center "${normalizedRow['cost center']}" not found.`);
                }
            }

            if (rowErrors.length > 0) {
                errors.push(`Row ${rowNum}: ${rowErrors.join('; ')}`);
            } else {
                try {
                     const budgetEntry: BudgetEntry = {
                         description: description.trim(),
                         amount: amount,
                         year: year,
                         month: month,
                         type: type as 'CAPEX' | 'OPEX',
                         business_line_id: budgetBusinessLineId,
                         cost_center_id: budgetCostCenterId,
                     };
                     BudgetSchema.omit({ id: true }).parse(budgetEntry); // Validate before adding
                     budgetEntries.push(budgetEntry);
                 } catch (zodError: any) {
                      if (zodError instanceof z.ZodError) {
                         errors.push(`Row ${rowNum}: Validation Error - ${zodError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
                     } else {
                         errors.push(`Row ${rowNum}: Unexpected error creating entry - ${zodError.message}`);
                     }
                 }
            }
        } // End row loop

        if (errors.length > 0) {
            console.error("Spreadsheet Errors:", errors);
            return { success: false, message: `Spreadsheet contains errors:\n- ${errors.join('\n- ')}\nPlease fix and re-upload.` };
        }

        if (budgetEntries.length === 0) {
             if (processedRows.length === 0) {
                 return { success: false, message: 'Spreadsheet is empty or contains no processable data rows.' };
             } else {
                 return { success: false, message: 'No valid budget entries found in the spreadsheet after validation.' };
             }
        }

        // --- Database Insertion (Transaction) ---
        await runDbOperation(async (db) => {
             await db.run('BEGIN TRANSACTION');
             try {
                 const stmt = await db.prepare(
                     // Manually set updated_at on insert
                     'INSERT INTO budgets (description, amount, year, month, type, business_line_id, cost_center_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
                 );
                 for (const entry of budgetEntries) {
                     await stmt.run(entry.description, entry.amount, entry.year, entry.month, entry.type, entry.business_line_id, entry.cost_center_id);
                 }
                 await stmt.finalize();
                 await db.run('COMMIT');
             } catch (dbError: any) {
                 await db.run('ROLLBACK');
                 console.error('Database insertion error during spreadsheet upload:', dbError);
                 throw dbError; // Re-throw to outer catch
             }
         });

        revalidatePath('/budgets');
        revalidatePath('/');
        return { success: true, message: `Successfully imported ${budgetEntries.length} budget entries.` };

    } catch (error: any) {
        console.error('Error processing spreadsheet:', error);
         if (error.message?.includes('File is not a zip file')) {
            return { success: false, message: 'Failed to process spreadsheet: The file is corrupted or not a valid XLSX format.' };
         }
        let userMessage = 'Failed to process spreadsheet file.';
          if (error.message?.includes('UNIQUE constraint failed')) { // Should not happen with budgets unless description+date+etc. is unique?
              userMessage = 'Error inserting data: Duplicate budget entry found.';
          } else if (error.message?.includes('FOREIGN KEY constraint failed')) {
              userMessage = 'Error inserting data: Check if Business Lines or Cost Centers referenced in the sheet exist.';
          } else {
             userMessage += ` Reason: ${error.message || 'Unknown error'}. Ensure it is a valid Excel (.xlsx) file.`;
          }

        return { success: false, message: userMessage };
    }
}


// --- Chart Data Actions ---

export async function getBudgetDataForCharts() {
   try {
       return await runDbOperation(async (db) => {
           return db.all(`
             SELECT
               b.amount, b.type,
               COALESCE(bl.name, 'Unassigned BL') as business_line_name, -- Name for the budget's linked BL
               COALESCE(cc.name, 'Unassigned CC') as cost_center_name   -- Name for the budget's linked CC
             FROM budgets b
             LEFT JOIN business_lines bl ON b.business_line_id = bl.id
             LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
           `);
           // Note: This chart data doesn't reflect the M2M CC<->BL relationship directly.
           // Charting based on *all* BLs associated with a budget's CC would require more complex joins/logic.
       });
    } catch (error: any) {
       console.error('Failed to get chart data:', error);
       return [];
    }
}
