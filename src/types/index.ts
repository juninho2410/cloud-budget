export interface BusinessLine {
  id: number;
  name: string;
  updated_at?: string;
}

export interface CostCenter {
  id: number;
  name: string;
  business_line_id: number | null;
  business_line_name?: string; // Optional: for display purposes
  updated_at?: string;
}

export interface Budget {
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
  business_line_name?: string; // Optional: for display purposes
  cost_center_name?: string; // Optional: for display purposes
}

export type BudgetEntry = Omit<Budget, 'id' | 'created_at' | 'updated_at'>;

export interface BudgetFormData extends Omit<Budget, 'id' | 'created_at' | 'updated_at' | 'business_line_name' | 'cost_center_name'> {
   business_line_id: string | null; // Form values might be strings
   cost_center_id: string | null;   // Form values might be strings
}

export type BudgetData = Budget[];

export type ChartData = {
  name: string;
  value: number;
}[];

export type GroupedChartData = {
  name: string;
  CAPEX: number;
  OPEX: number;
}[];
