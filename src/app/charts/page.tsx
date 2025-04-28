
import { getChartData } from '@/app/actions'; // Changed action to getChartData
import { BudgetCharts } from '@/components/charts/budget-charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ChartsPage() {
    const chartData = await getChartData(); // Use the new action to get combined data

    return (
        <div className="container mx-auto py-6">
             <Card className="mb-6">
                 <CardHeader>
                     <CardTitle>Budget & Expense Visualization</CardTitle>
                     <CardDescription>Charts showing budget and actual expenses breakdown by different categories.</CardDescription>
                 </CardHeader>
             </Card>
             {/* Pass the combined ChartItem[] data */}
             <BudgetCharts chartData={chartData} />
        </div>
    );
}

export const dynamic = 'force-dynamic';
