
"use client";

import type { CostCenter } from '@/types'; // Import basic CostCenter type
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react'; // Import useEffect

// Schema only needs name now
const costCenterSchema = z.object({
    name: z.string().min(1, 'Cost center name cannot be empty'),
    // business_line_id removed
});

interface CostCenterFormProps {
    initialData?: CostCenter | null; // Use basic CostCenter type
    onSubmit: (formData: FormData) => Promise<{ success: boolean; message: string }>;
    onCancel?: () => void;
    submitButtonText?: string;
    // businessLines prop removed
}

export function CostCenterForm({
    initialData,
    onSubmit,
    onCancel,
    submitButtonText = initialData ? 'Update Cost Center' : 'Add Cost Center'
}: CostCenterFormProps) {
    const { toast } = useToast();
    const form = useForm<z.infer<typeof costCenterSchema>>({
        resolver: zodResolver(costCenterSchema),
        defaultValues: {
            name: initialData?.name || '',
            // business_line_id removed
        },
    });

    const { formState, handleSubmit, control, reset } = form;
    const { isSubmitting } = formState;

    // Reset form when initialData changes (for edit dialog)
    useEffect(() => {
        reset({ name: initialData?.name || '' });
    }, [initialData, reset]);


    const handleFormSubmit = async (data: z.infer<typeof costCenterSchema>) => {
        const formData = new FormData();
        formData.append('name', data.name);
        // No business_line_id to append

        const result = await onSubmit(formData);

        toast({
            title: result.success ? 'Success' : 'Error',
            description: result.message,
            variant: result.success ? 'default' : 'destructive',
        });

         if (result.success) {
            // Reset form on successful add, call cancel for edit/dialog close
            if (!initialData) {
              reset({ name: '' });
            }
            onCancel?.();
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

                 {/* Business Line Select Field Removed */}

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
