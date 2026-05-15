import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const users = [
  { id: 'pi-user-placeholder', username: 'pioneer.demo', role: 'user', sellerStatus: 'verified' },
  { id: 'seller-maha', username: 'maha.pi', role: 'user', sellerStatus: 'verified' },
  { id: 'seller-pixel', username: 'pixelcare', role: 'user', sellerStatus: 'verified' },
  { id: 'seller-faris', username: 'faris.lang', role: 'user', sellerStatus: 'verified' },
  { id: 'seller-devdesk', username: 'devdesk', role: 'user', sellerStatus: 'unverified' },
  { id: 'buyer-ali', username: 'ali.pi', role: 'user', sellerStatus: 'unverified' },
  { id: 'buyer-nora', username: 'nora.pi', role: 'user', sellerStatus: 'unverified' },
  { id: 'buyer-sami', username: 'sami.pi', role: 'user', sellerStatus: 'unverified' },
  { id: 'admin-lina', username: 'lina.admin', role: 'admin', sellerStatus: 'verified' },
];

const services = [
  {
    id: 'logo-sprint',
    title: 'Minimal logo design sprint',
    category: 'Design',
    summary: 'Clean logo concepts for Pi apps, shops, and community projects.',
    pricePi: 18,
    depositPi: 5,
    deliveryDays: 2,
    status: 'approved',
    sellerId: 'seller-maha',
    sellerHandle: '@maha.pi',
    rating: 4.9,
    reviewCount: 37,
    accent: '#f5b84b',
    icon: 'LD',
    featured: true,
    terms: 'Buyer provides brand name, preferred colors, and one reference style.',
    portfolioUrl: 'https://example.com/maha-logo-portfolio',
    proofLink: 'https://example.com/maha-logo-samples',
    experience: 'Designed lightweight brand systems for Pi community projects and small digital shops.',
    revisionPolicy: 'Includes one revision round after the first concepts.',
    requirementsFromBuyer: 'Brand name, preferred colors, target audience, and one reference style.',
    deliverablesJson: JSON.stringify(['2 logo concepts', '1 revision round', 'PNG and source file']),
  },
  {
    id: 'cv-refresh',
    title: 'Professional CV rewrite',
    category: 'Writing',
    summary: 'Sharper CV wording for tech, business, and remote roles.',
    pricePi: 12,
    depositPi: 4,
    deliveryDays: 1,
    status: 'approved',
    sellerId: 'pi-user-placeholder',
    sellerHandle: '@pioneer.demo',
    rating: 4.8,
    reviewCount: 24,
    accent: '#72c7b8',
    icon: 'CV',
    featured: true,
    terms: 'Buyer sends current CV text and target role before work starts.',
    portfolioUrl: 'https://example.com/pioneer-cv-samples',
    proofLink: 'https://example.com/pioneer-writing-proof',
    experience: 'Rewrites CVs for remote product, support, and operations roles.',
    revisionPolicy: 'One wording adjustment after delivery.',
    requirementsFromBuyer: 'Current CV text, target role, and any job links to tailor the wording.',
    deliverablesJson: JSON.stringify(['ATS-ready CV text', 'Profile summary', 'Role bullet cleanup']),
  },
  {
    id: 'arabic-english-translation',
    title: 'Arabic to English translation',
    category: 'Translation',
    summary: 'Clear translation for profiles, app copy, and short documents.',
    pricePi: 10,
    depositPi: 3,
    deliveryDays: 2,
    status: 'approved',
    sellerId: 'seller-faris',
    sellerHandle: '@faris.lang',
    rating: 4.7,
    reviewCount: 19,
    accent: '#8ea7ff',
    icon: 'TR',
    featured: false,
    terms: 'Up to 900 words per order. Legal and medical content is excluded.',
    portfolioUrl: 'https://example.com/faris-translation-samples',
    proofLink: 'https://example.com/faris-language-proof',
    experience: 'Translates short app, profile, and community content between Arabic and English.',
    revisionPolicy: 'One tone adjustment if the meaning changes.',
    requirementsFromBuyer: 'Source text, target audience, and preferred formal or casual tone.',
    deliverablesJson: JSON.stringify(['Up to 900 words', 'Proofread text', 'Tone adjustment']),
  },
  {
    id: 'image-polish',
    title: 'Product image cleanup',
    category: 'Images',
    summary: 'Background cleanup, crop, contrast, and listing-ready export.',
    pricePi: 15,
    depositPi: 5,
    deliveryDays: 1,
    status: 'approved',
    sellerId: 'seller-pixel',
    sellerHandle: '@pixelcare',
    rating: 4.9,
    reviewCount: 42,
    accent: '#ef7d8a',
    icon: 'IP',
    featured: true,
    terms: 'Buyer provides original images and target size before work begins.',
    portfolioUrl: 'https://example.com/pixelcare-before-after',
    proofLink: 'https://example.com/pixelcare-image-proof',
    experience: 'Cleans marketplace images for small catalogs and digital service listings.',
    revisionPolicy: 'One correction pass for crop, brightness, or export size.',
    requirementsFromBuyer: 'Original images, target sizes, and examples of the desired result.',
    deliverablesJson: JSON.stringify(['5 edited images', 'Square and story sizes', 'Color polish']),
  },
  {
    id: 'simple-react-fix',
    title: 'Simple React bug fix',
    category: 'Code',
    summary: 'Small React fixes for forms, layout issues, and state bugs.',
    pricePi: 25,
    depositPi: 8,
    deliveryDays: 3,
    status: 'pending',
    sellerId: 'seller-devdesk',
    sellerHandle: '@devdesk',
    rating: 4.8,
    reviewCount: 31,
    accent: '#b98cff',
    icon: 'JS',
    featured: false,
    terms: 'One small component fix. Backend and database work are excluded.',
    portfolioUrl: 'https://example.com/devdesk-react-notes',
    proofLink: 'https://example.com/devdesk-code-proof',
    experience: 'Fixes small React state, form, and layout issues.',
    revisionPolicy: 'One follow-up adjustment if the same bug remains.',
    requirementsFromBuyer: 'Bug description, affected component, reproduction steps, and expected behavior.',
    deliverablesJson: JSON.stringify(['Bug diagnosis', 'Patch notes', 'One small component fix']),
  },
];

