import Link from 'next/link';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { Reveal } from '@/components/motion/Reveal';

export const metadata = {
  title: 'Terms & Conditions — Doshhmukti',
  description: 'Terms and conditions governing your use of the Doshhmukti website and purchase of products.',
  alternates: { canonical: '/terms' },
};

const LAST_UPDATED = 'August 26, 2026';

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'eligibility', title: '2. Eligibility & Guest Checkout' },
  { id: 'products', title: '3. Products & Descriptions' },
  { id: 'pricing', title: '4. Pricing & Availability' },
  { id: 'orders', title: '5. Order Placement & Acceptance' },
  { id: 'payments', title: '6. Payments' },
  { id: 'shipping', title: '7. Shipping & Delivery' },
  { id: 'cancellation', title: '8. Cancellation' },
  { id: 'returns', title: '9. Returns, Exchanges & Refunds' },
  { id: 'ip', title: '10. Intellectual Property' },
  { id: 'conduct', title: '11. User Conduct & Prohibited Use' },
  { id: 'disclaimer', title: '12. Nature of Products & Disclaimer' },
  { id: 'liability', title: '13. Limitation of Liability' },
  { id: 'indemnity', title: '14. Indemnity' },
  { id: 'force-majeure', title: '15. Force Majeure' },
  { id: 'privacy-ref', title: '16. Privacy' },
  { id: 'law', title: '17. Governing Law & Jurisdiction' },
  { id: 'grievance', title: '18. Grievance Officer' },
  { id: 'changes', title: '19. Changes to These Terms' },
  { id: 'contact', title: '20. Contact Us' },
];

