
"use client";

import * as React from 'react';
import type { CostCenter, BusinessLine } from '@/types'; // Import basic types
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteCostCenter, updateCostCenter } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CostCenterForm } from './cost-center-form'; // Form is simpler now
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge'; // Keep Badge if needed elsewhere, but not for CC list items

interface CostCenterListProps {
  costCenters: CostCenter[]; // Expecting the simple list
  businessLines: BusinessLine[]; // Still needed for the edit form (though form doesn't use it directly)
}

export function CostCenterList({ costCenters, businessLines }: CostCenterListProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [editingCenter, setEditingCenter] = React.useState<CostCenter | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const handleDelete = async (id: number, name: string) => {
    const result = await deleteCostCenter(id);
    toast({
      title: result.success ? 'Success' : 'Error',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
     if (result.success) {
       router.refresh();
    }
  };

   const handleEdit = (center: CostCenter) => {
        setEditingCenter(center);
        setIsEditDialogOpen(true);
    };

   const handleUpdateSubmit = async (formData: FormData) => {
        if (!editingCenter) return { success: false, message: 'No cost center selected for editing.' };
        // updateCostCenter action now only takes id and formData (name)
        const result = await updateCostCenter(editingCenter.id, formData);
        if (result.success) {
            setIsEditDialogOpen(false);
             setEditingCenter(null);
             router.refresh();
        }
        // Toast is handled within the form now
        return result;
    };

   // Function to close the dialog and reset editing state
    const handleCloseDialog = () => {
        setIsEditDialogOpen(false);
        setEditingCenter(null);
    };

  return (
     <Card>
         <CardHeader>
             <CardTitle>Manage Cost Centers</CardTitle>
             <CardDescription>Edit or delete existing cost centers. Associations are managed separately.</CardDescription>
         </CardHeader>
         <CardContent>
             {costCenters.length === 0 ? (
                 <p className="text-muted-foreground">No cost centers found. Add one above.</p>
            ) : (
                 <ul className="space-y-2">
                    {costCenters.map((center) => (
                        <li key={center.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50 transition-colors">
                             <div>
                                <span className="font-medium">{center.name}</span>
                                {/* Badge for Business Line Name removed as it's not directly linked here */}
                            </div>
                            <div className="space-x-1">
                                 <Button variant="ghost" size="icon" aria-label="Edit Cost Center Name" onClick={() => handleEdit(center)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <ConfirmDialog
                                    trigger={
                                        <Button variant="ghost" size="icon" aria-label="Delete Cost Center" className="text-destructive hover:text-destructive/80">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    }
                                    title={`Delete "${center.name}"?`}
                                    description={`This action cannot be undone. This will permanently delete the cost center "${center.name}", remove all its associations with business lines, and potentially affect associated Budgets (setting their cost center to null).`}
                                    confirmText="Delete"
                                    onConfirm={() => handleDelete(center.id, center.name)}
                                    confirmVariant='destructive'
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
             {/* Edit Dialog - Only for Name */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Cost Center Name</DialogTitle>
                         <DialogDescription>Update the name for this cost center.</DialogDescription>
                    </DialogHeader>
                    {editingCenter && (
                        <CostCenterForm
                            initialData={editingCenter}
                            // businessLines prop no longer needed by the form itself
                            onSubmit={handleUpdateSubmit}
                            onCancel={handleCloseDialog}
                            submitButtonText="Update Name"
                        />
                    )}
                </DialogContent>
            </Dialog>
         </CardContent>
     </Card>

  );
}
