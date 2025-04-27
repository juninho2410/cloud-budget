
"use client";

import * as React from 'react';
import type { CostCenterWithBusinessLines, BusinessLine } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface CostCenterAssociationManagerProps {
    costCentersWithLines: CostCenterWithBusinessLines[];
    allBusinessLines: BusinessLine[];
    onSaveAssociations: (costCenterId: number, businessLineIds: number[]) => Promise<{ success: boolean; message: string }>;
}

export function CostCenterAssociationManager({
    costCentersWithLines,
    allBusinessLines,
    onSaveAssociations
}: CostCenterAssociationManagerProps) {
    const { toast } = useToast();
    const [selectedCostCenterId, setSelectedCostCenterId] = React.useState<string>(''); // Store ID as string from Select
    const [associatedBusinessLineIds, setAssociatedBusinessLineIds] = React.useState<Set<number>>(new Set());
    const [isSaving, setIsSaving] = React.useState(false);

    const selectedCostCenter = React.useMemo(() => {
        return costCentersWithLines.find(cc => cc.id === parseInt(selectedCostCenterId, 10));
    }, [selectedCostCenterId, costCentersWithLines]);

    // Update the checkbox states when the selected cost center changes
    React.useEffect(() => {
        if (selectedCostCenter) {
            const initialIds = new Set(selectedCostCenter.businessLines.map(bl => bl.id));
            setAssociatedBusinessLineIds(initialIds);
        } else {
            setAssociatedBusinessLineIds(new Set()); // Clear if no cost center is selected
        }
    }, [selectedCostCenter]);

    const handleCheckboxChange = (businessLineId: number, checked: boolean | 'indeterminate') => {
         if (typeof checked !== 'boolean') return; // Should not happen with standard checkbox

        setAssociatedBusinessLineIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(businessLineId);
            } else {
                newSet.delete(businessLineId);
            }
            return newSet;
        });
    };

    const handleSave = async () => {
        if (!selectedCostCenterId) {
            toast({ title: 'Error', description: 'Please select a Cost Center.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        const ccId = parseInt(selectedCostCenterId, 10);
        const blIds = Array.from(associatedBusinessLineIds);

        const result = await onSaveAssociations(ccId, blIds);

        toast({
            title: result.success ? 'Success' : 'Error',
            description: result.message,
            variant: result.success ? 'default' : 'destructive',
        });
        setIsSaving(false);
        // No router.refresh() needed here as revalidation is handled by the action
    };

    return (
        <div className="space-y-4">
             {/* Cost Center Selector */}
            <div>
                <Label htmlFor="cost-center-select">Select Cost Center</Label>
                <Select value={selectedCostCenterId} onValueChange={setSelectedCostCenterId}>
                    <SelectTrigger id="cost-center-select">
                        <SelectValue placeholder="Select a Cost Center..." />
                    </SelectTrigger>
                    <SelectContent>
                        {costCentersWithLines.length === 0 && <SelectItem value="-" disabled>No Cost Centers available</SelectItem>}
                        {costCentersWithLines.map(cc => (
                            <SelectItem key={cc.id} value={String(cc.id)}>
                                {cc.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Separator />

            {/* Business Line Checkbox List (Conditional Rendering) */}
             {selectedCostCenterId && (
                <Card>
                    <CardHeader>
                         <CardTitle>Associate Business Lines with "{selectedCostCenter?.name}"</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {allBusinessLines.length === 0 ? (
                            <p className="text-muted-foreground">No Business Lines found. Please add some first.</p>
                        ) : (
                            <ScrollArea className="h-72 w-full rounded-md border p-4">
                                <div className="space-y-2">
                                    {allBusinessLines.map(bl => (
                                        <div key={bl.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`bl-${bl.id}`}
                                                checked={associatedBusinessLineIds.has(bl.id)}
                                                onCheckedChange={(checked) => handleCheckboxChange(bl.id, checked)}
                                            />
                                            <Label htmlFor={`bl-${bl.id}`} className="cursor-pointer">
                                                {bl.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                             </ScrollArea>
                        )}
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleSave} disabled={isSaving || allBusinessLines.length === 0}>
                            {isSaving ? 'Saving...' : 'Save Associations'}
                        </Button>
                    </CardFooter>
                 </Card>
             )}
             {!selectedCostCenterId && (
                 <p className="text-muted-foreground p-4 text-center">Select a Cost Center above to manage its associations.</p>
             )}
        </div>
    );
}
