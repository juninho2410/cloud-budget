"use client";

import * as React from 'react';
import type { BusinessLine } from '@/types';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteBusinessLine, updateBusinessLine } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { BusinessLineForm } from './business-line-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';


interface BusinessLineListProps {
  businessLines: BusinessLine[];
}

export function BusinessLineList({ businessLines }: BusinessLineListProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [editingLine, setEditingLine] = React.useState<BusinessLine | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const handleDelete = async (id: number, name: string) => {
    const result = await deleteBusinessLine(id);
    toast({
      title: result.success ? 'Success' : 'Error',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
     if (result.success) {
       router.refresh(); // Refresh data on the page
    }
  };

   const handleEdit = (line: BusinessLine) => {
        setEditingLine(line);
        setIsEditDialogOpen(true);
    };

   const handleUpdateSubmit = async (formData: FormData) => {
        if (!editingLine) return { success: false, message: 'No business line selected for editing.' };
        const result = await updateBusinessLine(editingLine.id, formData);
        if (result.success) {
            setIsEditDialogOpen(false); // Close dialog on successful update
             setEditingLine(null);
             router.refresh(); // Refresh data
        }
        return result; // Return result for the form to handle toast
    };


  return (
     <Card>
         <CardHeader>
             <CardTitle>Manage Business Lines</CardTitle>
             <CardDescription>Edit or delete existing business lines.</CardDescription>
         </CardHeader>
         <CardContent>
            {businessLines.length === 0 ? (
                 <p className="text-muted-foreground">No business lines found. Add one above.</p>
            ) : (
                <ul className="space-y-2">
                    {businessLines.map((line) => (
                        <li key={line.id} className="flex items-center justify-between p-2 border rounded-md">
                            <span className="font-medium">{line.name}</span>
                            <div className="space-x-2">
                                <Button variant="ghost" size="icon" aria-label="Edit Business Line" onClick={() => handleEdit(line)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <ConfirmDialog
                                    trigger={
                                        <Button variant="ghost" size="icon" aria-label="Delete Business Line" className="text-destructive hover:text-destructive/80">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    }
                                    title="Are you sure?"
                                    description={`This action cannot be undone. This will permanently delete the business line "${line.name}" and potentially affect associated Cost Centers and Budgets.`}
                                    confirmText="Delete"
                                    onConfirm={() => handleDelete(line.id, line.name)}
                                    confirmVariant='destructive'
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Business Line</DialogTitle>
                    </DialogHeader>
                    {editingLine && (
                        <BusinessLineForm
                            initialData={editingLine}
                            onSubmit={handleUpdateSubmit}
                            onCancel={() => setIsEditDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
         </CardContent>
     </Card>
  );
}
