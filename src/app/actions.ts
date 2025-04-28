
'use server';

import type { Database } from 'sqlite';
import { open } from 'sqlite'; // Import open directly
import sqlite3 from 'sqlite3'; // Import sqlite3 driver
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import type { BusinessLine, CostCenter, Budget, BudgetEntry, CostCenterWithBusinessLines, ChartItem, Expense, ExpenseEntry } from '@/types'; // Added Expense types
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { notFound } from 'next/navigation'; // Import notFound

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


const BaseEntrySchema = z.object({ // Base schema for common fields
    description: z.string().min(1, 'Description cannot be empty'),
    amount: z.number().positive('Amount must be a positive number'),
    year: z.number().int().min(1900).max(2100, 'Enter a valid year'),
    month: z.number().int().min(1).max(12, 'Enter a valid month (1-12)'),
    type: z.enum(['CAPEX', 'OPEX']),
    // Use zod transform to handle the special "__NONE__" value from the form or nullish values
    business_line_id: z.preprocess(
        (val) => (val === '__NONE__' || val === null || val === '' || val === undefined ? null : parseInt(String(val), 10)),
        z.number().int().positive().nullable()
    ).optional(),
    cost_center_id: z.preprocess(
        (val) => (val === '__NONE__' || val === null || val === '' || val === undefined ? null : parseInt(String(val), 10)),
        z.number().int().positive().nullable()
    ).optional(),
});

// Schema for Budget Entries (inherits Base and adds ID)
const BudgetSchema = BaseEntrySchema.extend({
    id: z.number().optional(), // Optional for update
});

// Schema for Expense Entries (inherits Base and adds ID) (NEW)
const ExpenseSchema = BaseEntrySchema.extend({
    id: z.number().optional(), // Optional for update
});


async function runDbOperation<T>(operation: (db: Database) => Promise<T>): Promise<T> {
  const db = await getDb();
  try {
    // Enable foreign keys for this operation if not already enabled globally
    // await db.run('PRAGMA foreign_keys = ON;'); // Done in getDb
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
      // Insert and trigger handles updated_at
      await db.run('INSERT INTO business_lines (name) VALUES (?)', name);
    });
    revalidatePath('/business-lines');
    revalidatePath('/cost-centers');
    revalidatePath('/cost-center-associations');
    revalidatePath('/');
    revalidatePath('/budgets'); // Budget forms might need updated BL list
    revalidatePath('/expenses'); // Expense forms might need updated BL list (NEW)
    revalidatePath('/charts'); // Charts might use BLs
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
           // Select only id and name
           return db.all('SELECT id, name FROM business_lines ORDER BY name');
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
            // Trigger handles updated_at
            const result = await db.run('UPDATE business_lines SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
            if (result.changes === 0) {
                 console.warn(`Attempted to update business line ID ${id}, but it was not found.`);
                 // Optionally throw an error or return a specific message
                 throw new Error(`Business line with ID ${id} not found.`);
             }
        });
        revalidatePath('/business-lines');
        revalidatePath('/cost-centers'); // CC list might show BL names (though not currently)
        revalidatePath('/cost-center-associations'); // Association manager uses BL names
        revalidatePath('/budgets'); // Budget list and forms use BL names/lists
        revalidatePath('/expenses'); // Expense list and forms use BL names/lists (NEW)
        revalidatePath('/'); // Dashboard might show BL count/info
        revalidatePath('/charts'); // Charts use BL names
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
      // CASCADE on cost_center_business_lines handles removing associations
      // ON DELETE SET NULL on budgets handles budget links
      // ON DELETE SET NULL on expenses handles expense links (NEW)
       const result = await db.run('DELETE FROM business_lines WHERE id = ?', id);
        if (result.changes === 0) {
            console.warn(`Attempted to delete business line ID ${id}, but it was not found.`);
        }
    });
    revalidatePath('/business-lines');
    revalidatePath('/cost-centers');
    revalidatePath('/cost-center-associations');
    revalidatePath('/budgets'); // Budgets might be affected
    revalidatePath('/expenses'); // Expenses might be affected (NEW)
    revalidatePath('/');
    revalidatePath('/charts'); // Charts use BL names
    return { success: true, message: 'Business line deleted successfully.' };
  } catch (error: any) {
     if (error.message?.includes('FOREIGN KEY constraint failed')) {
          // This shouldn't happen with ON DELETE SET NULL and CASCADE, but good to check
          return { success: false, message: `Cannot delete business line (ID: ${id}) due to an unexpected constraint. Check if budgets, expenses, or associations correctly cascade/set null.` };
     }
    console.error(`Failed to delete business line with ID ${id}:`, error);
    return { success: false, message: `Failed to delete business line (ID: ${id}). Reason: ${error.message || 'Unknown error'}.` };
  }
}

