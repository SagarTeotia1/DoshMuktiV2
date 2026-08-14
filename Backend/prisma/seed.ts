// Dummy catalog seed — replaces whatever products currently exist with the
// real Doshhmukti product list (names/categories from the client's sheet).
// Images are intentionally empty; product photos are being sourced separately.
import { PrismaClient } from '@prisma/client';
import { redis } from '../src/shared/cache/client';

const db = new PrismaClient();

interface SeedProduct {
  name: string;
  category: string;
  price: number;
  purpose: string[];
  description: string;
  badge?: string;
  featured?: boolean;
  tags?: string[];
  cashbackPercent?: number;
  compareAtPrice?: number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()*/]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Verified real jewelry photography (checked by hand — actual bracelets/rings, not
// random stock) for the two categories where a genuine visual match exists. Two per
// category so the card can hover-swap to a second angle. Every other category has no
// honest stock-photo equivalent (there's no stock photo of a "Money Magnet Turtle" or
// "Ghoda ki Naal"), so those fall back to a neutral Picsum placeholder pair instead of
// a photo that would misrepresent the actual product.
const CATEGORY_PHOTOS: Record<string, [string, string]> = {
  Bracelets: [
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a',
    'https://images.unsplash.com/photo-1573408301185-9146fe634ad0',
  ],
  'Pyrite Items': [
    'https://images.unsplash.com/photo-1608042314453-ae338d80c427',
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e',
  ],
};

function photoSet(url: string) {
  return {
    thumb: `${url}?w=160&h=160&fit=crop`,
    card: `${url}?w=600&h=750&fit=crop`,
    full: `${url}?w=1200&h=1500&fit=crop`,
  };
}

function placeholderImages(slug: string, category: string) {
  const curated = CATEGORY_PHOTOS[category];
  if (curated) return [photoSet(curated[0]), photoSet(curated[1])];

  return [
    {
      thumb: `https://picsum.photos/seed/${slug}/160/160`,
      card: `https://picsum.photos/seed/${slug}/600/750`,
      full: `https://picsum.photos/seed/${slug}/1200/1500`,
    },
    {
      thumb: `https://picsum.photos/seed/${slug}-2/160/160`,
      card: `https://picsum.photos/seed/${slug}-2/600/750`,
      full: `https://picsum.photos/seed/${slug}-2/1200/1500`,
    },
  ];
}

const PRODUCTS: SeedProduct[] = [
  // ─── Dhoop Sticks ─────────────────────────────────────────────────────────
  {
    name: 'Vrindavan Dhoop Sticks (20 ml)',
    category: 'Dhoop Sticks',
    price: 129,
    purpose: ['clarity'],
    description:
      'Hand-rolled dhoop sticks infused with a traditional Vrindavan fragrance blend. Light one daily to clear stagnant energy and settle your space into a calm, sacred mood.',
  },
  {
    name: 'Vrindavan Dhoop Sticks (Small)',
    category: 'Dhoop Sticks',
    price: 89,
    purpose: ['clarity'],
    description: 'A travel-friendly pack of the classic Vrindavan dhoop blend — perfect for daily puja or a quick moment of stillness.',
  },
  {
    name: 'Jagannath Dhoop Sticks',
    category: 'Dhoop Sticks',
    price: 99,
    purpose: ['clarity', 'protection'],
    description: 'Temple-style dhoop dedicated to Lord Jagannath, carrying deep devotional fragrance notes for your prayer space.',
  },
  {
    name: 'Bajrinath Dhoop Sticks',
    category: 'Dhoop Sticks',
    price: 99,
    purpose: ['clarity', 'protection'],
    description: 'A grounding, resin-rich dhoop blend inspired by the Bajrinath tradition — burns slow and steady through extended meditation sessions.',
  },

  // ─── Dosh Mukti Special ───────────────────────────────────────────────────
  {
    name: 'Rakshapati (Silver) – Shubh Rakshapati',
    category: 'Dosh Mukti Special',
    price: 1499,
    purpose: ['protection', 'gifting'],
    description:
      "A silver Rakshapati pendant crafted for protection rituals — worn to ward off negative energy and safeguard the wearer through life's transitions.",
    badge: 'Bestseller',
    featured: true,
    tags: ['Premium Pick'],
    cashbackPercent: 10,
  },
  {
    name: 'Digvijay Havan Powder',
    category: 'Dosh Mukti Special',
    price: 199,
    purpose: ['protection', 'clarity'],
    description: 'A fine ceremonial havan powder blended for Digvijay fire rituals, used to purify spaces and dissolve accumulated negativity.',
    featured: true,
  },
  {
    name: 'Durbhagya Nashak Nariyal',
    category: 'Dosh Mukti Special',
    price: 249,
    purpose: ['protection'],
    description: 'A ritually prepared coconut intended to counter durbhagya (misfortune) — used in traditional nazar-removal ceremonies at home.',
  },
  {
    name: 'Ghoda ki Naal',
    category: 'Dosh Mukti Special',
    price: 349,
    purpose: ['protection', 'wealth'],
    description: 'An authentic horseshoe (ghoda ki naal), long regarded as a symbol of protection and good fortune when placed at the entrance of a home.',
    featured: true,
  },
  {
    name: 'Vastu Tree (Pyrite, Rose Quartz, Seven Chakras)',
    category: 'Dosh Mukti Special',
    price: 799,
    purpose: ['wealth', 'love', 'clarity', 'gifting'],
    description: 'A handcrafted Vastu tree combining Pyrite, Rose Quartz and Seven Chakra stones — a multi-purpose energy piece for home or workspace.',
    featured: true,
    tags: ['Trending', 'GenZ Favorite'],
    cashbackPercent: 15,
  },
  {
    name: 'Vahan Suraksha Kavach',
    category: 'Dosh Mukti Special',
    price: 399,
    purpose: ['protection'],
    description: 'A protective kavach designed to be placed in your vehicle, invoked for safe travel and accident protection on the road.',
  },
  {
    name: 'Dhan Santulan Sikka',
    category: 'Dosh Mukti Special',
    price: 299,
    purpose: ['wealth'],
    description: 'A balancing coin (Dhan Santulan Sikka) kept in the cash box or wallet to steady the flow of income and curb impulsive financial loss.',
  },
  {
    name: 'Money Magnet Turtle',
    category: 'Dosh Mukti Special',
    price: 599,
    purpose: ['wealth', 'gifting'],
    description: 'A classic Feng Shui money turtle, placed near the entrance or workspace to attract steady wealth and career stability.',
    badge: 'Bestseller',
    featured: true,
    tags: ['100% Cashback in Wallet', 'Bestseller'],
    cashbackPercent: 100,
  },

  // ─── Rudraksha / Kada ─────────────────────────────────────────────────────
  {
    name: '5 Mukhi Kada (Golden)',
    category: 'Rudraksha / Kada',
    price: 899,
    purpose: ['protection'],
    description: 'A gold-toned 5 Mukhi kada strung with authentic rudraksha beads — worn on the wrist for daily protection and calm focus.',
    featured: true,
  },
  {
    name: '5 Mukhi Kada (Copper / Tamba)',
    category: 'Rudraksha / Kada',
    price: 599,
    purpose: ['protection'],
    description: 'A copper (tamba) 5 Mukhi kada, valued in tradition for its grounding, protective qualities.',
  },
  {
    name: '3 Mukhi Rudraksha',
    category: 'Rudraksha / Kada',
    price: 399,
    purpose: ['clarity', 'success'],
    description: 'A single 3 Mukhi rudraksha bead, associated with confidence, willpower and release from past-life karma.',
  },
  {
    name: '4 Mukhi Rudraksha',
    category: 'Rudraksha / Kada',
    price: 449,
    purpose: ['clarity'],
    description: 'A single 4 Mukhi rudraksha bead, traditionally worn to sharpen memory, focus and creative expression.',
  },
  {
    name: '5 Mukhi Rudraksha',
    category: 'Rudraksha / Kada',
    price: 299,
    purpose: ['health', 'clarity'],
    description: 'The most widely worn rudraksha — 5 Mukhi is associated with balance, wellbeing and everyday protection.',
    featured: true,
    tags: ['Most Loved'],
    cashbackPercent: 20,
  },
  {
    name: '6 Mukhi Rudraksha',
    category: 'Rudraksha / Kada',
    price: 549,
    purpose: ['success', 'love'],
    description: 'A single 6 Mukhi rudraksha bead, linked in tradition to determination, relationships and steady success.',
  },
  {
    name: '7 Mukhi Rudraksha',
    category: 'Rudraksha / Kada',
    price: 699,
    purpose: ['wealth'],
    description: 'A single 7 Mukhi rudraksha bead, worn for stability in wealth and protection from sudden financial setbacks.',
    featured: true,
  },
  {
    name: '5 Mukhi German Silver Pendant',
    category: 'Rudraksha / Kada',
    price: 699,
    purpose: ['protection', 'clarity'],
    description: 'A 5 Mukhi rudraksha bead set in a German silver pendant frame — everyday protection with a refined finish.',
  },
  {
    name: '5 Mukhi Mala (with Shankh)',
    category: 'Rudraksha / Kada',
    price: 1299,
    purpose: ['clarity', 'protection', 'gifting'],
    description: 'A full 5 Mukhi rudraksha mala interspersed with shankh (conch) beads, used for japa meditation and daily wear.',
  },
  {
    name: '5 Mukhi Mala (Normal)',
    category: 'Rudraksha / Kada',
    price: 999,
    purpose: ['clarity'],
    description: 'A traditional 108-bead 5 Mukhi rudraksha mala for meditation, chanting and everyday grounding.',
  },
  {
    name: '5 Mukhi Rudraksha Bracelet',
    category: 'Rudraksha / Kada',
    price: 499,
    purpose: ['clarity', 'health'],
    description: 'A wrist-friendly bracelet of 5 Mukhi rudraksha beads — a lighter, everyday way to carry its calming influence.',
  },

  // ─── Bracelets ────────────────────────────────────────────────────────────
  {
    name: 'Tiger Eye Bracelet',
    category: 'Bracelets',
    price: 449,
    purpose: ['protection', 'success'],
    description: 'A Tiger Eye crystal bracelet believed to sharpen focus and shield the wearer from negative intent.',
    tags: ['Trending'],
    featured: true,
  },
  {
    name: 'Green Aventurine Bracelet',
    category: 'Bracelets',
    price: 399,
    purpose: ['health', 'wealth'],
    description: 'Known as the "stone of opportunity," Green Aventurine is worn for calm confidence and steady luck.',
  },
  {
    name: 'Citrine Bracelet',
    category: 'Bracelets',
    price: 449,
    purpose: ['wealth', 'success'],
    description: 'A Citrine crystal bracelet associated with abundance, optimism and creative success.',
  },
  {
    name: 'Raw Pyrite Bracelet',
    category: 'Bracelets',
    price: 399,
    purpose: ['wealth'],
    description: "Raw, unpolished Pyrite beads strung for those who want the stone's wealth-drawing energy in its natural form.",
  },
  {
    name: 'Money Magnet Bracelet',
    category: 'Bracelets',
    price: 499,
    purpose: ['wealth'],
    description: 'A curated multi-stone bracelet designed specifically to support financial abundance and career growth.',
  },
  {
    name: 'Tulsi Bracelet',
    category: 'Bracelets',
    price: 299,
    purpose: ['clarity', 'protection'],
    description: 'A sacred Tulsi wood bracelet, traditionally worn for spiritual protection and a calm, devotional mind.',
  },
  {
    name: 'Rose Quartz Bracelet',
    category: 'Bracelets',
    price: 399,
    purpose: ['love', 'gifting'],
    description: 'The stone of unconditional love — Rose Quartz is worn to open the heart and deepen compassion in relationships.',
    featured: true,
    tags: ['GenZ Favorite'],
    cashbackPercent: 10,
  },
  {
    name: 'Golden Pyrite Bracelet',
    category: 'Bracelets',
    price: 449,
    purpose: ['wealth'],
    description: 'Polished golden Pyrite beads, worn to attract prosperity and protect against energetic drain.',
  },
  {
    name: 'Lapis Bracelet',
    category: 'Bracelets',
    price: 449,
    purpose: ['clarity'],
    description: 'A deep-blue Lapis Lazuli bracelet associated with inner truth, intuition and mental clarity.',
  },
  {
    name: 'Amethyst Bracelet',
    category: 'Bracelets',
    price: 399,
    purpose: ['clarity', 'health'],
    description: 'An Amethyst crystal bracelet worn for calm, clarity and protection from restless, anxious energy.',
  },
  {
    name: 'Kranguli Bracelet',
    category: 'Bracelets',
    price: 399,
    purpose: ['protection'],
    description: 'A traditional protective bracelet, worn as a daily shield against negative energy and evil eye.',
  },
  {
    name: 'Mix Bracelet',
    category: 'Bracelets',
    price: 449,
    purpose: ['wealth', 'love', 'health', 'gifting'],
    description: 'A multi-stone bracelet combining several healing crystals for a balanced, all-round energy boost.',
  },

  // ─── Pyrite Items ─────────────────────────────────────────────────────────
  {
    name: 'Pyrite Anklet',
    category: 'Pyrite Items',
    price: 599,
    purpose: ['wealth', 'protection'],
    description: 'A Pyrite bead anklet worn for grounding, protection and a steady pull toward abundance.',
  },
  {
    name: 'Pyrite Turtle',
    category: 'Pyrite Items',
    price: 499,
    purpose: ['wealth'],
    description: 'A carved Pyrite turtle figurine — a Vastu favorite for slow, steady wealth accumulation.',
    tags: ['Wealth Pick'],
    cashbackPercent: 15,
    featured: true,
  },
  {
    name: 'Pyrite Ring',
    category: 'Pyrite Items',
    price: 399,
    purpose: ['wealth', 'success'],
    description: 'A Pyrite crystal ring worn on the working hand to support confidence, focus and financial decision-making.',
  },

  // ─── Attar ────────────────────────────────────────────────────────────────
  {
    name: 'Attar (25 ml)',
    category: 'Attar',
    price: 349,
    purpose: ['love', 'clarity', 'gifting'],
    description: 'A traditionally distilled attar in a 25 ml bottle — an alcohol-free natural fragrance worn for its calming, uplifting effect.',
    tags: ['New'],
    featured: true,
  },
];

// Dummy trust-building reviews — orderId is a plain string (no FK on Review.orderId),
// so these don't need real Order rows. Matched to products by slug once seeded.
const DUMMY_REVIEWS: Array<{ productSlug: string; customerName: string; rating: number; title?: string; body: string }> = [
  {
    productSlug: 'money-magnet-turtle',
    customerName: 'Ananya R.',
    rating: 5,
    title: 'Actually love this on my desk',
    body: 'Ordered this for my study table and the cashback landed in my wallet within a day of delivery. Didn\'t expect that honestly, felt like a proper reward not just a gimmick.',
  },
  {
    productSlug: 'money-magnet-turtle',
    customerName: 'Kabir S.',
    rating: 4,
    title: 'Good quality, small size',
    body: 'Smaller than I imagined but the finish is solid. Packaging was neat, delivery was quick.',
  },
  {
    productSlug: 'rose-quartz-bracelet',
    customerName: 'Meher K.',
    rating: 5,
    title: 'My go-to gift now',
    body: 'Bought one for myself and one for my sister. Beads feel genuine, color is soft and pretty, not the fake glassy pink you see elsewhere.',
  },
  {
    productSlug: '5-mukhi-rudraksha',
    customerName: 'Aditya V.',
    rating: 5,
    title: 'Wear it daily',
    body: 'Been wearing this for three weeks now, feels grounding. Thread is sturdy, no fading so far.',
  },
  {
    productSlug: '5-mukhi-rudraksha',
    customerName: 'Priya N.',
    rating: 4,
    body: 'Good authentic feel to it. Wish the packaging explained the mukhi count a bit more for beginners like me.',
  },
  {
    productSlug: 'vastu-tree-pyrite-rose-quartz-seven-chakras',
    customerName: 'Rohan M.',
    rating: 5,
    title: 'Looks so premium',
    body: 'This looks way more expensive than what I paid. Placed it near my workspace, genuinely nice to look at even ignoring the energy side of things.',
  },
  {
    productSlug: 'rakshapati-silver-shubh-rakshapati',
    customerName: 'Ishita D.',
    rating: 5,
    body: 'Got this for my father, he really liked the silver finish. Fast shipping too.',
  },
  {
    productSlug: 'tiger-eye-bracelet',
    customerName: 'Yash T.',
    rating: 4,
    title: 'Solid everyday piece',
    body: 'Wear it to the gym and office both, holds up well. Would buy another color combo.',
  },
  {
    productSlug: 'pyrite-turtle',
    customerName: 'Simran A.',
    rating: 5,
    body: 'Small but well made. Sits nicely on my cash drawer at the shop.',
  },
  {
    productSlug: '5-mukhi-mala-with-shankh',
    customerName: 'Devansh P.',
    rating: 5,
    title: 'Use it for meditation every morning',
    body: 'The shankh beads add a nice texture between the rudraksha. Great for japa counting, exactly as described.',
  },
];

async function main() {
  console.log(`Seeding ${PRODUCTS.length} products (existing catalog will be replaced)...`);

  // ProductVariant/Review cascade on Product delete (see schema.prisma), so this is enough.
  await db.product.deleteMany({});

  const productIdBySlug = new Map<string, string>();

  for (const [i, p] of PRODUCTS.entries()) {
    const slug = slugify(p.name);
    // ~60% of the catalog gets a deterministic "MRP" so the sale-price/discount-tag UI has data
    // to render — real MRPs should replace these once pricing is finalized.
    const compareAtPrice = p.compareAtPrice ?? (i % 5 !== 4 ? Math.round((p.price * 1.35) / 10) * 10 : null);

    const product = await db.product.create({
      data: {
        name: p.name,
        slug,
        description: [{ type: 'text', content: p.description }],
        category: p.category,
        basePrice: p.price,
        compareAtPrice,
        images: placeholderImages(slug, p.category),
        status: 'ACTIVE',
        purpose: p.purpose,
        featured: p.featured ?? false,
        badge: p.badge ?? null,
        benefits: [],
        howToWear: [],
        tags: p.tags ?? [],
        cashbackPercent: p.cashbackPercent ?? null,
        variants: {
          create: [
            {
              sku: `${slug}-default`.toUpperCase(),
              attributes: {},
              stockQuantity: 25,
              lowStockThreshold: 5,
              weight: 100,
              isActive: true,
            },
          ],
        },
      },
    });
    productIdBySlug.set(slug, product.id);
  }

  console.log(`Seeding ${DUMMY_REVIEWS.length} dummy approved reviews...`);
  for (const [i, r] of DUMMY_REVIEWS.entries()) {
    const productId = productIdBySlug.get(r.productSlug);
    if (!productId) {
      console.warn(`Skipping review — no product with slug "${r.productSlug}"`);
      continue;
    }
    await db.review.create({
      data: {
        productId,
        orderId: `seed-order-${i}`,
        customerName: r.customerName,
        customerPhone: '9999999999',
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: 'APPROVED',
      },
    });
  }

  console.log('Clearing product caches (listing/featured/slug/categories)...');
  const productsKeys = await redis.keys('products:*');
  const productKeys = await redis.keys('product:*');
  await Promise.all([...productsKeys, ...productKeys].map((k) => redis.del(k)));

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
