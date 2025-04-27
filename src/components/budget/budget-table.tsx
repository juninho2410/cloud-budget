"use client";

import type { Budget, BusinessLine, CostCenter } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { deleteBudgetEntry } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/confirm-dialog';
import * as React from "react";

interface BudgetTableProps {
    budgets: Budget[];
}

export function BudgetTable({ budgets }: BudgetTableProps) {
     const { toast } = useToast();
     const router = useRouter();

     const handleDelete = async (id: number) => {
         const result = await deleteBudgetEntry(id);
         toast({
             title: result.success ? 'Success' : 'Error',
             description: result.message,
             variant: result.success ? 'default' : 'destructive',
         });
          if (result.success) {
             // Optionally refresh the page data or handle state update
             router.refresh();
         }
     };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Business Line</TableHead>
                    <TableHead>Cost Center</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {budgets.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center">No budget entries found.</TableCell>
                    </TableRow>
                )}
                {budgets.map((budget) => (
                    <TableRow key={budget.id}>
                        <TableCell className="font-medium">{budget.description}</TableCell>
                        <TableCell>{formatCurrency(budget.amount)}</TableCell>
                        <TableCell>{`${budget.month}/${budget.year}`}</TableCell>
                        <TableCell>
                             <Badge variant={budget.type === 'CAPEX' ? 'secondary' : 'outline'}>
                                 {budget.type}
                             </Badge>
                        </TableCell>
                        <TableCell>{budget.business_line_name || '-'}</TableCell>
                        <TableCell>{budget.cost_center_name || '-'}</TableCell>
                        <TableCell className="text-right space-x-2">
                             <Link href={`/budgets/${budget.id}/edit`} passHref>
                                 <Button variant="ghost" size="icon" aria-label="Edit Budget">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                             </Link>
                             <ConfirmDialog
                                trigger={
                                    <Button variant="ghost" size="icon" aria-label="Delete Budget" className="text-destructive hover:text-destructive/80">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                }
                                title="Are you sure?"
                                description={`This action cannot be undone. This will permanently delete the budget entry: "${budget.description}".`}
                                confirmText="Delete"
                                onConfirm={() => handleDelete(budget.id)}
                                confirmVariant='destructive'
                             />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
