
"use client";

import type { Budget, BusinessLine, CostCenter, BudgetFormData } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation'; // Correct import for App Router
import type { FormEvent } from 'react';

const budgetFormSchema = z.object({
    description: z.string().min(1, 'Description cannot be empty'),
    amount: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : typeof val === 'string' ? parseFloat(val) : val),
        z.number({ required_error: "Amount is required", invalid_type_error: "Amount must be a number" }).positive('Amount must be a positive number')
    ),
    year: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : typeof val === 'string' ? parseInt(val, 10) : val),
        z.number({ required_error: "Year is required", invalid_type_error: "Year must be a number" }).int().min(1900, 'Enter a valid year').max(2100, 'Enter a valid year')
    ),
    month: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : typeof val === 'string' ? parseInt(val, 10) : val),
        z.number({ required_error: "Month is required", invalid_type_error: "Month must be a number" }).int().min(1, 'Enter a valid month (1-12)').max(12, 'Enter a valid month (1-12)')
    ),
    type: z.enum(['CAPEX', 'OPEX'], { required_error: "Type is required" }),
    business_line_id: z.string().nullable().optional(), // Can be null or a string ID
    cost_center_id: z.string().nullable().optional(), // Can be null or a string ID
});

const NONE_VALUE = "__NONE__"; // Special value for representing null in Select


interface BudgetFormProps {
    initialData?: Budget | null;
    businessLines: BusinessLine[];
    costCenters: CostCenter[];
    onSubmit: (formData: FormData) => Promise<{ success: boolean; message: string }>;
    formType: 'add' | 'edit';
}

export function BudgetForm({ initialData, businessLines, costCenters, onSubmit, formType }: BudgetFormProps) {
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<z.infer<typeof budgetFormSchema>>({
        resolver: zodResolver(budgetFormSchema),
        defaultValues: {
            description: initialData?.description || '',
            amount: initialData?.amount ? String(initialData.amount) : '', // Initialize as string or empty string
            year: initialData?.year ? String(initialData.year) : '',       // Initialize as string or empty string
            month: initialData?.month ? String(initialData.month) : '',     // Initialize as string or empty string
            type: initialData?.type || undefined, // Let zod handle the required error if undefined
            business_line_id: initialData?.business_line_id ? String(initialData.business_line_id) : NONE_VALUE,
            cost_center_id: initialData?.cost_center_id ? String(initialData.cost_center_id) : NONE_VALUE,
        },
    });

    const { formState, handleSubmit, control, watch } = form;
    const { isSubmitting } = formState;

    // Filter cost centers based on the selected business line
    const selectedBusinessLineId = watch('business_line_id');
    const filteredCostCenters = selectedBusinessLineId && selectedBusinessLineId !== NONE_VALUE
        ? costCenters.filter(cc => cc.business_line_id === parseInt(selectedBusinessLineId, 10) || cc.business_line_id === null) // Also include CCs with no BL
        : costCenters; // Show all if no BL is selected


    const handleFormSubmit = async (data: z.infer<typeof budgetFormSchema>) => {

        const formData = new FormData();
        formData.append('description', data.description);
        formData.append('amount', String(data.amount));
        formData.append('year', String(data.year));
        formData.append('month', String(data.month));
        formData.append('type', data.type);
        if (data.business_line_id && data.business_line_id !== NONE_VALUE) {
           formData.append('business_line_id', data.business_line_id);
        }
         if (data.cost_center_id && data.cost_center_id !== NONE_VALUE) {
           formData.append('cost_center_id', data.cost_center_id);
        }


        const result = await onSubmit(formData);

        toast({
            title: result.success ? 'Success' : 'Error',
            description: result.message,
            variant: result.success ? 'default' : 'destructive',
        });

        if (result.success) {
            router.push('/budgets'); // Redirect after successful submission
            router.refresh(); // Ensure data is fresh
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>{formType === 'add' ? 'Add New Budget Entry' : 'Edit Budget Entry'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                    <CardContent className="space-y-4">
                         <FormField
                          control={control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Server costs Q1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField
                             control={control}
                             name="amount"
                             render={({ field }) => (
                               <FormItem>
                                 <FormLabel>Amount</FormLabel>
                                 <FormControl>
                                   {/* Ensure value is always a string */}
                                   <Input type="number" step="0.01" placeholder="1000.00" {...field} value={field.value ?? ''} />
                                 </FormControl>
                                 <FormMessage />
                               </FormItem>
                             )}
                           />
                            <FormField
                                control={control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type (CAPEX/OPEX)</FormLabel>
                                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                     <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="CAPEX">CAPEX</SelectItem>
                                                <SelectItem value="OPEX">OPEX</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={control}
                                name="year"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Year</FormLabel>
                                        <FormControl>
                                             {/* Ensure value is always a string */}
                                            <Input type="number" placeholder="YYYY" {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                             />
                            <FormField
                                control={control}
                                name="month"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Month</FormLabel>
                                         <FormControl>
                                            {/* Ensure value is always a string */}
                                            <Input type="number" placeholder="MM" {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField
                             control={control}
                             name="business_line_id"
                             render={({ field }) => (
                               <FormItem>
                                 <FormLabel>Business Line (Optional)</FormLabel>
                                 <Select
                                    onValueChange={(value) => field.onChange(value)}
                                    value={field.value ?? NONE_VALUE} // Use NONE_VALUE if null/undefined
                                  >
                                   <FormControl>
                                     <SelectTrigger>
                                       <SelectValue placeholder="Select business line" />
                                     </SelectTrigger>
                                   </FormControl>
                                   <SelectContent>
                                     <SelectItem value={NONE_VALUE}>-- None --</SelectItem>
                                     {businessLines.map((line) => (
                                       <SelectItem key={line.id} value={String(line.id)}>
                                         {line.name}
                                       </SelectItem>
                                     ))}
                                   </SelectContent>
                                 </Select>
                                 <FormMessage />
                               </FormItem>
                             )}
                           />
                            <FormField
                                control={control}
                                name="cost_center_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cost Center (Optional)</FormLabel>
                                         <Select
                                            onValueChange={(value) => field.onChange(value)}
                                            value={field.value ?? NONE_VALUE} // Use NONE_VALUE if null/undefined
                                            // Disable if no BL selected OR if BL selected but no matching CCs
                                            disabled={(!selectedBusinessLineId || selectedBusinessLineId === NONE_VALUE) || filteredCostCenters.length === 0}
                                            >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select cost center" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                 <SelectItem value={NONE_VALUE}>-- None --</SelectItem>
                                                {filteredCostCenters.map((center) => (
                                                    <SelectItem key={center.id} value={String(center.id)}>
                                                        {center.name}
                                                        {center.business_line_name && ` (${center.business_line_name})`}
                                                    </SelectItem>
                                                ))}
                                                 {filteredCostCenters.length === 0 && selectedBusinessLineId && selectedBusinessLineId !== NONE_VALUE && (
                                                      <p className="p-2 text-xs text-muted-foreground">No cost centers found for the selected business line.</p>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : (formType === 'add' ? 'Add Entry' : 'Update Entry')}
                        </Button>
                         <Button type="button" variant="outline" onClick={() => router.back()} className="ml-2">
                            Cancel
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
