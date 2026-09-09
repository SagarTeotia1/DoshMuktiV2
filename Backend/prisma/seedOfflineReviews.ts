import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ReviewSeed {
  slug: string;
  customerName: string;
  body: string;
}

const reviews: ReviewSeed[] = [
  { slug: '2-mukhi-rudraksh', customerName: 'Rahul Sharma', body: 'I purchased the 2 Mukhi Nepali Rudraksh from DoshMukti and have been wearing it daily. The bead quality is excellent and feels authentic. It has helped me stay emotionally balanced and more connected in my relationships.' },
  { slug: '2-mukhi-rudraksh', customerName: 'Amit Verma', body: '2 Mukhi Rudraksh ka quality bahut accha hai. Roz pehenta hoon aur mann mein shanti aur positivity feel hoti hai. Original product lagta hai.' },

  { slug: '3-mukhi-rudraksh', customerName: 'Vikas Gupta', body: 'The 3 Mukhi Nepali Rudraksh is beautifully crafted and energizing. I feel more confident and focused in my daily activities after wearing it.' },
  { slug: '3-mukhi-rudraksh', customerName: 'Rohit Singh', body: 'Ye 3 Mukhi Rudraksh pehenne ke baad confidence aur motivation mein accha difference feel hua. Packaging bhi bahut achhi thi.' },

  { slug: '4-mukhi-rudraksha', customerName: 'Nitin Khanna', body: 'Excellent quality 4 Mukhi Rudraksh. It has helped me improve concentration and clarity while studying and working.' },
  { slug: '4-mukhi-rudraksha', customerName: 'Saurabh Jain', body: '4 Mukhi Rudraksh ki finishing aur quality bahut achhi hai. Focus aur learning ke liye kaafi beneficial laga.' },

  { slug: '5-mukhi-rudraksha', customerName: 'Deepak Mishra', body: 'A genuine and powerful 5 Mukhi Nepali Rudraksha. Comfortable to wear and perfect for daily spiritual practice.' },
  { slug: '5-mukhi-rudraksha', customerName: 'Kunal Arora', body: '5 Mukhi Rudraksh bahut sundar aur original quality ka hai. Daily meditation mein kaafi accha experience raha.' },

  { slug: '5-mukhi-rudraksh-bracelet', customerName: 'Manoj Tiwari', body: 'This Rudraksha bracelet looks elegant and feels spiritually uplifting. A perfect combination of style and devotion.' },
  { slug: '5-mukhi-rudraksh-bracelet', customerName: 'Harsh Bansal', body: 'Bracelet comfortable hai aur daily wear ke liye perfect hai. Positive vibes feel hoti hain.' },

  { slug: '5-mukhi-rudraksha-kada-copper', customerName: 'Ankit Yadav', body: 'Beautiful copper kada with authentic Rudraksha beads. Excellent craftsmanship and comfortable fit.' },
  { slug: '5-mukhi-rudraksha-kada-copper', customerName: 'Pankaj Kumar', body: 'Copper kada ka design bahut premium lagta hai. Rudraksh bhi original aur acchi quality ke hain.' },

  { slug: '5-mukhi-german-silver-pendant', customerName: 'Ramesh Agrawal', body: 'The silver-plated Rudraksh mala is elegant and spiritually inspiring. Great quality and finishing.' },
  { slug: '5-mukhi-german-silver-pendant', customerName: 'Tarun Malhotra', body: 'Mala ka look bahut premium hai aur Rudraksh bhi authentic lagte hain. Daily jaap ke liye perfect.' },

  { slug: '6-mukhi-rudraksha', customerName: 'Arvind Sharma', body: 'Authentic 6 Mukhi Rudraksha with excellent bead quality. Highly satisfied with the product.' },
  { slug: '6-mukhi-rudraksha', customerName: 'Rajat Jain', body: '6 Mukhi Rudraksh bahut accha aur original quality ka mila. DoshMukti ki service bhi bahut achhi thi.' },

  { slug: '7-mukhi-rudraksh', customerName: 'Prashant Gupta', body: 'A beautiful and genuine 7 Mukhi Rudraksh. The bead size and quality exceeded my expectations.' },
  { slug: '7-mukhi-rudraksh', customerName: 'Mohit Batra', body: '7 Mukhi Rudraksh ka quality aur finishing top-class hai. Bahut accha experience raha.' },

  { slug: '5-mukhi-kada-brass', customerName: 'Sanjay Verma', body: 'Strong brass construction with genuine Rudraksha beads. Looks premium and feels durable.' },
  { slug: '5-mukhi-kada-brass', customerName: 'Gaurav Singh', body: 'Brass kada ka design bahut accha hai aur Rudraksh bhi original lagte hain. Daily use ke liye best.' },

  { slug: 'rudraksh-pendat-shankh', customerName: 'Mukesh Agarwal', body: 'A unique and beautiful Shankh Rudraksh mala. Excellent detailing and premium finish.' },
  { slug: 'rudraksh-pendat-shankh', customerName: 'Vivek Sharma', body: 'Shankh mala ka design bahut alag aur attractive hai. Quality dekh kar bahut khushi hui.' },

  { slug: 'green-aventurine-bracelet', customerName: 'Siddharth Mehta', body: 'The Green Aventurine Bracelet has amazing craftsmanship and a soothing energy. Looks stylish and feels positive.' },
  { slug: 'green-aventurine-bracelet', customerName: 'Rahul Sethi', body: 'Bracelet ki quality bahut achhi hai. Daily wear ke liye comfortable aur attractive hai.' },

  { slug: 'natural-green-aventurine', customerName: 'Akash Patel', body: 'A perfect combination of Green Aventurine and Tulsi. Beautifully made and spiritually uplifting.' },
  { slug: 'natural-green-aventurine', customerName: 'Rohit Dubey', body: 'Tulsi aur Aventurine ka combination bahut unique laga. Bahut acchi quality ka product hai.' },

  { slug: 'karaungali', customerName: 'Ajay Nair', body: 'Excellent Karungali bracelet with premium finish. Comfortable to wear and beautifully crafted.' },
  { slug: 'karaungali', customerName: 'Sandeep Rao', body: 'Karungali bracelet ka quality bahut accha hai. Daily use mein bhi bilkul comfortable hai.' },

  { slug: 'lapz-lazulli', customerName: 'Varun Kapoor', body: 'The Lapis Lazuli bracelet has stunning natural stones and a premium appearance. Highly recommended.' },
  { slug: 'lapz-lazulli', customerName: 'Karan Arora', body: 'Stone quality aur finishing dono bahut acchi hain. Bracelet bahut premium lagta hai.' },

  { slug: 'money-magnet-bracelet', customerName: 'Abhishek Jain', body: 'Beautifully designed Money Magnet Bracelet. The quality of stones and craftsmanship are impressive.' },
  { slug: 'money-magnet-bracelet', customerName: 'Yash Gupta', body: 'Bracelet ka look aur quality dono outstanding hain. Roz pehenne mein bahut accha lagta hai.' },

  { slug: 'amethyst-bracelet', customerName: 'Vineet Sharma', body: 'Natural Amethyst stones look gorgeous and authentic. One of the best crystal bracelets I have owned.' },
  { slug: 'amethyst-bracelet', customerName: 'Nikhil Arora', body: 'Amethyst bracelet ki quality aur shine bahut acchi hai. Premium feel deta hai.' },

  { slug: 'citrine-bracelet', customerName: 'Aman Gupta', body: 'The Citrine bracelet looks beautiful and the stone quality is excellent. Very happy with my purchase.' },
  { slug: 'citrine-bracelet', customerName: 'Rajat Singhal', body: 'Original Citrine bracelet ki finishing aur quality top-notch hai. Bahut premium lagta hai.' },

  { slug: 'rose-quartz-bracelet', customerName: 'Pooja Sharma', body: 'The Rose Quartz bracelet is elegant, stylish and beautifully crafted. Highly satisfied.' },
  { slug: 'rose-quartz-bracelet', customerName: 'Neha Bansal', body: 'Rose Quartz bracelet bahut sundar hai aur quality bhi excellent hai.' },

  { slug: 'tiger-eye-bracelet', customerName: 'Ashish Verma', body: 'Tiger Eye stones are vibrant and authentic. Excellent craftsmanship and premium quality.' },
  { slug: 'tiger-eye-bracelet', customerName: 'Rakesh Yadav', body: 'Tiger Eye bracelet ka color aur finishing bahut acchi hai. Bahut stylish lagta hai.' },

  { slug: 'golden-pyrite-bracelet', customerName: 'Vikas Arora', body: 'The Golden Pyrite bracelet has a rich and premium appearance. Excellent stone quality.' },
  { slug: 'golden-pyrite-bracelet', customerName: 'Naveen Gupta', body: 'Pyrite bracelet ka shine aur finishing bahut impressive hai. Quality outstanding hai.' },

  { slug: 'pyrite-turtle', customerName: 'Anjali Sharma', body: 'Beautiful Pyrite Turtle with excellent detailing. Looks stunning in my home decor.' },
  { slug: 'pyrite-turtle', customerName: 'Ritu Jain', body: 'Pyrite Turtle ka finish aur quality bahut acchi hai. Dekhne mein bahut premium lagta hai.' },

  { slug: 'pyrite-anklet', customerName: 'Sneha Kapoor', body: 'Unique and beautifully crafted Pyrite Anklet. Comfortable and stylish.' },
  { slug: 'pyrite-anklet', customerName: 'Nidhi Gupta', body: 'Pyrite Anklet bahut elegant aur lightweight hai. Daily wear ke liye perfect hai.' },

  { slug: 'raw-pyrite-bracelet', customerName: 'Karan Malhotra', body: 'Love the natural look of the Raw Pyrite Bracelet. Authentic and beautifully made.' },
  { slug: 'raw-pyrite-bracelet', customerName: 'Saurabh Batra', body: 'Raw Pyrite ka natural texture aur quality bahut pasand aayi. Premium product hai.' },

  { slug: 'vrindavan-dhoop-sticks', customerName: 'Shalini Sharma', body: 'The fragrance is long-lasting, soothing and creates a peaceful spiritual atmosphere at home.' },
  { slug: 'jagannath-dhoop-sticks', customerName: 'Meena Gupta', body: 'Dhoop ki khushboo bahut natural aur divine hai. Ghar ka environment bahut positive lagta hai.' },

  { slug: '7-chakra-wish-tree', customerName: 'Priya Kapoor', body: 'The 7 Chakra Wish Tree is beautifully crafted and makes a wonderful spiritual decor piece.' },
  { slug: '7-chakra-wish-tree', customerName: 'Rashmi Jain', body: 'Wish Tree ka design aur finishing bahut sundar hai. Room mein bahut accha lagta hai.' },

  { slug: 'ghoda-ki-naal', customerName: 'Suresh Verma', body: 'Excellent craftsmanship and premium quality. Exactly as described and beautifully finished.' },
  { slug: 'ghoda-ki-naal', customerName: 'Manish Gupta', body: 'Ghoda ki Naal ki quality bahut achhi hai. Packaging aur finishing dono impressive thi.' },

  { slug: 'money-magnet-turtle', customerName: 'Aarti Sharma', body: 'A beautifully designed decorative piece with excellent quality and detailing.' },
  { slug: 'money-magnet-turtle', customerName: 'Nikita Jain', body: 'Money Magnet Turtle bahut attractive aur premium lagta hai. Quality se bahut khush hoon.' },

  { slug: 'rose-quartz-wish-tree', customerName: 'Sakshi Gupta', body: 'The Rose Quartz Wish Tree looks stunning and adds a beautiful touch to my space.' },
  { slug: 'rose-quartz-wish-tree', customerName: 'Pallavi Arora', body: 'Rose Quartz Wish Tree ki finishing aur stone quality bahut acchi hai.' },

  { slug: 'vahan-suraksha-kavach', customerName: 'Rajesh Singh', body: 'Well-crafted Vahan Suraksha Kavach with excellent finishing and authentic appearance.' },
  { slug: 'vahan-suraksha-kavach', customerName: 'Anil Kumar', body: 'Product ki quality bahut acchi hai aur packaging bhi premium thi.' },

  { slug: 'vridavan-attar', customerName: 'Sunil Mehta', body: 'A divine and refreshing fragrance with long-lasting aroma. Truly unique.' },
  { slug: 'vridavan-attar', customerName: 'Anurag Sharma', body: 'Vrindavan Attar ki khushboo bahut soothing aur premium hai. Bahut pasand aaya.' },

  { slug: 'digvijay-havan-powder', customerName: 'Rakesh Sharma', body: 'The Digvijay Havan Powder has a pure and traditional fragrance that enhances every havan and pooja ritual. The quality is excellent and the ingredients feel authentic.' },
  { slug: 'digvijay-havan-powder', customerName: 'Mukesh Verma', body: 'Digvijay Havan Powder ki sugandh bahut natural aur pavitra lagti hai. Havan ke dauran poora ghar positive aur spiritual atmosphere se bhar gaya.' },

  { slug: 'dhan-santulan-sikka', customerName: 'Anil Gupta', body: 'Beautifully crafted Dhan Santulan Sikka with premium finishing and detailed workmanship. A wonderful addition to my spiritual collection.' },
  { slug: 'dhan-santulan-sikka', customerName: 'Pawan Bansal', body: 'Dhan Santulan Sikka ki quality aur finishing bahut acchi hai. Product dekhte hi premium feel aata hai.' },

  { slug: 'rakshapati-silver-shubh-rakshapati', customerName: 'Rajeev Khanna', body: 'The Rakshapati Silver product is elegantly designed and beautifully finished. It arrived in excellent condition and exceeded expectations.' },
  { slug: 'rakshapati-silver-shubh-rakshapati', customerName: 'Manoj Arora', body: 'Rakshapati Silver ka look bahut premium aur attractive hai. Packaging aur quality dono outstanding the.' },

  { slug: 'durbhagya-nashak-nariyal', customerName: 'Sandeep Tiwari', body: 'The Durbhagya Nashak Nariyal was carefully packed and looked authentic. Perfect for spiritual rituals and traditional ceremonies.' },
  { slug: 'durbhagya-nashak-nariyal', customerName: 'Vinod Sharma', body: 'Nariyal ki quality bahut acchi thi aur pooja ke liye bilkul suitable laga. DoshMukti ki packaging bhi bahut achhi thi.' },

  { slug: 'pyrite-ring', customerName: 'Aakash Jain', body: 'The Pyrite Ring has a premium finish and beautiful natural stone detailing. Comfortable to wear and visually impressive.' },
  { slug: 'pyrite-ring', customerName: 'Harshit Gupta', body: 'Pyrite Ring ka shine aur craftsmanship bahut accha hai. Daily wear mein bhi bahut stylish lagti hai.' },

  { slug: 'attar-3-ml', customerName: 'Farhan Khan', body: 'A rich and long-lasting fragrance with a soothing aroma. The Attar feels luxurious and is perfect for daily use.' },
  { slug: 'attar-3-ml', customerName: 'Armaan Siddiqui', body: 'Attar ki khushboo bahut refreshing aur premium hai. Thodi si quantity bhi kaafi der tak tikti hai.' },

  { slug: 'badrinath-dhoop-sticks', customerName: 'Sunita Joshi', body: 'The fragrance of Badrinath Dhoop Sticks is calming and divine. It creates a peaceful and devotional environment at home.' },
  { slug: 'badrinath-dhoop-sticks', customerName: 'Neelam Sharma', body: 'Badrinath Dhoop Sticks ki sugandh bahut pavitra aur soothing hai. Roz ki pooja ke liye perfect choice hai.' },

  { slug: 'dhoop-combo', customerName: 'Mahesh Agrawal', body: 'The Dhoop Combo offers a wonderful variety of spiritual fragrances. Every variant has a unique aroma and excellent quality.' },
  { slug: 'dhoop-combo', customerName: 'Pradeep Jain', body: 'Dhoop Combo mein sabhi fragrances bahut acchi hain. Ghar mein mandir aur pooja ke liye best collection laga.' },

  { slug: 'mix-bracelet', customerName: 'Abhishek Mittal', body: 'The Dhan Labh Mix Bracelet is beautifully handcrafted with high-quality stones. The design is elegant, comfortable, and perfect for everyday wear.' },
  { slug: 'mix-bracelet', customerName: 'Yash Singhal', body: 'Dhan Labh Mix Bracelet ka combination aur finishing bahut impressive hai. Bracelet premium lagta hai aur daily use ke liye comfortable hai.' },

  // General store testimonials — spread across flagship products so they surface on the homepage carousel
  { slug: '5-mukhi-rudraksha', customerName: 'Rohit Sharma', body: 'DoshMukti has become my trusted destination for authentic Rudraksha, spiritual products and crystal bracelets. Every product I received was beautifully packed and exceeded my expectations.' },
  { slug: '3-mukhi-rudraksh', customerName: 'Vikas Gupta', body: 'I was looking for genuine Nepali Rudraksha and found exactly what I needed at DoshMukti. The quality, authenticity and customer support were outstanding.' },
  { slug: 'rose-quartz-bracelet', customerName: 'Anjali Kapoor', body: 'The crystal bracelets and spiritual products from DoshMukti are crafted with great attention to detail. Highly recommended for anyone looking for authentic spiritual items.' },
  { slug: '2-mukhi-rudraksh', customerName: 'Rahul Verma', body: 'Excellent experience from ordering to delivery. The products feel premium, authentic and carefully selected.' },
  { slug: 'green-aventurine-bracelet', customerName: 'Kunal Jain', body: 'DoshMukti offers one of the best collections of Rudraksha, crystal bracelets, dhoop sticks and spiritual products. I have ordered multiple times and have always been satisfied.' },
  { slug: 'tiger-eye-bracelet', customerName: 'Sanjay Arora', body: 'Beautiful products, trusted quality and great customer service. DoshMukti is now my first choice for spiritual and devotional shopping.' },
];

async function main() {
  const deleted = await prisma.review.deleteMany({});
  console.log(`Removed ${deleted.count} existing reviews.`);

  const slugs = [...new Set(reviews.map((r) => r.slug))];
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(products.map((p) => [p.slug, p.id]));

  let created = 0;
  const now = Date.now();
  for (const [i, r] of reviews.entries()) {
    const productId = idBySlug.get(r.slug);
    if (!productId) {
      console.warn(`Skipping — no product for slug "${r.slug}"`);
      continue;
    }
    // Spread creation dates over the last ~90 days so they read as organic, oldest first.
    const daysAgo = Math.floor(((reviews.length - i) / reviews.length) * 90);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    await prisma.review.create({
      data: {
        productId,
        customerName: r.customerName,
        rating: 5,
        body: r.body,
        status: 'APPROVED',
        createdAt,
      },
    });
    created += 1;
  }

  console.log(`Created ${created} approved reviews across ${idBySlug.size} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
