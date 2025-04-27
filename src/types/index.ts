
export interface BusinessLine {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
}

// Basic Cost Center type (as stored in DB) - removed timestamps
export interface CostCenter {
  id: number;
  name: string;
  // created_at?: string; // Removed
  // updated_at?: string; // Removed
}

// Extended Cost Center type including associated Business Lines for M2M
export interface CostCenterWithBusinessLines extends CostCenter {
    businessLines: Pick<BusinessLine, 'id' | 'name'>[]; // Array of associated business lines
}


export interface Budget {
  id: number;
  description: string;
  amount: number;
  year: number;
  month: number;
  type: 'CAPEX' | 'OPEX';
  business_line_id: number | null; // FK to business_lines
  cost_center_id: number | null;   // FK to cost_centers
  created_at?: string;
  updated_at?: string;
  business_line_name?: string; // Optional: name of the linked business line
  cost_center_name?: string;   // Optional: name of the linked cost center
}

// Type for creating a new budget entry (from spreadsheet or form)
export type BudgetEntry = Omit<Budget, 'id' | 'created_at' | 'updated_at' | 'business_line_name' | 'cost_center_name'>;

// Type for the budget form data (IDs might be strings from select inputs)
export interface BudgetFormData extends Omit<Budget, 'id' | 'created_at' | 'updated_at' | 'business_line_name' | 'cost_center_name' | 'business_line_id' | 'cost_center_id'> {
   business_line_id: string | null; // Form values might be strings or null representation
   cost_center_id: string | null;   // Form values might be strings or null representation
}


export type BudgetData = Budget[];

// --- Chart Data Types (Remain the same, based on Budget info) ---
export type ChartData = {
  name: string; // e.g., Business Line Name, Cost Center Name, Type (CAPEX/OPEX)
  value: number; // e.g., Total amount
}[];

export type GroupedChartData = {
  name: string; // e.g., Business Line Name
  CAPEX: number;
  OPEX: number;
}[];
