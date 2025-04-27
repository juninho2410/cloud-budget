import { getCostCenters, getBusinessLines, addCostCenter } from '@/app/actions';
import { CostCenterForm } from '@/components/cost-centers/cost-center-form';
import { CostCenterList } from '@/components/cost-centers/cost-center-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default async function CostCentersPage() {
    const [costCenters, businessLines] = await Promise.all([
        getCostCenters(),
        getBusinessLines(),
    ]);

    return (
        <div className="container mx-auto py-6 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Add New Cost Center</CardTitle>
                    <CardDescription>Create a new cost center and optionally assign it to a business line.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <CostCenterForm
                        businessLines={businessLines}
                        onSubmit={addCostCenter}
                    />
                </CardContent>
            </Card>

            <Separator />

            <CostCenterList costCenters={costCenters} businessLines={businessLines} />
        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request
