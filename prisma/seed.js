import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { id: 'pi-user-placeholder' },
    update: {},
    create: {
      id: 'pi-user-placeholder',
      username: 'pioneer.demo',
      role: 'seller',
    },
  });

  await prisma.user.upsert({
    where: { id: 'seller-pixel' },
    update: {},
    create: {
      id: 'seller-pixel',
      username: 'pixelcare',
      role: 'seller',
    },
  });

  await prisma.user.upsert({
    where: { id: 'buyer-ali' },
    update: {},
    create: {
      id: 'buyer-ali',
      username: 'ali.pi',
      role: 'buyer',
    },
  });

  await prisma.service.upsert({
    where: { id: 'cv-refresh' },
    update: {},
    create: {
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
  });

  await prisma.service.upsert({
    where: { id: 'image-polish' },
    update: {},
    create: {
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
  });

  await prisma.order.upsert({
    where: { id: 'order-1001' },
    update: {},
    create: {
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
    },
  });

  await prisma.report.upsert({
    where: { id: 'report-001' },
    update: {},
    create: {
      id: 'report-001',
      serviceId: 'image-polish',
      reporterId: 'pi-user-placeholder',
      serviceTitle: 'Product image cleanup',
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
