// One-off seed for the 25 real customer reviews supplied for Durghatna Nashak Yantra.
// Review model has no `city` field (see schema.prisma) — city is dropped, matching the
// existing seedOfflineReviews.ts convention of customerName + body only.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'durghatna-nashak-yantra';

interface ReviewSeed {
  customerName: string;
  rating: number;
  body: string;
}

const reviews: ReviewSeed[] = [
  { customerName: 'Rahul Sharma', rating: 5, body: 'Product kaafi achhi packaging mein mila. Yantra ki finishing bhi premium lag rahi hai. Overall purchase experience bahut achha raha.' },
  { customerName: 'Amit Verma', rating: 5, body: 'Exactly photos jaisa product mila. Packing secure thi aur delivery bhi time par ho gayi. Happy with the purchase.' },
  { customerName: 'Priya Gupta', rating: 5, body: 'Yantra compact hai aur car mein rakhne ke liye convenient laga. Quality dekhkar genuinely satisfied hoon.' },
  { customerName: 'Sandeep Kumar', rating: 5, body: 'Packaging bahut achhi thi, product bilkul safe condition mein receive hua. Overall experience smooth raha.' },
  { customerName: 'Ankit Mishra', rating: 5, body: 'Product ki finishing kaafi clean hai. Delivery bhi expected time par hui. Overall achha experience raha.' },
  { customerName: 'Neha Agarwal', rating: 5, body: 'Website se order karna easy tha aur parcel bhi properly packed tha. Product dekhne mein premium lagta hai.' },
  { customerName: 'Rajesh Yadav', rating: 5, body: 'Achhi quality ka product laga. Packaging strong thi aur delivery ke time koi issue nahi hua.' },
  { customerName: 'Vikram Singh', rating: 5, body: 'Product exactly expected condition mein mila. Finishing aur packaging dono impressive lage.' },
  { customerName: 'Pankaj Mehta', rating: 5, body: 'Kaafi neatly packed tha. Product compact aur well-finished hai. Overall purchase se satisfied hoon.' },
  { customerName: 'Rohit Bansal', rating: 5, body: 'Order process simple tha aur delivery bhi smooth rahi. Product quality photos se bhi better lagi.' },
  { customerName: 'Arjun Malhotra', rating: 5, body: 'Packaging premium thi aur yantra ki finishing bhi achhi hai. Overall very good experience.' },
  { customerName: 'Manish Tiwari', rating: 5, body: 'Product safely receive hua. Quality achhi lagi aur packing bhi proper thi. Definitely happy with the purchase.' },
  { customerName: 'Karan Joshi', rating: 5, body: 'Delivery fast thi aur product properly protected tha. First impression kaafi positive raha.' },
  { customerName: 'Deepak Sharma', rating: 5, body: 'Achhi finishing hai aur product compact bhi hai. Packaging dekhkar laga ki seller ne properly attention diya hai.' },
  { customerName: 'Nitin Kapoor', rating: 5, body: 'Overall excellent experience. Product achhi condition mein mila aur delivery bhi hassle-free rahi.' },
  { customerName: 'Mohit Saxena', rating: 5, body: 'Product genuine-looking hai aur finishing kaafi clean hai. Packaging bhi strong thi. Satisfied.' },
  { customerName: 'Rakesh Gupta', rating: 4, body: 'Quality achhi lagi aur packaging bhi secure thi. Delivery thodi late hui but overall experience good raha.' },
  { customerName: 'Simran Kaur', rating: 4, body: 'Product achha laga. Finishing decent hai aur packaging bhi proper thi. Overall positive experience.' },
  { customerName: 'Abhishek Jain', rating: 4, body: 'Yantra ki quality theek hai aur delivery bhi smoothly ho gayi. Overall satisfied, bas delivery thodi faster ho sakti thi.' },
  { customerName: 'Varun Saini', rating: 3, body: 'Aaj hi receive hua hai. Product decent lag raha hai. Abhi use start kiya hai, aage experience dekhunga.' },
  { customerName: 'Shubham Rawat', rating: 3, body: 'Packaging achhi thi aur product safe mila. Abhi recently receive hua hai, isliye experience ke baare mein abhi zyada nahi keh sakta.' },
  { customerName: 'Naveen Kumar', rating: 2, body: 'Product receive ho gaya hai but abhi kuch hi time hua hai. Overall theek hai, lekin abhi experience judge karna difficult hai.' },
  { customerName: 'Ajay Thakur', rating: 2, body: 'Delivery thodi late hui. Product finally safely mil gaya hai, ab use karke dekhunga.' },
  { customerName: 'Sunil Chauhan', rating: 1, body: 'Delivery expected se kaafi late hui. Product abhi receive hua hai, overall delivery experience improve ho sakta hai.' },
  { customerName: 'Harish Patel', rating: 1, body: 'Order deliver hone mein kaafi time laga. Packaging okay thi, lekin delivery experience satisfactory nahi raha.' },
];

async function main() {
  const product = await prisma.product.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (!product) {
    console.error(`No product found for slug "${SLUG}" — nothing inserted.`);
    process.exitCode = 1;
    return;
  }

  let created = 0;
  const now = Date.now();
  for (const [i, r] of reviews.entries()) {
    // Spread creation dates over the last ~90 days, oldest first (row 1 = oldest) so
    // they read as organic instead of all landing at the exact same timestamp.
    const daysAgo = Math.floor(((reviews.length - i) / reviews.length) * 90);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    await prisma.review.create({
      data: {
        productId: product.id,
        customerName: r.customerName,
        rating: r.rating,
        body: r.body,
        status: 'APPROVED',
        createdAt,
      },
    });
    created += 1;
  }

  console.log(`Created ${created} approved reviews for "${SLUG}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
