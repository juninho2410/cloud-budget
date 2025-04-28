
"use client";

import type { ChartItem, ChartData, GroupedChartData, TimeSeriesChartData, BudgetExpenseComparisonChartData } from '@/types'; // Import ChartItem and new comparison type
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts'; // Added ComposedChart
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import * as React from "react";
import { useTheme } from 'next-themes';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select

interface BudgetChartsProps {
    chartData: ChartItem[]; // Accept the combined ChartItem array
}

// Define consistent colors using CSS variables from globals.css
const COLORS = {
    CAPEX: 'hsl(var(--chart-1))', // Primary Blue for CAPEX
    OPEX: 'hsl(var(--chart-2))', // Accent Teal for OPEX
    Budget: 'hsl(var(--chart-3))', // Light Blue for Budget
    Expense: 'hsl(var(--chart-4))', // Orange for Expense
    // Add more colors if needed for other charts using chart-5 etc.
    color5: 'hsl(var(--chart-5))',
};
const lineColors = [COLORS.Budget, COLORS.Expense, COLORS.CAPEX, COLORS.OPEX, COLORS.color5]; // Added Budget/Expense colors
const pieColors = [COLORS.CAPEX, COLORS.OPEX, COLORS.color5, COLORS.Budget, COLORS.Expense]; // Adjusted pie colors


const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percent is large enough
    if (percent * 100 < 5) return null; // Adjust threshold as needed

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-medium">
            {`${name} (${(percent * 100).toFixed(0)}%)`}
        </text>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  const { resolvedTheme } = useTheme();
  const tooltipBg = resolvedTheme === 'dark' ? 'hsl(var(--popover))' : 'hsl(var(--popover))';
  const tooltipText = resolvedTheme === 'dark' ? 'hsl(var(--popover-foreground))' : 'hsl(var(--popover-foreground))';
  const tooltipBorder = resolvedTheme === 'dark' ? 'hsl(var(--border))' : 'hsl(var(--border))';


  if (active && payload && payload.length) {
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    return (
      <div className="rounded-lg border p-2 shadow-sm" style={{ backgroundColor: tooltipBg, color: tooltipText, borderColor: tooltipBorder }}>
        <p className="font-bold mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} style={{ color: entry.stroke || entry.color || entry.payload?.fill || tooltipText }} className="text-sm">
            {/* Check for payload 'source' if available for differentiation */}
             {`${entry.name}: ${formatCurrency(entry.value)}`}
          </p>
        ))}
      </div>
    );
  }

  return null;
};


