import { TrackForm } from './track-form';

export const metadata = {
  title: 'Track Your Order — Doshhmukti',
  description: 'Enter your order number to see your Doshhmukti order status and estimated delivery.',
  alternates: { canonical: '/track' },
};

export default function TrackLandingPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
      <h1 className="font-heading font-black tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-3">
        Track Your Order
      </h1>
      <p className="font-body text-sm text-[#6B5539] mb-8">
        Enter the order number from your confirmation message to see its status and estimated delivery.
      </p>
      <TrackForm />
    </div>
  );
}
