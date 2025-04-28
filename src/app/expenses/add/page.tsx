
import { getBusinessLines, getCostCentersWithBusinessLines, addExpenseEntry } from '@/app/actions';
import { ExpenseForm } from '@/components/expenses/expense-form'; // Use ExpenseForm

export default async function AddExpensePage() {
    const [businessLines, costCenters] = await Promise.all([
        getBusinessLines(),
        getCostCentersWithBusinessLines(),
    ]);

    return (
         <div className="container mx-auto py-6">
             {/* Use the ExpenseForm component */}
             <ExpenseForm
                businessLines={businessLines}
                costCenters={costCenters}
                onSubmit={addExpenseEntry} // Use the addExpenseEntry action
                formType="add"
            />
        </div>
    );
}

export const dynamic = 'force-dynamic';
