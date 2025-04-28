
import { UploadForm } from '@/components/upload/upload-form';

export default function UploadPage() {
    // Optional: Add metadata for the page title
    // export const metadata = { title: 'Upload Budget & Expense Data' };

    return (
        <div className="container mx-auto py-6">
            <UploadForm />
        </div>
    );
}
