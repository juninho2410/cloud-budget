
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
        notFound();
    }

    const [budget, businessLines, costCenters] = await Promise.all([
        getBudgetById(budgetId),
        getBusinessLines(),
        getCostCentersWithBusinessLines(), // Use the action that fetches associations
    ]);

    if (!budget) {
        notFound();
    }

    // Server action needs to accept ID as first arg
    const updateAction = updateBudgetEntry.bind(null, budgetId);


    return (
         <div className="container mx-auto py-6">
             <BudgetForm
                initialData={budget}
                businessLines={businessLines}
                costCenters={costCenters} // Pass the CostCentersWithBusinessLines
                onSubmit={updateAction}
                formType="edit"
            />
        </div>
    );
}

export const dynamic = 'force-dynamic';
