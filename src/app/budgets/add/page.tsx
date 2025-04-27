import { getBusinessLines, getCostCenters, addBudgetEntry } from '@/app/actions';
import { BudgetForm } from '@/components/budget/budget-form';

export default async function AddBudgetPage() {
    const [businessLines, costCenters] = await Promise.all([
        getBusinessLines(),
        getCostCenters(),
    ]);

    return (
         <div className="container mx-auto py-6">
             <BudgetForm
                businessLines={businessLines}
                costCenters={costCenters}
                onSubmit={addBudgetEntry}
                formType="add"
            />
        </div>
    );
}

export const dynamic = 'force-dynamic';
