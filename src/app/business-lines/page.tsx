import { getBusinessLines, addBusinessLine } from '@/app/actions';
import { BusinessLineForm } from '@/components/business-lines/business-line-form';
import { BusinessLineList } from '@/components/business-lines/business-line-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default async function BusinessLinesPage() {
    const businessLines = await getBusinessLines();

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Add New Business Line</CardTitle>
                     <CardDescription>Create a new category for your budget entries.</CardDescription>
                </CardHeader>
                <CardContent>
                     <BusinessLineForm onSubmit={addBusinessLine} />
                </CardContent>
            </Card>

            <Separator />

            <BusinessLineList businessLines={businessLines} />
        </div>
    );
}

export const dynamic = 'force-dynamic'; // Ensure data is fetched on every request
