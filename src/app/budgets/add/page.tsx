
import { getBusinessLines, getCostCentersWithBusinessLines, addBudgetEntry } from '@/app/actions'; // Fetch CostCentersWithBusinessLines
import { BudgetForm } from '@/components/budget/budget-form';

export default async function AddBudgetPage() {
    const [businessLines, costCenters] = await Promise.all([
        getBusinessLines(),
        getCostCentersWithBusinessLines(), // Use the action that fetches associations
    ]);

    return (
         <div className="container mx-auto py-6">
             <BudgetForm
                businessLines={businessLines}
                costCenters={costCenters} // Pass the CostCentersWithBusinessLines
                onSubmit={addBudgetEntry}
                formType="add"
            />
        </div>
    );
}

export const dynamic = 'force-dynamic';
