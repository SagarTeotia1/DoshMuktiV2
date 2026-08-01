'use client';

import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Topbar } from '@/components/layout/Topbar';
import { ProductForm, type ProductFormValues } from '@/components/products/ProductForm';
import { VariantsPanel } from '@/components/products/VariantsPanel';
import { ImageUploader } from '@/components/products/ImageUploader';
import { useProduct, useUpdateProduct } from '@/hooks/use-products';
import { ApiError } from '@/lib/api-client';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading } = useProduct(id);
  const updateProduct = useUpdateProduct(id);

  function handleSubmit(values: ProductFormValues) {
    updateProduct.mutate(
      { ...values, badge: values.badge || null, careInstructions: values.careInstructions || null, socialProofText: values.socialProofText || null },
      {
        onSuccess: () => toast.success('Product updated'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update product'),
      }
    );
  }

  if (isLoading || !product) {
    return (
      <>
        <Topbar title="Edit Product" />
        <div className="p-6 text-sm text-slate-400">Loading...</div>
      </>
    );
  }

  return (
    <>
      <Topbar title={product.name} />
      <div className="p-6 flex flex-col gap-6 max-w-2xl">
        <ImageUploader product={product} />
        <ProductForm defaultValues={product} onSubmit={handleSubmit} submitLabel="Save Changes" submitting={updateProduct.isPending} />
        <VariantsPanel product={product} />
      </div>
    </>
  );
}
