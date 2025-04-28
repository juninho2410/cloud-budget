
"use client";

import type { Budget, BusinessLine, CostCenter } from '@/types';
import { useState, useMemo } from 'react';
import { BudgetTable } from './budget-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FilterX, X } from 'lucide-react';

interface BudgetFilterWrapperProps {
    initialBudgets: Budget[];
    businessLines: BusinessLine[];
    costCenters: CostCenter[];
}

const ALL_VALUE = "__ALL__";

export function BudgetFilterWrapper({ initialBudgets, businessLines, costCenters }: BudgetFilterWrapperProps) {
    const [yearFilter, setYearFilter] = useState<string>('');
    const [monthFilter, setMonthFilter] = useState<string>(ALL_VALUE);
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'CAPEX' | 'OPEX'>(ALL_VALUE as 'ALL'); // Initialize with 'ALL'
    const [blFilter, setBlFilter] = useState<string>(ALL_VALUE);
    const [ccFilter, setCcFilter] = useState<string>(ALL_VALUE);

    const filteredBudgets = useMemo(() => {
        return initialBudgets.filter(budget => {
            const yearMatch = !yearFilter || budget.year.toString() === yearFilter;
            const monthMatch = monthFilter === ALL_VALUE || budget.month.toString() === monthFilter;
            const typeMatch = typeFilter === ALL_VALUE || budget.type === typeFilter;
            const blMatch = blFilter === ALL_VALUE || (budget.business_line_id ? budget.business_line_id.toString() === blFilter : blFilter === '__NONE__');
            const ccMatch = ccFilter === ALL_VALUE || (budget.cost_center_id ? budget.cost_center_id.toString() === ccFilter : ccFilter === '__NONE__');

            return yearMatch && monthMatch && typeMatch && blMatch && ccMatch;
        });
    }, [initialBudgets, yearFilter, monthFilter, typeFilter, blFilter, ccFilter]);

    const resetFilters = () => {
        setYearFilter('');
        setMonthFilter(ALL_VALUE);
        setTypeFilter(ALL_VALUE as 'ALL');
        setBlFilter(ALL_VALUE);
        setCcFilter(ALL_VALUE);
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i); // Example: last 5 + next 4 years

    const months = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: new Date(0, i).toLocaleString('default', { month: 'long' }) }));

    return (
        <div className="space-y-4">
            {/* Filter Section */}
            <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-muted/50">
                {/* Year Filter */}
                <div className="flex-grow min-w-[100px]">
                    <label htmlFor="year-filter" className="text-xs font-medium text-muted-foreground">Year</label>
                    <Input
                        id="year-filter"
                        type="number"
                        placeholder="YYYY"
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>

                {/* Month Filter */}
                <div className="flex-grow min-w-[120px]">
                     <label htmlFor="month-filter" className="text-xs font-medium text-muted-foreground">Month</label>
                     <Select value={monthFilter} onValueChange={setMonthFilter}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All Months</SelectItem>
                            {months.map(month => (
                                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                            ))}
                        </SelectContent>
                     </Select>
                </div>

                {/* Type Filter */}
                 <div className="flex-grow min-w-[120px]">
                     <label htmlFor="type-filter" className="text-xs font-medium text-muted-foreground">Type</label>
                     <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'ALL' | 'CAPEX' | 'OPEX')}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All Types</SelectItem>
                            <SelectItem value="CAPEX">CAPEX</SelectItem>
                            <SelectItem value="OPEX">OPEX</SelectItem>
                        </SelectContent>
                     </Select>
                </div>

                {/* Business Line Filter */}
                <div className="flex-grow min-w-[150px]">
                     <label htmlFor="bl-filter" className="text-xs font-medium text-muted-foreground">Business Line</label>
                     <Select value={blFilter} onValueChange={setBlFilter}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Business Line" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All Business Lines</SelectItem>
                            <SelectItem value="__NONE__">-- Unassigned --</SelectItem>
                            {businessLines.map(bl => (
                                <SelectItem key={bl.id} value={bl.id.toString()}>{bl.name}</SelectItem>
                            ))}
                        </SelectContent>
                     </Select>
                 </div>

                {/* Cost Center Filter */}
                <div className="flex-grow min-w-[150px]">
                    <label htmlFor="cc-filter" className="text-xs font-medium text-muted-foreground">Cost Center</label>
                    <Select value={ccFilter} onValueChange={setCcFilter}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Cost Center" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All Cost Centers</SelectItem>
                             <SelectItem value="__NONE__">-- Unassigned --</SelectItem>
                            {costCenters.map(cc => (
                                <SelectItem key={cc.id} value={cc.id.toString()}>{cc.name}</SelectItem>
                            ))}
                        </SelectContent>
                     </Select>
                </div>

                {/* Reset Button */}
                <div className="flex items-end">
                     <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8">
                        <FilterX className="mr-1 h-3 w-3" /> Reset
                    </Button>
                </div>
            </div>

            {/* Budget Table */}
            <BudgetTable budgets={filteredBudgets} />
        </div>
    );
}
