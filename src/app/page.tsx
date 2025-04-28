
'use client'; // Add 'use client' directive for client-side interactions

import { getBudgets, getBusinessLines, getCostCentersSimple, getChartData, prepareBudgetsCsvData, getExpenses, prepareExpensesCsvData } from '@/app/actions'; // Added getExpenses, getChartData, prepareExpensesCsvData
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, Building2, Target, ArrowUpRight, DollarSign, TrendingUp, Upload, BarChart3, PlusCircle, Link2, Download, Receipt } from 'lucide-react'; // Added Download, Receipt icons
import Link from 'next/link';
// Removed BudgetCharts import as it's no longer used on this page
import type { ChartItem } from '@/types'; // Import ChartItem
import { useEffect, useState } from 'react'; // Import useEffect and useState
import { useToast } from '@/hooks/use-toast'; // Import useToast for notifications

interface DashboardData {
    totalBudget: number;
    totalExpense: number; // Added total expense
    totalCapex: number; // This will now be combined budget+expense
    totalOpex: number; // This will now be combined budget+expense
    budgetEntryCount: number;
    expenseEntryCount: number; // Added expense count
    businessLineCount: number;
    costCenterCount: number;
    // chartData removed as it's no longer directly used for rendering here
}

async function getDashboardData(): Promise<DashboardData> {
    // Fetch budgets, expenses, BLs, CCs, and combined chart data for calculations
    const [budgets, expenses, businessLines, costCenters, chartRawData] = await Promise.all([
        getBudgets(),
        getExpenses(), // Fetch expenses
        getBusinessLines(),
        getCostCentersSimple(),
        getChartData(), // Still fetch chart data for calculations
    ]);

    const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Calculate combined CAPEX/OPEX from chart data
    const totalCapex = chartRawData.filter(b => b.type === 'CAPEX').reduce((sum, b) => sum + b.amount, 0);
    const totalOpex = chartRawData.filter(b => b.type === 'OPEX').reduce((sum, b) => sum + b.amount, 0);

    return {
        totalBudget,
        totalExpense,
        totalCapex, // Combined CAPEX
        totalOpex, // Combined OPEX
        budgetEntryCount: budgets.length,
        expenseEntryCount: expenses.length, // Add expense count
        businessLineCount: businessLines.length,
        costCenterCount: costCenters.length,
    };
}

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloadingBudget, setDownloadingBudget] = useState(false);
    const [downloadingExpenses, setDownloadingExpenses] = useState(false); // State for expense download
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
    }, [toast]);

     const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Generic function to handle CSV data generation and download
    const generateAndDownloadCsv = (data: Record<string, any>[], filename: string) => {
        if (data.length === 0) {
            toast({
                title: 'No Data',
                description: `There is no data to export for ${filename}.`,
            });
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    let cell = row[header];
                    if (cell === null || cell === undefined) {
                        cell = '';
                    } else {
                        cell = String(cell);
                        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                            cell = `"${cell.replace(/"/g, '""')}"`;
                        }
                    }
                    return cell;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: 'Download Started',
            description: `Your ${filename} file is downloading.`,
        });
    };

    const handleDownloadBudgetCsv = async () => {
         setDownloadingBudget(true);
         try {
             const result = await prepareBudgetsCsvData();
             if (!result.success || !result.data) {
                 throw new Error(result.message || 'Failed to fetch data for CSV.');
             }
             generateAndDownloadCsv(result.data, 'cloudwise_budgets.csv');
         } catch (error: any) {
              console.error("Failed to download Budget CSV:", error);
              toast({
                  title: 'Download Failed',
                  description: error.message || 'Could not prepare budget data for download.',
                  variant: 'destructive',
              });
         } finally {
             setDownloadingBudget(false);
         }
    };

    const handleDownloadExpenseCsv = async () => {
        setDownloadingExpenses(true);
        try {
            const result = await prepareExpensesCsvData(); // Call the new action
            if (!result.success || !result.data) {
                throw new Error(result.message || 'Failed to fetch expense data for CSV.');
            }
            generateAndDownloadCsv(result.data, 'cloudwise_expenses.csv'); // Use expense filename
        } catch (error: any) {
             console.error("Failed to download Expense CSV:", error);
             toast({
                 title: 'Download Failed',
                 description: error.message || 'Could not prepare expense data for download.',
                 variant: 'destructive',
             });
        } finally {
            setDownloadingExpenses(false);
        }
   };


    if (loading || !data) {
        return <div className="text-center p-10">Loading dashboard...</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"> {/* Adjusted grid columns */}
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
                 {/* New Total Expense Card */}
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalExpense)}</div>
                        <p className="text-xs text-muted-foreground">Across {data.expenseEntryCount} entries</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                         <CardTitle className="text-sm font-medium">Total CAPEX</CardTitle>
                         <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalCapex)}</div>
                        <p className="text-xs text-muted-foreground">(Budget + Expenses)</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total OPEX</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalOpex)}</div>
                        <p className="text-xs text-muted-foreground">(Budget + Expenses)</p>
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
                           View Budgets <ArrowUpRight className="h-3 w-3 ml-1" />
                         </Link>
                    </CardContent>
                </Card>
                {/* New Expense Entries Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Expense Entries</CardTitle>
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.expenseEntryCount}</div>
                        <Link href="/expenses" className="text-xs text-muted-foreground flex items-center hover:text-primary">
                           View Expenses <ArrowUpRight className="h-3 w-3 ml-1" />
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
                      <Link href="/expenses/add" passHref>
                         <Button variant="outline">
                             <Receipt className="mr-2 h-4 w-4" /> Add Expense Entry
                         </Button>
                      </Link>
                       <Link href="/cost-center-associations" passHref>
                         <Button variant="outline">
                              <Link2 className="mr-2 h-4 w-4" /> Manage Associations
                         </Button>
                      </Link>
                      <Link href="/upload" passHref>
                         <Button variant="outline">
                             <Upload className="mr-2 h-4 w-4" /> Upload Data
                         </Button>
                      </Link>
                       <Link href="/charts" passHref>
                         <Button variant="outline">
                             <BarChart3 className="mr-2 h-4 w-4" /> View Charts
                         </Button>
                      </Link>
                       <Button variant="outline" onClick={handleDownloadBudgetCsv} disabled={downloadingBudget}>
                           <Download className="mr-2 h-4 w-4" />
                           {downloadingBudget ? 'Preparing Budget...' : 'Download Budget CSV'}
                       </Button>
                       {/* New Download Expense CSV Button */}
                       <Button variant="outline" onClick={handleDownloadExpenseCsv} disabled={downloadingExpenses}>
                           <Download className="mr-2 h-4 w-4" />
                           {downloadingExpenses ? 'Preparing Expenses...' : 'Download Expenses CSV'}
                       </Button>
                 </CardContent>
             </Card>

            {/* Charts Section - Removed from Dashboard */}
            {/*
             {data.chartData.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Overview Charts</CardTitle>
                        <CardDescription>Visual breakdown of your budget and spending.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BudgetCharts chartData={data.chartData} />
                    </CardContent>
                </Card>
             ) : (
                 <Card>
                    <CardHeader>
                        <CardTitle>Overview Charts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No budget or expense data available to display charts.</p>
                    </CardContent>
                 </Card>
             )}
            */}

        </div>
    );
}


    