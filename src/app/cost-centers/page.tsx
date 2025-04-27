
import { getCostCentersSimple, getBusinessLines, addCostCenter } from '@/app/actions';
import { CostCenterForm } from '@/components/cost-centers/cost-center-form';
import { CostCenterList } from '@/components/cost-centers/cost-center-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default async function CostCentersPage() {
    // Fetch simple cost centers for the list and all business lines for the form
    const [costCenters, businessLines] = await Promise.all([
        getCostCentersSimple(), // Use the simpler fetch for the main list
        getBusinessLines(),
    ]);

    return (
        <div className="container mx-auto py-6 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Add New Cost Center</CardTitle>
                    <CardDescription>
                        Create a new cost center. You can associate it with Business Lines later.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    {/* Form no longer needs businessLines prop */}
                    <CostCenterForm
                        onSubmit={addCostCenter}
                    />
                </CardContent>
            </Card>

            <Separator />

            {/* Pass simple cost centers and all business lines (for edit dialog inside list) */}
            <CostCenterList costCenters={costCenters} businessLines={businessLines} />
        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request
