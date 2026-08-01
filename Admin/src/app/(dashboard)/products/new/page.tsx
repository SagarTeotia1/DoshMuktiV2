'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Topbar } from '@/components/layout/Topbar';
import { ProductForm, type ProductFormValues } from '@/components/products/ProductForm';
import { useCreateProduct } from '@/hooks/use-products';
import { ApiError } from '@/lib/api-client';

export default function NewProductPage() {
  const router = useRouter();
  const createProduct = useCreateProduct();

  function handleSubmit(values: ProductFormValues) {
    createProduct.mutate(
      { ...values, badge: values.badge || null, careInstructions: values.careInstructions || null, socialProofText: values.socialProofText || null },
      {
        onSuccess: (product) => {
          toast.success('Product created');
          router.push(`/products/${product.id}`);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to create product'),
      }
    );
  }

  return (
    <>
      <Topbar title="New Product" />
      <div className="p-6">
        <ProductForm onSubmit={handleSubmit} submitLabel="Create Product" submitting={createProduct.isPending} />
      </div>
    </>
  );
}
