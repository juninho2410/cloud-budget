
"use client";

import type { CostCenter, BusinessLine } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import type { FormEvent } from 'react';


const costCenterSchema = z.object({
    name: z.string().min(1, 'Cost center name cannot be empty'),
    business_line_id: z.string().nullable().optional(), // Stored as string from select, can be null
});

const NONE_VALUE = "__NONE__"; // Special value for representing null in Select

interface CostCenterFormProps {
    initialData?: CostCenter | null;
    businessLines: BusinessLine[];
    onSubmit: (formData: FormData) => Promise<{ success: boolean; message: string }>;
    onCancel?: () => void;
    submitButtonText?: string;
}

export function CostCenterForm({
    initialData,
    businessLines,
    onSubmit,
    onCancel,
    submitButtonText = initialData ? 'Update Cost Center' : 'Add Cost Center'
}: CostCenterFormProps) {
    const { toast } = useToast();
    const form = useForm<z.infer<typeof costCenterSchema>>({
        resolver: zodResolver(costCenterSchema),
        defaultValues: {
            name: initialData?.name || '',
            business_line_id: initialData?.business_line_id ? String(initialData.business_line_id) : null,
        },
    });

    const { formState, handleSubmit, control, reset } = form;
    const { isSubmitting } = formState;


    const handleFormSubmit = async (data: z.infer<typeof costCenterSchema>) => {
        const formData = new FormData();
        formData.append('name', data.name);
        if (data.business_line_id) {
           formData.append('business_line_id', data.business_line_id);
        }

        const result = await onSubmit(formData);

        toast({
            title: result.success ? 'Success' : 'Error',
            description: result.message,
            variant: result.success ? 'default' : 'destructive',
        });

         if (result.success) {
            reset({ name: '', business_line_id: null }); // Reset form
            onCancel?.(); // Close dialog/modal if needed
        }
    };


    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cost Center Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., R&D Team" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                 <FormField
                    control={control}
                    name="business_line_id"
                    render={({ field }) => (
                         <FormItem>
                             <FormLabel>Business Line (Optional)</FormLabel>
                             <Select
                                onValueChange={(value) => field.onChange(value === NONE_VALUE ? null : value)}
                                value={field.value ?? NONE_VALUE}
                             >
                                <FormControl>
                                    <SelectTrigger>
                                         <SelectValue placeholder="Assign to Business Line" />
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

                 <div className="flex justify-end space-x-2">
                   {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                   )}
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : submitButtonText}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

