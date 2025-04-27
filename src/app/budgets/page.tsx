import { getBudgets } from '@/app/actions';
import { BudgetTable } from '@/components/budget/budget-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function BudgetsPage() {
    const budgets = await getBudgets();

    return (
        <div className="container mx-auto py-6">
             <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                     <div>
                        <CardTitle>Budget Entries</CardTitle>
                        <CardDescription>View and manage your budget line items.</CardDescription>
                     </div>
                      <Link href="/budgets/add" passHref>
                           <Button>
                             <PlusCircle className="mr-2 h-4 w-4" /> Add New Entry
                           </Button>
                      </Link>
                 </CardHeader>
                 <CardContent>
                     <BudgetTable budgets={budgets} />
                 </CardContent>
             </Card>
        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request
