import Link from 'next/link';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { Reveal } from '@/components/motion/Reveal';

export const metadata = {
  title: 'Privacy Policy — Doshhmukti',
  description: 'How Doshhmukti collects, uses, and protects your personal data.',
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = 'August 26, 2026';

const SECTIONS = [
  { id: 'scope', title: '1. Scope of This Policy' },
  { id: 'collect', title: '2. Information We Collect' },
  { id: 'use', title: '3. How We Use Your Information' },
  { id: 'cookies', title: '4. Cookies & Tracking' },
  { id: 'sharing', title: '5. Who We Share Data With' },
  { id: 'payments', title: '6. Payment Data' },
  { id: 'retention', title: '7. Data Retention' },
  { id: 'security', title: '8. Security' },
  { id: 'rights', title: '9. Your Rights' },
  { id: 'transfer', title: '10. Cross-Border Data Transfer' },
  { id: 'children', title: '11. Children’s Privacy' },
  { id: 'thirdparty', title: '12. Third-Party Links' },
  { id: 'changes', title: '13. Changes to This Policy' },
  { id: 'grievance', title: '14. Grievance Officer' },
  { id: 'contact', title: '15. Contact Us' },
];

export default function PrivacyPage() {
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
            Privacy Policy
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
              This Privacy Policy explains how Digital Kalakaar Videos Private Limited, trading as Doshhmukti
              (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, shares, and protects
              information when you visit doshhmukti.com or place an order (together, the &ldquo;Site&rdquo;). We
              built the Site on a guest-checkout model — you never need to create an account or hand us a password
              to buy something — and this policy is written around that fact.
            </p>

            <Section id="scope" title="1. Scope of This Policy">
              <p>
                This policy applies to the Doshhmukti storefront and checkout flow. It does not apply to
                third-party sites linked from the Site (see Section 12), or to our internal admin systems, which
                are not customer-facing.
              </p>
            </Section>

            <Section id="collect" title="2. Information We Collect">
              <p>We collect information in three ways:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-[#2B1B0C]">Information you give us at checkout</strong> — name, phone
                  number, email, shipping address, and pincode, so we can fulfil and communicate about your order.
                </li>
                <li>
                  <strong className="text-[#2B1B0C]">Information collected automatically</strong> — a randomly
                  generated session identifier (stored in your browser) that links your cart to your device, plus
                  standard technical data such as IP address, browser type, device type, and pages viewed, via
                  Firebase Analytics where enabled.
                </li>
                <li>
                  <strong className="text-[#2B1B0C]">Information from order fulfilment</strong> — order status,
                  delivery tracking, and any communication you send us (WhatsApp, email, contact form) regarding
                  an order.
                </li>
              </ul>
              <p>
                We do not require you to create an account, and we do not collect or store payment card numbers,
                UPI IDs, or net-banking credentials — see Section 6.
              </p>
            </Section>

            <Section id="use" title="3. How We Use Your Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Process, pack, and ship your order.</li>
                <li>Send order confirmations, shipping updates, and delivery notifications by email/WhatsApp.</li>
                <li>Respond to support requests and process returns/refunds.</li>
                <li>Check serviceability of your pincode before you pay.</li>
                <li>Detect and prevent fraud, abuse, or checkout errors.</li>
                <li>Understand aggregate Site usage to improve product listings and performance (analytics).</li>
                <li>Send promotional updates via WhatsApp/email, only if you opted in (e.g. newsletter signup) — you can opt out at any time.</li>
              </ul>
              <p>We do not sell your personal data to third parties.</p>
            </Section>

            <Section id="cookies" title="4. Cookies & Tracking">
              <p>
                We use a small number of cookies/local storage entries: a session identifier that scopes your
                cart, and (where enabled) Firebase Analytics cookies that help us understand traffic and usage
                patterns in aggregate. These are not used to build advertising profiles. You can block cookies in
                your browser settings, though the cart and checkout flow require the session identifier to
                function.
              </p>
            </Section>

            <Section id="sharing" title="5. Who We Share Data With">
              <p>
                We share the minimum data necessary with the following categories of service providers, solely to
                deliver your order:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-[#2B1B0C]">Razorpay</strong> — payment processing (Section 6).</li>
                <li><strong className="text-[#2B1B0C]">Delhivery</strong> (or another courier partner) — your name, address, and phone number, to deliver your order.</li>
                <li><strong className="text-[#2B1B0C]">Resend</strong> — transactional email delivery (order confirmations, shipping updates).</li>
                <li><strong className="text-[#2B1B0C]">Google Cloud Platform</strong> — infrastructure hosting for our servers and database; Firebase Analytics for aggregate usage data.</li>
              </ul>
              <p>
                Each of these providers is contractually restricted to using your data only to perform the service
                we&rsquo;ve engaged them for. We may also disclose information where required by law, court order,
                or to protect the rights, safety, or property of Doshhmukti or others.
              </p>
            </Section>

            <Section id="payments" title="6. Payment Data">
              <p>
                All payments are processed directly by Razorpay, a PCI-DSS compliant payment gateway. Your card,
                UPI, or net-banking details are entered directly into Razorpay&rsquo;s secure interface and never
                pass through or get stored on Doshhmukti&rsquo;s servers. We only receive a payment confirmation
                and a reference ID from Razorpay to reconcile your order.
              </p>
            </Section>

            <Section id="retention" title="7. Data Retention">
              <p>
                We retain order data (name, address, order history) for as long as needed to fulfil legal,
                accounting, and tax obligations under Indian law, and to handle any post-delivery returns,
                warranty, or dispute matters — typically up to 7 years for financial records. Session identifiers
                for abandoned/anonymous carts are purged automatically after a limited period of inactivity.
              </p>
            </Section>

            <Section id="security" title="8. Security">
              <p>
                We use industry-standard safeguards to protect your data: encrypted connections (HTTPS/TLS)
                across the Site, restricted internal access to order data (JWT-authenticated admin access only),
                and no storage of payment credentials on our systems. No online system is 100% secure, and we
                cannot guarantee absolute security, but we take reasonable technical and organizational measures
                to protect your information against unauthorized access, alteration, or loss.
              </p>
            </Section>

            <Section id="rights" title="9. Your Rights">
              <p>
                Under the Digital Personal Data Protection Act, 2023 and applicable Indian law, you have the
                right to:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Request a copy of the personal data we hold about you.</li>
                <li>Request correction of inaccurate or incomplete data.</li>
                <li>Request deletion of your data, subject to our legal/accounting retention obligations.</li>
                <li>Withdraw consent for marketing communications at any time.</li>
                <li>Lodge a grievance with our Grievance Officer (Section 14) or the relevant data protection authority.</li>
              </ul>
              <p>
                To exercise any of these rights, email us at{' '}
                <a href="mailto:support@doshhmukti.com" className="text-[#9C5A26] font-semibold hover:underline">
                  support@doshhmukti.com
                </a>{' '}
                with your order number for verification. We will respond within 30 days.
              </p>
            </Section>

            <Section id="transfer" title="10. Cross-Border Data Transfer">
              <p>
                Our infrastructure runs on Google Cloud Platform, which may process data in data centres located
                outside India. Where this occurs, we rely on our providers&rsquo; standard contractual and
                security safeguards to protect your data to a standard consistent with Indian law.
              </p>
            </Section>

            <Section id="children" title="11. Children’s Privacy">
              <p>
                The Site is not directed at children under 18. We do not knowingly collect personal data from
                children. If you believe a child has provided us with personal data, contact us and we will
                delete it.
              </p>
            </Section>

            <Section id="thirdparty" title="12. Third-Party Links">
              <p>
                The Site may link to third-party sites (e.g. Instagram, YouTube, WhatsApp). We are not responsible
                for the privacy practices of these third parties — review their own policies before sharing
                information with them.
              </p>
            </Section>

            <Section id="changes" title="13. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices or legal
                requirements. The &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent
                revision. Continued use of the Site after an update constitutes acceptance of the revised policy.
              </p>
            </Section>

            <Section id="grievance" title="14. Grievance Officer">
              <p>
                In accordance with the Information Technology Act, 2000, the Digital Personal Data Protection
                Act, 2023, and applicable rules, the details of our Grievance Officer are provided below:
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

            <Section id="contact" title="15. Contact Us">
              <p>Questions about this Privacy Policy or your data can be sent to:</p>
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
                <br />
                See also our{' '}
                <Link href="/terms" className="text-[#9C5A26] font-semibold hover:underline">
                  Terms &amp; Conditions
                </Link>
                .
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
