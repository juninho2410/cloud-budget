
'use client'; // Add 'use client' directive for client-side interactions

import { getBudgets, getBusinessLines, getCostCentersSimple, getBudgetDataForCharts, prepareBudgetsCsvData } from '@/app/actions'; // Added prepareBudgetsCsvData
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, Building2, Target, ArrowUpRight, DollarSign, TrendingUp, Upload, BarChart3, PlusCircle, Link2, Download } from 'lucide-react'; // Added Download icon
import Link from 'next/link';
import { BudgetCharts } from '@/components/charts/budget-charts';
import type { BudgetChartItem } from '@/types'; // Import BudgetChartItem
import { useEffect, useState } from 'react'; // Import useEffect and useState
import { useToast } from '@/hooks/use-toast'; // Import useToast for notifications

interface DashboardData {
    totalBudget: number;
    totalCapex: number;
    totalOpex: number;
    budgetEntryCount: number;
    businessLineCount: number;
    costCenterCount: number;
    chartData: BudgetChartItem[];
}

async function getDashboardData(): Promise<DashboardData> {
    // Use getCostCentersSimple to get the count
    const [budgets, businessLines, costCenters, chartRawData] = await Promise.all([
        getBudgets(),
        getBusinessLines(),
        getCostCentersSimple(), // Changed function call
        getBudgetDataForCharts(), // Fetch raw chart data
    ]);

    const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalCapex = budgets.filter(b => b.type === 'CAPEX').reduce((sum, b) => sum + b.amount, 0);
    const totalOpex = budgets.filter(b => b.type === 'OPEX').reduce((sum, b) => sum + b.amount, 0);

    // Prepare chart data (already fetched as chartRawData which matches BudgetChartItem structure)
    const chartData: BudgetChartItem[] = chartRawData;

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

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                const dashboardData = await getDashboardData();
                setData(dashboardData);
            } catch (error) {
                console.error("Failed to load dashboard data:", error);
                toast({
                    title: 'Error Loading Data',
                    description: 'Could not fetch dashboard information.',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [toast]); // Add toast to dependency array

     const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const handleDownloadCsv = async () => {
         setDownloading(true);
         try {
             const result = await prepareBudgetsCsvData();
             if (!result.success || !result.data) {
                 throw new Error(result.message || 'Failed to fetch data for CSV.');
             }

             if (result.data.length === 0) {
                 toast({
                     title: 'No Data',
                     description: 'There is no budget data to export.',
                 });
                 return;
             }

             // Convert JSON to CSV
             const headers = Object.keys(result.data[0]);
             const csvContent = [
                 headers.join(','), // Header row
                 ...result.data.map(row =>
                     headers.map(header => {
                         let cell = row[header];
                         // Handle null/undefined and stringify if necessary
                         if (cell === null || cell === undefined) {
                             cell = '';
                         } else {
                            cell = String(cell);
                            // Escape commas and quotes within cells
                            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                                 cell = `"${cell.replace(/"/g, '""')}"`; // Double quotes for escaping
                             }
                         }

                         return cell;
                     }).join(',')
                 )
             ].join('\n');

             // Create blob and trigger download
             const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
             const link = document.createElement('a');
             const url = URL.createObjectURL(blob);
             link.setAttribute('href', url);
             link.setAttribute('download', 'cloudwise_budgets.csv');
             link.style.visibility = 'hidden';
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);

             toast({
                 title: 'Download Started',
                 description: 'Your budget data CSV file is downloading.',
             });

         } catch (error: any) {
              console.error("Failed to download CSV:", error);
              toast({
                  title: 'Download Failed',
                  description: error.message || 'Could not prepare budget data for download.',
                  variant: 'destructive',
              });
         } finally {
             setDownloading(false);
         }
    };

    if (loading || !data) {
        // Optional: Show a loading state or skeleton
        return <div className="text-center p-10">Loading dashboard...</div>;
    }

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
                       <Button variant="outline" onClick={handleDownloadCsv} disabled={downloading}>
                           <Download className="mr-2 h-4 w-4" />
                           {downloading ? 'Preparing...' : 'Download CSV'}
                       </Button>
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
                        {/* Pass the BudgetChartItem[] data */}
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

// Removed dynamic export as page is now client-side rendered due to hooks
// export const dynamic = 'force-dynamic';