const orders = [
  {
    id: 'order-1001',
    serviceId: 'cv-refresh',
    buyerId: 'buyer-ali',
    sellerId: 'pi-user-placeholder',
    buyerName: 'ali.pi',
    sellerName: 'pioneer.demo',
    status: 'In Progress',
    paymentMode: 'Full payment',
    amountPi: 12,
    platformFeePi: 0.6,
    buyerNote: 'Please make this CV stronger for remote product roles.',
    requestSourceText: 'Existing CV text and target role details.',
    requestReferenceLink: '',
    requestFileName: 'ali-current-cv.pdf',
    requestFileSize: '420 KB',
    deliveryMessage: '',
    deliveryLink: '',
    deliveryFileName: '',
    deliveryFileSize: '',
  },
  {
    id: 'order-1002',
    serviceId: 'image-polish',
    buyerId: 'pi-user-placeholder',
    sellerId: 'seller-pixel',
    buyerName: 'pioneer.demo',
    sellerName: 'pixelcare',
    status: 'Delivered',
    paymentMode: 'Deposit',
    amountPi: 5,
    platformFeePi: 0.25,
    buyerNote: 'Clean up five product shots for a Pi service listing.',
    requestSourceText: '',
    requestReferenceLink: 'https://example.com/source-images',
    requestFileName: 'product-shots.zip',
    requestFileSize: '8.6 MB',
    deliveryMessage: 'Images are cleaned and exported in square and story sizes.',
    deliveryLink: 'https://example.com/mock-delivery',
    deliveryFileName: 'cleaned-product-images.zip',
    deliveryFileSize: '6.2 MB',
  },
  {
    id: 'order-1003',
    serviceId: 'logo-sprint',
    buyerId: 'buyer-nora',
    sellerId: 'seller-maha',
    buyerName: 'nora.pi',
    sellerName: 'maha.pi',
    status: 'Pending Payment',
    paymentMode: null,
    amountPi: 5,
    platformFeePi: 0.25,
    buyerNote: 'Please create a logo direction for a small Pi shop.',
    requestSourceText: 'Brand name: Nora Pi Goods. Style: simple and friendly.',
    requestReferenceLink: '',
    requestFileName: '',
    requestFileSize: '',
    deliveryMessage: '',
    deliveryLink: '',
    deliveryFileName: '',
    deliveryFileSize: '',
  },
  {
    id: 'order-1004',
    serviceId: 'arabic-english-translation',
    buyerId: 'buyer-sami',
    sellerId: 'seller-faris',
    buyerName: 'sami.pi',
    sellerName: 'faris.lang',
    status: 'Completed',
    paymentMode: 'Full payment',
    amountPi: 10,
    platformFeePi: 0.5,
    buyerNote: 'Translate this short community announcement.',
    requestSourceText: 'Arabic source text for a Pi community announcement.',
    requestReferenceLink: '',
    requestFileName: '',
    requestFileSize: '',
    deliveryMessage: 'Translation delivered with a concise tone pass.',
    deliveryLink: 'https://example.com/translation-delivery',
    deliveryFileName: 'translated-announcement.txt',
    deliveryFileSize: '18 KB',
  },
];

