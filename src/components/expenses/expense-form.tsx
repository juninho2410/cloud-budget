
"use client";

import type { Expense, BusinessLine, CostCenterWithBusinessLines } from '@/types'; // Use Expense type
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Unused, can remove
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect } from 'react';

// Base schema for shared fields (description, amount, year, month, type, bl_id, cc_id)
const baseEntrySchema = z.object({
    description: z.string().min(1, 'Description cannot be empty'),
    amount: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val),
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
    business_line_id: z.string().nullable().optional(),
    cost_center_id: z.string().nullable().optional(),
});

// Extend base schema specifically for expense form validation
const expenseFormSchema = baseEntrySchema;

// Special value for representing null in Select dropdowns
const NONE_VALUE = "__NONE__";

interface ExpenseFormProps {
    initialData?: Expense | null; // Use Expense type
    businessLines: BusinessLine[];
    costCenters: CostCenterWithBusinessLines[];
    onSubmit: (formData: FormData) => Promise<{ success: boolean; message: string }>;
    formType: 'add' | 'edit';
}

export function ExpenseForm({ initialData, businessLines, costCenters, onSubmit, formType }: ExpenseFormProps) {
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<z.infer<typeof expenseFormSchema>>({
        resolver: zodResolver(expenseFormSchema),
        defaultValues: {
            description: initialData?.description || '',
            amount: initialData?.amount !== undefined ? String(initialData.amount) : '',
            year: initialData?.year !== undefined ? String(initialData.year) : new Date().getFullYear().toString(), // Default to current year for add
            month: initialData?.month !== undefined ? String(initialData.month) : (new Date().getMonth() + 1).toString(), // Default to current month for add
            type: initialData?.type || undefined,
            business_line_id: initialData?.business_line_id ? String(initialData.business_line_id) : NONE_VALUE,
            cost_center_id: initialData?.cost_center_id ? String(initialData.cost_center_id) : NONE_VALUE,
        },
    });

    const { formState, handleSubmit, control, watch, reset, setValue } = form; // Added setValue
    const { isSubmitting } = formState;

     useEffect(() => {
         reset({
             description: initialData?.description || '',
             amount: initialData?.amount !== undefined ? String(initialData.amount) : '',
             year: initialData?.year !== undefined ? String(initialData.year) : new Date().getFullYear().toString(),
             month: initialData?.month !== undefined ? String(initialData.month) : (new Date().getMonth() + 1).toString(),
             type: initialData?.type || undefined,
             business_line_id: initialData?.business_line_id ? String(initialData.business_line_id) : NONE_VALUE,
             cost_center_id: initialData?.cost_center_id ? String(initialData.cost_center_id) : NONE_VALUE,
         });
     }, [initialData, reset]);

    const selectedBusinessLineId = watch('business_line_id');

    const filteredCostCenters = useMemo(() => {
        if (!selectedBusinessLineId || selectedBusinessLineId === NONE_VALUE) {
            return [];
        }
        const targetBlId = parseInt(selectedBusinessLineId, 10);
        if (isNaN(targetBlId)) {
            return [];
        }
        return costCenters.filter(cc => cc.businessLines.some(bl => bl.id === targetBlId));
    }, [selectedBusinessLineId, costCenters]);


    const handleFormSubmit = async (data: z.infer<typeof expenseFormSchema>) => {
        const formData = new FormData();
        formData.append('description', data.description);
        formData.append('amount', String(data.amount));
        formData.append('year', String(data.year));
        formData.append('month', String(data.month));
        formData.append('type', data.type);
        formData.append('business_line_id', data.business_line_id ?? NONE_VALUE);
        formData.append('cost_center_id', data.cost_center_id ?? NONE_VALUE);

        const result = await onSubmit(formData);

        toast({
            title: result.success ? 'Success' : 'Error',
            description: result.message,
            variant: result.success ? 'default' : 'destructive',
        });

        if (result.success) {
            router.push('/expenses'); // Navigate back to the expense list
            router.refresh();
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>{formType === 'add' ? 'Add New Expense Entry' : 'Edit Expense Entry'}</CardTitle>
                 <CardDescription>
                    Fill in the details for the expense entry. Select a Business Line first to filter compatible Cost Centers.
                 </CardDescription>
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
                                <Input placeholder="e.g., Cloud server costs" {...field} />
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
                                   <Input type="text" inputMode="decimal" placeholder="100.00" {...field} value={field.value ?? ''}/>
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
                                         <Select onValueChange={field.onChange} value={field.value} defaultValue={initialData?.type}>
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
                                            <Input type="text" inputMode="numeric" placeholder="YYYY" {...field} value={field.value ?? ''}/>
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
                                            <Input type="text" inputMode="numeric" placeholder="MM" {...field} value={field.value ?? ''}/>
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
                                 <FormLabel>Business Line</FormLabel>
                                 <Select
                                    onValueChange={(value) => {
                                        field.onChange(value === NONE_VALUE ? null : value);
                                        // Reset cost center when business line changes
                                        setValue('cost_center_id', NONE_VALUE);
                                    }}
                                    value={field.value ?? NONE_VALUE} // Ensure value is string or __NONE__
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
                                        <FormLabel>Cost Center</FormLabel>
                                         <Select
                                            onValueChange={(value) => field.onChange(value === NONE_VALUE ? null : value)}
                                            value={field.value ?? NONE_VALUE} // Ensure value is string or __NONE__
                                            disabled={!selectedBusinessLineId || selectedBusinessLineId === NONE_VALUE}
                                            >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={
                                                         !selectedBusinessLineId || selectedBusinessLineId === NONE_VALUE
                                                         ? "Select Business Line first"
                                                         : "Select cost center"
                                                    } />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                 <SelectItem value={NONE_VALUE}>-- None --</SelectItem>
                                                 {selectedBusinessLineId && selectedBusinessLineId !== NONE_VALUE && filteredCostCenters.map((center) => (
                                                    <SelectItem key={center.id} value={String(center.id)}>
                                                        {center.name}
                                                    </SelectItem>
                                                ))}
                                                {selectedBusinessLineId && selectedBusinessLineId !== NONE_VALUE && filteredCostCenters.length === 0 && (
                                                      <div className="p-2 text-xs text-muted-foreground text-center italic">No cost centers associated.</div>
                                                )}
                                                 {(!selectedBusinessLineId || selectedBusinessLineId === NONE_VALUE) && (
                                                     <div className="p-2 text-xs text-muted-foreground text-center italic">Select Business Line first.</div>
                                                 )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : (formType === 'add' ? 'Add Expense' : 'Update Expense')}
                        </Button>
                         <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
