

export interface BusinessLine {
  id: number;
  name: string;
  // Removed optional timestamps as they are not always selected/needed
  // created_at?: string;
  // updated_at?: string;
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

// --- Expense Types (NEW) ---

export interface Expense {
  id: number;
  description: string;
  amount: number;
  year: number;
  month: number;
  type: 'CAPEX' | 'OPEX';
  business_line_id: number | null;
  cost_center_id: number | null;
  created_at?: string;
  updated_at?: string;
  business_line_name?: string; // Optional: name of the linked business line
  cost_center_name?: string;   // Optional: name of the linked cost center
}

// Type for creating a new expense entry (from spreadsheet or form)
export type ExpenseEntry = Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'business_line_name' | 'cost_center_name'>;


export type BudgetData = Budget[];
export type ExpenseData = Expense[]; // New type for array of expenses


// --- Chart Data Types ---

// Type for raw data fetched for charting (includes time info) - Extended for expenses
export type ChartItem = {
    amount: number;
    type: 'CAPEX' | 'OPEX';
    year: number;
    month: number;
    business_line_name: string; // Use resolved name, default to 'Unassigned' if null
    cost_center_name: string; // Use resolved name, default to 'Unassigned' if null
    source: 'Budget' | 'Expense'; // Indicate if the item is a budget or expense
};


// Aggregated data for simple pie/bar charts
export type ChartData = {
  name: string; // e.g., Business Line Name, Cost Center Name, Type (CAPEX/OPEX)
  value: number; // e.g., Total amount
}[];

// Aggregated data grouped by type (CAPEX/OPEX) for stacked/grouped charts
export type GroupedChartData = {
  name: string; // e.g., Business Line Name, Month-Year
  CAPEX: number;
  OPEX: number;
}[];

// Data formatted for time series charts (e.g., Line chart)
export type TimeSeriesChartData = {
    monthYear: string; // e.g., "2023-01"
    [key: string]: number | string; // Allows dynamic keys for business lines or other categories
}[];

// NEW: Data formatted for Budget vs Expense comparison charts
export type BudgetExpenseComparisonChartData = {
    group: string; // e.g., Business Line Name, Cost Center Name, Month-Year
    Budget: number;
    Expense: number;
    // Optional: Include CAPEX/OPEX breakdown if needed for more complex charts
    // BudgetCAPEX?: number;
    // BudgetOPEX?: number;
    // ExpenseCAPEX?: number;
    // ExpenseOPEX?: number;
}[];