const payments = [
  {
    id: 'payment-1001',
    orderId: 'order-1001',
    serviceId: 'cv-refresh',
    amountPi: 12,
    mode: 'full',
    txid: 'seed-tx-1001',
    status: 'completed',
  },
  {
    id: 'payment-1002',
    orderId: 'order-1002',
    serviceId: 'image-polish',
    amountPi: 5,
    mode: 'deposit',
    txid: 'seed-tx-1002',
    status: 'completed',
  },
  {
    id: 'payment-1004',
    orderId: 'order-1004',
    serviceId: 'arabic-english-translation',
    amountPi: 10,
    mode: 'full',
    txid: 'seed-tx-1004',
    status: 'completed',
  },
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        role: user.role,
        sellerStatus: user.sellerStatus,
      },
      create: user,
    });
  }

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: service,
      create: service,
    });
  }

  for (const order of orders) {
    await prisma.order.upsert({
      where: { id: order.id },
      update: order,
      create: order,
    });
  }

  for (const payment of payments) {
    await prisma.payment.upsert({
      where: { id: payment.id },
      update: {
        ...payment,
        mock: true,
        piPaymentJson: JSON.stringify({
          identifier: payment.id,
          amount: payment.amountPi,
          metadata: { orderId: payment.orderId, serviceId: payment.serviceId, mode: payment.mode },
          status: {
            developer_approved: true,
            transaction_verified: true,
            developer_completed: true,
          },
        }),
      },
      create: {
        ...payment,
        mock: true,
        piPaymentJson: JSON.stringify({
          identifier: payment.id,
          amount: payment.amountPi,
          metadata: { orderId: payment.orderId, serviceId: payment.serviceId, mode: payment.mode },
          status: {
            developer_approved: true,
            transaction_verified: true,
            developer_completed: true,
          },
        }),
      },
    });
  }

  await prisma.review.upsert({
    where: { orderId: 'order-1004' },
    update: {
      rating: 5,
      comment: 'Fast delivery and clear translation.',
    },
    create: {
      orderId: 'order-1004',
      serviceId: 'arabic-english-translation',
      buyerId: 'buyer-sami',
      sellerId: 'seller-faris',
      rating: 5,
      comment: 'Fast delivery and clear translation.',
    },
  });

  await prisma.report.upsert({
    where: { id: 'report-001' },
    update: {
      serviceId: 'simple-react-fix',
      reporterId: 'pi-user-placeholder',
      serviceTitle: 'Simple React bug fix',
      reason: 'Seed report for admin moderation smoke tests.',
      status: 'open',
    },
    create: {
      id: 'report-001',
      serviceId: 'simple-react-fix',
      reporterId: 'pi-user-placeholder',
      serviceTitle: 'Simple React bug fix',
      reason: 'Seed report for admin moderation smoke tests.',
      status: 'open',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
