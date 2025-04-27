
"use client";

import type { Budget, BusinessLine, CostCenter, BudgetFormData, CostCenterWithBusinessLines } from '@/types'; // Import CostCenterWithBusinessLines
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card'; // Added CardDescription
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect } from 'react'; // Import useMemo and useEffect

const budgetFormSchema = z.object({
    description: z.string().min(1, 'Description cannot be empty'),
    amount: z.preprocess(
        // Convert empty string/null/undefined to undefined for zod, parse valid strings/numbers
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
    // Use string for select value, server action will parse/validate __NONE__
    business_line_id: z.string().nullable().optional(),
    cost_center_id: z.string().nullable().optional(),
});

// Special value for representing null in Select dropdowns
const NONE_VALUE = "__NONE__";


interface BudgetFormProps {
    initialData?: Budget | null;
    businessLines: BusinessLine[];
    costCenters: CostCenterWithBusinessLines[]; // Expect CostCenters with associated business lines
    onSubmit: (formData: FormData) => Promise<{ success: boolean; message: string }>;
    formType: 'add' | 'edit';
}

export function BudgetForm({ initialData, businessLines, costCenters, onSubmit, formType }: BudgetFormProps) {
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<z.infer<typeof budgetFormSchema>>({
        resolver: zodResolver(budgetFormSchema),
        // Initialize with strings or NONE_VALUE to avoid uncontrolled input issues
        defaultValues: {
            description: initialData?.description || '',
            amount: initialData?.amount !== undefined ? String(initialData.amount) : '',
            year: initialData?.year !== undefined ? String(initialData.year) : '',
            month: initialData?.month !== undefined ? String(initialData.month) : '',
            type: initialData?.type || undefined,
            business_line_id: initialData?.business_line_id ? String(initialData.business_line_id) : NONE_VALUE,
            cost_center_id: initialData?.cost_center_id ? String(initialData.cost_center_id) : NONE_VALUE,
        },
    });

    const { formState, handleSubmit, control, watch, reset } = form;
    const { isSubmitting } = formState;

    // Reset form if initialData changes (e.g., navigating between edit pages or after save)
     useEffect(() => {
         reset({
             description: initialData?.description || '',
             amount: initialData?.amount !== undefined ? String(initialData.amount) : '',
             year: initialData?.year !== undefined ? String(initialData.year) : '',
             month: initialData?.month !== undefined ? String(initialData.month) : '',
             type: initialData?.type || undefined,
             business_line_id: initialData?.business_line_id ? String(initialData.business_line_id) : NONE_VALUE,
             cost_center_id: initialData?.cost_center_id ? String(initialData.cost_center_id) : NONE_VALUE,
         });
     }, [initialData, reset]);

    // Watch the selected business line ID
    const selectedBusinessLineId = watch('business_line_id');

    // Filter cost centers based on the selected business line using M2M relationship
    const filteredCostCenters = useMemo(() => {
        // If no business line is selected or 'None' is chosen, show all cost centers initially
        if (!selectedBusinessLineId || selectedBusinessLineId === NONE_VALUE) {
            // In 'add' mode, maybe we shouldn't show all CCs until BL is selected?
            // For 'edit' mode, we need to show the initially selected one even if BL changes.
            // Let's show cost centers *only* if a business line is selected.
            return [];
        }
        const targetBlId = parseInt(selectedBusinessLineId, 10);
        if (isNaN(targetBlId)) {
            return []; // Invalid BL ID selected
        }
        // Filter cost centers that have the selected business line in their associations
        return costCenters.filter(cc => cc.businessLines.some(bl => bl.id === targetBlId));
    }, [selectedBusinessLineId, costCenters]);


    const handleFormSubmit = async (data: z.infer<typeof budgetFormSchema>) => {

        const formData = new FormData();
        formData.append('description', data.description);
        formData.append('amount', String(data.amount)); // Send as string
        formData.append('year', String(data.year));     // Send as string
        formData.append('month', String(data.month));    // Send as string
        formData.append('type', data.type);

        // Send the actual value ('__NONE__' or the ID) to the server action for processing
        formData.append('business_line_id', data.business_line_id ?? NONE_VALUE);
        formData.append('cost_center_id', data.cost_center_id ?? NONE_VALUE);

        const result = await onSubmit(formData);

        toast({
            title: result.success ? 'Success' : 'Error',
            description: result.message,
            variant: result.success ? 'default' : 'destructive',
        });

        if (result.success) {
            router.push('/budgets'); // Navigate back to the list on success
            router.refresh(); // Ensure the list page is updated
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>{formType === 'add' ? 'Add New Budget Entry' : 'Edit Budget Entry'}</CardTitle>
                 <CardDescription>
                    Fill in the details for the budget entry. Select a Business Line first to filter compatible Cost Centers.
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
                                   {/* Use text type initially to allow empty string, validation handles parsing */}
                                   <Input type="text" inputMode="decimal" placeholder="1000.00" {...field} />
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
                                            {/* Use text type initially */}
                                            <Input type="text" inputMode="numeric" placeholder="YYYY" {...field} />
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
                                            {/* Use text type initially */}
                                            <Input type="text" inputMode="numeric" placeholder="MM" {...field} />
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
                                        field.onChange(value);
                                        // Reset cost center when business line changes
                                        form.setValue('cost_center_id', NONE_VALUE);
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
                                            onValueChange={(value) => field.onChange(value)}
                                            value={field.value ?? NONE_VALUE} // Ensure value is string or __NONE__
                                            // Disable if no BL selected OR if BL selected but no matching CCs available
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
                                                 {/* Render options only if a valid BL is selected */}
                                                 {selectedBusinessLineId && selectedBusinessLineId !== NONE_VALUE && filteredCostCenters.map((center) => (
                                                    <SelectItem key={center.id} value={String(center.id)}>
                                                        {center.name}
                                                    </SelectItem>
                                                ))}
                                                {/* Provide feedback if no associated cost centers */}
                                                {selectedBusinessLineId && selectedBusinessLineId !== NONE_VALUE && filteredCostCenters.length === 0 && (
                                                      <div className="p-2 text-xs text-muted-foreground text-center italic">No cost centers associated with the selected business line.</div>
                                                )}
                                                 {/* Initial state message */}
                                                 {(!selectedBusinessLineId || selectedBusinessLineId === NONE_VALUE) && (
                                                     <div className="p-2 text-xs text-muted-foreground text-center italic">Select a Business Line to see available Cost Centers.</div>
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
                            {isSubmitting ? 'Saving...' : (formType === 'add' ? 'Add Entry' : 'Update Entry')}
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
