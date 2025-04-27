
import { getCostCentersWithBusinessLines, getBusinessLines, setCostCenterAssociations } from '@/app/actions';
import { CostCenterAssociationManager } from '@/components/cost-centers/cost-center-association-manager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function CostCenterAssociationsPage() {
    const [costCentersWithLines, allBusinessLines] = await Promise.all([
        getCostCentersWithBusinessLines(),
        getBusinessLines(),
    ]);

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Manage Cost Center - Business Line Associations</CardTitle>
                    <CardDescription>
                        Select a Cost Center to view and modify its associated Business Lines.
                        Budgets are linked directly to one Cost Center and one Business Line. This page manages the relationships between Cost Centers and Business Lines themselves.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CostCenterAssociationManager
                        costCentersWithLines={costCentersWithLines}
                        allBusinessLines={allBusinessLines}
                        onSaveAssociations={setCostCenterAssociations} // Pass the server action
                    />
                </CardContent>
            </Card>
        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request
