"use client";

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { uploadSpreadsheet } from '@/app/actions';
import { Upload } from 'lucide-react';


export function UploadForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for the file input

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const file = formData.get('spreadsheet') as File;

    if (!file || file.size === 0) {
        toast({
            title: 'Error',
            description: 'Please select a spreadsheet file to upload.',
            variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
    }

    // Basic client-side validation for file type (optional but good UX)
     if (!file.name.endsWith('.xlsx')) {
         toast({
             title: 'Invalid File Type',
             description: 'Please upload a valid Excel file (.xlsx).',
             variant: 'destructive',
         });
         setIsSubmitting(false);
         return;
     }


    const result = await uploadSpreadsheet(formData);

    toast({
      title: result.success ? 'Upload Successful' : 'Upload Failed',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
       duration: result.success ? 5000 : 10000, // Show errors longer
    });

    // Reset the file input if upload was successful
     if (result.success && fileInputRef.current) {
         fileInputRef.current.value = ''; // Clear the selected file
     }


    setIsSubmitting(false);
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Upload Budget Spreadsheet</CardTitle>
        <CardDescription>
          Upload an Excel (.xlsx) file with budget data. Ensure columns match expected format:
          Description, Amount, Year, Month, Type (CAPEX/OPEX), Business Line (Optional), Cost Center (Optional).
           Lookup columns (Business Line, Cost Center) are case-insensitive.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="spreadsheet">Spreadsheet File (.xlsx)</Label>
            <Input id="spreadsheet" name="spreadsheet" type="file" accept=".xlsx" ref={fileInputRef} required disabled={isSubmitting} />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            <Upload className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Uploading...' : 'Upload and Process'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