export function BudgetCharts({ chartData }: BudgetChartsProps) {
    const { resolvedTheme } = useTheme();
    const tickColor = resolvedTheme === 'dark' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground))';
    const [trendViewType, setTrendViewType] = React.useState<'CAPEX' | 'OPEX'>('OPEX');
    const [comparisonGroupBy, setComparisonGroupBy] = React.useState<'business_line_name' | 'cost_center_name'>('business_line_name'); // State for comparison grouping
    const [selectedMonthlyBlFilter, setSelectedMonthlyBlFilter] = React.useState<string>('__ALL__'); // State for monthly comparison BL filter
    const [selectedMonthlyTypeFilter, setSelectedMonthlyTypeFilter] = React.useState<'ALL' | 'CAPEX' | 'OPEX'>('ALL'); // State for monthly comparison Type filter

    // --- Data Processing ---

    // Get unique business lines for the filter dropdown
    const availableBusinessLines = React.useMemo(() => {
        const lines = new Set<string>();
        chartData.forEach(item => lines.add(item.business_line_name || 'Unassigned'));
        return Array.from(lines).sort();
    }, [chartData]);

    // 1. Total CAPEX vs OPEX (Combined for Budget and Expenses)
    const totalCapexOpexData = React.useMemo(() => {
        return chartData.reduce((acc, item) => {
            if (item.type === 'CAPEX') {
                acc[0].value += item.amount; // Add to CAPEX total
            } else if (item.type === 'OPEX') {
                acc[1].value += item.amount; // Add to OPEX total
            }
            return acc;
        }, [{ name: 'CAPEX', value: 0 }, { name: 'OPEX', value: 0 }]).filter(d => d.value > 0);
    }, [chartData]);

    // 2. Budget vs Expense by Month (Composed Chart) - Now with filtering by BL and Type
    const monthlyComparisonData = React.useMemo(() => {
        const monthlyData: Record<string, { monthYear: string; Budget: number; Expense: number }> = {};

        // Filter data based on selected Business Line and Type
        const filteredData = chartData.filter(item =>
            (selectedMonthlyBlFilter === '__ALL__' || item.business_line_name === selectedMonthlyBlFilter) &&
            (selectedMonthlyTypeFilter === 'ALL' || item.type === selectedMonthlyTypeFilter)
        );

        filteredData.forEach(item => {
            const monthYear = `${item.year}-${String(item.month).padStart(2, '0')}`;
            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = { monthYear, Budget: 0, Expense: 0 };
            }
            if (item.source === 'Budget') {
                monthlyData[monthYear].Budget += item.amount;
            } else { // source === 'Expense'
                monthlyData[monthYear].Expense += item.amount;
            }
        });

        // Convert to array and sort by monthYear
        return Object.values(monthlyData).sort((a, b) => a.monthYear.localeCompare(b.monthYear));
    }, [chartData, selectedMonthlyBlFilter, selectedMonthlyTypeFilter]); // Add filter states as dependencies


    // 3. Budget vs Expense by Category (Business Line or Cost Center)
    const categoryComparisonData = React.useMemo(() => {
        const categoryData: Record<string, { group: string; Budget: number; Expense: number }> = {};

         chartData.forEach(item => {
             // Use the selected grouping key
             const groupName = item[comparisonGroupBy] || 'Unassigned';

             if (!categoryData[groupName]) {
                 categoryData[groupName] = { group: groupName, Budget: 0, Expense: 0 };
             }

             if (item.source === 'Budget') {
                 categoryData[groupName].Budget += item.amount;
             } else { // source === 'Expense'
                 categoryData[groupName].Expense += item.amount;
             }
         });

         return Object.values(categoryData);

    }, [chartData, comparisonGroupBy]);


    // 4. Budget Trend by Business Line over Time (Existing, but needs filtering by source)
    const [timeSeriesData, allBusinessLines] = React.useMemo(() => {
         // Filter only Budget data for this specific chart
        const filteredBudgetData = chartData.filter(item => item.source === 'Budget' && item.type === trendViewType);
        const monthlyData: Record<string, Record<string, number>> = {};
        const uniqueBusinessLines = new Set<string>();

        filteredBudgetData.forEach(item => {
            const monthYear = `${item.year}-${String(item.month).padStart(2, '0')}`;
            const blName = item.business_line_name || 'Unassigned';
            uniqueBusinessLines.add(blName);

            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = {};
            }
            if (!monthlyData[monthYear][blName]) {
                monthlyData[monthYear][blName] = 0;
            }
            monthlyData[monthYear][blName] += item.amount;
        });

        const sortedMonths = Object.keys(monthlyData).sort();
        const finalData: TimeSeriesChartData[] = sortedMonths.map(monthYear => {
            const entry: TimeSeriesChartData = { monthYear };
            uniqueBusinessLines.forEach(blName => {
                entry[blName] = monthlyData[monthYear][blName] || 0;
            });
            return entry;
        });

        return [finalData, Array.from(uniqueBusinessLines)];
    }, [chartData, trendViewType]);



    // --- Render Charts ---
    return (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">

            {/* Total CAPEX vs OPEX Pie Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Total CAPEX vs OPEX</CardTitle>
                     <CardDescription>Overall spending distribution (Budget + Expenses)</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full">
                     {totalCapexOpexData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={totalCapexOpexData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {totalCapexOpexData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'CAPEX' ? COLORS.CAPEX : COLORS.OPEX} />
                                    ))}
                                </Pie>
                                 <Tooltip content={<CustomTooltip />} />
                                 <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                         <p className="text-center text-muted-foreground h-full flex items-center justify-center">No CAPEX/OPEX data available.</p>
                    )}
                </CardContent>
            </Card>

             {/* Budget vs Expense by Month (NEW Composed Chart) */}
            <Card className="lg:col-span-2 xl:col-span-3">
                 <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 sm:space-x-4 pb-4">
                     {/* Title and Description */}
                     <div className="flex-1">
                         <CardTitle>Budget vs. Expense Trend by Month</CardTitle>
                         <CardDescription>
                             Comparison of planned budget vs. actual expenses over time.
                             {selectedMonthlyBlFilter !== '__ALL__' && ` Filtered by: ${selectedMonthlyBlFilter}.`}
                             {selectedMonthlyTypeFilter !== 'ALL' && ` Type: ${selectedMonthlyTypeFilter}.`}
                         </CardDescription>
                     </div>
                     {/* Filters */}
                     <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         {/* Business Line Filter */}
                         <Select value={selectedMonthlyBlFilter} onValueChange={setSelectedMonthlyBlFilter}>
                             <SelectTrigger className="w-full sm:w-[200px]">
                                 <SelectValue placeholder="Filter by Business Line..." />
                             </SelectTrigger>
                             <SelectContent>
                                 <SelectItem value="__ALL__">All Business Lines</SelectItem>
                                 {availableBusinessLines.map(blName => (
                                     <SelectItem key={blName} value={blName}>
                                         {blName}
                                     </SelectItem>
                                 ))}
                             </SelectContent>
                         </Select>
                          {/* Type (CAPEX/OPEX) Filter */}
                         <Select value={selectedMonthlyTypeFilter} onValueChange={(value: 'ALL' | 'CAPEX' | 'OPEX') => setSelectedMonthlyTypeFilter(value)}>
                             <SelectTrigger className="w-full sm:w-[150px]">
                                 <SelectValue placeholder="Filter by Type..." />
                             </SelectTrigger>
                             <SelectContent>
                                 <SelectItem value="ALL">All Types</SelectItem>
                                 <SelectItem value="CAPEX">CAPEX</SelectItem>
                                 <SelectItem value="OPEX">OPEX</SelectItem>
                             </SelectContent>
                         </Select>
                     </div>
                 </CardHeader>
                 <CardContent className="h-[350px] w-full pt-0"> {/* Removed pt-4 */}
                     {monthlyComparisonData.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                              {/* Use ComposedChart to potentially mix Bar and Line */}
                             <ComposedChart data={monthlyComparisonData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                 <XAxis dataKey="monthYear" stroke={tickColor} fontSize={12} />
                                 <YAxis stroke={tickColor} fontSize={12} tickFormatter={(value) => `$${value / 1000}k`} />
                                 <Tooltip content={<CustomTooltip />} />
                                 <Legend />
                                 <Bar dataKey="Budget" fill={COLORS.Budget} barSize={20} radius={[4, 4, 0, 0]} />
                                 <Line type="monotone" dataKey="Expense" stroke={COLORS.Expense} strokeWidth={2} dot={false} />
                             </ComposedChart>
                         </ResponsiveContainer>
                     ) : (
                         <p className="text-center text-muted-foreground h-full flex items-center justify-center">No budget or expense data available for the selected filter.</p>
                     )}
                 </CardContent>
            </Card>

             {/* Budget vs Expense by Category (NEW Bar Chart) */}
             <Card className="lg:col-span-2 xl:col-span-3">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <div>
                         <CardTitle>Budget vs. Expense by Category</CardTitle>
                         <CardDescription>Comparison grouped by Business Line or Cost Center.</CardDescription>
                     </div>
                      <Select value={comparisonGroupBy} onValueChange={(value: 'business_line_name' | 'cost_center_name') => setComparisonGroupBy(value)}>
                           <SelectTrigger className="w-[180px]">
                             <SelectValue placeholder="Group by..." />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="business_line_name">Business Line</SelectItem>
                             <SelectItem value="cost_center_name">Cost Center</SelectItem>
                           </SelectContent>
                       </Select>
                 </CardHeader>
                 <CardContent className="h-[400px] w-full pt-4"> {/* Increased height */}
                     {categoryComparisonData.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={categoryComparisonData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                                 <XAxis type="number" stroke={tickColor} fontSize={12} tickFormatter={(value) => `$${value / 1000}k`}/>
                                 {/* Adjust width for longer labels potentially */}
                                 <YAxis dataKey="group" type="category" stroke={tickColor} fontSize={12} width={120} interval={0} />
                                 <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent)/0.1)' }}/>
                                <Legend />
                                <Bar dataKey="Budget" fill={COLORS.Budget} radius={[0, 4, 4, 0]} />
                                <Bar dataKey="Expense" fill={COLORS.Expense} radius={[4, 0, 0, 4]}/>
                            </BarChart>
                        </ResponsiveContainer>
                     ) : (
                         <p className="text-center text-muted-foreground h-full flex items-center justify-center">No data available for category comparison.</p>
                     )}
                 </CardContent>
            </Card>


            {/* Budget Trend by Business Line Line Chart (Existing - Filtered for Budget) */}
             <Card className="lg:col-span-2 xl:col-span-3"> {/* Span across columns */}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle>Budget Trend by Business Line ({trendViewType})</CardTitle>
                         <CardDescription>Monthly planned budget per business line over time.</CardDescription>
                    </div>
                     <RadioGroup
                        defaultValue={trendViewType}
                        onValueChange={(value: 'CAPEX' | 'OPEX') => setTrendViewType(value)}
                        className="flex items-center space-x-2"
                     >
                        <div className="flex items-center space-x-1">
                            <RadioGroupItem value="CAPEX" id="capex-trend" />
                            <Label htmlFor="capex-trend" className="text-sm">CAPEX</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                            <RadioGroupItem value="OPEX" id="opex-trend" />
                            <Label htmlFor="opex-trend" className="text-sm">OPEX</Label>
                        </div>
                     </RadioGroup>
                </CardHeader>
                <CardContent className="h-[350px] w-full pt-4">
                     {timeSeriesData.length > 0 && allBusinessLines.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={timeSeriesData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                                <XAxis dataKey="monthYear" stroke={tickColor} fontSize={12} />
                                <YAxis stroke={tickColor} fontSize={12} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                {allBusinessLines.map((blName, index) => (
                                    <Line
                                        key={blName}
                                        type="monotone"
                                        dataKey={blName}
                                        // Use consistent colors but maybe offset for budget trend
                                        stroke={lineColors[(index + 2) % lineColors.length]}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                         <p className="text-center text-muted-foreground h-full flex items-center justify-center">No budget data available for the selected time period and type.</p>
                    )}
                 </CardContent>
            </Card>


        </div>
    );
}

