import { PrismaClient } from '@prisma/client';

if (!/^postgres(?:ql)?:\/\//i.test(String(process.env.DATABASE_URL || ''))) {
  throw new Error('DATABASE_URL must be set to a PostgreSQL URL before starting the backend.');
}

export const prisma = new PrismaClient();

export async function ensureUser(id, username, role = 'user') {
  const normalizedRole = role === 'admin' ? 'admin' : 'user';
  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    return prisma.user.create({
      data: { id, username, role: normalizedRole },
    });
  }

  const shouldUpdateRole =
    normalizedRole === 'admin' || !['user', 'admin'].includes(existingUser.role);

  return prisma.user.update({
    where: { id },
    data: {
      username,
      ...(shouldUpdateRole ? { role: normalizedRole } : {}),
    },
  });
}

export async function ensureServiceSnapshot({ serviceId, sellerId, amountPi }) {
  if (!serviceId) return null;

  return prisma.service.upsert({
    where: { id: serviceId },
    create: {
      id: serviceId,
      slug: String(serviceId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `service-${Date.now()}`,
      title: `Service ${serviceId}`,
      category: 'Digital',
      summary: 'Frontend-created service snapshot for payment persistence.',
      pricePi: amountPi || 0,
      depositPi: amountPi || 0,
      deliveryDays: 1,
      status: 'approved',
      sellerId,
      sellerHandle: '@seller',
      accent: '#f5b84b',
      icon: 'PI',
      terms: 'Payment-created service snapshot.',
      deliverablesJson: JSON.stringify(['Digital delivery message or link', 'Buyer confirmation required']),
    },
    update: {},
  });
}

export async function shutdown(server) {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
