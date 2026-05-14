import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const users = [
  { id: 'pi-user-placeholder', username: 'pioneer.demo', role: 'seller' },
  { id: 'seller-maha', username: 'maha.pi', role: 'seller' },
  { id: 'seller-pixel', username: 'pixelcare', role: 'seller' },
  { id: 'seller-faris', username: 'faris.lang', role: 'seller' },
  { id: 'seller-devdesk', username: 'devdesk', role: 'seller' },
  { id: 'buyer-ali', username: 'ali.pi', role: 'buyer' },
  { id: 'buyer-nora', username: 'nora.pi', role: 'buyer' },
  { id: 'buyer-sami', username: 'sami.pi', role: 'buyer' },
  { id: 'admin-lina', username: 'lina.admin', role: 'admin' },
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
    deliveryMessage: '',
    deliveryLink: '',
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
    deliveryMessage: 'Images are cleaned and exported in square and story sizes.',
    deliveryLink: 'https://example.com/mock-delivery',
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
    deliveryMessage: '',
    deliveryLink: '',
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
    deliveryMessage: 'Translation delivered with a concise tone pass.',
    deliveryLink: 'https://example.com/translation-delivery',
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
