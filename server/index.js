import 'dotenv/config';
import express from 'express';

import { allowLocalDevCors } from './middleware/cors.js';
import { prisma, ensureUser, shutdown } from './utils/db.js';
import { callPiPlatform, verifyPiAccessToken } from './utils/piClient.js';
import { normalizePolicyUrl } from './utils/urlPolicy.js';
import {
  normalizePaymentRequest,
  createMockPaymentDto,
  normalizePaymentMode,
  calculatePlatformFee,
  getPlatformFeePercentLabel,
  getPlatformFeeRate,
  serializeOrder,
  serializePayment,
  serializePublicService,
  serializeReport,
  serializeService,
  stringifyJson,
} from './utils/payment.js';

const app = express();

const PORT = Number(process.env.PORT || 4000);
const PI_PLATFORM_API_KEY = process.env.PI_NETWORK_API_KEY || process.env.PI_API_KEY;
const USE_MOCK_PAYMENTS =
  process.env.PI_USE_MOCK_PAYMENTS === 'true' ||
  (!PI_PLATFORM_API_KEY && process.env.NODE_ENV !== 'production');
const PI_ADMIN_USERNAMES = parseEnvList(process.env.PI_ADMIN_USERNAMES ?? 'mohammedabobaker')
  .map(normalizePiUsername)
  .filter(Boolean);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ORDER_STATUS = {
  REQUESTED: 'Requested',
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid',
  DEPOSIT_PAID: 'Deposit Paid',
  IN_PROGRESS: 'In Progress',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

const ESCROW_STATUS = {
  NOT_FUNDED: 'not_funded',
  HOLDING: 'holding',
  HOLDING_DEPOSIT: 'holding_deposit',
  HOLDING_FULL: 'holding_full',
  RELEASE_PENDING: 'release_pending',
  RELEASED: 'released',
  DISPUTED: 'disputed',
  REFUNDED: 'refunded',
};

const ESCROW_EVENT_TYPE = {
  FUNDED: 'funded',
  RELEASE_SCHEDULED: 'release_scheduled',
  DISPUTE_OPENED: 'dispute_opened',
  RELEASED: 'released',
  REFUNDED: 'refunded',
  PAYOUT_PAID: 'payout_paid',
};

const SELLER_PAYOUT_STATUS = {
  MANUAL_REQUIRED: 'manual_required',
  PAID: 'paid',
};

const PUBLIC_SERVICE_TEXT = {
  en: {
    service: 'PiDeal service',
    escrow: 'Escrow protected',
    verifiedIdentity: 'Verified Pi identity',
    dispute: 'Dispute resolution',
    order: 'Order securely in Pi Browser',
    share: 'Share',
    price: 'Price',
    deposit: 'Deposit',
    delivery: 'Delivery',
    days: 'days',
    sellerRating: 'Seller rating',
    rating: 'rating',
    newSeller: 'New seller',
    underReview: 'Under review',
    completed: 'completed',
    publicProof: 'Public order proof',
    verifiedSeller: 'Verified seller',
    whatYouGet: 'What you get',
    digitalDelivery: 'Digital delivery message or link',
    buyerConfirmation: 'Buyer confirmation required',
    piPayment: 'Pi escrow payment',
    continueSafely: 'Continue safely',
    ordersInside: 'Orders and payments work inside Pi Browser',
    gateMessage:
      'PiDeal protects both buyer and seller with verified Pi identity, escrow, protected delivery, and dispute resolution.',
    secureCheckout: 'Secure checkout',
    escrowProtection: 'Escrow protection',
    disputeSupport: 'Dispute support',
    openPiBrowser: 'Open in Pi Browser',
    getPiBrowser: 'Get Pi Browser',
    linkCopied: 'Link copied',
    close: 'Close',
    notFound: 'Service not found',
    unavailable: 'This public service is unavailable or awaiting review.',
    openPiDeal: 'Open PiDeal',
    shareCardTrust: 'PiDeal escrow protected',
    shareCardCta: 'Order securely inside Pi Browser',
  },
  ar: {
    service: 'خدمة على PiDeal',
    escrow: 'محمي بنظام الضمان',
    verifiedIdentity: 'هوية Pi موثقة',
    dispute: 'حل النزاعات',
    order: 'اطلب بأمان داخل Pi Browser',
    share: 'مشاركة',
    price: 'السعر',
    deposit: 'العربون',
    delivery: 'مدة التسليم',
    days: 'أيام',
    sellerRating: 'تقييم البائع',
    rating: 'تقييم',
    newSeller: 'بائع جديد',
    underReview: 'قيد المراجعة',
    completed: 'طلبات مكتملة',
    publicProof: 'إثبات طلب عام',
    verifiedSeller: 'بائع موثق',
    whatYouGet: 'ماذا ستحصل عليه',
    digitalDelivery: 'رسالة أو رابط تسليم رقمي',
    buyerConfirmation: 'يتطلب تأكيد المشتري',
    piPayment: 'دفع Pi داخل التطبيق',
    continueSafely: 'تابع بأمان',
    ordersInside: 'الطلبات والمدفوعات تعمل داخل Pi Browser',
    gateMessage:
      'يحمي PiDeal المشتري والبائع عبر هوية Pi الموثقة، والضمان، والتسليم المحمي، وحل النزاعات.',
    secureCheckout: 'دفع آمن',
    escrowProtection: 'حماية الضمان',
    disputeSupport: 'دعم النزاعات',
    openPiBrowser: 'افتح في Pi Browser',
    getPiBrowser: 'حمّل Pi Browser',
    linkCopied: 'تم نسخ الرابط',
    close: 'إغلاق',
    notFound: 'الخدمة غير موجودة',
    unavailable: 'هذه الخدمة العامة غير متاحة أو بانتظار المراجعة.',
    openPiDeal: 'افتح PiDeal',
    shareCardTrust: 'خدمة محمية بضمان PiDeal',
    shareCardCta: 'اطلب بأمان داخل Pi Browser',
  },
};

const PUBLIC_DELIVERABLE_TEXT_KEYS = {
  'Digital delivery message or link': 'digitalDelivery',
  'Buyer confirmation required': 'buyerConfirmation',
  'Pi escrow payment': 'piPayment',
  'Pi payment placeholder': 'piPayment',
};

const ESCROW_DISPUTE_WINDOW_HOURS = normalizeNonNegativeNumber(
  process.env.ESCROW_DISPUTE_WINDOW_HOURS ?? process.env.DISPUTE_WINDOW_HOURS ?? 72,
  72,
);

const SERVICE_INCLUDE = {
  seller: true,
  reviews: true,
};

const PUBLIC_SERVICE_INCLUDE = {
  seller: true,
  reviews: true,
  _count: {
    select: { reviews: true },
  },
};

const ORDER_INCLUDE = {
  payments: {
    orderBy: { updatedAt: 'desc' },
  },
  review: true,
  service: true,
  sellerPayout: true,
  escrowEvents: {
    orderBy: { createdAt: 'desc' },
    take: 8,
  },
};

const REPORT_INCLUDE = {
  service: true,
  reporter: true,
};

const SELLER_PAYOUT_INCLUDE = {
  seller: true,
  order: {
    include: {
      service: true,
    },
  },
};

app.use(express.json({ limit: '256kb' }));
app.use(allowLocalDevCors);

app.get('/api/health', async (request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return response.json({
      ok: true,
      service: 'pideal-lite-api',
      database: 'postgresql-prisma',
      piPaymentsMode: USE_MOCK_PAYMENTS ? 'mock' : 'pi-platform-api',
      platformFeeRate: getPlatformFeeRate(),
      platformFeePercent: getPlatformFeePercentLabel(),
      escrowDisputeWindowHours: ESCROW_DISPUTE_WINDOW_HOURS,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/session', async (request, response, next) => {
  try {
    const accessToken = String(request.body?.accessToken || '').trim();
    if (!accessToken) {
      return response.status(401).json({ ok: false, error: 'A verified Pi access token is required.' });
    }

    const sessionIdentity = { ...(await verifyPiAccessToken(accessToken)), verifiedPi: true };
    const role = getSessionRole(sessionIdentity);
    const user = await ensureUser(sessionIdentity.uid, sessionIdentity.username, role);

    return response.json({
      ok: true,
      user: serializeUser(user),
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/notifications', async (request, response, next) => {
  try {
    await releaseEligibleEscrows();
    const userId = getActorUserId(request);

    if (!userId) {
      return response.status(401).json({ ok: false, error: 'User id is required for notifications.' });
    }

    const sessionUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!sessionUser) {
      return response.status(404).json({ ok: false, error: 'Notification user was not found.' });
    }

    const notifications = await getNotificationsForUser(sessionUser);

    return response.json({
      ok: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/escrow/release-due', requireAdmin, async (request, response, next) => {
  try {
    const result = await releaseEligibleEscrows();

    return response.json({
      ok: true,
      releasedCount: result.releasedCount,
      orderIds: result.orderIds,
      payoutIds: result.payoutIds,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/seller-payouts', requireAdmin, async (request, response, next) => {
  try {
    const payouts = await prisma.sellerPayout.findMany({
      include: SELLER_PAYOUT_INCLUDE,
      orderBy: [
        { payoutStatus: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return response.json({ ok: true, payouts: payouts.map(serializeSellerPayout) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/seller-payouts/:payoutId/mark-paid', requireAdmin, async (request, response, next) => {
  try {
    const payoutTxid = requiredString(request.body?.payoutTxid || request.body?.txid, 'payoutTxid');
    const paidAt = new Date();

    const existingPayout = await prisma.sellerPayout.findUnique({
      where: { id: request.params.payoutId },
      include: SELLER_PAYOUT_INCLUDE,
    });

    if (!existingPayout) {
      return response.status(404).json({ ok: false, error: 'Seller payout was not found.' });
    }
    if (existingPayout.payoutStatus === SELLER_PAYOUT_STATUS.PAID) {
      return response.status(409).json({ ok: false, error: 'Seller payout is already marked paid.' });
    }
    if (existingPayout.payoutStatus !== SELLER_PAYOUT_STATUS.MANUAL_REQUIRED) {
      return response.status(409).json({ ok: false, error: 'Only manual-required seller payouts can be marked paid.' });
    }

    const { payout, order } = await prisma.$transaction(async (tx) => {
      const payout = await tx.sellerPayout.update({
        where: { id: existingPayout.id },
        data: {
          payoutStatus: SELLER_PAYOUT_STATUS.PAID,
          payoutTxid,
          paidAt,
          paidByAdmin: request.actor.id,
        },
        include: SELLER_PAYOUT_INCLUDE,
      });

      await tx.order.update({
        where: { id: existingPayout.orderId },
        data: {
          sellerPayoutTxid: payoutTxid,
        },
      });

      await tx.escrowEvent.create({
        data: {
          orderId: existingPayout.orderId,
          actorId: request.actor.id,
          type: ESCROW_EVENT_TYPE.PAYOUT_PAID,
          amountPi: existingPayout.netPi,
          status: ESCROW_STATUS.RELEASED,
          txid: payoutTxid,
          note: 'Manual seller payout completed and verified by admin.',
        },
      });

      const order = await tx.order.findUnique({
        where: { id: existingPayout.orderId },
        include: ORDER_INCLUDE,
      });

      return { payout, order };
    });

    return response.json({
      ok: true,
      payout: serializeSellerPayout(payout),
      order: serializeOrder(order, request.actor),
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/public/services/:slug', async (request, response, next) => {
  try {
    const publicService = await getPublicServiceBySlug(request.params.slug);

    if (!publicService) {
      return response.status(404).json({ ok: false, error: 'Public service was not found.' });
    }

    return response.json({ ok: true, service: publicService });
  } catch (error) {
    return next(error);
  }
});

app.get('/service/:slug/share-card.svg', async (request, response, next) => {
  try {
    const publicService = await getPublicServiceBySlug(request.params.slug);

    if (!publicService) {
      return response.status(404).type('text/plain').send('Public service was not found.');
    }

    response.set('Cache-Control', 'public, max-age=300');
    return response.type('image/svg+xml').send(renderServiceShareCardSvg(publicService, getPublicLanguage(request)));
  } catch (error) {
    return next(error);
  }
});

app.get('/service/:slug', async (request, response, next) => {
  try {
    const publicService = await getPublicServiceBySlug(request.params.slug);

    if (!publicService) {
      return response.status(404).type('html').send(renderPublicNotFoundPage(request));
    }

    return response.type('html').send(renderPublicServicePage(request, publicService));
  } catch (error) {
    return next(error);
  }
});

app.get('/api/services', async (request, response, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { status: { not: 'removed' } },
      include: SERVICE_INCLUDE,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });

    return response.json({ ok: true, services: services.map(serializeService) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/services', async (request, response, next) => {
  try {
    const listing = normalizeServiceInput(request.body || {});
    const seller = await ensureUser(listing.sellerId, listing.sellerName, 'user');

    if (seller.sellerStatus === 'blocked') {
      return response.status(403).json({ ok: false, error: 'This seller is blocked from publishing services.' });
    }

    const service = await prisma.service.create({
      data: {
        id: listing.id,
        slug: await createUniqueServiceSlug(listing.title),
        title: listing.title,
        category: listing.category,
        sellerId: seller.id,
        sellerHandle: listing.sellerHandle,
        pricePi: listing.pricePi,
        depositPi: listing.depositPi,
        rating: 0,
        reviewCount: 0,
        deliveryDays: listing.deliveryDays,
        status: 'pending',
        accent: listing.accent,
        icon: listing.icon,
        featured: false,
        summary: listing.summary,
        terms: listing.terms,
        portfolioUrl: listing.portfolioUrl,
        proofLink: listing.proofLink,
        experience: listing.experience,
        revisionPolicy: listing.revisionPolicy,
        requirementsFromBuyer: listing.requirementsFromBuyer,
        deliverablesJson: stringifyJson(listing.deliverables),
      },
      include: SERVICE_INCLUDE,
    });

    return response.status(201).json({ ok: true, service: serializeService(service) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/services/:serviceId/status', requireAdmin, async (request, response, next) => {
  try {
    const nextStatus = String(request.body?.status || '').trim();
    if (!['approved', 'pending', 'rejected', 'blocked'].includes(nextStatus)) {
      return response.status(400).json({ ok: false, error: 'Unsupported service status.' });
    }

    const service = await prisma.service.update({
      where: { id: request.params.serviceId },
      data: { status: nextStatus },
      include: SERVICE_INCLUDE,
    });

    return response.json({ ok: true, service: serializeService(service) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/services/:serviceId/remove', requireAdmin, async (request, response, next) => {
  try {
    const service = await prisma.service.update({
      where: { id: request.params.serviceId },
      data: { status: 'removed' },
      include: SERVICE_INCLUDE,
    });

    return response.json({ ok: true, service: serializeService(service) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/users/:userId/seller-status', requireAdmin, async (request, response, next) => {
  try {
    const sellerStatus = String(request.body?.sellerStatus || '').trim();
    if (!['unverified', 'verified', 'blocked'].includes(sellerStatus)) {
      return response.status(400).json({ ok: false, error: 'Unsupported seller status.' });
    }

    const user = await prisma.user.update({
      where: { id: request.params.userId },
      data: { sellerStatus },
    });

    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/orders', async (request, response, next) => {
  try {
    await releaseEligibleEscrows();
    const viewer = await getRequestViewer(request);
    const orders = await prisma.order.findMany({
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return response.json({ ok: true, orders: orders.map((order) => serializeOrder(order, viewer)) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders', async (request, response, next) => {
  try {
    const orderInput = normalizeOrderInput(request.body || {});
    const service = await prisma.service.findUnique({
      where: { id: orderInput.serviceId },
      include: { seller: true },
    });

    if (!service || service.status !== 'approved') {
      return response.status(404).json({ ok: false, error: 'Approved service was not found.' });
    }
    if (service.seller?.sellerStatus === 'blocked') {
      return response.status(403).json({ ok: false, error: 'This seller is currently blocked.' });
    }

    const buyer = await ensureUser(orderInput.buyerId, orderInput.buyerName, 'user');

    const order = await prisma.order.create({
      data: {
        id: orderInput.id,
        serviceId: service.id,
        buyerId: buyer.id,
        sellerId: service.sellerId,
        buyerName: buyer.username,
        sellerName: service.seller?.username || 'Pi seller',
        status: ORDER_STATUS.REQUESTED,
        buyerNote: orderInput.buyerNote,
        requestSourceText: orderInput.requestSourceText,
        requestReferenceLink: orderInput.requestReferenceLink,
        requestFileName: orderInput.requestFileName,
        requestFileSize: orderInput.requestFileSize,
        deliveryMessage: '',
        deliveryLink: '',
        deliveryFileName: '',
        deliveryFileSize: '',
      },
      include: ORDER_INCLUDE,
    });

    return response.status(201).json({ ok: true, order: serializeOrder(order, buyer) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/accept', async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.REQUESTED) {
      return response.status(409).json({ ok: false, error: 'Only requested orders can be accepted by the seller.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.PENDING_PAYMENT },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder, { id: updatedOrder.sellerId }) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/start', async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (![ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.PAID].includes(order.status)) {
      return response.status(409).json({ ok: false, error: 'Only deposit-paid orders can move to In Progress.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.IN_PROGRESS },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder, { id: updatedOrder.sellerId }) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/deliver', async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.IN_PROGRESS) {
      return response.status(409).json({ ok: false, error: 'Only orders in progress can be delivered.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: {
        status: ORDER_STATUS.DELIVERED,
        deliveryMessage: String(request.body?.deliveryMessage || 'Delivery submitted by seller.').trim(),
        deliveryLink: normalizePolicyUrl(request.body?.deliveryLink, 'deliveryLink', 'Delivery link'),
        deliveryFileName: String(request.body?.deliveryFileName || '').trim(),
        deliveryFileSize: String(request.body?.deliveryFileSize || '').trim(),
      },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder, { id: updatedOrder.sellerId }) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/confirm', async (request, response, next) => {
  try {
    const order = await findOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.DELIVERED) {
      return response.status(409).json({ ok: false, error: 'Only delivered orders can be confirmed.' });
    }
    if (calculateRemainingPi(order) > 0) {
      return response.status(409).json({ ok: false, error: 'Remaining balance must be paid before the order can be completed.' });
    }

    const completedAt = new Date();
    const escrowReleaseUpdate = buildEscrowReleaseScheduleUpdate(order, completedAt);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: request.params.orderId },
        data: {
          status: ORDER_STATUS.COMPLETED,
          ...escrowReleaseUpdate,
        },
        include: ORDER_INCLUDE,
      });

      await tx.escrowEvent.create({
        data: {
          orderId: request.params.orderId,
          type: ESCROW_EVENT_TYPE.RELEASE_SCHEDULED,
          amountPi: escrowReleaseUpdate.sellerPayoutPi,
          status: ESCROW_STATUS.RELEASE_PENDING,
          note: `Buyer confirmed delivery. Seller payout is scheduled after the ${ESCROW_DISPUTE_WINDOW_HOURS}-hour dispute window.`,
        },
      });

      return updatedOrder;
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder, { id: updatedOrder.buyerId }) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/review', async (request, response, next) => {
  try {
    const rating = Number(request.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return response.status(400).json({ ok: false, error: 'Rating must be an integer from 1 to 5.' });
    }

    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.COMPLETED) {
      return response.status(409).json({ ok: false, error: 'Only completed orders can be reviewed.' });
    }

    await prisma.review.upsert({
      where: { orderId: order.id },
      update: {
        rating,
        comment: String(request.body?.comment || '').trim(),
      },
      create: {
        orderId: order.id,
        serviceId: order.serviceId,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        rating,
        comment: String(request.body?.comment || '').trim(),
      },
    });

    await refreshServiceRating(order.serviceId);
    const updatedOrder = await findOrderById(order.id);

    return response.json({ ok: true, order: serializeOrder(updatedOrder, { id: updatedOrder.buyerId }) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/cancel', async (request, response, next) => {
  try {
    const order = await findOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (![ORDER_STATUS.REQUESTED, ORDER_STATUS.PENDING_PAYMENT].includes(order.status)) {
      return response.status(409).json({ ok: false, error: 'Funded orders must be resolved through delivery, dispute, release, or refund.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: {
        status: ORDER_STATUS.CANCELLED,
        escrowStatus: ESCROW_STATUS.NOT_FUNDED,
        escrowHeldPi: 0,
      },
      include: ORDER_INCLUDE,
    });

    const viewer = await getRequestViewer(request);
    return response.json({ ok: true, order: serializeOrder(updatedOrder, viewer) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/dispute', async (request, response, next) => {
  try {
    const order = await findOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED].includes(order.status)) {
      return response.status(409).json({ ok: false, error: 'Only delivered or completed orders can be disputed.' });
    }
    if ([ESCROW_STATUS.RELEASED, ESCROW_STATUS.REFUNDED].includes(order.escrowStatus)) {
      return response.status(409).json({ ok: false, error: 'Escrow has already been resolved for this order.' });
    }

    const disputedAt = new Date();
    const viewer = await getRequestViewer(request);
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: request.params.orderId },
        data: {
          status: ORDER_STATUS.DISPUTED,
          escrowStatus: ESCROW_STATUS.DISPUTED,
          disputeOpenedAt: disputedAt,
        },
        include: ORDER_INCLUDE,
      });

      await tx.escrowEvent.create({
        data: {
          orderId: request.params.orderId,
          actorId: viewer?.id || null,
          type: ESCROW_EVENT_TYPE.DISPUTE_OPENED,
          amountPi: Number(order.escrowHeldPi || calculatePaidTotal(order)),
          status: ESCROW_STATUS.DISPUTED,
          note: 'Escrow release paused because a dispute was opened.',
        },
      });

      return updatedOrder;
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder, viewer) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/refund', requireAdmin, async (request, response, next) => {
  try {
    const order = await findOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.DISPUTED) {
      return response.status(409).json({ ok: false, error: 'Only disputed orders can be refunded by admin.' });
    }

    const resolvedAt = new Date();
    const refundPi = Number((Number(order.escrowHeldPi || 0) || calculatePaidTotal(order)).toFixed(2));
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: request.params.orderId },
        data: {
          status: ORDER_STATUS.REFUNDED,
          escrowStatus: ESCROW_STATUS.REFUNDED,
          escrowHeldPi: 0,
          escrowFeePi: 0,
          sellerPayoutPi: 0,
          refundedPi: refundPi,
          platformFeePi: 0,
          disputeResolvedAt: resolvedAt,
          refundRecordedAt: resolvedAt,
        },
        include: ORDER_INCLUDE,
      });

      await tx.escrowEvent.create({
        data: {
          orderId: request.params.orderId,
          actorId: request.actor.id,
          type: ESCROW_EVENT_TYPE.REFUNDED,
          amountPi: refundPi,
          status: ESCROW_STATUS.REFUNDED,
          note: 'Admin resolved dispute in favor of buyer. Refund is recorded for the held escrow.',
        },
      });

      return updatedOrder;
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder, request.actor) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/release', requireAdmin, async (request, response, next) => {
  try {
    const order = await findOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.DISPUTED) {
      return response.status(409).json({ ok: false, error: 'Only disputed orders can be released by admin.' });
    }

    const releasedAt = new Date();
    const releaseUpdate = buildEscrowReleaseUpdate(order, releasedAt);
    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: request.params.orderId },
        data: {
          status: ORDER_STATUS.COMPLETED,
          ...releaseUpdate,
        },
      });

      await tx.escrowEvent.create({
        data: {
          orderId: request.params.orderId,
          actorId: request.actor.id,
          type: ESCROW_EVENT_TYPE.RELEASED,
          amountPi: releaseUpdate.sellerPayoutPi,
          status: ESCROW_STATUS.RELEASED,
          note: 'Admin resolved dispute in favor of seller. Escrow settled and seller payout queued for manual transfer.',
        },
      });

      await queueSellerPayout(tx, order, releaseUpdate, releasedAt);

      return tx.order.findUnique({
        where: { id: request.params.orderId },
        include: ORDER_INCLUDE,
      });
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder, request.actor) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/reports', async (request, response, next) => {
  try {
    const reports = await prisma.report.findMany({
      include: REPORT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return response.json({ ok: true, reports: reports.map(serializeReport) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/reports', async (request, response, next) => {
  try {
    const service = request.body?.serviceId
      ? await prisma.service.findUnique({ where: { id: request.body.serviceId } })
      : null;

    const reporterId = request.body?.reporterId || null;
    if (reporterId) {
      await ensureUser(reporterId, request.body?.reporterName || 'Pi reporter', 'user');
    }

    const report = await prisma.report.create({
      data: {
        serviceId: service?.id || null,
        reporterId,
        serviceTitle: String(request.body?.serviceTitle || service?.title || 'Reported service').trim(),
        reason: String(request.body?.reason || 'Buyer reported this digital service for admin review.').trim(),
        status: 'open',
      },
      include: REPORT_INCLUDE,
    });

    return response.status(201).json({ ok: true, report: serializeReport(report) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/reports/:reportId/resolve', requireAdmin, async (request, response, next) => {
  try {
    const report = await prisma.report.update({
      where: { id: request.params.reportId },
      data: { status: 'resolved' },
      include: REPORT_INCLUDE,
    });

    return response.json({ ok: true, report: serializeReport(report) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/pi/payments/incomplete', handleIncompletePiPayment);
app.post('/api/payments/incomplete', handleIncompletePiPayment);

app.post('/api/pi/payments/:paymentId/approve', async (request, response, next) => {
  try {
    const { paymentId } = request.params;
    const paymentRequest = normalizePaymentRequest(paymentId, request.body || {});

    if (!paymentRequest.paymentId || !paymentRequest.orderId) {
      return response.status(400).json({ ok: false, error: 'paymentId and orderId are required.' });
    }

    const orderForPayment = await findOrderById(paymentRequest.orderId);
    if (!orderForPayment) {
      return response.status(404).json({ ok: false, error: 'Order must be created before payment approval.' });
    }

    const serverPaymentRequest = resolveServerPaymentRequest(orderForPayment, paymentRequest);

    const useMockPayment = USE_MOCK_PAYMENTS || (!IS_PRODUCTION && paymentRequest.demoMode);

    const piPayment = useMockPayment
      ? createMockPaymentDto({ ...serverPaymentRequest, phase: 'approved' })
      : await callPiPlatform(`/payments/${encodeURIComponent(paymentId)}/approve`);

    const payment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { id: paymentId },
        create: {
          id: paymentId,
          orderId: serverPaymentRequest.orderId,
          serviceId: serverPaymentRequest.serviceId,
          amountPi: serverPaymentRequest.amountPi,
          mode: serverPaymentRequest.mode,
          status: 'approved',
          mock: useMockPayment,
          piPaymentJson: stringifyJson(piPayment),
        },
        update: {
          orderId: serverPaymentRequest.orderId,
          serviceId: serverPaymentRequest.serviceId,
          amountPi: serverPaymentRequest.amountPi,
          mode: serverPaymentRequest.mode,
          status: 'approved',
          mock: useMockPayment,
          piPaymentJson: stringifyJson(piPayment),
        },
      });

      return payment;
    });

    const storedOrder = await findOrderById(serverPaymentRequest.orderId);

    return response.json({
      ok: true,
      mock: useMockPayment,
      payment: serializePayment(payment),
      order: serializeOrder(storedOrder, { id: storedOrder?.buyerId }),
      piPayment,
    });
  } catch (error) {
    return next(error);
  }
});

async function handleIncompletePiPayment(request, response, next) {
  try {
    const input = normalizeIncompletePaymentInput(request.body || {});

    if (!input.paymentId) {
      return response.status(400).json({ ok: false, error: 'paymentId is required for incomplete Pi payments.' });
    }

    let existingPayment = await findPaymentWithOrder(input.paymentId);
    let action = 'found_existing_payment';

    if (!existingPayment) {
      if (!input.orderId) {
        return response.status(404).json({
          ok: false,
          error: 'Incomplete payment is not linked to a known order. Missing metadata.orderId.',
        });
      }

      const orderForPayment = await findOrderById(input.orderId);
      if (!orderForPayment) {
        return response.status(404).json({ ok: false, error: 'Order for incomplete payment was not found.' });
      }

      const serverPaymentRequest = resolveServerPaymentRequest(orderForPayment, {
        paymentId: input.paymentId,
        orderId: input.orderId,
        serviceId: input.serviceId,
        amountPi: null,
        mode: input.mode,
        demoMode: input.demoMode,
      });
      const useMockPayment = USE_MOCK_PAYMENTS || (!IS_PRODUCTION && input.demoMode);
      const piPayment = useMockPayment
        ? createMockPaymentDto({ ...serverPaymentRequest, phase: 'approved' })
        : await callPiPlatform(`/payments/${encodeURIComponent(input.paymentId)}/approve`);

      await prisma.payment.create({
        data: {
          id: input.paymentId,
          orderId: serverPaymentRequest.orderId,
          serviceId: serverPaymentRequest.serviceId,
          amountPi: serverPaymentRequest.amountPi,
          mode: serverPaymentRequest.mode,
          status: 'approved',
          mock: useMockPayment,
          piPaymentJson: stringifyJson(piPayment),
        },
      });

      existingPayment = await findPaymentWithOrder(input.paymentId);
      action = 'approved_missing_server_record';
    }

    if (existingPayment.status === 'completed') {
      return response.json({
        ok: true,
        action: 'already_completed',
        payment: serializePayment(existingPayment),
        order: serializeOrder(existingPayment.order, { id: existingPayment.order?.buyerId }),
      });
    }

    if (!input.txid) {
      return response.json({
        ok: true,
        action,
        needsTxid: true,
        payment: serializePayment(existingPayment),
        order: serializeOrder(existingPayment.order, { id: existingPayment.order?.buyerId }),
      });
    }

    if (!['approved', 'completed'].includes(existingPayment.status)) {
      return response.status(409).json({
        ok: false,
        error: 'Incomplete payment exists but is not ready for server completion.',
      });
    }

    const useMockPayment = USE_MOCK_PAYMENTS || existingPayment.mock || (!IS_PRODUCTION && input.demoMode);
    const piPayment = useMockPayment
      ? createMockPaymentDto({
          paymentId: input.paymentId,
          orderId: existingPayment.orderId,
          serviceId: existingPayment.serviceId,
          amountPi: existingPayment.amountPi,
          mode: existingPayment.mode,
          txid: input.txid,
          phase: 'completed',
        })
      : await callPiPlatform(`/payments/${encodeURIComponent(input.paymentId)}/complete`, { txid: input.txid });

    const nextStatus = resolveStatusAfterPayment(existingPayment.order, existingPayment);
    const nextPaidTotal = calculatePaidTotal(existingPayment.order, existingPayment);
    const completedAt = new Date();
    const escrowFundingUpdate = buildEscrowFundingUpdate(
      existingPayment.order,
      existingPayment,
      nextStatus,
      nextPaidTotal,
      completedAt,
    );

    const { order, payment } = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: input.paymentId },
        data: {
          txid: input.txid,
          status: 'completed',
          mock: useMockPayment,
          piPaymentJson: stringifyJson(piPayment),
        },
      });

      const order = await tx.order.update({
        where: { id: existingPayment.orderId },
        data: {
          status: nextStatus,
          paidAt: completedAt,
          paymentMode: normalizePaymentMode(existingPayment.mode),
          amountPi: nextPaidTotal,
          platformFeePi: calculatePlatformFee(nextPaidTotal),
          ...escrowFundingUpdate,
        },
      });

      await tx.escrowEvent.create({
        data: {
          orderId: existingPayment.orderId,
          type: ESCROW_EVENT_TYPE.FUNDED,
          amountPi: existingPayment.amountPi,
          status: escrowFundingUpdate.escrowStatus,
          txid: input.txid,
          note: `${normalizePaymentMode(existingPayment.mode)} completed and held by app escrow.`,
          metadataJson: stringifyJson({ paymentId: input.paymentId, mode: existingPayment.mode }),
        },
      });

      if (escrowFundingUpdate.escrowStatus === ESCROW_STATUS.RELEASE_PENDING) {
        await tx.escrowEvent.create({
          data: {
            orderId: existingPayment.orderId,
            type: ESCROW_EVENT_TYPE.RELEASE_SCHEDULED,
            amountPi: escrowFundingUpdate.sellerPayoutPi,
            status: ESCROW_STATUS.RELEASE_PENDING,
            note: `Seller payout is scheduled after the ${ESCROW_DISPUTE_WINDOW_HOURS}-hour dispute window.`,
          },
        });
      }

      return { order, payment };
    });

    const storedOrder = await findOrderById(order.id);

    return response.json({
      ok: true,
      action: 'completed',
      mock: useMockPayment,
      payment: serializePayment(payment),
      order: serializeOrder(storedOrder, { id: storedOrder?.buyerId }),
      piPayment,
    });
  } catch (error) {
    return next(error);
  }
}

app.post('/api/pi/payments/:paymentId/complete', async (request, response, next) => {
  try {
    const { paymentId } = request.params;
    const { orderId, txid } = request.body || {};

    if (!paymentId || !orderId || !txid) {
      return response.status(400).json({ ok: false, error: 'paymentId, orderId, and txid are required.' });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            service: true,
            payments: true,
          },
        },
      },
    });

    if (!existingPayment) {
      return response.status(404).json({ ok: false, error: 'Payment was not approved by this server.' });
    }

    if (existingPayment.orderId !== orderId) {
      return response.status(409).json({ ok: false, error: 'Payment does not belong to this order.' });
    }

    if (!['approved', 'completed'].includes(existingPayment.status)) {
      return response.status(409).json({ ok: false, error: 'Payment must be approved before completion.' });
    }

    const useMockPayment = USE_MOCK_PAYMENTS || existingPayment.mock;

    const piPayment = useMockPayment
      ? createMockPaymentDto({
          paymentId,
          orderId,
          serviceId: existingPayment.serviceId,
          amountPi: existingPayment.amountPi,
          mode: existingPayment.mode,
          txid,
          phase: 'completed',
        })
      : await callPiPlatform(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid });

    const nextStatus = resolveStatusAfterPayment(existingPayment.order, existingPayment);
    const nextPaidTotal = calculatePaidTotal(existingPayment.order, existingPayment);
    const completedAt = new Date();
    const escrowFundingUpdate = buildEscrowFundingUpdate(
      existingPayment.order,
      existingPayment,
      nextStatus,
      nextPaidTotal,
      completedAt,
    );

    const { order, payment } = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          txid,
          status: 'completed',
          mock: useMockPayment,
          piPaymentJson: stringifyJson(piPayment),
        },
      });

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          paidAt: completedAt,
          paymentMode: normalizePaymentMode(existingPayment.mode),
          amountPi: nextPaidTotal,
          platformFeePi: calculatePlatformFee(nextPaidTotal),
          ...escrowFundingUpdate,
        },
      });

      await tx.escrowEvent.create({
        data: {
          orderId,
          type: ESCROW_EVENT_TYPE.FUNDED,
          amountPi: existingPayment.amountPi,
          status: escrowFundingUpdate.escrowStatus,
          txid,
          note: `${normalizePaymentMode(existingPayment.mode)} completed and held by app escrow.`,
          metadataJson: stringifyJson({ paymentId, mode: existingPayment.mode }),
        },
      });

      if (escrowFundingUpdate.escrowStatus === ESCROW_STATUS.RELEASE_PENDING) {
        await tx.escrowEvent.create({
          data: {
            orderId,
            type: ESCROW_EVENT_TYPE.RELEASE_SCHEDULED,
            amountPi: escrowFundingUpdate.sellerPayoutPi,
            status: ESCROW_STATUS.RELEASE_PENDING,
            note: `Seller payout is scheduled after the ${ESCROW_DISPUTE_WINDOW_HOURS}-hour dispute window.`,
          },
        });
      }

      return { order, payment };
    });

    const storedOrder = await findOrderById(order.id);

    return response.json({
      ok: true,
      mock: useMockPayment,
      payment: serializePayment(payment),
      order: serializeOrder(storedOrder, { id: storedOrder?.buyerId }),
      piPayment,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/orders/:orderId/status', async (request, response, next) => {
  try {
    await releaseEligibleEscrows();
    const order = await findOrderById(request.params.orderId);

    if (!order) {
      return response.status(404).json({
        ok: false,
        error: 'Order status is not available on the payment server yet.',
      });
    }

    const viewer = await getRequestViewer(request);
    return response.json({ ok: true, order: serializeOrder(order, viewer) });
  } catch (error) {
    return next(error);
  }
});

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);

  return response.status(error.statusCode || 500).json({
    ok: false,
    error: error.message || 'Unexpected PiDeal server error.',
  });
});

const server = app.listen(PORT, () => {
  console.log(`PiDeal backend listening on http://127.0.0.1:${PORT}`);
  console.log(`Pi payments mode: ${USE_MOCK_PAYMENTS ? 'mock' : 'pi-platform-api'}`);
});

process.once('SIGINT', () => shutdown(server));
process.once('SIGTERM', () => shutdown(server));

function normalizeServiceInput(body) {
  const pricePi = positiveNumber(body.pricePi, 'pricePi');
  const depositPi = positiveNumber(body.depositPi, 'depositPi');
  const deliveryDays = positiveInteger(body.deliveryDays, 'deliveryDays');

  if (depositPi > pricePi) {
    badRequest('depositPi must be equal to or lower than pricePi.');
  }

  const title = requiredString(body.title, 'title');
  const summary = requiredString(body.summary, 'summary');
  const terms = requiredString(body.terms, 'terms');
  const category = requiredString(body.category, 'category');
  const sellerId = requiredString(body.sellerId, 'sellerId');
  const sellerName = requiredString(body.sellerName, 'sellerName');
  const portfolioUrl = normalizePolicyUrl(body.portfolioUrl, 'portfolio', 'Portfolio URL');
  const proofLink = normalizePolicyUrl(body.proofLink, 'proof', 'Proof link');
  const experience = optionalString(body.experience);
  const revisionPolicy = requiredString(body.revisionPolicy, 'revisionPolicy');
  const requirementsFromBuyer = requiredString(body.requirementsFromBuyer, 'requirementsFromBuyer');

  assertNoExternalContact({
    title,
    summary,
    terms,
    experience,
    revisionPolicy,
    requirementsFromBuyer,
  });
  return {
    id: body.id || createId('service'),
    title,
    category,
    sellerId,
    sellerName,
    sellerHandle: body.sellerHandle || `@${sellerName}`,
    pricePi,
    depositPi,
    deliveryDays,
    accent: body.accent || '#f5b84b',
    icon: String(body.icon || category.slice(0, 2)).toUpperCase().slice(0, 3),
    summary,
    terms,
    portfolioUrl,
    proofLink,
    experience,
    revisionPolicy,
    requirementsFromBuyer,
    deliverables: Array.isArray(body.deliverables)
      ? body.deliverables
      : ['Digital delivery message or link', 'Buyer confirmation required', 'Pi escrow payment'],
  };
}

function normalizeOrderInput(body) {
  return {
    id: body.id || createId('order'),
    serviceId: requiredString(body.serviceId, 'serviceId'),
    buyerId: requiredString(body.buyerId, 'buyerId'),
    buyerName: requiredString(body.buyerName, 'buyerName'),
    buyerNote: String(body.buyerNote || '').trim(),
    requestSourceText: String(body.requestSourceText || '').trim(),
    requestReferenceLink: normalizePolicyUrl(body.requestReferenceLink, 'requestReference', 'Reference link'),
    requestFileName: String(body.requestFileName || '').trim(),
    requestFileSize: String(body.requestFileSize || '').trim(),
  };
}

async function findOrderById(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
}

async function getPublicServiceBySlug(rawSlug) {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return null;

  const service = await prisma.service.findUnique({
    where: { slug },
    include: PUBLIC_SERVICE_INCLUDE,
  });

  if (!service || service.status !== 'approved' || service.seller?.sellerStatus === 'blocked') {
    return null;
  }

  const completedOrders = await prisma.order.count({
    where: {
      serviceId: service.id,
      status: ORDER_STATUS.COMPLETED,
    },
  });

  return serializePublicService(service, { completedOrders });
}

async function createUniqueServiceSlug(title) {
  const baseSlug = slugify(title) || 'service';

  for (let index = 0; index < 20; index += 1) {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    const slug = `${baseSlug}${suffix}`;
    const existingService = await prisma.service.findUnique({ where: { slug } });
    if (!existingService) return slug;
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
}

function normalizeSlug(value) {
  return slugify(String(value || '').slice(0, 180));
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function renderPublicServicePage(request, service) {
  const lang = getPublicLanguage(request);
  const isArabic = lang === 'ar';
  const dir = isArabic ? 'rtl' : 'ltr';
  const t = PUBLIC_SERVICE_TEXT[lang];
  const encodedSlug = encodeURIComponent(service.slug);
  const publicBaseUrl = getPublicBaseUrl(request);
  const shareUrl = `${publicBaseUrl}/service/${encodedSlug}?lang=${lang}`;
  const languageSwitchUrl = `${publicBaseUrl}/service/${encodedSlug}?lang=${isArabic ? 'en' : 'ar'}`;
  const languageSwitchLabel = isArabic ? 'English' : 'العربية';
  const executionUrl = `${getExecutionAppBaseUrl(request)}/?service=${encodedSlug}&from=public&lang=${lang}`;
  const imageUrl = `${publicBaseUrl}/service/${encodedSlug}/share-card.svg?lang=${lang}`;
  const title = `${service.title} | PiDeal`;
  const description = truncateText(
    service.summary || `${service.category} service protected by PiDeal escrow.`,
    155,
  );
  const ratingLabel = service.rating ? `${service.rating} ${t.rating}` : t.newSeller;
  const completedOrdersLabel = `${service.completedOrders || 0} ${t.completed}`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${escapeAttr(shareUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeAttr(service.title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:image" content="${escapeAttr(imageUrl)}" />
    <meta property="og:url" content="${escapeAttr(shareUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(service.title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(imageUrl)}" />
    <style>${getPublicServiceCss()}</style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="copy">
          <div class="public-topbar">
            <span class="eyebrow">${escapeHtml(t.service)}</span>
            <a class="language-link" href="${escapeAttr(languageSwitchUrl)}">${escapeHtml(languageSwitchLabel)}</a>
          </div>
          <h1>${escapeHtml(service.title)}</h1>
          <p>${escapeHtml(description)}</p>
          <div class="badges">
            <span>${escapeHtml(t.escrow)}</span>
            <span>${escapeHtml(t.verifiedIdentity)}</span>
            <span>${escapeHtml(t.dispute)}</span>
          </div>
          <div class="actions">
            <a class="primary" href="${escapeAttr(executionUrl)}" data-order>${escapeHtml(t.order)}</a>
            <button class="secondary" type="button" data-share>${escapeHtml(t.share)}</button>
          </div>
        </div>
        <aside class="card">
          <div class="art" style="--accent: ${escapeAttr(service.accent)}">${escapeHtml(service.icon)}</div>
          <dl>
            <div><dt>${escapeHtml(t.price)}</dt><dd>${escapeHtml(String(service.pricePi))} Pi</dd></div>
            <div><dt>${escapeHtml(t.deposit)}</dt><dd>${escapeHtml(String(service.depositPi))} Pi</dd></div>
            <div><dt>${escapeHtml(t.delivery)}</dt><dd>${escapeHtml(String(service.deliveryDays))} ${escapeHtml(t.days)}</dd></div>
          </dl>
        </aside>
      </section>

      <section class="trust">
        <div><strong>${escapeHtml(ratingLabel)}</strong><span>${escapeHtml(t.sellerRating)}</span></div>
        <div><strong>${escapeHtml(completedOrdersLabel)}</strong><span>${escapeHtml(t.publicProof)}</span></div>
        <div><strong>${escapeHtml(service.seller.displayName)}</strong><span>${escapeHtml(formatPublicSellerStatus(service.seller.status, t))}</span></div>
      </section>

      <section class="details">
        <h2>${escapeHtml(t.whatYouGet)}</h2>
        <ul>
          ${service.deliverables.map((item) => `<li>${escapeHtml(formatPublicDeliverable(item, t))}</li>`).join('')}
        </ul>
      </section>
    </main>

    <div class="gate" hidden data-gate>
      <div class="gate-panel">
        <button class="close" type="button" data-close aria-label="${escapeAttr(t.close)}">x</button>
        <span class="eyebrow">${escapeHtml(t.continueSafely)}</span>
        <h2>${escapeHtml(t.ordersInside)}</h2>
        <p>${escapeHtml(t.gateMessage)}</p>
        <div class="gate-grid">
          <span>${escapeHtml(t.secureCheckout)}</span>
          <span>${escapeHtml(t.escrowProtection)}</span>
          <span>${escapeHtml(t.verifiedIdentity)}</span>
          <span>${escapeHtml(t.disputeSupport)}</span>
        </div>
        <a class="primary full" href="${escapeAttr(executionUrl)}">${escapeHtml(t.openPiBrowser)}</a>
        <a class="secondary full" href="https://minepi.com/pi-browser/" rel="noopener">${escapeHtml(t.getPiBrowser)}</a>
      </div>
    </div>

    <script>
      const isPiBrowser = Boolean(window.Pi) || navigator.userAgent.toLowerCase().includes('pibrowser');
      const gate = document.querySelector('[data-gate]');
      document.querySelector('[data-order]').addEventListener('click', (event) => {
        if (isPiBrowser) return;
        event.preventDefault();
        gate.hidden = false;
      });
      document.querySelector('[data-close]').addEventListener('click', () => {
        gate.hidden = true;
      });
      document.querySelector('[data-share]').addEventListener('click', async () => {
        const shareData = {
          title: ${htmlSafeJson(service.title)},
          text: ${htmlSafeJson(description)},
          url: ${htmlSafeJson(shareUrl)}
        };
        if (navigator.share) {
          await navigator.share(shareData).catch(() => {});
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareData.url).catch(() => {});
          alert(${htmlSafeJson(t.linkCopied)});
        }
      });
    </script>
  </body>
</html>`;
}

function renderPublicNotFoundPage(request) {
  const lang = getPublicLanguage(request);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = PUBLIC_SERVICE_TEXT[lang];
  const homeUrl = getExecutionAppBaseUrl(request);

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(t.notFound)} | PiDeal</title>
    <style>${getPublicServiceCss()}</style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="copy">
          <span class="eyebrow">PiDeal</span>
          <h1>${escapeHtml(t.notFound)}</h1>
          <p>${escapeHtml(t.unavailable)}</p>
          <div class="actions"><a class="primary" href="${escapeAttr(homeUrl)}">${escapeHtml(t.openPiDeal)}</a></div>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function renderServiceShareCardSvg(service, lang = 'en') {
  const t = PUBLIC_SERVICE_TEXT[lang] || PUBLIC_SERVICE_TEXT.en;
  const ratingLabel = service.rating ? `${service.rating} ${t.rating}` : t.newSeller;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7fbf8"/>
      <stop offset="1" stop-color="#e6f3ed"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="72" y="70" width="1056" height="490" rx="36" fill="#ffffff" stroke="#d9e7df" stroke-width="4"/>
  <circle cx="160" cy="165" r="58" fill="${escapeAttr(service.accent)}"/>
  <text x="160" y="181" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="#1d2520">${escapeHtml(service.icon)}</text>
  <text x="240" y="145" font-family="Arial, sans-serif" font-size="28" font-weight="800" fill="#2d8f6f">${escapeHtml(t.shareCardTrust)}</text>
  <text x="240" y="215" font-family="Arial, sans-serif" font-size="58" font-weight="900" fill="#121716">${escapeHtml(truncateText(service.title, 42))}</text>
  <text x="240" y="285" font-family="Arial, sans-serif" font-size="30" fill="#52605a">${escapeHtml(truncateText(service.summary, 74))}</text>
  <text x="240" y="390" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#121716">${escapeHtml(String(service.pricePi))} Pi</text>
  <text x="390" y="390" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#121716">${escapeHtml(String(service.deliveryDays))} ${escapeHtml(t.days)}</text>
  <text x="570" y="390" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#121716">${escapeHtml(ratingLabel)}</text>
  <text x="240" y="475" font-family="Arial, sans-serif" font-size="26" fill="#52605a">${escapeHtml(t.shareCardCta)}</text>
</svg>`;
}

function getPublicServiceCss() {
  return `
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #121716; background: #edf5f1; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    .page { width: min(100%, 1080px); margin: 0 auto; padding: 28px 18px 48px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.6fr); gap: 18px; align-items: stretch; }
    .copy, .card, .trust, .details, .gate-panel { border: 1px solid #d9e7df; border-radius: 14px; background: #fff; box-shadow: 0 22px 60px rgba(21, 48, 39, 0.08); }
    .copy { padding: clamp(24px, 6vw, 56px); }
    .public-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .eyebrow { display: inline-block; margin-bottom: 10px; color: #2d8f6f; font-size: 0.78rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
    .public-topbar .eyebrow { margin-bottom: 0; }
    .language-link { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 0 12px; border: 1px solid #d9e7df; border-radius: 8px; color: #1d2520; background: #f8faf7; font-size: 0.88rem; font-weight: 900; text-decoration: none; }
    h1, h2, p { margin: 0; }
    h1 { max-width: 880px; font-size: clamp(2.35rem, 8vw, 5.5rem); line-height: 0.98; letter-spacing: 0; }
    h2 { font-size: clamp(1.45rem, 5vw, 2.35rem); line-height: 1.05; letter-spacing: 0; }
    p { margin-top: 18px; color: #52605a; font-size: clamp(1rem, 2.4vw, 1.25rem); line-height: 1.55; }
    .badges, .actions, .gate-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    .badges span, .gate-grid span { padding: 9px 11px; border-radius: 8px; color: #245845; background: #eef9f4; font-weight: 800; }
    .primary, .secondary { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 18px; border-radius: 8px; border: 1px solid transparent; font: inherit; font-weight: 900; text-decoration: none; cursor: pointer; }
    .primary { color: #fff; background: #2d8f6f; }
    .secondary { color: #1d2520; background: #f4f7f2; border-color: #d9e7df; }
    .full { width: 100%; margin-top: 10px; }
    .card { display: grid; gap: 18px; padding: 18px; }
    .art { display: grid; min-height: 220px; place-items: center; border-radius: 12px; color: #171b18; background: linear-gradient(135deg, var(--accent), #ffffff); font-size: 3rem; font-weight: 950; }
    dl { display: grid; gap: 10px; margin: 0; }
    dl div { display: flex; justify-content: space-between; gap: 14px; padding: 12px; border-radius: 8px; background: #f8faf7; }
    dt { color: #52605a; font-weight: 800; }
    dd { margin: 0; font-weight: 950; }
    .trust { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; padding: 16px; }
    .trust div { padding: 16px; border-radius: 8px; background: #f8faf7; }
    .trust strong, .trust span { display: block; }
    .trust span { margin-top: 5px; color: #52605a; font-weight: 750; }
    .details { margin-top: 18px; padding: 24px; }
    ul { display: grid; gap: 10px; margin: 18px 0 0; padding: 0; list-style: none; }
    li { padding: 12px; border-radius: 8px; background: #f8faf7; color: #26332e; font-weight: 780; }
    .gate { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 18px; background: rgba(18, 23, 22, 0.62); }
    .gate[hidden] { display: none; }
    .gate-panel { position: relative; width: min(100%, 520px); padding: 24px; }
    .close { position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; border: 1px solid #d9e7df; border-radius: 8px; background: #f8faf7; cursor: pointer; }
    [dir="rtl"] .eyebrow { letter-spacing: 0; }
    [dir="rtl"] .close { right: auto; left: 12px; }
    @media (max-width: 760px) {
      .hero { grid-template-columns: 1fr; }
      .trust { grid-template-columns: 1fr; }
      .copy { padding: 24px; }
    }
  `;
}

function getPublicLanguage(request) {
  return request.query?.lang === 'ar' ? 'ar' : 'en';
}

function getPublicBaseUrl(request) {
  const configuredUrl = process.env.PUBLIC_SITE_URL || process.env.PUBLIC_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const protocol = String(request.get('x-forwarded-proto') || request.protocol || 'https').split(',')[0].trim();
  const host = request.get('x-forwarded-host') || request.get('host') || `127.0.0.1:${PORT}`;
  return `${protocol}://${host}`.replace(/\/$/, '');
}

function getExecutionAppBaseUrl(request) {
  return (process.env.FRONTEND_ORIGIN || getPublicBaseUrl(request)).replace(/\/$/, '');
}

function truncateText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function formatDateTimeValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatPublicSellerStatus(status, t = PUBLIC_SERVICE_TEXT.en) {
  if (status === 'verified') return t.verifiedSeller;
  if (status === 'blocked') return t.underReview;
  return t.newSeller;
}

function formatPublicDeliverable(item, t = PUBLIC_SERVICE_TEXT.en) {
  const textKey = PUBLIC_DELIVERABLE_TEXT_KEYS[item];
  return textKey ? t[textKey] : item;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function htmlSafeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

async function findPaymentWithOrder(paymentId) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          service: true,
          payments: true,
        },
      },
    },
  });
}

function normalizeIncompletePaymentInput(body) {
  const piPayment = body.piPayment || body.payment || {};
  const metadata = body.metadata || piPayment.metadata || {};
  const transaction = body.transaction || piPayment.transaction || {};

  return {
    paymentId: String(body.paymentId || body.identifier || body.id || piPayment.identifier || piPayment.paymentId || piPayment.id || '').trim(),
    txid: String(body.txid || transaction.txid || '').trim(),
    orderId: String(body.orderId || metadata.orderId || '').trim(),
    serviceId: String(body.serviceId || metadata.serviceId || '').trim(),
    mode: String(body.mode || metadata.mode || 'deposit').trim(),
    demoMode: body.demoMode === true,
  };
}

function resolveServerPaymentRequest(order, paymentRequest) {
  if (!order.service) {
    badRequest('Order service is required before payment.');
  }

  const mode = ['deposit', 'full', 'balance'].includes(paymentRequest.mode)
    ? paymentRequest.mode
    : 'deposit';
  const servicePrice = Number(order.service.pricePi || 0);
  const depositPi = Number(order.service.depositPi || 0);
  const remainingPi = calculateRemainingPi(order);

  if (mode === 'deposit') {
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      badRequest('Deposit can only be paid after seller acceptance.');
    }
    return {
      ...paymentRequest,
      serviceId: order.serviceId,
      amountPi: Number(Math.min(depositPi, servicePrice).toFixed(2)),
      mode,
      buyerId: order.buyerId,
      buyerName: order.buyerName,
      sellerId: order.sellerId,
      sellerName: order.sellerName,
    };
  }

  if (mode === 'full') {
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      badRequest('Full payment can only be paid before work starts.');
    }
    return {
      ...paymentRequest,
      serviceId: order.serviceId,
      amountPi: Number(servicePrice.toFixed(2)),
      mode,
      buyerId: order.buyerId,
      buyerName: order.buyerName,
      sellerId: order.sellerId,
      sellerName: order.sellerName,
    };
  }

  if (order.status !== ORDER_STATUS.DELIVERED) {
    badRequest('Remaining balance can only be paid after seller delivery.');
  }
  if (remainingPi <= 0) {
    badRequest('No remaining balance is due for this order.');
  }

  return {
    ...paymentRequest,
    serviceId: order.serviceId,
    amountPi: remainingPi,
    mode,
    buyerId: order.buyerId,
    buyerName: order.buyerName,
    sellerId: order.sellerId,
    sellerName: order.sellerName,
  };
}

function resolveStatusAfterPayment(order, payment) {
  const paidTotal = calculatePaidTotal(order, payment);
  const servicePrice = Number(order.service?.pricePi || 0);
  const isFullyPaid = servicePrice > 0 && paidTotal + 0.00001 >= servicePrice;

  if (payment.mode === 'balance') {
    return isFullyPaid ? ORDER_STATUS.COMPLETED : ORDER_STATUS.DELIVERED;
  }

  if (payment.mode === 'full') {
    return order.status === ORDER_STATUS.DELIVERED ? ORDER_STATUS.COMPLETED : ORDER_STATUS.PAID;
  }

  return isFullyPaid ? ORDER_STATUS.PAID : ORDER_STATUS.DEPOSIT_PAID;
}

function calculatePaidTotal(order, currentPayment = null) {
  const paidFromOtherPayments = (order.payments || [])
    .filter((payment) => payment.status === 'completed' && payment.id !== currentPayment?.id)
    .reduce((sum, payment) => sum + Number(payment.amountPi || 0), 0);

  const currentPaymentAmount = currentPayment ? Number(currentPayment.amountPi || 0) : 0;

  return Number((paidFromOtherPayments + currentPaymentAmount).toFixed(2));
}

function calculateRemainingPi(order) {
  const servicePrice = Number(order.service?.pricePi || 0);
  const paidTotal = calculatePaidTotal(order);
  return Number(Math.max(servicePrice - paidTotal, 0).toFixed(2));
}

function buildEscrowFundingUpdate(order, payment, nextStatus, paidTotal, now = new Date()) {
  const paidPi = Number(Number(paidTotal || 0).toFixed(2));
  const platformFeePi = calculatePlatformFee(paidPi) || 0;
  const sellerPayoutPi = Number(Math.max(paidPi - platformFeePi, 0).toFixed(2));
  const isCompleted = nextStatus === ORDER_STATUS.COMPLETED;
  const isFullyPaid = calculateRemainingAfterPaidTotal(order, paidPi) <= 0;

  if (isCompleted) {
    const releaseEligibleAt = getEscrowReleaseEligibleAt(now);
    return {
      escrowStatus: ESCROW_STATUS.RELEASE_PENDING,
      escrowHeldPi: paidPi,
      escrowFeePi: platformFeePi,
      sellerPayoutPi,
      escrowFundedAt: order.escrowFundedAt || now,
      disputeWindowEndsAt: releaseEligibleAt,
      releaseEligibleAt,
      releasedAt: null,
      refundRecordedAt: null,
      refundedPi: 0,
    };
  }

  return {
    escrowStatus: isFullyPaid ? ESCROW_STATUS.HOLDING_FULL : ESCROW_STATUS.HOLDING_DEPOSIT,
    escrowHeldPi: paidPi,
    escrowFeePi: platformFeePi,
    sellerPayoutPi: isFullyPaid ? sellerPayoutPi : 0,
    escrowFundedAt: order.escrowFundedAt || now,
    releasedAt: null,
    refundRecordedAt: null,
    refundedPi: 0,
  };
}

function buildEscrowReleaseScheduleUpdate(order, now = new Date()) {
  const paidTotal = calculateEscrowPaidTotal(order);
  const platformFeePi = calculatePlatformFee(paidTotal) || 0;
  const sellerPayoutPi = Number(Math.max(paidTotal - platformFeePi, 0).toFixed(2));
  const releaseEligibleAt = getEscrowReleaseEligibleAt(now);

  return {
    escrowStatus: ESCROW_STATUS.RELEASE_PENDING,
    escrowHeldPi: paidTotal,
    escrowFeePi: platformFeePi,
    sellerPayoutPi,
    platformFeePi,
    amountPi: paidTotal,
    escrowFundedAt: order.escrowFundedAt || now,
    disputeWindowEndsAt: releaseEligibleAt,
    releaseEligibleAt,
    releasedAt: null,
    refundRecordedAt: null,
    refundedPi: 0,
  };
}

function buildEscrowReleaseUpdate(order, now = new Date()) {
  const paidTotal = calculateEscrowPaidTotal(order);
  const platformFeePi = calculatePlatformFee(paidTotal) || 0;
  const sellerPayoutPi = Number(Math.max(paidTotal - platformFeePi, 0).toFixed(2));

  return {
    escrowStatus: ESCROW_STATUS.RELEASED,
    escrowHeldPi: 0,
    escrowFeePi: platformFeePi,
    sellerPayoutPi,
    platformFeePi,
    amountPi: paidTotal,
    disputeResolvedAt: order.status === ORDER_STATUS.DISPUTED ? now : order.disputeResolvedAt,
    releaseEligibleAt: order.releaseEligibleAt || now,
    releasedAt: now,
  };
}

async function releaseEligibleEscrows(now = new Date()) {
  const dueOrders = await prisma.order.findMany({
    where: {
      status: ORDER_STATUS.COMPLETED,
      escrowStatus: ESCROW_STATUS.RELEASE_PENDING,
      releaseEligibleAt: { lte: now },
    },
    include: ORDER_INCLUDE,
  });
  const orderIds = [];
  const payoutIds = [];

  for (const order of dueOrders) {
    const released = await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: ORDER_INCLUDE,
      });

      if (
        !currentOrder ||
        currentOrder.status !== ORDER_STATUS.COMPLETED ||
        currentOrder.escrowStatus !== ESCROW_STATUS.RELEASE_PENDING ||
        !currentOrder.releaseEligibleAt ||
        currentOrder.releaseEligibleAt > now
      ) {
        return false;
      }

      const releaseUpdate = buildEscrowReleaseUpdate(currentOrder, now);

      await tx.order.update({
        where: { id: currentOrder.id },
        data: releaseUpdate,
      });

      await tx.escrowEvent.create({
        data: {
          orderId: currentOrder.id,
          type: ESCROW_EVENT_TYPE.RELEASED,
          amountPi: releaseUpdate.sellerPayoutPi,
          status: ESCROW_STATUS.RELEASED,
          note: 'Escrow settled after the dispute window ended without an open dispute. Seller payout queued for manual transfer.',
        },
      });

      const payout = await queueSellerPayout(tx, currentOrder, releaseUpdate, now);

      return {
        orderId: currentOrder.id,
        payoutId: payout?.id || '',
      };
    });

    if (released) {
      orderIds.push(released.orderId);
      if (released.payoutId) payoutIds.push(released.payoutId);
    }
  }

  return {
    releasedCount: orderIds.length,
    orderIds,
    payoutIds,
  };
}

async function queueSellerPayout(tx, order, releaseUpdate, now = new Date()) {
  if (!order?.id || !order.sellerId || Number(releaseUpdate.sellerPayoutPi || 0) <= 0) {
    return null;
  }

  const existingPayout = await tx.sellerPayout.findUnique({
    where: { orderId: order.id },
  });

  if (existingPayout) return existingPayout;

  return tx.sellerPayout.create({
    data: {
      orderId: order.id,
      sellerId: order.sellerId,
      grossPi: Number(releaseUpdate.amountPi || 0),
      platformFeePi: Number(releaseUpdate.platformFeePi || 0),
      netPi: Number(releaseUpdate.sellerPayoutPi || 0),
      payoutStatus: SELLER_PAYOUT_STATUS.MANUAL_REQUIRED,
      createdAt: now,
    },
  });
}

function getEscrowReleaseEligibleAt(now = new Date()) {
  return new Date(now.getTime() + ESCROW_DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);
}

function calculateRemainingAfterPaidTotal(order, paidTotal) {
  const servicePrice = Number(order.service?.pricePi || 0);
  return Number(Math.max(servicePrice - Number(paidTotal || 0), 0).toFixed(2));
}

function calculateEscrowPaidTotal(order) {
  const paidTotal = calculatePaidTotal(order);
  if (paidTotal > 0) return paidTotal;
  return Number(Number(order.escrowHeldPi || order.amountPi || 0).toFixed(2));
}

async function requireAdmin(request, response, next) {
  try {
    const actorUserId = getActorUserId(request);

    if (!actorUserId) {
      return response.status(401).json({ ok: false, error: 'Admin user id is required.' });
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
    });

    if (actor?.role !== 'admin') {
      return response.status(403).json({ ok: false, error: 'Only admins can moderate services and reports.' });
    }

    request.actor = actor;
    return next();
  } catch (error) {
    return next(error);
  }
}

function getActorUserId(request) {
  return (
    request.get('x-pideal-user-id') ||
    request.body?.actorUserId ||
    request.query?.actorUserId ||
    ''
  ).trim();
}

async function getRequestViewer(request) {
  const userId = getActorUserId(request);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
  });
}

async function getNotificationsForUser(user) {
  const notifications = [];

  const userOrders = await prisma.order.findMany({
    where: {
      OR: [
        { buyerId: user.id },
        { sellerId: user.id },
      ],
    },
    include: ORDER_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });

  for (const order of userOrders) {
    const serviceTitle = order.service?.title || 'this order';

    if (order.buyerId === user.id) {
      if (order.status === ORDER_STATUS.PENDING_PAYMENT) {
        notifications.push(createNotification({
          id: `buyer-pay-deposit-${order.id}`,
          type: 'buyer_payment_due',
          title: 'Order accepted by seller',
          message: `The seller accepted ${serviceTitle}.`,
          targetType: 'order',
          targetId: order.id,
          actionLabel: 'Pay deposit',
          severity: 'warning',
        }));
      }

      if (order.status === ORDER_STATUS.DELIVERED) {
        notifications.push(createNotification({
          id: `buyer-review-delivery-${order.id}`,
          type: 'buyer_delivery_ready',
          title: 'Order delivered',
          message: `Review the delivery for ${serviceTitle}.`,
          targetType: 'order',
          targetId: order.id,
          actionLabel: 'Pay remaining / review delivery',
          severity: calculateRemainingPi(order) > 0 ? 'warning' : 'info',
        }));
      }

      if (order.status === ORDER_STATUS.REFUNDED) {
        notifications.push(createNotification({
          id: `buyer-dispute-result-${order.id}`,
          type: 'buyer_dispute_resolved',
          title: 'Dispute resolved',
          message: `Check the dispute result for ${serviceTitle}.`,
          targetType: 'order',
          targetId: order.id,
          actionLabel: 'Check dispute result',
          severity: 'info',
        }));
      }
    }

    if (order.sellerId === user.id) {
      if (order.status === ORDER_STATUS.REQUESTED) {
        notifications.push(createNotification({
          id: `seller-new-request-${order.id}`,
          type: 'seller_order_requested',
          title: 'New order requested',
          message: `A buyer requested ${serviceTitle}.`,
          targetType: 'order',
          targetId: order.id,
          actionLabel: 'Accept or reject order',
          severity: 'warning',
        }));
      }

      if ([ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.PAID].includes(order.status)) {
        notifications.push(createNotification({
          id: `seller-start-work-${order.id}`,
          type: 'seller_deposit_paid',
          title: 'Deposit paid',
          message: `${serviceTitle} is ready to start.`,
          targetType: 'order',
          targetId: order.id,
          actionLabel: 'Start work',
          severity: 'warning',
        }));
      }

      if (order.status === ORDER_STATUS.COMPLETED) {
        notifications.push(createNotification({
          id: `seller-order-completed-${order.id}`,
          type: 'seller_order_completed',
          title: 'Buyer completed payment',
          message: `${serviceTitle} is complete.`,
          targetType: 'order',
          targetId: order.id,
          actionLabel: 'Order completed',
          severity: 'success',
        }));
      }

      if (order.status === ORDER_STATUS.DISPUTED) {
        notifications.push(createNotification({
          id: `seller-dispute-open-${order.id}`,
          type: 'seller_dispute_opened',
          title: 'Dispute opened',
          message: `${serviceTitle} is under admin review.`,
          targetType: 'order',
          targetId: order.id,
          actionLabel: 'Respond / wait for admin',
          severity: 'danger',
        }));
      }
    }
  }

  if (user.role === 'admin') {
    notifications.push(...await getAdminNotifications());
  }

  return notifications;
}

async function getAdminNotifications() {
  const notifications = [];

  const [pendingServices, openReports, disputedOrders, pendingSellerPayouts, sellersAwaitingVerification] = await Promise.all([
    prisma.service.count({ where: { status: 'pending' } }),
    prisma.report.count({ where: { status: 'open' } }),
    prisma.order.count({ where: { status: ORDER_STATUS.DISPUTED } }),
    prisma.sellerPayout.count({ where: { payoutStatus: SELLER_PAYOUT_STATUS.MANUAL_REQUIRED } }),
    prisma.user.count({
      where: {
        sellerStatus: 'unverified',
        services: { some: { status: { not: 'removed' } } },
      },
    }),
  ]);

  if (pendingServices > 0) {
    notifications.push(createNotification({
      id: 'admin-pending-services',
      type: 'admin_pending_services',
      title: 'Pending services',
      message: `${pendingServices} service listing needs review.`,
      targetType: 'admin',
      targetId: 'services',
      actionLabel: 'Review services',
      severity: 'warning',
    }));
  }

  if (openReports > 0) {
    notifications.push(createNotification({
      id: 'admin-open-reports',
      type: 'admin_pending_reports',
      title: 'Pending reports',
      message: `${openReports} report needs moderation.`,
      targetType: 'admin',
      targetId: 'reports',
      actionLabel: 'Resolve reports',
      severity: 'danger',
    }));
  }

  if (disputedOrders > 0) {
    notifications.push(createNotification({
      id: 'admin-disputed-orders',
      type: 'admin_pending_disputes',
      title: 'Pending disputes',
      message: `${disputedOrders} disputed order needs a decision.`,
      targetType: 'admin',
      targetId: 'orders',
      actionLabel: 'Resolve reports',
      severity: 'danger',
    }));
  }

  if (pendingSellerPayouts > 0) {
    notifications.push(createNotification({
      id: 'admin-pending-seller-payouts',
      type: 'admin_pending_seller_payouts',
      title: 'Pending seller payouts',
      message: `${pendingSellerPayouts} seller payout needs manual transfer verification.`,
      targetType: 'admin',
      targetId: 'payouts',
      actionLabel: 'Complete seller payouts',
      severity: 'warning',
    }));
  }

  if (sellersAwaitingVerification > 0) {
    notifications.push(createNotification({
      id: 'admin-seller-verification',
      type: 'admin_sellers_awaiting_verification',
      title: 'Sellers awaiting verification',
      message: `${sellersAwaitingVerification} seller profile needs review.`,
      targetType: 'admin',
      targetId: 'services',
      actionLabel: 'Review sellers',
      severity: 'info',
    }));
  }

  return notifications;
}

function createNotification({ id, type, title, message, targetType, targetId, actionLabel, severity }) {
  return {
    id,
    type,
    title,
    message,
    targetType,
    targetId,
    actionLabel,
    severity,
  };
}

function serializeSellerPayout(payout) {
  return {
    id: payout.id,
    orderId: payout.orderId,
    sellerId: payout.sellerId,
    sellerName: payout.seller?.username || payout.order?.sellerName || 'seller',
    serviceTitle: payout.order?.service?.title || 'Order payout',
    grossPi: Number(payout.grossPi || 0),
    platformFeePi: Number(payout.platformFeePi || 0),
    netPi: Number(payout.netPi || 0),
    payoutStatus: payout.payoutStatus,
    payoutTxid: payout.payoutTxid || '',
    paidAt: formatDateTimeValue(payout.paidAt),
    paidByAdmin: payout.paidByAdmin || '',
    releasedAt: formatDateTimeValue(payout.order?.releasedAt),
    createdAt: formatDateTimeValue(payout.createdAt),
  };
}

function serializeUser(user) {
  return {
    uid: user.id,
    username: user.username,
    role: user.role,
    sellerStatus: user.sellerStatus,
  };
}

function getSessionRole(sessionIdentity) {
  const isConfiguredPiAdmin =
    sessionIdentity.verifiedPi === true &&
    PI_ADMIN_USERNAMES.includes(normalizePiUsername(sessionIdentity.username));

  if (isConfiguredPiAdmin) {
    return 'admin';
  }

  return 'user';
}

function parseEnvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePiUsername(username) {
  return String(username || '').trim().replace(/^@/, '').toLowerCase();
}

async function refreshServiceRating(serviceId) {
  if (!serviceId) return;

  const aggregate = await prisma.review.aggregate({
    where: { serviceId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      rating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0,
      reviewCount: aggregate._count.rating,
    },
  });
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requiredString(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    badRequest(`${fieldName} is required.`);
  }
  return text;
}

function positiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    badRequest(`${fieldName} must be a positive number.`);
  }
  return number;
}

function normalizeNonNegativeNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}

function positiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    badRequest(`${fieldName} must be a positive integer.`);
  }
  return number;
}

function optionalString(value) {
  return String(value || '').trim();
}

function assertNoExternalContact(fields) {
  const contactPattern =
    /(@[\w.-]+\.\w{2,}|[\w.%+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|\b(?:whatsapp|telegram|instagram|facebook|snapchat|tiktok|discord|wechat|line|signal|email|gmail|phone|mobile|call me|dm me|contact me)\b|(?:wa\.me|t\.me|telegram\.me|instagram\.com|facebook\.com|fb\.com|discord\.gg))/i;

  for (const [fieldName, value] of Object.entries(fields)) {
    if (contactPattern.test(String(value || ''))) {
      badRequest(`${fieldName} cannot include external contact methods.`);
    }
  }
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}
