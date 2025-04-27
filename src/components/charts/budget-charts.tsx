
"use client";

import type { BudgetChartItem, ChartData, GroupedChartData, TimeSeriesChartData } from '@/types';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import * as React from "react";
import { useTheme } from 'next-themes';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';

interface BudgetChartsProps {
    budgetData: BudgetChartItem[]; // Use the more detailed type
}

// Define consistent colors using CSS variables from globals.css
const COLORS = {
    CAPEX: 'hsl(var(--chart-1))', // Primary Blue
    OPEX: 'hsl(var(--chart-2))', // Accent Teal
    // Add more colors if needed for other charts using chart-3, chart-4, chart-5 etc.
    color3: 'hsl(var(--chart-3))',
    color4: 'hsl(var(--chart-4))',
    color5: 'hsl(var(--chart-5))',
};
const lineColors = [COLORS.CAPEX, COLORS.OPEX, COLORS.color3, COLORS.color4, COLORS.color5];

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
            {`${entry.name}: ${formatCurrency(entry.value)}`}
          </p>
        ))}
      </div>
    );
  }

  return null;
};


export function BudgetCharts({ budgetData }: BudgetChartsProps) {
    const { resolvedTheme } = useTheme();
    const tickColor = resolvedTheme === 'dark' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground))';
    const [trendViewType, setTrendViewType] = React.useState<'CAPEX' | 'OPEX'>('OPEX');


    // --- Data Processing ---

    // 1. Total CAPEX vs OPEX
    const capexOpexData = budgetData.reduce((acc, item) => {
        if (item.type === 'CAPEX') {
            acc[0].value += item.amount;
        } else if (item.type === 'OPEX') {
            acc[1].value += item.amount;
        }
        return acc;
    }, [{ name: 'CAPEX', value: 0 }, { name: 'OPEX', value: 0 }]).filter(d => d.value > 0); // Filter out zero values

    // 2. Budget per Business Line (Grouped CAPEX/OPEX)
    const businessLineData = budgetData.reduce<Record<string, { name: string; CAPEX: number; OPEX: number }>>((acc, item) => {
        const name = item.business_line_name || 'Unassigned';
        if (!acc[name]) {
            acc[name] = { name: name, CAPEX: 0, OPEX: 0 };
        }
        if (item.type === 'CAPEX') {
            acc[name].CAPEX += item.amount;
        } else {
            acc[name].OPEX += item.amount;
        }
        return acc;
    }, {});
    const businessLineChartData: GroupedChartData = Object.values(businessLineData);


    // 3. Budget per Cost Center (Simple Total)
    const costCenterData = budgetData.reduce<Record<string, { name: string; value: number }>>((acc, item) => {
        const name = item.cost_center_name || 'Unassigned';
         if (!acc[name]) {
            acc[name] = { name: name, value: 0 };
        }
        acc[name].value += item.amount;
        return acc;
    }, {});
     const costCenterChartData: ChartData = Object.values(costCenterData).filter(d => d.value > 0);

    // 4. Budget Trend by Business Line over Time (NEW)
    const [timeSeriesData, allBusinessLines] = React.useMemo(() => {
        const filteredData = budgetData.filter(item => item.type === trendViewType);
        const monthlyData: Record<string, Record<string, number>> = {};
        const uniqueBusinessLines = new Set<string>();

        filteredData.forEach(item => {
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
    }, [budgetData, trendViewType]);


    const pieColors = [COLORS.CAPEX, COLORS.OPEX, COLORS.color3, COLORS.color4, COLORS.color5]; // Define colors for pie charts if needed


    // --- Render Charts ---
    return (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">

            {/* CAPEX vs OPEX Pie Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>CAPEX vs OPEX</CardTitle>
                     <CardDescription>Total spending distribution</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full">
                     {capexOpexData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={capexOpexData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {capexOpexData.map((entry, index) => (
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

            {/* Budget per Business Line Bar Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Budget by Business Line</CardTitle>
                     <CardDescription>CAPEX and OPEX spending per line</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full">
                     {businessLineChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={businessLineChartData} layout="vertical" barSize={20}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                                <XAxis type="number" stroke={tickColor} fontSize={12} tickFormatter={(value) => `$${value / 1000}k`}/>
                                <YAxis dataKey="name" type="category" stroke={tickColor} fontSize={12} width={80} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent)/0.1)' }}/>
                                <Legend />
                                <Bar dataKey="CAPEX" stackId="a" fill={COLORS.CAPEX} radius={[0, 4, 4, 0]} />
                                <Bar dataKey="OPEX" stackId="a" fill={COLORS.OPEX} radius={[4, 4, 0, 0]}/>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                         <p className="text-center text-muted-foreground h-full flex items-center justify-center">No business line data available.</p>
                    )}
                </CardContent>
            </Card>


            {/* Budget per Cost Center Pie Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Budget by Cost Center</CardTitle>
                    <CardDescription>Total spending distribution per center</CardDescription>
                </CardHeader>
                 <CardContent className="h-[300px] w-full">
                     {costCenterChartData.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                 <Pie
                                     data={costCenterChartData}
                                     cx="50%"
                                     cy="50%"
                                     labelLine={false}
                                     label={renderCustomizedLabel}
                                     outerRadius={110}
                                     fill="#8884d8"
                                     dataKey="value"
                                     nameKey="name"
                                >
                                    {costCenterChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                {/* <Legend /> */} {/* Legend might get crowded */}
                            </PieChart>
                         </ResponsiveContainer>
                     ) : (
                         <p className="text-center text-muted-foreground h-full flex items-center justify-center">No cost center data available.</p>
                    )}
                 </CardContent>
            </Card>

            {/* Budget Trend by Business Line Line Chart (NEW) */}
             <Card className="lg:col-span-2 xl:col-span-3"> {/* Span across columns */}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle>Budget Trend by Business Line ({trendViewType})</CardTitle>
                         <CardDescription>Monthly spending per business line over time.</CardDescription>
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
                <CardContent className="h-[350px] w-full pt-4"> {/* Increased height slightly */}
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
                                        stroke={lineColors[index % lineColors.length]}
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

