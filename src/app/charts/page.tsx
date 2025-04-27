import { getBudgetDataForCharts } from '@/app/actions';
import { BudgetCharts } from '@/components/charts/budget-charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ChartsPage() {
    const budgetData = await getBudgetDataForCharts();

    return (
        <div className="container mx-auto py-6">
             <Card className="mb-6">
                 <CardHeader>
                     <CardTitle>Budget Visualization</CardTitle>
                     <CardDescription>Charts showing budget breakdown by different categories.</CardDescription>
                 </CardHeader>
             </Card>
             <BudgetCharts budgetData={budgetData} />
        </div>
    );
}

export const dynamic = 'force-dynamic';
