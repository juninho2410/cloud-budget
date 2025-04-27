"use client";

import * as React from 'react';
import type { CostCenter, BusinessLine } from '@/types';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteCostCenter, updateCostCenter } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CostCenterForm } from './cost-center-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CostCenterListProps {
  costCenters: CostCenter[];
  businessLines: BusinessLine[]; // Needed for the edit form
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
        const result = await updateCostCenter(editingCenter.id, formData);
        if (result.success) {
            setIsEditDialogOpen(false);
             setEditingCenter(null);
             router.refresh();
        }
        return result;
    };

  return (
     <Card>
         <CardHeader>
             <CardTitle>Manage Cost Centers</CardTitle>
             <CardDescription>Edit or delete existing cost centers.</CardDescription>
         </CardHeader>
         <CardContent>
             {costCenters.length === 0 ? (
                 <p className="text-muted-foreground">No cost centers found. Add one above.</p>
            ) : (
                 <ul className="space-y-2">
                    {costCenters.map((center) => (
                        <li key={center.id} className="flex items-center justify-between p-2 border rounded-md">
                             <div>
                                <span className="font-medium">{center.name}</span>
                                {center.business_line_name && (
                                     <Badge variant="outline" className="ml-2">{center.business_line_name}</Badge>
                                )}
                            </div>
                            <div className="space-x-2">
                                 <Button variant="ghost" size="icon" aria-label="Edit Cost Center" onClick={() => handleEdit(center)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <ConfirmDialog
                                    trigger={
                                        <Button variant="ghost" size="icon" aria-label="Delete Cost Center" className="text-destructive hover:text-destructive/80">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    }
                                    title="Are you sure?"
                                    description={`This action cannot be undone. This will permanently delete the cost center "${center.name}" and potentially affect associated Budgets.`}
                                    confirmText="Delete"
                                    onConfirm={() => handleDelete(center.id, center.name)}
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
                        <DialogTitle>Edit Cost Center</DialogTitle>
                    </DialogHeader>
                    {editingCenter && (
                        <CostCenterForm
                            initialData={editingCenter}
                            businessLines={businessLines}
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
