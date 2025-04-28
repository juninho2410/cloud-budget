
import { getBusinessLines, getCostCentersWithBusinessLines, getExpenseById, updateExpenseEntry } from '@/app/actions';
import { ExpenseForm } from '@/components/expenses/expense-form'; // Use ExpenseForm
import { notFound } from 'next/navigation';

interface EditExpensePageProps {
    params: {
        id: string;
    };
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
    const expenseId = parseInt(params.id, 10);
    if (isNaN(expenseId)) {
        notFound(); // Invalid ID format
    }

    const [expense, businessLines, costCenters] = await Promise.all([
        getExpenseById(expenseId), // Fetch expense by ID
        getBusinessLines(),
        getCostCentersWithBusinessLines(),
    ]);

    // If getExpenseById returns null, trigger 404
    if (!expense) {
        notFound();
    }

    // Bind the ID to the updateExpenseEntry action
    const updateActionWithId = updateExpenseEntry.bind(null, expenseId);

    return (
         <div className="container mx-auto py-6">
             <ExpenseForm
                initialData={expense} // Pass expense data
                businessLines={businessLines}
                costCenters={costCenters}
                onSubmit={updateActionWithId} // Pass the bound update action
                formType="edit"
            />
        </div>
    );
}

// Use dynamic rendering
export const dynamic = 'force-dynamic';
