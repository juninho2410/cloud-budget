
"use client";

import type { Expense } from '@/types'; // Use Expense type
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
import { deleteExpenseEntry } from '@/app/actions'; // Use deleteExpenseEntry action
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/confirm-dialog';
import * as React from "react";

interface ExpenseTableProps {
    expenses: Expense[]; // Expect an array of Expense objects
}

export function ExpenseTable({ expenses }: ExpenseTableProps) {
     const { toast } = useToast();
     const router = useRouter();

     const handleDelete = async (id: number) => {
         const result = await deleteExpenseEntry(id); // Call deleteExpenseEntry
         toast({
             title: result.success ? 'Success' : 'Error',
             description: result.message,
             variant: result.success ? 'default' : 'destructive',
         });
          if (result.success) {
             router.refresh();
         }
     };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        // Add overflow-x-auto for smaller screens if table is wide
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Business Line</TableHead>
                        <TableHead>Cost Center</TableHead>
                        <TableHead className="text-right min-w-[100px]">Actions</TableHead> {/* Added min-width */}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {expenses.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                No expense entries found matching your filters.
                            </TableCell>
                        </TableRow>
                    )}
                    {expenses.map((expense) => ( // Iterate over expenses
                        <TableRow key={expense.id}>
                            <TableCell className="font-medium">{expense.description}</TableCell>
                            <TableCell>{formatCurrency(expense.amount)}</TableCell>
                            <TableCell>{`${String(expense.month).padStart(2, '0')}/${expense.year}`}</TableCell>
                            <TableCell>
                                 <Badge variant={expense.type === 'CAPEX' ? 'secondary' : 'outline'}>
                                     {expense.type}
                                 </Badge>
                            </TableCell>
                             {/* Use fallback for potentially null names */}
                            <TableCell>{expense.business_line_name || <span className="text-xs text-muted-foreground italic">N/A</span>}</TableCell>
                            <TableCell>{expense.cost_center_name || <span className="text-xs text-muted-foreground italic">N/A</span>}</TableCell>
                            <TableCell className="text-right space-x-1">
                                 {/* Edit Button - Link to expense edit page */}
                                 <Link href={`/expenses/${expense.id}/edit`} passHref>
                                     <Button variant="ghost" size="icon" aria-label={`Edit expense entry ${expense.description}`}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                 </Link>
                                 {/* Delete Button with Confirmation */}
                                 <ConfirmDialog
                                    trigger={
                                        <Button variant="ghost" size="icon" aria-label={`Delete expense entry ${expense.description}`} className="text-destructive hover:text-destructive/80">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    }
                                    title="Are you sure?"
                                    description={`This action cannot be undone. This will permanently delete the expense entry: "${expense.description}".`}
                                    confirmText="Delete"
                                    onConfirm={() => handleDelete(expense.id)}
                                    confirmVariant='destructive'
                                 />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

