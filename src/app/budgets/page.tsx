import { getBudgets, getBusinessLines, getCostCentersSimple } from '@/app/actions';
import { BudgetFilterWrapper } from '@/components/budget/budget-filter-wrapper'; // Import the new wrapper
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function BudgetsPage() {
    // Fetch all necessary data: budgets, business lines, and cost centers for filters
    const [budgets, businessLines, costCenters] = await Promise.all([
        getBudgets(),
        getBusinessLines(),
        getCostCentersSimple(), // Fetch simple cost centers for filtering
    ]);

    return (
        <div className="container mx-auto py-6">
             <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                     <div>
                        <CardTitle>Budget Entries</CardTitle>
                        <CardDescription>View, manage, and filter your budget line items.</CardDescription> {/* Updated description */}
                     </div>
                      <Link href="/budgets/add" passHref>
                           <Button>
                             <PlusCircle className="mr-2 h-4 w-4" /> Add New Entry
                           </Button>
                      </Link>
                 </CardHeader>
                 <CardContent>
                    {/* Pass data to the filter wrapper */}
                     <BudgetFilterWrapper
                        initialBudgets={budgets}
                        businessLines={businessLines}
                        costCenters={costCenters}
                     />
                 </CardContent>
             </Card>
        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request
