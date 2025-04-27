"use client";

import type { BusinessLine } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import type { FormEvent } from 'react';

const businessLineSchema = z.object({
  name: z.string().min(1, 'Business line name cannot be empty'),
});

interface BusinessLineFormProps {
  initialData?: BusinessLine | null;
  onSubmit: (formData: FormData) => Promise<{ success: boolean; message: string }>;
  onCancel?: () => void; // Optional cancel handler
  submitButtonText?: string;
}

export function BusinessLineForm({
  initialData,
  onSubmit,
  onCancel,
  submitButtonText = initialData ? 'Update Business Line' : 'Add Business Line'
}: BusinessLineFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof businessLineSchema>>({
    resolver: zodResolver(businessLineSchema),
    defaultValues: {
      name: initialData?.name || '',
    },
  });

  const { formState, handleSubmit, control, reset } = form;
  const { isSubmitting } = formState;

  const handleFormSubmit = async (data: z.infer<typeof businessLineSchema>) => {
    const formData = new FormData();
    formData.append('name', data.name);

    const result = await onSubmit(formData);

    toast({
      title: result.success ? 'Success' : 'Error',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });

    if (result.success) {
        reset({ name: '' }); // Reset form on success
        onCancel?.(); // Call cancel handler which might close a modal/dialog
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
              <FormLabel>Business Line Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Marketing" {...field} />
              </FormControl>
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
