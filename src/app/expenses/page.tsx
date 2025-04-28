
import { getExpenses } from '@/app/actions';
import { ExpenseTable } from '@/components/expenses/expense-table'; // Use ExpenseTable
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function ExpensesPage() {
    const expenses = await getExpenses();

    return (
        <div className="container mx-auto py-6">
             <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                     <div>
                        <CardTitle>Expense Entries</CardTitle>
                        <CardDescription>View and manage your actual expense line items.</CardDescription>
                     </div>
                      <Link href="/expenses/add" passHref>
                           <Button>
                             <PlusCircle className="mr-2 h-4 w-4" /> Add New Expense
                           </Button>
                      </Link>
                 </CardHeader>
                 <CardContent>
                     {/* Use the ExpenseTable component */}
                     <ExpenseTable expenses={expenses} />
                 </CardContent>
             </Card>
        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request
