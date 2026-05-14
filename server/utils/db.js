import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function ensureUser(id, username, role) {
  return prisma.user.upsert({
    where: { id },
    create: { id, username, role },
    update: { username },
  });
}

export async function ensureServiceSnapshot({ serviceId, sellerId, amountPi }) {
  if (!serviceId) return null;

  return prisma.service.upsert({
    where: { id: serviceId },
    create: {
      id: serviceId,
      title: `Service ${serviceId}`,
      category: 'Digital',
      summary: 'Frontend-created service snapshot for payment persistence.',
      pricePi: amountPi || 0,
      depositPi: amountPi || 0,
      deliveryDays: 1,
      status: 'approved',
      sellerId,
    },
    update: {},
  });
}

export async function shutdown(server) {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
