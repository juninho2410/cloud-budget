
import { getBudgets, getBusinessLines, getCostCentersSimple } from '@/app/actions'; // Changed getCostCenters to getCostCentersSimple
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, Building2, Target, ArrowUpRight, DollarSign, TrendingUp, Upload, BarChart3, PlusCircle, Link2 } from 'lucide-react';
import Link from 'next/link';
import { BudgetCharts } from '@/components/charts/budget-charts';


async function getDashboardData() {
    // Use getCostCentersSimple to get the count
    const [budgets, businessLines, costCenters] = await Promise.all([
        getBudgets(),
        getBusinessLines(),
        getCostCentersSimple(), // Changed function call
    ]);

    const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalCapex = budgets.filter(b => b.type === 'CAPEX').reduce((sum, b) => sum + b.amount, 0);
    const totalOpex = budgets.filter(b => b.type === 'OPEX').reduce((sum, b) => sum + b.amount, 0);

    // Prepare limited data for charts on dashboard (same structure as needed by BudgetCharts)
    const chartData = budgets.map(b => ({
        amount: b.amount,
        type: b.type,
        business_line_name: b.business_line_name ?? 'Unassigned BL', // Ensure names are not null
        cost_center_name: b.cost_center_name ?? 'Unassigned CC',   // Ensure names are not null
    }));


    return {
        totalBudget,
        totalCapex,
        totalOpex,
        budgetEntryCount: budgets.length,
        businessLineCount: businessLines.length,
        costCenterCount: costCenters.length, // Count based on simple list
        chartData, // Pass prepared chart data
    };
}

export default async function DashboardPage() {
    const data = await getDashboardData();

     const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalBudget)}</div>
                         <p className="text-xs text-muted-foreground">Across {data.budgetEntryCount} entries</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                         <CardTitle className="text-sm font-medium">Total CAPEX</CardTitle>
                         <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalCapex)}</div>
                         {/* <p className="text-xs text-muted-foreground">+10% from last month</p> */}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total OPEX</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalOpex)}</div>
                        {/* <p className="text-xs text-muted-foreground">+5% from last month</p> */}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Business Lines</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         <div className="text-2xl font-bold">{data.businessLineCount}</div>
                          <Link href="/business-lines" className="text-xs text-muted-foreground flex items-center hover:text-primary">
                            Manage Lines <ArrowUpRight className="h-3 w-3 ml-1" />
                          </Link>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cost Centers</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.costCenterCount}</div>
                         <Link href="/cost-centers" className="text-xs text-muted-foreground flex items-center hover:text-primary">
                            Manage Centers <ArrowUpRight className="h-3 w-3 ml-1" />
                         </Link>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Budget Entries</CardTitle>
                         <Sheet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         <div className="text-2xl font-bold">{data.budgetEntryCount}</div>
                         <Link href="/budgets" className="text-xs text-muted-foreground flex items-center hover:text-primary">
                           View All Entries <ArrowUpRight className="h-3 w-3 ml-1" />
                         </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
             <Card>
                 <CardHeader>
                     <CardTitle>Quick Actions</CardTitle>
                 </CardHeader>
                 <CardContent className="flex flex-wrap gap-2">
                      <Link href="/budgets/add" passHref>
                         <Button variant="outline">
                             <PlusCircle className="mr-2 h-4 w-4" /> Add Budget Entry
                         </Button>
                      </Link>
                       <Link href="/cost-center-associations" passHref>
                         <Button variant="outline">
                              <Link2 className="mr-2 h-4 w-4" /> Manage Associations
                         </Button>
                      </Link>
                      <Link href="/upload" passHref>
                         <Button variant="outline">
                             <Upload className="mr-2 h-4 w-4" /> Upload Spreadsheet
                         </Button>
                      </Link>
                       <Link href="/charts" passHref>
                         <Button variant="outline">
                             <BarChart3 className="mr-2 h-4 w-4" /> View Charts
                         </Button>
                      </Link>
                 </CardContent>
             </Card>

            {/* Charts Section */}
             {data.chartData.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Budget Overview Charts</CardTitle>
                        <CardDescription>Visual breakdown of your spending.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BudgetCharts budgetData={data.chartData} />
                    </CardContent>
                </Card>
             ) : (
                 <Card>
                    <CardHeader>
                        <CardTitle>Budget Overview Charts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No budget data available to display charts.</p>
                    </CardContent>
                 </Card>
             )}

        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request