// --- Cost Center Actions (Updated for M2M) ---

export async function addCostCenter(formData: FormData) {
  const name = formData.get('name') as string;

  try {
      const parsedData = CostCenterSchema.omit({id: true}).parse({ name });
    await runDbOperation(async (db) => {
      await db.run('INSERT INTO cost_centers (name) VALUES (?)', [parsedData.name]);
    });
    revalidatePath('/cost-centers');
    revalidatePath('/cost-center-associations');
    revalidatePath('/budgets'); // Budget forms need CC list
    revalidatePath('/expenses'); // Expense forms need CC list (NEW)
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
           return db.all<CostCenter[]>(`
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
        // Validate only the name from the form data for update
        const parsedData = CostCenterSchema.pick({ name: true }).parse({ name });
        await runDbOperation(async (db) => {
             // Update only the name. Associations are handled separately.
             const result = await db.run('UPDATE cost_centers SET name = ? WHERE id = ?', [parsedData.name, id]);
             if (result.changes === 0) {
                 console.warn(`Attempted to update cost center ID ${id}, but it was not found.`);
                 throw new Error(`Cost center with ID ${id} not found.`);
             }
        });
        revalidatePath('/cost-centers');
        revalidatePath('/cost-center-associations'); // Association manager uses CC names
        revalidatePath('/budgets'); // Budget list and forms use CC names/lists
        revalidatePath('/expenses'); // Expense list and forms use CC names/lists (NEW)
        revalidatePath('/'); // Dashboard might show CC count/info
        revalidatePath('/charts'); // Charts use CC names
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
       // ON DELETE SET NULL on budgets handles budget links
       // ON DELETE SET NULL on expenses handles expense links (NEW)
       const result = await db.run('DELETE FROM cost_centers WHERE id = ?', id);
        if (result.changes === 0) {
             console.warn(`Attempted to delete cost center ID ${id}, but it was not found.`);
        }
    });
    revalidatePath('/cost-centers');
    revalidatePath('/cost-center-associations');
    revalidatePath('/budgets'); // Budgets might be affected
    revalidatePath('/expenses'); // Expenses might be affected (NEW)
    revalidatePath('/');
    revalidatePath('/charts'); // Charts use CC names
    return { success: true, message: 'Cost center deleted successfully.' };
  } catch (error: any) {
      // FK errors on budgets/expenses should be handled by SET NULL
      if (error.message?.includes('FOREIGN KEY constraint failed')) {
         return { success: false, message: `Cannot delete cost center (ID: ${id}) due to an unexpected constraint. Check if budgets, expenses, or associations correctly cascade/set null.` };
      }
    console.error(`Failed to delete cost center with ID ${id}:`, error);
    return { success: false, message: `Failed to delete cost center (ID: ${id}). Reason: ${error.message || 'Unknown error'}.` };
  }
}

// --- Cost Center <-> Business Line Association Actions ---

export async function associateBusinessLineToCostCenter(costCenterId: number, businessLineId: number) {
    try {
        AssociateBusinessLineSchema.parse({ cost_center_id: costCenterId, business_line_id: businessLineId });
        await runDbOperation(async (db) => {
            await db.run(
                'INSERT OR IGNORE INTO cost_center_business_lines (cost_center_id, business_line_id) VALUES (?, ?)',
                [costCenterId, businessLineId]
            );
        });
        revalidatePath('/cost-centers'); // Update display if CC list shows associations
        revalidatePath('/cost-center-associations');
        revalidatePath('/budgets/add'); // Refresh budget form which might filter CCs
        revalidatePath('/budgets/*/edit'); // Refresh budget edit forms
        revalidatePath('/expenses/add'); // Refresh expense form (NEW)
        revalidatePath('/expenses/*/edit'); // Refresh expense edit forms (NEW)
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
        revalidatePath('/budgets/add'); // Refresh budget form which might filter CCs
        revalidatePath('/budgets/*/edit'); // Refresh budget edit forms
        revalidatePath('/expenses/add'); // Refresh expense form (NEW)
        revalidatePath('/expenses/*/edit'); // Refresh expense edit forms (NEW)
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
        revalidatePath('/budgets/add'); // Refresh budget form which might filter CCs
        revalidatePath('/budgets/*/edit'); // Refresh budget edit forms
        revalidatePath('/expenses/add'); // Refresh expense form (NEW)
        revalidatePath('/expenses/*/edit'); // Refresh expense edit forms (NEW)
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
    const rawData = {
        description: formData.get('description') as string,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
        year: formData.get('year') ? parseInt(formData.get('year') as string, 10) : undefined,
        month: formData.get('month') ? parseInt(formData.get('month') as string, 10) : undefined,
        type: formData.get('type') as 'CAPEX' | 'OPEX' | undefined,
        business_line_id: formData.get('business_line_id') as string | null, // Keep as string for validation
        cost_center_id: formData.get('cost_center_id') as string | null,     // Keep as string for validation
    };

    try {
        // Validate using the schema with preprocess steps
        const validatedData = BudgetSchema.omit({ id: true }).parse(rawData);

        // Additional check: Ensure cost center is associated with the business line
         if (validatedData.business_line_id && validatedData.cost_center_id) {
             const isAssociated = await runDbOperation(async (db) => {
                 const association = await db.get(
                     'SELECT 1 FROM cost_center_business_lines WHERE cost_center_id = ? AND business_line_id = ?',
                     validatedData.cost_center_id,
                     validatedData.business_line_id
                 );
                 return !!association;
             });
             if (!isAssociated) {
                 return { success: false, message: 'Selected Cost Center is not associated with the selected Business Line.' };
             }
         }

        await runDbOperation(async (db) => {
            await db.run(
                'INSERT INTO budgets (description, amount, year, month, type, business_line_id, cost_center_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [validatedData.description, validatedData.amount, validatedData.year, validatedData.month, validatedData.type, validatedData.business_line_id, validatedData.cost_center_id]
            );
        });
        revalidatePath('/budgets');
        revalidatePath('/');
        revalidatePath('/charts'); // Revalidate charts page
        return { success: true, message: 'Budget entry added successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}` };
        }
         // FK errors are less likely now due to Zod parsing and association check, but keep for safety
         if (error.message?.includes('FOREIGN KEY constraint failed')) {
             // Check if it was BL or CC that failed
             if (rawData.business_line_id && rawData.business_line_id !== '__NONE__' && !(await runDbOperation(db => db.get('SELECT 1 FROM business_lines WHERE id = ?', parseInt(rawData.business_line_id, 10))))) {
                 return { success: false, message: 'Invalid Business Line selected.' };
             }
             if (rawData.cost_center_id && rawData.cost_center_id !== '__NONE__' && !(await runDbOperation(db => db.get('SELECT 1 FROM cost_centers WHERE id = ?', parseInt(rawData.cost_center_id, 10))))) {
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
               strftime('%Y-%m-%d %H:%M:%S', b.created_at) as created_at,
               strftime('%Y-%m-%d %H:%M:%S', b.updated_at) as updated_at
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
           return db.get<Budget>(`
               SELECT
                   b.id, b.description, b.amount, b.year, b.month, b.type,
                   b.business_line_id, b.cost_center_id,
                   bl.name as business_line_name,
                   cc.name as cost_center_name,
                   strftime('%Y-%m-%d %H:%M:%S', b.created_at) as created_at,
                   strftime('%Y-%m-%d %H:%M:%S', b.updated_at) as updated_at
               FROM budgets b
               LEFT JOIN business_lines bl ON b.business_line_id = bl.id
               LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
               WHERE b.id = ?
           `, id);
       });
        if (!result) {
             // If not found, throw a specific error or trigger Next.js notFound
             // notFound(); // Or return null depending on desired behavior in caller
             return null;
         }
       return result;
   } catch (error: any) {
       console.error(`Failed to get budget with ID ${id}:`, error);
       // notFound(); // Trigger 404 on error as well?
       return null; // Return null on error
   }
}


