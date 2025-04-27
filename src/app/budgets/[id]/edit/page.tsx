
import { getBusinessLines, getCostCentersWithBusinessLines, getBudgetById, updateBudgetEntry } from '@/app/actions'; // Fetch CostCentersWithBusinessLines
import { BudgetForm } from '@/components/budget/budget-form';
import { notFound } from 'next/navigation';

interface EditBudgetPageProps {
    params: {
        id: string;
    };
}

export default async function EditBudgetPage({ params }: EditBudgetPageProps) {
    const budgetId = parseInt(params.id, 10);
    if (isNaN(budgetId)) {
        notFound(); // Invalid ID format
    }

    const [budget, businessLines, costCenters] = await Promise.all([
        getBudgetById(budgetId),
        getBusinessLines(),
        getCostCentersWithBusinessLines(), // Use the action that fetches associations
    ]);

    // If getBudgetById returns null (meaning not found or error), trigger 404
    if (!budget) {
        notFound();
    }

    // Server action needs to accept ID as first arg
    // Bind the ID to the updateBudgetEntry action
    const updateActionWithId = updateBudgetEntry.bind(null, budgetId);


    return (
         <div className="container mx-auto py-6">
             <BudgetForm
                initialData={budget}
                businessLines={businessLines}
                costCenters={costCenters} // Pass the CostCentersWithBusinessLines
                onSubmit={updateActionWithId} // Pass the bound action
                formType="edit"
            />
        </div>
    );
}

// Use dynamic rendering to ensure data is fresh on each request
// and handles cases where the budget might be deleted between requests.
export const dynamic = 'force-dynamic';
