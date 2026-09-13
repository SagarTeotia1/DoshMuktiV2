// One-off seed for the 25 real customer reviews supplied for Durbhagya Nashak Nariyal.
// Review model has no `city` field (see schema.prisma) — city is dropped, matching the
// existing seedOfflineReviews.ts convention of customerName + body only.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'durbhagya-nashak-nariyal';

interface ReviewSeed {
  customerName: string;
  rating: number;
  body: string;
}

const reviews: ReviewSeed[] = [
  { customerName: 'Pooja Mehta', rating: 5, body: 'Nariyal bahut achhi aur secure packaging mein receive hua. Presentation kaafi premium lagi. Overall experience excellent raha.' },
  { customerName: 'Rajiv Sharma', rating: 5, body: 'Product safely packed tha aur bilkul proper condition mein mila. Instructions bhi easy to understand the.' },
  { customerName: 'Kavita Joshi', rating: 5, body: 'Packaging kaafi neat thi. Product dekhkar achha laga aur poora ordering experience smooth raha.' },
  { customerName: 'Manoj Agarwal', rating: 5, body: 'Parcel safely receive hua aur product ki presentation bhi impressive hai. Delivery bhi time par hui.' },
  { customerName: 'Ritu Singh', rating: 5, body: 'Very nicely packed product. Instructions clear the aur overall purchase experience kaafi positive raha.' },
  { customerName: 'Sanjay Verma', rating: 5, body: 'Product exactly expected condition mein mila. Packaging strong thi aur delivery bhi hassle-free rahi.' },
  { customerName: 'Anjali Gupta', rating: 5, body: 'Presentation aur packaging dono bahut achhe lage. Product receive karne ka overall experience really good tha.' },
  { customerName: 'Mahesh Yadav', rating: 5, body: 'Achhi packaging ke saath safely deliver hua. Product dekhne mein premium lagta hai. Overall satisfied.' },
  { customerName: 'Sneha Kapoor', rating: 5, body: 'Order karna easy tha aur parcel bhi proper condition mein mila. Packaging especially kaafi achhi lagi.' },
  { customerName: 'Vivek Mishra', rating: 5, body: 'Product neatly packed tha aur delivery bhi expected time ke andar ho gayi. Overall good experience.' },
  { customerName: 'Nisha Malhotra', rating: 5, body: 'Packaging dekhkar kaafi impressed hui. Product safely receive hua aur instructions bhi clear the.' },
  { customerName: 'Ashish Tiwari', rating: 5, body: 'Overall product presentation bahut achhi hai. Parcel secure tha aur delivery experience bhi smooth raha.' },
  { customerName: 'Shweta Jain', rating: 5, body: 'Product achhi condition mein mila. Packing kaafi secure thi aur website par order karna bhi simple tha.' },
  { customerName: 'Gaurav Saxena', rating: 5, body: 'Good quality packaging aur clean presentation. Delivery time bhi reasonable tha. Overall happy with the purchase.' },
  { customerName: 'Meena Sharma', rating: 5, body: 'Product safely receive hua aur packaging bilkul proper thi. Overall experience kaafi achha raha.' },
  { customerName: 'Rohit Joshi', rating: 5, body: 'Nariyal carefully packed tha, koi damage nahi hua. Presentation bhi achhi hai. Overall satisfied with the order.' },
  { customerName: 'Aakash Bansal', rating: 4, body: 'Packaging achhi thi aur product safe condition mein mila. Overall experience positive raha.' },
  { customerName: 'Divya Agarwal', rating: 4, body: 'Product theek condition mein receive hua. Packaging good thi aur instructions bhi understandable the.' },
  { customerName: 'Mukesh Kumar', rating: 4, body: 'Overall experience achha raha. Delivery time par hui aur product bhi properly packed tha.' },
  { customerName: 'Tanya Verma', rating: 3, body: 'Aaj hi receive hua hai. Packaging achhi hai aur product bhi theek lag raha hai. Abhi experience ke liye thoda time chahiye.' },
  { customerName: 'Ramesh Chand', rating: 3, body: 'Product safely deliver hua. Abhi recently mila hai, isliye abhi experience ke baare mein zyada kuch bolna difficult hai.' },
  { customerName: 'Akash Singh', rating: 2, body: 'Product mil gaya hai aur packaging okay thi. Abhi use/process start kiya hai, isliye abhi koi clear experience nahi hai.' },
  { customerName: 'Komal Sharma', rating: 2, body: 'Delivery thodi late hui, lekin product safe condition mein mila. Abhi result ya experience ke baare mein kuch kehna jaldi hoga.' },
  { customerName: 'Dinesh Kumar', rating: 1, body: 'Delivery mein expected se kaafi delay hua. Product safely mila hai but overall delivery experience disappointing raha.' },
  { customerName: 'Lokesh Patel', rating: 1, body: 'Order receive hone mein kaafi time laga. Packaging okay thi, lekin delivery process better aur faster hona chahiye.' },
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