export default function TermsPage() {
  return (
    <>
      <section className="relative bg-[#2B1B0C] overflow-hidden py-14 sm:py-20">
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(156,90,38,0.22), transparent 55%)' }}
        />
        <MandalaMotif className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 text-[#C9863F]/[0.06]" />

        <Reveal className="relative max-w-2xl mx-auto px-6 text-center">
          <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-3">
            Legal
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#E6D3AE] leading-[1.05] mb-4">
            Terms &amp; Conditions
          </h1>
          <p className="font-body text-sm text-[#B8A98A]">Last updated: {LAST_UPDATED}</p>
        </Reveal>
      </section>

      <section className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">
          {/* TOC */}
          <nav className="hidden lg:block sticky top-24 self-start">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-3">
              On This Page
            </p>
            <ul className="space-y-2 border-l border-[#2B1B0C]/10 pl-4">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="font-body text-xs text-[#6B5539] hover:text-[#9C5A26] transition-colors leading-relaxed"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Body */}
          <article className="max-w-3xl font-body text-sm text-[#6B5539] leading-relaxed space-y-10">
            <p>
              These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the website
              located at doshhmukti.com (the &ldquo;Site&rdquo;) and any purchase of products made through it,
              operated by Digital Kalakaar Videos Private Limited, trading as Doshhmukti (&ldquo;Doshhmukti&rdquo;,
              &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By browsing the Site or placing an order, you
              (&ldquo;you&rdquo;, &ldquo;user&rdquo;, &ldquo;customer&rdquo;) agree to be bound by these Terms. If
              you do not agree, do not use the Site.
            </p>

            <Section id="acceptance" title="1. Acceptance of Terms">
              <p>
                Using the Site in any way — browsing, creating a cart, placing an order, contacting support —
                constitutes acceptance of these Terms and our{' '}
                <Link href="/privacy" className="text-[#9C5A26] font-semibold hover:underline">
                  Privacy Policy
                </Link>
                , which is incorporated here by reference. We may update these Terms at any time; continued use
                after an update constitutes acceptance of the revised Terms.
              </p>
            </Section>

            <Section id="eligibility" title="2. Eligibility & Guest Checkout">
              <p>
                You must be at least 18 years old, or using the Site under the supervision of a parent/legal
                guardian, to place an order. The Site currently supports guest checkout only — no account or
                login is required to purchase. A session identifier is stored in your browser to associate your
                cart with your device; it does not identify you personally.
              </p>
            </Section>

            <Section id="products" title="3. Products & Descriptions">
              <p>
                We make reasonable efforts to display product images, descriptions, materials, and specifications
                accurately. Rudraksha, gemstones, malas, and other natural or handcrafted items may show minor
                variation in size, colour, texture, or grain from the images shown, as they are natural or
                hand-finished products, not machine-uniform goods. Such variation is not a defect and is not
                grounds for return unless the product received is materially different from, or damaged relative
                to, what was ordered.
              </p>
            </Section>

            <Section id="pricing" title="4. Pricing & Availability">
              <p>
                All prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated
                otherwise. Shipping charges (₹99, waived on orders above ₹999) are shown separately at checkout
                before payment. We reserve the right to change prices, discontinue products, or correct pricing
                errors at any time without prior notice. If a pricing error is discovered after you place an
                order, we will contact you before shipping — you may cancel for a full refund or proceed at the
                corrected price.
              </p>
              <p>
                Product availability is not guaranteed until an order is confirmed and payment is captured. In
                the rare case of a stock discrepancy after payment, we will refund the affected item in full.
              </p>
            </Section>

            <Section id="orders" title="5. Order Placement & Acceptance">
              <p>
                Placing an order is an offer to purchase, not an automatic acceptance by us. An order is
                considered accepted only once payment is successfully captured and you receive an order
                confirmation with an order number. We reserve the right to refuse or cancel any order — including
                for suspected fraud, pricing errors, or stock unavailability — with a full refund of any amount
                already charged.
              </p>
            </Section>

            <Section id="payments" title="6. Payments">
              <p>
                Payments are processed by Razorpay, a third-party PCI-DSS compliant payment gateway. We do not
                store your card, UPI, or net-banking credentials on our servers. By paying on the Site you also
                agree to Razorpay&rsquo;s applicable terms. All payments must clear before an order is processed;
                orders left unpaid past the checkout hold window are automatically released.
              </p>
            </Section>

            <Section id="shipping" title="7. Shipping & Delivery">
              <p>
                Orders are shipped via Delhivery or another courier partner to serviceable pincodes shown at
                checkout. Estimated delivery timelines are indicative, not guaranteed, and may be affected by
                courier delays, weather, regional restrictions, or force majeure events (see Section 15). Risk of
                loss and title to products pass to you on delivery. You can track your order at any time using
                your order number at{' '}
                <Link href="/track" className="text-[#9C5A26] font-semibold hover:underline">
                  doshhmukti.com/track
                </Link>
                .
              </p>
            </Section>

            <Section id="cancellation" title="8. Cancellation">
              <p>
                You may cancel an order free of charge any time before it is marked &ldquo;Packed&rdquo;. Once an
                order has shipped, it cannot be cancelled — you may instead initiate a return once delivered,
                subject to Section 9. To cancel, contact us via WhatsApp or email with your order number.
              </p>
            </Section>

            <Section id="returns" title="9. Returns, Exchanges & Refunds">
              <p>
                We offer a 7-day return window from the date of delivery for eligible products. To be eligible,
                an item must be unused, in its original packaging, and accompanied by proof of purchase (order
                number). The following are not eligible for return: items reported as used or altered, energized
                items that have been worn/handled beyond inspection, and items damaged after delivery due to
                misuse.
              </p>
              <p>
                To initiate a return, contact us via WhatsApp or email within 7 days of delivery with your order
                number and reason. Once we receive and inspect the returned item, we will notify you of approval
                or rejection. Approved refunds are issued to the original payment method within 5–7 business
                days. Return shipping costs are borne by the customer unless the return is due to our error
                (wrong item shipped, damaged/defective on arrival), in which case we cover return shipping and,
                where applicable, arrange a reverse pickup.
              </p>
            </Section>

            <Section id="ip" title="10. Intellectual Property">
              <p>
                All content on the Site — text, graphics, logos, product photography, and design — is the
                property of Doshhmukti or its licensors and is protected under Indian copyright and trademark
                law. You may not reproduce, distribute, or create derivative works from Site content without our
                prior written consent.
              </p>
            </Section>

            <Section id="conduct" title="11. User Conduct & Prohibited Use">
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Use the Site for any unlawful purpose or in violation of these Terms.</li>
                <li>Attempt to gain unauthorized access to the Site, its systems, or other users&rsquo; data.</li>
                <li>Place fraudulent orders or use stolen payment credentials.</li>
                <li>Interfere with the Site&rsquo;s operation, including via bots, scraping, or denial-of-service activity.</li>
                <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
              </ul>
              <p>
                We reserve the right to refuse service, cancel orders, or block access from any device or IP
                address engaged in prohibited use.
              </p>
            </Section>

            <Section id="disclaimer" title="12. Nature of Products & Disclaimer">
              <p>
                Doshhmukti sells spiritual, devotional, and lifestyle products — rings, bracelets, crystals,
                rudraksha, and pooja accessories. These products are sold as items of devotional, cultural, or
                decorative significance. We do not claim, and no representation on this Site should be taken to
                claim, that any product cures, treats, or prevents any medical, psychological, or physical
                condition, or guarantees any specific life outcome (financial, romantic, professional, or
                otherwise). Any benefit described is rooted in traditional belief and personal experience, not
                medical or scientific claim. Products are not a substitute for professional medical, legal, or
                financial advice.
              </p>
            </Section>

            <Section id="liability" title="13. Limitation of Liability">
              <p>
                To the maximum extent permitted by law, Doshhmukti&rsquo;s total liability arising out of or
                relating to your use of the Site or any product purchased shall not exceed the amount you paid
                for the order giving rise to the claim. We are not liable for any indirect, incidental,
                consequential, or punitive damages, including loss of profits, data, or goodwill, arising from
                use of the Site or products, even if advised of the possibility of such damages. Nothing in these
                Terms limits liability that cannot be limited under applicable Indian law, including the Consumer
                Protection Act, 2019.
              </p>
            </Section>

            <Section id="indemnity" title="14. Indemnity">
              <p>
                You agree to indemnify and hold Doshhmukti, its officers, employees, and partners harmless from
                any claim, liability, loss, or expense (including reasonable legal fees) arising from your breach
                of these Terms or misuse of the Site.
              </p>
            </Section>

            <Section id="force-majeure" title="15. Force Majeure">
              <p>
                We are not liable for any delay or failure to perform resulting from causes beyond our reasonable
                control, including natural disasters, government action, courier network disruption, strikes, or
                internet/infrastructure outages.
              </p>
            </Section>

            <Section id="privacy-ref" title="16. Privacy">
              <p>
                Your use of the Site is also governed by our{' '}
                <Link href="/privacy" className="text-[#9C5A26] font-semibold hover:underline">
                  Privacy Policy
                </Link>
                , which explains what data we collect and how it is used.
              </p>
            </Section>

            <Section id="law" title="17. Governing Law & Jurisdiction">
              <p>
                These Terms are governed by the laws of India. Any dispute arising from these Terms or your use of
                the Site shall be subject to the exclusive jurisdiction of the courts located in India, and
                nothing here excludes any rights you have as a consumer under the Consumer Protection Act, 2019
                and the Consumer Protection (E-Commerce) Rules, 2020, including the right to approach the
                appropriate consumer forum or the National Consumer Helpline.
              </p>
            </Section>

            <Section id="grievance" title="18. Grievance Officer">
              <p>
                In accordance with the Information Technology Act, 2000, and the Consumer Protection
                (E-Commerce) Rules, 2020, the details of our Grievance Officer are provided below. If you have any
                complaint regarding the Site or a transaction, you may contact:
              </p>
              <p>
                <strong className="text-[#2B1B0C]">Grievance Officer:</strong> [Name to be designated]
                <br />
                <strong className="text-[#2B1B0C]">Email:</strong> support@doshhmukti.com
                <br />
                <strong className="text-[#2B1B0C]">Response time:</strong> Acknowledgement within 48 hours,
                resolution within 30 days.
              </p>
            </Section>

            <Section id="changes" title="19. Changes to These Terms">
              <p>
                We may revise these Terms from time to time. The &ldquo;Last updated&rdquo; date at the top of
                this page reflects the most recent revision. Material changes will be reflected here; we
                encourage you to review this page periodically.
              </p>
            </Section>

            <Section id="contact" title="20. Contact Us">
              <p>Questions about these Terms can be sent to:</p>
              <p>
                <strong className="text-[#2B1B0C]">Digital Kalakaar Videos Private Limited</strong> (Doshhmukti)
                <br />
                Email:{' '}
                <a href="mailto:support@doshhmukti.com" className="text-[#9C5A26] font-semibold hover:underline">
                  support@doshhmukti.com
                </a>
                <br />
                WhatsApp / Contact form:{' '}
                <Link href="/contact" className="text-[#9C5A26] font-semibold hover:underline">
                  doshhmukti.com/contact
                </Link>
              </p>
            </Section>
          </article>
        </div>
      </section>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24">
      <h2 className="font-heading font-bold text-lg sm:text-xl text-[#2B1B0C] mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
