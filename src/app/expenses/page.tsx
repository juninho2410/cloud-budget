
import { getExpenses, getBusinessLines, getCostCentersSimple } from '@/app/actions'; // Import actions to fetch filter data
import { ExpenseFilterWrapper } from '@/components/expenses/expense-filter-wrapper'; // Import the new wrapper
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function ExpensesPage() {
    // Fetch expenses and data needed for filters
    const [expenses, businessLines, costCenters] = await Promise.all([
        getExpenses(),
        getBusinessLines(),
        getCostCentersSimple(), // Fetch simple cost centers for filtering
    ]);

    return (
        <div className="container mx-auto py-6">
             <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                     <div>
                        <CardTitle>Expense Entries</CardTitle>
                        <CardDescription>View, manage, and filter your actual expense line items.</CardDescription> {/* Updated description */}
                     </div>
                      <Link href="/expenses/add" passHref>
                           <Button>
                             <PlusCircle className="mr-2 h-4 w-4" /> Add New Expense
                           </Button>
                      </Link>
                 </CardHeader>
                 <CardContent>
                     {/* Use the ExpenseFilterWrapper component */}
                     <ExpenseFilterWrapper
                        initialExpenses={expenses}
                        businessLines={businessLines}
                        costCenters={costCenters}
                     />
                 </CardContent>
             </Card>
        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request