export async function updateBudgetEntry(id: number, formData: FormData) {
    const rawData = {
        id: id, // Include id for context
        description: formData.get('description') as string,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
        year: formData.get('year') ? parseInt(formData.get('year') as string, 10) : undefined,
        month: formData.get('month') ? parseInt(formData.get('month') as string, 10) : undefined,
        type: formData.get('type') as 'CAPEX' | 'OPEX' | undefined,
        business_line_id: formData.get('business_line_id') as string | null, // Keep as string for validation
        cost_center_id: formData.get('cost_center_id') as string | null,     // Keep as string for validation
    };

  try {
      // Validate using the schema with preprocess steps
      const validatedData = BudgetSchema.parse(rawData);

      // Additional check: Ensure cost center is associated with the business line
       if (validatedData.business_line_id && validatedData.cost_center_id) {
           const isAssociated = await runDbOperation(async (db) => {
               const association = await db.get(
                   'SELECT 1 FROM cost_center_business_lines WHERE cost_center_id = ? AND business_line_id = ?',
                   validatedData.cost_center_id,
                   validatedData.business_line_id
               );
               return !!association;
           });
           if (!isAssociated) {
               return { success: false, message: 'Selected Cost Center is not associated with the selected Business Line.' };
           }
       }


      await runDbOperation(async (db) => {
         // Trigger handles updated_at
         const result = await db.run(
            'UPDATE budgets SET description = ?, amount = ?, year = ?, month = ?, type = ?, business_line_id = ?, cost_center_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [validatedData.description, validatedData.amount, validatedData.year, validatedData.month, validatedData.type, validatedData.business_line_id, validatedData.cost_center_id, id]
        );
         if (result.changes === 0) {
              console.warn(`Attempted to update budget entry ID ${id}, but it was not found.`);
              throw new Error(`Budget entry with ID ${id} not found.`);
         }
        });
        revalidatePath('/budgets');
        revalidatePath(`/budgets/${id}/edit`); // Revalidate specific edit page
        revalidatePath('/');
        revalidatePath('/charts'); // Revalidate charts page
        return { success: true, message: 'Budget entry updated successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}` };
        }
        // FK errors are less likely now due to Zod parsing and association check, but keep for safety
         if (error.message?.includes('FOREIGN KEY constraint failed')) {
             if (rawData.business_line_id && rawData.business_line_id !== '__NONE__' && !(await runDbOperation(db => db.get('SELECT 1 FROM business_lines WHERE id = ?', parseInt(rawData.business_line_id, 10))))) {
                 return { success: false, message: 'Invalid Business Line selected.' };
             }
             if (rawData.cost_center_id && rawData.cost_center_id !== '__NONE__' && !(await runDbOperation(db => db.get('SELECT 1 FROM cost_centers WHERE id = ?', parseInt(rawData.cost_center_id, 10))))) {
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
    revalidatePath('/charts'); // Revalidate charts page
    return { success: true, message: 'Budget entry deleted successfully.' };
  } catch (error: any) {
    console.error(`Failed to delete budget entry with ID ${id}:`, error);
    return { success: false, message: `Failed to delete budget entry (ID: ${id}). Reason: ${error.message || 'Unknown error'}. Please check server logs.` };
  }
}


// --- Expense Actions (NEW) ---

export async function addExpenseEntry(formData: FormData) {
    const rawData = {
        description: formData.get('description') as string,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
        year: formData.get('year') ? parseInt(formData.get('year') as string, 10) : undefined,
        month: formData.get('month') ? parseInt(formData.get('month') as string, 10) : undefined,
        type: formData.get('type') as 'CAPEX' | 'OPEX' | undefined,
        business_line_id: formData.get('business_line_id') as string | null,
        cost_center_id: formData.get('cost_center_id') as string | null,
    };

    try {
        const validatedData = ExpenseSchema.omit({ id: true }).parse(rawData);

        if (validatedData.business_line_id && validatedData.cost_center_id) {
            const isAssociated = await runDbOperation(async (db) => {
                const association = await db.get(
                    'SELECT 1 FROM cost_center_business_lines WHERE cost_center_id = ? AND business_line_id = ?',
                    validatedData.cost_center_id, validatedData.business_line_id
                );
                return !!association;
            });
            if (!isAssociated) {
                return { success: false, message: 'Selected Cost Center is not associated with the selected Business Line.' };
            }
        }

        await runDbOperation(async (db) => {
            await db.run(
                'INSERT INTO expenses (description, amount, year, month, type, business_line_id, cost_center_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [validatedData.description, validatedData.amount, validatedData.year, validatedData.month, validatedData.type, validatedData.business_line_id, validatedData.cost_center_id]
            );
        });
        revalidatePath('/expenses');
        revalidatePath('/');
        revalidatePath('/charts');
        return { success: true, message: 'Expense entry added successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}` };
        }
        if (error.message?.includes('FOREIGN KEY constraint failed')) {
             // More specific error checking could be added here like in budget actions
             return { success: false, message: 'Invalid reference to Business Line or Cost Center.' };
         }
        console.error('Failed to add expense entry:', error);
        return { success: false, message: `Failed to add expense entry. Reason: ${error.message || 'Unknown error'}.` };
    }
}

export async function getExpenses(): Promise<Expense[]> {
   try {
       return await runDbOperation(async (db) => {
           return db.all(`
             SELECT
               e.id, e.description, e.amount, e.year, e.month, e.type,
               e.business_line_id, e.cost_center_id,
               bl.name as business_line_name,
               cc.name as cost_center_name,
               strftime('%Y-%m-%d %H:%M:%S', e.created_at) as created_at,
               strftime('%Y-%m-%d %H:%M:%S', e.updated_at) as updated_at
             FROM expenses e
             LEFT JOIN business_lines bl ON e.business_line_id = bl.id
             LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
             ORDER BY e.year DESC, e.month DESC, e.id DESC
           `);
       });
    } catch (error: any) {
       console.error('Failed to get expenses:', error);
       return [];
    }
}

export async function getExpenseById(id: number): Promise<Expense | null> {
   try {
       const result = await runDbOperation(async (db) => {
           return db.get<Expense>(`
               SELECT
                   e.id, e.description, e.amount, e.year, e.month, e.type,
                   e.business_line_id, e.cost_center_id,
                   bl.name as business_line_name,
                   cc.name as cost_center_name,
                   strftime('%Y-%m-%d %H:%M:%S', e.created_at) as created_at,
                   strftime('%Y-%m-%d %H:%M:%S', e.updated_at) as updated_at
               FROM expenses e
               LEFT JOIN business_lines bl ON e.business_line_id = bl.id
               LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
               WHERE e.id = ?
           `, id);
       });
        if (!result) {
             return null;
         }
       return result;
   } catch (error: any) {
       console.error(`Failed to get expense with ID ${id}:`, error);
       return null; // Return null on error
   }
}

export async function updateExpenseEntry(id: number, formData: FormData) {
    const rawData = {
        id: id,
        description: formData.get('description') as string,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
        year: formData.get('year') ? parseInt(formData.get('year') as string, 10) : undefined,
        month: formData.get('month') ? parseInt(formData.get('month') as string, 10) : undefined,
        type: formData.get('type') as 'CAPEX' | 'OPEX' | undefined,
        business_line_id: formData.get('business_line_id') as string | null,
        cost_center_id: formData.get('cost_center_id') as string | null,
    };

  try {
      const validatedData = ExpenseSchema.parse(rawData);

       if (validatedData.business_line_id && validatedData.cost_center_id) {
           const isAssociated = await runDbOperation(async (db) => {
               const association = await db.get(
                   'SELECT 1 FROM cost_center_business_lines WHERE cost_center_id = ? AND business_line_id = ?',
                   validatedData.cost_center_id, validatedData.business_line_id
               );
               return !!association;
           });
           if (!isAssociated) {
               return { success: false, message: 'Selected Cost Center is not associated with the selected Business Line.' };
           }
       }

      await runDbOperation(async (db) => {
         const result = await db.run(
            'UPDATE expenses SET description = ?, amount = ?, year = ?, month = ?, type = ?, business_line_id = ?, cost_center_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [validatedData.description, validatedData.amount, validatedData.year, validatedData.month, validatedData.type, validatedData.business_line_id, validatedData.cost_center_id, id]
        );
         if (result.changes === 0) {
              throw new Error(`Expense entry with ID ${id} not found.`);
         }
        });
        revalidatePath('/expenses');
        revalidatePath(`/expenses/${id}/edit`);
        revalidatePath('/');
        revalidatePath('/charts');
        return { success: true, message: 'Expense entry updated successfully.' };
    } catch (error: any) {
         if (error instanceof z.ZodError) {
            return { success: false, message: `Validation failed: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}` };
        }
        if (error.message?.includes('FOREIGN KEY constraint failed')) {
             // Specific error checking like in budget actions
             return { success: false, message: 'Invalid reference to Business Line or Cost Center.' };
         }
        console.error(`Failed to update expense entry with ID ${id}:`, error);
        return { success: false, message: `Failed to update expense entry (ID: ${id}). Reason: ${error.message || 'Unknown error'}.` };
    }
}

export async function deleteExpenseEntry(id: number) {
  try {
    await runDbOperation(async (db) => {
       const result = await db.run('DELETE FROM expenses WHERE id = ?', id);
       if (result.changes === 0) {
           console.warn(`Attempted to delete expense entry ID ${id}, but it was not found.`);
       }
    });
    revalidatePath('/expenses');
    revalidatePath('/');
    revalidatePath('/charts');
    return { success: true, message: 'Expense entry deleted successfully.' };
  } catch (error: any) {
    console.error(`Failed to delete expense entry with ID ${id}:`, error);
    return { success: false, message: `Failed to delete expense entry (ID: ${id}). Reason: ${error.message || 'Unknown error'}.` };
  }
}


// --- Spreadsheet Upload Action ---

export async function uploadSpreadsheet(formData: FormData): Promise<{ success: boolean; message: string }> {
    const file = formData.get('spreadsheet') as File;

    if (!file || file.size === 0) {
        return { success: false, message: 'No file uploaded or file is empty.' };
    }

    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
    const isCsv = file.name.toLowerCase().endsWith('.csv');

    if (!isXlsx && !isCsv) {
        return { success: false, message: 'Invalid file type. Please upload an Excel (.xlsx) or CSV (.csv) file.' };
    }

    try {
        const bytes = await file.arrayBuffer();
        const workbook = XLSX.read(bytes, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '', rawNumbers: false });

        const { businessLines, costCenters, associations } = await runDbOperation(async (db) => {
           const businessLines = await db.all('SELECT id, lower(name) as name FROM business_lines');
           const costCenters = await db.all('SELECT id, lower(name) as name FROM cost_centers');
           const associations = await db.all<{cost_center_id: number, business_line_id: number}>(
               'SELECT cost_center_id, business_line_id FROM cost_center_business_lines'
           );
           return { businessLines, costCenters, associations };
        });

        const businessLineMap = new Map(businessLines.map(bl => [bl.name, bl.id]));
        const costCenterMap = new Map(costCenters.map(cc => [cc.name, cc.id]));
        const associationSet = new Set(associations.map(a => `${a.cost_center_id}-${a.business_line_id}`));

        const budgetEntries: BudgetEntry[] = [];
        const expenseEntries: ExpenseEntry[] = []; // NEW: Array for expense entries
        const errors: string[] = [];
        const processedRows: any[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Assuming header is row 1
            const rowErrors: string[] = [];

            const normalizedRow: { [key: string]: any } = {};
            for (const key in row) {
                 if (Object.prototype.hasOwnProperty.call(row, key) && typeof key === 'string' && key.trim()) {
                     const normKey = key.toLowerCase().trim().replace(/\s+/g, ' ');
                     normalizedRow[normKey] = row[key];
                 } else if (Object.prototype.hasOwnProperty.call(row, key) && key) {
                     normalizedRow[String(key)] = row[key];
                 }
             }

            if (Object.values(normalizedRow).every(v => v === null || v === undefined || String(v).trim() === '')) {
                 console.log(`Skipping empty row ${rowNum}`);
                 continue;
            }

            processedRows.push(normalizedRow);

            // Define columns
            const requiredColumns = ['description', 'amount', 'year', 'month', 'type'];
            const optionalColumns = ['business line', 'cost center', 'source']; // Added 'source'
            const actualColumns = Object.keys(normalizedRow);

            requiredColumns.forEach(col => {
                const originalKeyExists = Object.keys(row).some(k => k.toLowerCase().trim().replace(/\s+/g, ' ') === col);
                 if (!originalKeyExists || String(normalizedRow[col]).trim() === '') {
                    rowErrors.push(`Missing or empty required column: '${col}'.`);
                 }
             });

            // Extract and validate data
            const description = normalizedRow['description'];
            const amountStr = normalizedRow['amount'];
            const yearStr = normalizedRow['year'];
            const monthStr = normalizedRow['month'];
            const type = (typeof normalizedRow['type'] === 'string' ? normalizedRow['type'] : String(normalizedRow['type']))?.toUpperCase().trim();
            const budgetBusinessLineNameRaw = normalizedRow['business line'];
            const budgetCostCenterNameRaw = normalizedRow['cost center'];
            const sourceRaw = normalizedRow['source']; // NEW: Get source

            const budgetBusinessLineName = (typeof budgetBusinessLineNameRaw === 'string' ? budgetBusinessLineNameRaw : String(budgetBusinessLineNameRaw))?.toLowerCase().trim();
            const budgetCostCenterName = (typeof budgetCostCenterNameRaw === 'string' ? budgetCostCenterNameRaw : String(budgetCostCenterNameRaw))?.toLowerCase().trim();
            // NEW: Validate source (default to Budget if missing or invalid)
            let source: 'Budget' | 'Expense' = 'Budget';
            if (sourceRaw && typeof sourceRaw === 'string') {
                 const normalizedSource = sourceRaw.trim().toLowerCase();
                 if (normalizedSource === 'expense') {
                     source = 'Expense';
                 } else if (normalizedSource !== 'budget') {
                     // Only error if a value is provided but it's neither 'budget' nor 'expense'
                     if(normalizedSource !== '') {
                        rowErrors.push(`Invalid Source: "${sourceRaw}". Must be 'Budget' or 'Expense' (case-insensitive). Defaulting to Budget.`);
                     }
                     source = 'Budget'; // Default to budget on invalid or empty value
                 }
            } else if (sourceRaw !== undefined && sourceRaw !== null && String(sourceRaw).trim() !== '') {
                 // If source is present but not a string, consider it an error
                 rowErrors.push(`Invalid Source format: "${sourceRaw}". Must be text 'Budget' or 'Expense'. Defaulting to Budget.`);
                 source = 'Budget';
            }
             // Default to Budget if source column is completely missing or empty


            // --- Basic Validation ---
            if (!description || typeof description !== 'string' || description.trim() === '') rowErrors.push(`Invalid or missing Description.`);
            const amount = parseFloat(String(amountStr).replace(/[^0-9.-]+/g,""));
            if (isNaN(amount) || amount <= 0) rowErrors.push(`Invalid or missing positive Amount (value read: '${amountStr}', parsed as: ${amount}).`);
            const year = parseInt(String(yearStr), 10);
            if (isNaN(year) || year < 1900 || year > 2100) rowErrors.push(`Invalid or missing Year (1900-2100, value: '${yearStr}').`);
            const month = parseInt(String(monthStr), 10);
            if (isNaN(month) || month < 1 || month > 12) rowErrors.push(`Invalid or missing Month (1-12, value: '${monthStr}').`);
            if (!type || (type !== 'CAPEX' && type !== 'OPEX')) rowErrors.push(`Invalid or missing Type (must be 'CAPEX' or 'OPEX', value: '${normalizedRow['type']}').`);

            // --- Lookup IDs ---
            let entryBusinessLineId: number | null = null;
            if (actualColumns.includes('business line') && budgetBusinessLineName && budgetBusinessLineName !== 'undefined' && budgetBusinessLineName !== 'null') {
                if (businessLineMap.has(budgetBusinessLineName)) {
                    entryBusinessLineId = businessLineMap.get(budgetBusinessLineName)!;
                } else {
                    rowErrors.push(`Business Line "${budgetBusinessLineNameRaw}" not found.`);
                }
            }

            let entryCostCenterId: number | null = null;
            if (actualColumns.includes('cost center') && budgetCostCenterName && budgetCostCenterName !== 'undefined' && budgetCostCenterName !== 'null') {
                if (costCenterMap.has(budgetCostCenterName)) {
                    entryCostCenterId = costCenterMap.get(budgetCostCenterName)!;
                } else {
                    rowErrors.push(`Cost Center "${budgetCostCenterNameRaw}" not found.`);
                }
            }

            // --- Association Validation ---
            if (entryBusinessLineId && entryCostCenterId) {
                 if (!associationSet.has(`${entryCostCenterId}-${entryBusinessLineId}`)) {
                     rowErrors.push(`Cost Center "${budgetCostCenterNameRaw}" is not associated with Business Line "${budgetBusinessLineNameRaw}".`);
                 }
             }

            if (rowErrors.length > 0) {
                errors.push(`Row ${rowNum}: ${rowErrors.join('; ')}`);
            } else {
                try {
                    const entryData = {
                         description: description.trim(),
                         amount: amount,
                         year: year,
                         month: month,
                         type: type as 'CAPEX' | 'OPEX',
                         business_line_id: entryBusinessLineId,
                         cost_center_id: entryCostCenterId,
                     };

                    if (source === 'Budget') {
                        const budgetEntry: BudgetEntry = entryData;
                        BudgetSchema.omit({ id: true }).parse(budgetEntry); // Validate against Budget schema
                        budgetEntries.push(budgetEntry);
                    } else { // source === 'Expense'
                         const expenseEntry: ExpenseEntry = entryData;
                         ExpenseSchema.omit({ id: true }).parse(expenseEntry); // Validate against Expense schema
                         expenseEntries.push(expenseEntry);
                    }

                 } catch (zodError: any) {
                      if (zodError instanceof z.ZodError) {
                         errors.push(`Row ${rowNum} (${source}): Validation Error - ${zodError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
                     } else {
                         errors.push(`Row ${rowNum} (${source}): Unexpected error creating entry - ${zodError.message}`);
                     }
                 }
            }
        } // End row loop

        if (errors.length > 0) {
            console.error("Spreadsheet/CSV Errors:", errors);
            const MAX_ERRORS_TO_SHOW = 10;
            const limitedErrors = errors.slice(0, MAX_ERRORS_TO_SHOW);
            const moreErrorsMessage = errors.length > MAX_ERRORS_TO_SHOW ? `\n... and ${errors.length - MAX_ERRORS_TO_SHOW} more errors.` : '';
            return { success: false, message: `File contains errors:\n- ${limitedErrors.join('\n- ')}${moreErrorsMessage}\nPlease fix and re-upload.` };
        }

        if (budgetEntries.length === 0 && expenseEntries.length === 0) { // Check both arrays
             if (processedRows.length === 0) {
                 return { success: false, message: 'File is empty or contains no processable data rows.' };
             } else {
                 return { success: false, message: 'No valid budget or expense entries found in the file after validation. Please check column headers and data formats.' };
             }
        }

        // --- Database Insertion (Transaction) ---
        await runDbOperation(async (db) => {
             await db.run('BEGIN TRANSACTION');
             try {
                 // Insert Budgets
                 if (budgetEntries.length > 0) {
                     const budgetStmt = await db.prepare(
                         'INSERT INTO budgets (description, amount, year, month, type, business_line_id, cost_center_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
                     );
                     for (const entry of budgetEntries) {
                         await budgetStmt.run(entry.description, entry.amount, entry.year, entry.month, entry.type, entry.business_line_id, entry.cost_center_id);
                     }
                     await budgetStmt.finalize();
                 }

                  // Insert Expenses (NEW)
                  if (expenseEntries.length > 0) {
                     const expenseStmt = await db.prepare(
                         'INSERT INTO expenses (description, amount, year, month, type, business_line_id, cost_center_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
                     );
                     for (const entry of expenseEntries) {
                         await expenseStmt.run(entry.description, entry.amount, entry.year, entry.month, entry.type, entry.business_line_id, entry.cost_center_id);
                     }
                     await expenseStmt.finalize();
                 }

                 await db.run('COMMIT');
             } catch (dbError: any) {
                 await db.run('ROLLBACK');
                 console.error('Database insertion error during file upload:', dbError);
                 if (dbError.message?.includes('UNIQUE constraint failed')) {
                    throw new Error('Database error: Duplicate entry detected during insertion.');
                 } else if (dbError.message?.includes('FOREIGN KEY constraint failed')) {
                     throw new Error('Database error: Invalid Business Line or Cost Center ID encountered during insertion.');
                 }
                 throw dbError;
             }
         });

        revalidatePath('/budgets');
        revalidatePath('/expenses'); // Revalidate expenses page (NEW)
        revalidatePath('/');
        revalidatePath('/charts'); // Revalidate charts page
        const message = `Successfully imported ${budgetEntries.length} budget entries and ${expenseEntries.length} expense entries from ${isXlsx ? 'spreadsheet' : 'CSV'}.`;
        return { success: true, message };

    } catch (error: any) {
        console.error('Error processing file:', error);
         if (error.message?.includes('File is not a zip file') && isXlsx) {
            return { success: false, message: 'Failed to process spreadsheet: The file is corrupted or not a valid XLSX format.' };
         }
        let userMessage = `Failed to process ${isXlsx ? 'spreadsheet' : 'CSV'} file.`;
         if (error.message?.startsWith('Database error:')) {
              userMessage = error.message;
          } else {
             userMessage += ` Reason: ${error.message || 'Unknown error'}. Ensure it is a valid ${isXlsx ? 'Excel (.xlsx)' : 'CSV (.csv)'} file with correct structure.`;
          }

        return { success: false, message: userMessage };
    }
}


// --- Chart Data Actions ---

// Fetch data specifically for charts, including year and month
export async function getChartData(): Promise<ChartItem[]> {
   try {
       const combinedData: ChartItem[] = await runDbOperation(async (db) => {
            // Fetch budgets
            const budgets = await db.all(`
                 SELECT
                   b.amount, b.type, b.year, b.month,
                   COALESCE(bl.name, 'Unassigned') as business_line_name,
                   COALESCE(cc.name, 'Unassigned') as cost_center_name
                 FROM budgets b
                 LEFT JOIN business_lines bl ON b.business_line_id = bl.id
                 LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
               `);

             // Fetch expenses (NEW)
            const expenses = await db.all(`
                 SELECT
                   e.amount, e.type, e.year, e.month,
                   COALESCE(bl.name, 'Unassigned') as business_line_name,
                   COALESCE(cc.name, 'Unassigned') as cost_center_name
                 FROM expenses e
                 LEFT JOIN business_lines bl ON e.business_line_id = bl.id
                 LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
               `);

            // Combine and add source indicator
            const chartItems: ChartItem[] = [
                ...budgets.map(b => ({ ...b, source: 'Budget' as const })),
                ...expenses.map(e => ({ ...e, source: 'Expense' as const }))
            ];
            return chartItems;
       });
        return combinedData;
    } catch (error: any) {
       console.error('Failed to get chart data:', error);
       return [];
    }
}


// --- CSV Export Action ---
// Fetches budget data and returns it as an array of objects suitable for CSV conversion on the client-side.
// **TODO:** Update this to include Expenses or create a separate export action?
export async function prepareBudgetsCsvData(): Promise<{ success: boolean; data: Record<string, any>[] | null; message?: string }> {
    try {
        const budgets = await runDbOperation(async (db) => {
            // Fetch all necessary columns, including related names
            return db.all(`
                SELECT
                    b.id as "Budget ID",
                    b.description as "Description",
                    b.amount as "Amount",
                    b.year as "Year",
                    b.month as "Month",
                    b.type as "Type",
                    COALESCE(bl.name, '') as "Business Line",
                    COALESCE(cc.name, '') as "Cost Center",
                    strftime('%Y-%m-%d %H:%M:%S', b.created_at) as "Created At",
                    strftime('%Y-%m-%d %H:%M:%S', b.updated_at) as "Updated At"
                FROM budgets b
                LEFT JOIN business_lines bl ON b.business_line_id = bl.id
                LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
                ORDER BY b.year DESC, b.month DESC, b.id DESC
            `);
        });

        if (!budgets || budgets.length === 0) {
            return { success: true, data: [], message: 'No budget data to export.' };
        }

        return { success: true, data: budgets };

    } catch (error: any) {
        console.error('Failed to prepare budget data for CSV:', error);
        return { success: false, data: null, message: `Failed to get budget data for export. Reason: ${error.message || 'Unknown error'}` };
    }
}
