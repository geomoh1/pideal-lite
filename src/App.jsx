import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  FilePlus2,
  Flag,
  Gauge,
  Home,
  Link as LinkIcon,
  LogIn,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserRound,
  WalletCards,
} from 'lucide-react';
import {
  authenticateWithPi,
  confirmPiDeliveryPayment,
  createPiDepositPayment,
  getPiIntegrationStatus,
} from './piPlaceholders.js';
import {
  cancelOrder as cancelOrderApi,
  createOrder as createOrderApi,
  createReport as createReportApi,
  createService as createServiceApi,
  deliverOrder as deliverOrderApi,
  disputeOrder as disputeOrderApi,
  fetchMarketplaceData,
  removeServiceById,
  refundOrder as refundOrderApi,
  releaseOrder as releaseOrderApi,
  resolveReportById,
  reviewOrder as reviewOrderApi,
  startOrder as startOrderApi,
  syncUserSession,
  updateSellerStatus as updateSellerStatusApi,
  updateServiceStatus,
} from './api.js';

const ORDER_STATUS = {
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid',
  IN_PROGRESS: 'In Progress',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

const categories = [
  'All',
  'Design',
  'Writing',
  'Translation',
  'Images',
  'Code',
  'Prompts',
  'Templates',
];

const accentOptions = ['#f5b84b', '#72c7b8', '#8ea7ff', '#ef7d8a', '#b98cff', '#66a5ad'];

const blankService = {
  title: '',
  category: 'Design',
  pricePi: '',
  depositPi: '',
  deliveryDays: '',
  icon: '',
  accent: accentOptions[0],
  summary: '',
  terms: '',
  portfolioUrl: '',
  proofLink: '',
  experience: '',
  revisionPolicy: '',
  requirementsFromBuyer: '',
};

const blankRequestAsset = {
  sourceText: '',
  referenceLink: '',
  fileName: '',
  fileSize: '',
};

const demoUsers = [
  {
    uid: 'buyer-ali',
    username: 'ali.pi',
    role: 'Demo Browse',
    targetMode: 'Browse',
    walletStatus: 'Demo browsing account. No Pi Browser required.',
  },
  {
    uid: 'pi-user-placeholder',
    username: 'pioneer.demo',
    role: 'Demo Sell',
    targetMode: 'Sell',
    walletStatus: 'Demo selling account. Payments stay in mock mode.',
  },
  {
    uid: 'admin-lina',
    username: 'lina.admin',
    role: 'Demo Admin',
    targetMode: 'Admin',
    walletStatus: 'Demo admin account for moderation testing.',
  },
];

const orderFlowSteps = [
  { status: ORDER_STATUS.PENDING_PAYMENT, label: 'Pay' },
  { status: ORDER_STATUS.PAID, label: 'Paid' },
  { status: ORDER_STATUS.IN_PROGRESS, label: 'Work' },
  { status: ORDER_STATUS.DELIVERED, label: 'Delivery' },
  { status: ORDER_STATUS.COMPLETED, label: 'Rating' },
];

function App() {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('home');
  const [selectedMode, setSelectedMode] = useState('Browse');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [newService, setNewService] = useState(blankService);
  const [requestNote, setRequestNote] = useState('');
  const [requestAsset, setRequestAsset] = useState(blankRequestAsset);
  const [orderTab, setOrderTab] = useState('buyer');
  const [adminTab, setAdminTab] = useState('services');
  const [deliveryDrafts, setDeliveryDrafts] = useState({});
  const [flowError, setFlowError] = useState('');
  const [flowNotice, setFlowNotice] = useState('');
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState('');
  const piIntegrationStatus = getPiIntegrationStatus();

  const currentUserId = user?.uid;
  const isAdmin = user?.appRole === 'admin';

  useEffect(() => {
    let isMounted = true;

    async function loadMarketplace() {
      try {
        setMarketplaceLoading(true);
        const data = await fetchMarketplaceData();
        if (!isMounted) return;

        setServices(data.services);
        setOrders(data.orders);
        setReports(data.reports);
        setMarketplaceError('');
      } catch (error) {
        if (!isMounted) return;
        setMarketplaceError(getErrorMessage(error, 'Could not load marketplace data from the backend.'));
      } finally {
        if (isMounted) {
          setMarketplaceLoading(false);
        }
      }
    }

    loadMarketplace();

    return () => {
      isMounted = false;
    };
  }, []);

  const approvedServices = useMemo(
    () => services.filter((service) => service.status === 'approved' && service.sellerStatus !== 'blocked'),
    [services],
  );

  const filteredServices = useMemo(() => {
    return approvedServices.filter((service) => {
      const categoryMatch = selectedCategory === 'All' || service.category === selectedCategory;
      const textMatch = [service.title, service.summary, service.seller, service.category]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
      return categoryMatch && textMatch;
    });
  }, [approvedServices, query, selectedCategory]);

  useEffect(() => {
    if (!services.length) return;

    if (!selectedServiceId || !services.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(services[0].id);
    }
  }, [selectedServiceId, services]);

  const selectedService = useMemo(
    () =>
      services.find((service) => service.id === selectedServiceId) ??
      approvedServices[0] ??
      services[0] ??
      null,
    [approvedServices, selectedServiceId, services],
  );

  const featuredServices = approvedServices.filter((service) => service.featured).slice(0, 3);
  const latestServices = [...approvedServices]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 4);
  const activeOrder = orders.find(
    (order) => order.serviceId === selectedService?.id && order.buyerId === currentUserId,
  );

  const userBuyerOrders = orders.filter((order) => order.buyerId === currentUserId);
  const userSellerOrders = orders.filter((order) => order.sellerId === currentUserId);
  const userServices = services.filter((service) => service.sellerId === currentUserId);
  const isInitialMarketplaceLoading =
    marketplaceLoading && services.length === 0 && orders.length === 0 && reports.length === 0;

  function replaceOrder(updatedOrder) {
    setOrders((current) => {
      const exists = current.some((order) => order.id === updatedOrder.id);
      if (!exists) return [updatedOrder, ...current];
      return current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order));
    });
  }

  function replaceService(updatedService) {
    setServices((current) => {
      const exists = current.some((service) => service.id === updatedService.id);
      if (!exists) return [updatedService, ...current];
      return current.map((service) => (service.id === updatedService.id ? updatedService : service));
    });
  }

  function replaceReport(updatedReport) {
    setReports((current) =>
      current.map((report) => (report.id === updatedReport.id ? updatedReport : report)),
    );
  }

  async function attachServerRole(authenticatedUser) {
    const sessionUser = await syncUserSession(authenticatedUser);
    return {
      ...authenticatedUser,
      appRole: sessionUser.role,
    };
  }

  async function getAuthenticatedPiUser() {
    if (user) return user;

    // Official Pi auth must stay inside src/piPlaceholders.js.
    try {
      const piUser = await authenticateWithPi();
      const sessionUser = await attachServerRole(piUser);
      setUser(sessionUser);
      if (sessionUser.appRole !== 'admin' && selectedMode === 'Admin') {
        setSelectedMode('Browse');
      }
      setFlowError('');
      setFlowNotice(`Connected as ${sessionUser.username}.`);
      return sessionUser;
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Pi login failed. Open in Pi Browser or check the official Pi SDK setup.'));
      setFlowNotice('');
      return null;
    }
  }

  async function handlePiLogin() {
    await getAuthenticatedPiUser();
  }

  async function handleDemoUser(demoUser) {
    const demoSession = {
      uid: demoUser.uid,
      username: demoUser.username,
      accessToken: 'local-demo-access-token',
      walletStatus: demoUser.walletStatus,
      authProvider: 'demo',
      demoMode: true,
    };

    let nextUser;
    try {
      nextUser = await attachServerRole(demoSession);
    } catch {
      nextUser = {
        ...demoSession,
        appRole: demoUser.uid === 'admin-lina' ? 'admin' : 'user',
      };
    }

    const targetMode = nextUser.appRole === 'admin' ? demoUser.targetMode : demoUser.targetMode === 'Admin' ? 'Browse' : demoUser.targetMode;
    setUser(nextUser);
    setSelectedMode(targetMode);
    setFlowError('');
    setFlowNotice(`Demo account active: ${demoUser.username}.`);

    if (targetMode === 'Browse') {
      setOrderTab('buyer');
      setActiveView('home');
    }

    if (targetMode === 'Sell') {
      setOrderTab('seller');
      setActiveView('orders');
    }

    if (targetMode === 'Admin' && nextUser.appRole === 'admin') {
      setActiveView('admin');
    }
  }

  function openService(serviceId) {
    setSelectedServiceId(serviceId);
    setActiveView('detail');
    setRequestNote('');
    setRequestAsset(blankRequestAsset);
  }

  function updateRequestAsset(field, value) {
    const patch = typeof field === 'object' ? field : { [field]: value };
    setRequestAsset((current) => ({ ...current, ...patch }));
  }

  async function handleAddService(event) {
    event.preventDefault();
    const pricePi = Number(newService.pricePi);
    const depositPi = Number(newService.depositPi);
    const deliveryDays = Number(newService.deliveryDays);

    const listing = {
      title: newService.title.trim(),
      category: newService.category,
      sellerId: user?.uid ?? 'pi-user-placeholder',
      sellerName: user?.username ?? 'pioneer.demo',
      sellerHandle: user ? `@${user.username}` : '@pioneer.demo',
      pricePi,
      depositPi,
      deliveryDays,
      accent: newService.accent,
      icon: (newService.icon || newService.category.slice(0, 2)).toUpperCase().slice(0, 3),
      summary: newService.summary.trim(),
      terms: newService.terms.trim(),
      portfolioUrl: newService.portfolioUrl.trim(),
      proofLink: newService.proofLink.trim(),
      experience: newService.experience.trim(),
      revisionPolicy: newService.revisionPolicy.trim(),
      requirementsFromBuyer: newService.requirementsFromBuyer.trim(),
      deliverables: ['Digital delivery message or link', 'Buyer confirmation required', 'Pi payment placeholder'],
    };

    try {
      const createdService = await createServiceApi(listing);
      setServices((current) => [createdService, ...current]);
      setNewService(blankService);
      setFlowError('');
      setFlowNotice('Service submitted for admin review.');
      setSelectedMode('Sell');
      setActiveView(isAdmin ? 'admin' : 'profile');
      if (isAdmin) {
        setAdminTab('services');
      }
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Service could not be submitted to the backend.'));
      setFlowNotice('');
    }
  }

  async function handleRequestService(service) {
    const buyer = await getAuthenticatedPiUser();
    if (!buyer) {
      return;
    }

    if (service.sellerId === buyer.uid) {
      setFlowError('This is your own listing. Buyer requests will appear in Orders > Selling.');
      setFlowNotice('');
      return;
    }

    if (activeOrder) {
      setFlowError('You already have an active order for this service.');
      setFlowNotice('');
      return;
    }

    const orderRequest = {
      serviceId: service.id,
      buyerId: buyer.uid,
      buyerName: buyer.username,
      buyerNote: requestNote.trim(),
      requestSourceText: requestAsset.sourceText.trim(),
      requestReferenceLink: requestAsset.referenceLink.trim(),
      requestFileName: requestAsset.fileName,
      requestFileSize: requestAsset.fileSize,
    };

    try {
      const createdOrder = await createOrderApi(orderRequest);
      setFlowError('');
      setFlowNotice('Order created. Choose a deposit or full payment to continue.');
      setOrders((current) => [createdOrder, ...current.filter((item) => item.id !== createdOrder.id)]);
      setRequestNote('');
      setRequestAsset(blankRequestAsset);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be created on the backend.'));
      setFlowNotice('');
    }
  }

  async function handlePayOrder(orderId, mode) {
    const order = orders.find((item) => item.id === orderId);
    const service = services.find((item) => item.id === order?.serviceId);
    if (!order || !service) return;
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      setFlowError('This order is not waiting for payment.');
      setFlowNotice('');
      return;
    }

    const amountPi = mode === 'full' ? service.pricePi : service.depositPi;

    let paymentResult;
    try {
      // Official Pi payment creation/approval/completion must stay inside src/piPlaceholders.js.
      paymentResult = await createPiDepositPayment({
        orderId,
        serviceId: service.id,
        amountPi,
        mode,
        buyerId: order.buyerId,
        buyerName: order.buyerName,
        sellerId: order.sellerId,
        sellerName: order.sellerName,
        demoMode: user?.demoMode === true,
      });
      if (paymentResult.order?.status !== ORDER_STATUS.PAID) {
        throw new Error('Payment server did not mark this order as paid.');
      }
      setFlowError('');
    } catch (error) {
      setFlowError(
        error instanceof Error
          ? error.message
          : 'Pi payment could not be completed. Open in Pi Browser and configure official server-side approval/completion.',
      );
      setFlowNotice('');
      return;
    }

    setFlowNotice('Payment completed by the backend. The seller can start work now.');
    setOrders((current) =>
      current.map((item) =>
        item.id === orderId ? { ...paymentResult.order, payment: paymentResult.payment } : item,
      ),
    );
  }

  async function handleStartOrder(orderId) {
    try {
      const updatedOrder = await startOrderApi(orderId);
      setFlowNotice('Order moved to In Progress.');
      setFlowError('');
      replaceOrder(updatedOrder);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be moved to In Progress.'));
      setFlowNotice('');
    }
  }

  function updateDeliveryDraft(orderId, field, value) {
    const patch = typeof field === 'object' ? field : { [field]: value };

    setDeliveryDrafts((current) => ({
      ...current,
      [orderId]: {
        deliveryMessage: '',
        deliveryLink: '',
        deliveryFileName: '',
        deliveryFileSize: '',
        ...current[orderId],
        ...patch,
      },
    }));
  }

  async function handleDeliverOrder(orderId) {
    const draft = deliveryDrafts[orderId] ?? {};
    try {
      const updatedOrder = await deliverOrderApi(orderId, {
        deliveryMessage: draft.deliveryMessage || 'Delivery submitted by seller.',
        deliveryLink: draft.deliveryLink || '',
        deliveryFileName: draft.deliveryFileName || '',
        deliveryFileSize: draft.deliveryFileSize || '',
      });
      setFlowNotice('Delivery submitted. Waiting for buyer confirmation.');
      setFlowError('');
      replaceOrder(updatedOrder);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Delivery could not be submitted to the backend.'));
      setFlowNotice('');
    }
  }

  async function handleConfirmDelivery(orderId) {
    const order = orders.find((item) => item.id === orderId);
    if (order?.status !== ORDER_STATUS.DELIVERED) {
      setFlowError('Delivery can only be confirmed after the seller submits work.');
      setFlowNotice('');
      return;
    }

    try {
      // Official Pi delivery/payment completion must stay inside src/piPlaceholders.js.
      const confirmation = await confirmPiDeliveryPayment({ orderId });
      setFlowError('');
      if (confirmation.order) {
        replaceOrder(confirmation.order);
      }
    } catch {
      setFlowError('Delivery confirmation failed. Recheck the official Pi completion flow later.');
      setFlowNotice('');
      return;
    }

    setFlowNotice('Delivery confirmed. You can rate the seller now.');
  }

  async function handleRateOrder(orderId, rating) {
    try {
      const updatedOrder = await reviewOrderApi(orderId, rating);
      setFlowNotice(`Seller rated ${rating} stars.`);
      setFlowError('');
      replaceOrder(updatedOrder);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Seller rating could not be saved.'));
      setFlowNotice('');
    }
  }

  async function handleCancelOrder(orderId) {
    try {
      const updatedOrder = await cancelOrderApi(orderId);
      setFlowNotice('Order cancelled.');
      setFlowError('');
      replaceOrder(updatedOrder);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be cancelled.'));
      setFlowNotice('');
    }
  }

  async function handleDisputeOrder(orderId) {
    try {
      const updatedOrder = await disputeOrderApi(orderId);
      setFlowNotice('Order marked as disputed for admin review.');
      setFlowError('');
      replaceOrder(updatedOrder);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be marked as disputed.'));
      setFlowNotice('');
    }
  }

  async function moderateService(serviceId, nextStatus) {
    try {
      const updatedService = await updateServiceStatus(serviceId, nextStatus, user);
      setFlowNotice(`Service ${nextStatus}.`);
      setFlowError('');
      replaceService(updatedService);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Service moderation change could not be saved.'));
      setFlowNotice('');
    }
  }

  async function updateSellerStatus(sellerId, sellerStatus) {
    try {
      await updateSellerStatusApi(sellerId, sellerStatus, user);
      setFlowNotice(`Seller marked ${sellerStatus}.`);
      setFlowError('');
      setServices((current) =>
        current.map((service) =>
          service.sellerId === sellerId ? { ...service, sellerStatus } : service,
        ),
      );
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Seller status could not be updated.'));
      setFlowNotice('');
    }
  }

  async function removeService(serviceId) {
    try {
      await removeServiceById(serviceId, user);
      setFlowNotice('Service removed from moderation.');
      setFlowError('');
      setServices((current) => current.filter((service) => service.id !== serviceId));
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Service could not be removed.'));
      setFlowNotice('');
    }
  }

  async function reportService(service) {
    try {
      const report = await createReportApi({
        serviceId: service.id,
        serviceTitle: service.title,
        reporterId: user?.uid,
        reporterName: user?.username,
        reason: 'Buyer reported this digital service for admin review.',
      });
      setFlowNotice('Report sent to admin moderation.');
      setFlowError('');
      setReports((current) => [report, ...current.filter((item) => item.id !== report.id)]);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Report could not be sent to admin moderation.'));
      setFlowNotice('');
    }
  }

  async function resolveReport(reportId) {
    try {
      const report = await resolveReportById(reportId, user);
      setFlowNotice('Report resolved.');
      setFlowError('');
      replaceReport(report);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Report could not be resolved.'));
      setFlowNotice('');
    }
  }

  async function refundOrder(orderId) {
    try {
      const updatedOrder = await refundOrderApi(orderId, user);
      setFlowNotice('Dispute resolved: buyer refund recorded.');
      setFlowError('');
      replaceOrder(updatedOrder);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be marked refunded.'));
      setFlowNotice('');
    }
  }

  async function releaseOrder(orderId) {
    try {
      const updatedOrder = await releaseOrderApi(orderId, user);
      setFlowNotice('Dispute resolved: order released to seller.');
      setFlowError('');
      replaceOrder(updatedOrder);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be released to seller.'));
      setFlowNotice('');
    }
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <button className="brand-button" onClick={() => setActiveView('home')} aria-label="PiDeal home">
          <span className="brand-mark">Pi</span>
          <span>
            <strong>PiDeal</strong>
            <small>Buy and sell digital services with Pi.</small>
          </span>
        </button>
        <button className="icon-button" aria-label="Notifications">
          <Bell size={19} />
        </button>
      </header>

      <main>
        <PiAccessStrip
          user={user}
          selectedMode={selectedMode}
          piIntegrationStatus={piIntegrationStatus}
          onLogin={handlePiLogin}
          onDemoUser={handleDemoUser}
        />
        {flowError && <FlowError message={flowError} />}
        {flowNotice && <FlowNotice message={flowNotice} />}
        {marketplaceError && <FlowError message={marketplaceError} />}
        {isInitialMarketplaceLoading && <LoadingState message="Loading marketplace data..." />}

        {!isInitialMarketplaceLoading && activeView === 'home' && (
          <HomeView
            query={query}
            setQuery={setQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            filteredServices={filteredServices}
            featuredServices={featuredServices}
            latestServices={latestServices}
            openService={openService}
          />
        )}

        {!isInitialMarketplaceLoading && activeView === 'detail' && selectedService && (
          <DetailView
            user={user}
            service={selectedService}
            activeOrder={activeOrder}
            requestNote={requestNote}
            setRequestNote={setRequestNote}
            requestAsset={requestAsset}
            updateRequestAsset={updateRequestAsset}
            onBack={() => setActiveView('home')}
            onRequest={handleRequestService}
            onPay={handlePayOrder}
            onConfirmDelivery={handleConfirmDelivery}
            onRateOrder={handleRateOrder}
            onDisputeOrder={handleDisputeOrder}
            onReportService={reportService}
          />
        )}

        {!isInitialMarketplaceLoading && activeView === 'add' && (
          <AddServiceView
            user={user}
            newService={newService}
            setNewService={setNewService}
            onSubmit={handleAddService}
            onLogin={handlePiLogin}
          />
        )}

        {!isInitialMarketplaceLoading && activeView === 'orders' && (
          <OrdersView
            user={user}
            orderTab={orderTab}
            setOrderTab={setOrderTab}
            buyerOrders={userBuyerOrders}
            sellerOrders={userSellerOrders}
            services={services}
            deliveryDrafts={deliveryDrafts}
            updateDeliveryDraft={updateDeliveryDraft}
            openService={openService}
            onPay={handlePayOrder}
            onStartOrder={handleStartOrder}
            onDeliverOrder={handleDeliverOrder}
            onConfirmDelivery={handleConfirmDelivery}
            onRateOrder={handleRateOrder}
            onCancelOrder={handleCancelOrder}
            onDisputeOrder={handleDisputeOrder}
            onLogin={handlePiLogin}
          />
        )}

        {!isInitialMarketplaceLoading && activeView === 'profile' && (
          <ProfileView
            user={user}
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            isAdmin={isAdmin}
            userServices={userServices}
            buyerOrders={userBuyerOrders}
            sellerOrders={userSellerOrders}
            onLogin={handlePiLogin}
            openService={openService}
          />
        )}

        {!isInitialMarketplaceLoading && activeView === 'admin' && (
          isAdmin ? (
            <AdminView
              adminTab={adminTab}
              setAdminTab={setAdminTab}
              services={services}
              orders={orders}
              reports={reports}
              moderateService={moderateService}
              updateSellerStatus={updateSellerStatus}
              removeService={removeService}
              resolveReport={resolveReport}
              refundOrder={refundOrder}
              releaseOrder={releaseOrder}
              openService={openService}
            />
          ) : (
            <AdminGate user={user} onLogin={handlePiLogin} />
          )
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        <NavItem icon={<Home size={20} />} label="Home" active={activeView === 'home'} onClick={() => setActiveView('home')} />
        <NavItem icon={<FilePlus2 size={20} />} label="Sell" active={activeView === 'add'} onClick={() => setActiveView('add')} />
        <NavItem icon={<BriefcaseBusiness size={20} />} label="Orders" active={activeView === 'orders'} onClick={() => setActiveView('orders')} />
        <NavItem icon={<UserRound size={20} />} label="Profile" active={activeView === 'profile'} onClick={() => setActiveView('profile')} />
        {isAdmin && <NavItem icon={<Gauge size={20} />} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />}
      </nav>
    </div>
  );
}

function PiAccessStrip({ user, selectedMode, piIntegrationStatus, onLogin, onDemoUser }) {
  const isRealPiUser = user?.authProvider === 'pi-sdk';
  const showDemoUsers = !isRealPiUser;

  return (
    <section className="wallet-strip">
      <div className="wallet-copy">
        <div>
          <span className="eyebrow">Pi Browser ready</span>
          <p>
            {user
              ? `${isRealPiUser ? 'Signed in' : 'Testing'} as ${user.username}. Active mode: ${selectedMode}.`
              : `Use Pi Login when available, or choose a demo account for testing. Mode: ${piIntegrationStatus.mode}.`}
          </p>
        </div>
        {showDemoUsers && (
          <div className="demo-panel">
            <span className="demo-label">Demo/testing accounts - no Pi Browser required</span>
            <div className="demo-account-switch" aria-label="Demo testing accounts">
              {demoUsers.map((demoUser) => (
                <button
                  key={demoUser.uid}
                  className={user?.uid === demoUser.uid ? 'demo-user-button active' : 'demo-user-button'}
                  onClick={() => onDemoUser(demoUser)}
                >
                  <span>{demoUser.role}</span>
                  <strong>{demoUser.username}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <button className="primary-button compact" onClick={onLogin}>
        {user ? <BadgeCheck size={17} /> : <LogIn size={17} />}
        {user ? 'Connected' : 'Pi Login'}
      </button>
    </section>
  );
}

function FlowError({ message }) {
  return (
    <div className="flow-error" role="alert">
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
  );
}

function FlowNotice({ message }) {
  return (
    <div className="flow-notice" role="status">
      <CheckCircle2 size={18} />
      <span>{message}</span>
    </div>
  );
}

function LoadingState({ message }) {
  return (
    <div className="empty-state loading-state" role="status">
      <Clock3 size={24} />
      <p>{message}</p>
    </div>
  );
}

function HomeView({
  query,
  setQuery,
  selectedCategory,
  setSelectedCategory,
  filteredServices,
  featuredServices,
  latestServices,
  openService,
}) {
  return (
    <section className="view-stack">
      <div className="home-hero">
        <div>
          <span className="eyebrow">PiDeal Lite</span>
          <h1>Fast digital services for Pi pioneers.</h1>
          <p>Browse, order, pay a mock Pi deposit, receive delivery, confirm, and rate.</p>
        </div>
        <div className="hero-metrics">
          <Metric label="Commission" value="5%" />
          <Metric label="Scope" value="Digital only" />
        </div>
      </div>

      <div className="search-panel">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search digital services"
            aria-label="Search services"
          />
        </div>
        <div className="category-row" aria-label="Service categories">
          {categories.map((category) => (
            <button
              key={category}
              className={category === selectedCategory ? 'chip active' : 'chip'}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <ServiceSection title="Featured services" services={featuredServices} openService={openService} />
      <ServiceSection title="Latest services" services={latestServices} openService={openService} />

      <div className="section-heading">
        <div>
          <span className="eyebrow">Marketplace</span>
          <h1>Browse all</h1>
        </div>
        <span className="count-pill">{filteredServices.length} live</span>
      </div>

      <div className="service-grid">
        {filteredServices.map((service) => (
          <ServiceCard key={service.id} service={service} onClick={() => openService(service.id)} />
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="empty-state">
          <Sparkles size={24} />
          <p>No approved service matches this search.</p>
        </div>
      )}
    </section>
  );
}

function ServiceSection({ title, services, openService }) {
  return (
    <section className="compact-section">
      <div className="section-heading tight">
        <h2>{title}</h2>
      </div>
      <div className="horizontal-list">
        {services.map((service) => (
          <button key={service.id} className="mini-service-card" onClick={() => openService(service.id)}>
            <span className="mini-art" style={{ '--accent': service.accent }}>
              {service.icon}
            </span>
            <span>
              <strong>{service.title}</strong>
              <small>{service.pricePi} Pi · {service.deliveryDays}d</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ServiceCard({ service, onClick }) {
  return (
    <button className="service-card" onClick={onClick}>
      <div className="service-art" style={{ '--accent': service.accent }}>
        <span>{service.icon}</span>
      </div>
      <div className="service-body">
        <div>
          <span className="category-label">{service.category}</span>
          <h2>{service.title}</h2>
          <p>{service.summary}</p>
        </div>
        <div className="meta-row">
          <span><Star size={15} /> {service.rating || 'New'}</span>
          <span><ShieldCheck size={15} /> {formatSellerStatus(service.sellerStatus)}</span>
          <span><Clock3 size={15} /> {service.deliveryDays}d</span>
          <strong>{service.pricePi} Pi</strong>
        </div>
      </div>
    </button>
  );
}

function DetailView({
  user,
  service,
  activeOrder,
  requestNote,
  setRequestNote,
  requestAsset,
  updateRequestAsset,
  onBack,
  onRequest,
  onPay,
  onConfirmDelivery,
  onRateOrder,
  onDisputeOrder,
  onReportService,
}) {
  const deliveryConfirmed = activeOrder?.status === ORDER_STATUS.COMPLETED;
  const canConfirm = activeOrder?.status === ORDER_STATUS.DELIVERED;
  const isOwnListing = user?.uid === service.sellerId;
  const isBlockedSeller = service.sellerStatus === 'blocked';

  return (
    <section className="view-stack">
      <button className="ghost-button back-button" onClick={onBack}>
        <ChevronLeft size={18} />
        Home
      </button>

      <article className="detail-panel">
        <div className="detail-hero" style={{ '--accent': service.accent }}>
          <span>{service.category}</span>
          <h1>{service.title}</h1>
          <p>{service.summary}</p>
        </div>

        <div className="seller-row">
          <div className="avatar"><UserRound size={20} /></div>
          <div>
            <strong>{service.seller}</strong>
            <small>{service.sellerHandle}</small>
          </div>
          <span className="rating-pill"><ShieldCheck size={15} /> {formatSellerStatus(service.sellerStatus)}</span>
        </div>

        <div className="price-grid">
          <Metric label="Price" value={`${service.pricePi} Pi`} />
          <Metric label="Deposit" value={`${service.depositPi} Pi`} />
          <Metric label="Delivery" value={`${service.deliveryDays} days`} />
        </div>

        <div className="deliverables">
          <h2>Delivery</h2>
          {service.deliverables.map((item) => (
            <div className="deliverable" key={item}>
              <CheckCircle2 size={17} />
              <span>{item}</span>
            </div>
          ))}
          <div className="terms-box">
            <span className="eyebrow">Terms</span>
            <p>{service.terms}</p>
          </div>
          <div className="terms-box">
            <span className="eyebrow">Trust signals</span>
            <p>{service.experience || 'New seller profile.'}</p>
            <p><strong>Requirements:</strong> {service.requirementsFromBuyer || 'Buyer brief required before work starts.'}</p>
            <p><strong>Revision policy:</strong> {service.revisionPolicy || 'Revision policy not provided.'}</p>
            {service.portfolioUrl && (
              <span className="delivery-link"><LinkIcon size={15} /> {service.portfolioUrl}</span>
            )}
            {service.proofLink && (
              <span className="delivery-link"><LinkIcon size={15} /> {service.proofLink}</span>
            )}
          </div>
        </div>
      </article>

      <section className="action-panel">
        <div className="section-heading tight">
          <h2>Request service</h2>
          <button className="ghost-button small" onClick={() => onReportService(service)}>
            <Flag size={16} />
            Report
          </button>
        </div>

        {!activeOrder && isOwnListing && (
          <StatusHint
            icon={<BriefcaseBusiness size={18} />}
            text="This is your listing. New buyer requests appear in Orders > Selling."
          />
        )}

        {!activeOrder && isBlockedSeller && (
          <StatusHint
            icon={<AlertTriangle size={18} />}
            text="This seller is blocked while admin reviews trust and safety reports."
          />
        )}

        {!activeOrder && !isOwnListing && !isBlockedSeller && (
          <div className="request-materials">
            <label>
              Brief
              <textarea
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Describe what the seller should create or edit"
                rows={4}
              />
            </label>
            <label>
              Source text
              <textarea
                value={requestAsset.sourceText}
                onChange={(event) => updateRequestAsset('sourceText', event.target.value)}
                placeholder="Paste text for translation, CV edits, prompts, or copy work"
                rows={4}
              />
            </label>
            <label>
              Reference link
              <input
                value={requestAsset.referenceLink}
                onChange={(event) => updateRequestAsset('referenceLink', event.target.value)}
                placeholder="https://example.com/reference"
              />
            </label>
            <label className="file-field">
              Reference file
              <input
                type="file"
                onChange={(event) => updateRequestAsset(filePatchFromInput(event))}
              />
              <span>
                {requestAsset.fileName
                  ? `${requestAsset.fileName} ${requestAsset.fileSize ? `(${requestAsset.fileSize})` : ''}`
                  : 'No file selected'}
              </span>
            </label>
            <button className="primary-button" onClick={() => onRequest(service)}>
              <WalletCards size={19} />
              {user ? 'Request service' : 'Pi Login to order'}
            </button>
          </div>
        )}

        {activeOrder && (
          <OrderProgress
            order={activeOrder}
            service={service}
            onPay={onPay}
            onConfirmDelivery={onConfirmDelivery}
            onRateOrder={onRateOrder}
            onDisputeOrder={onDisputeOrder}
            deliveryConfirmed={deliveryConfirmed}
            canConfirm={canConfirm}
          />
        )}
      </section>
    </section>
  );
}

function OrderProgress({
  order,
  service,
  onPay,
  onConfirmDelivery,
  onRateOrder,
  onDisputeOrder,
  deliveryConfirmed,
  canConfirm,
}) {
  return (
    <div className="order-status">
      <div>
        <span className="eyebrow">Order status</span>
        <strong>{order.status}</strong>
        <p>{order.buyerNote || 'No buyer note added.'}</p>
      </div>
      <OrderMaterials order={order} />
      <StatusTimeline status={order.status} />

      {order.status === ORDER_STATUS.PENDING_PAYMENT && (
        <div className="payment-actions">
          <button className="primary-button" onClick={() => onPay(order.id, 'deposit')}>
            <CircleDollarSign size={18} />
            Pay {service.depositPi} Pi deposit
          </button>
          <button className="secondary-button" onClick={() => onPay(order.id, 'full')}>
            <CircleDollarSign size={18} />
            Pay {service.pricePi} Pi full
          </button>
        </div>
      )}

      {[ORDER_STATUS.PAID, ORDER_STATUS.IN_PROGRESS].includes(order.status) && (
        <StatusHint icon={<Clock3 size={18} />} text="Waiting for seller delivery." />
      )}

      {canConfirm && (
        <div className="delivery-box">
          <span className="eyebrow">Seller delivery</span>
          <p>{order.deliveryMessage}</p>
          {order.deliveryLink && (
            <span className="delivery-link"><LinkIcon size={15} /> {order.deliveryLink}</span>
          )}
          {order.deliveryFileName && (
            <span className="delivery-link">
              <Paperclip size={15} />
              {order.deliveryFileName} {order.deliveryFileSize ? `(${order.deliveryFileSize})` : ''}
            </span>
          )}
          <button className="secondary-button" onClick={() => onConfirmDelivery(order.id)}>
            <ShieldCheck size={18} />
            Confirm delivery
          </button>
          <button className="ghost-button small" onClick={() => onDisputeOrder(order.id)}>
            <AlertTriangle size={16} />
            Dispute
          </button>
        </div>
      )}

      {deliveryConfirmed && (
        <RatingControl
          rating={order.rating}
          onRate={(rating) => onRateOrder(order.id, rating)}
        />
      )}
    </div>
  );
}

function StatusTimeline({ status }) {
  const activeIndex = orderFlowSteps.findIndex((step) => step.status === status);
  const isStopped = [ORDER_STATUS.DISPUTED, ORDER_STATUS.REFUNDED, ORDER_STATUS.CANCELLED].includes(status);

  return (
    <div className={isStopped ? 'status-timeline stopped' : 'status-timeline'} aria-label="Order progress">
      {orderFlowSteps.map((step, index) => {
        const isComplete = activeIndex >= 0 && index <= activeIndex;
        return (
          <span key={step.status} className={isComplete ? 'timeline-step active' : 'timeline-step'}>
            {step.label}
          </span>
        );
      })}
    </div>
  );
}

function OrderMaterials({ order }) {
  const hasMaterials = Boolean(
    order.requestSourceText || order.requestReferenceLink || order.requestFileName,
  );

  if (!hasMaterials) return null;

  return (
    <div className="material-list">
      <span className="eyebrow">Buyer materials</span>
      {order.requestSourceText && <p>{order.requestSourceText}</p>}
      {order.requestReferenceLink && (
        <span className="delivery-link">
          <LinkIcon size={15} />
          {order.requestReferenceLink}
        </span>
      )}
      {order.requestFileName && (
        <span className="delivery-link">
          <Paperclip size={15} />
          {order.requestFileName} {order.requestFileSize ? `(${order.requestFileSize})` : ''}
        </span>
      )}
    </div>
  );
}

function AddServiceView({ user, newService, setNewService, onSubmit, onLogin }) {
  const pricePi = Number(newService.pricePi);
  const depositPi = Number(newService.depositPi);
  const canSubmit =
    newService.title.trim() &&
    newService.summary.trim() &&
    newService.terms.trim() &&
    newService.revisionPolicy.trim() &&
    newService.requirementsFromBuyer.trim() &&
    pricePi > 0 &&
    depositPi > 0 &&
    depositPi <= pricePi &&
    Number(newService.deliveryDays) > 0;

  function updateField(field, value) {
    setNewService((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Seller flow</span>
          <h1>Add service</h1>
        </div>
        <span className="count-pill">{user ? user.username : 'Pi login'}</span>
      </div>

      {!user && (
        <div className="inline-callout">
          <LogIn size={18} />
          <span>Pi login is required before submitting a listing.</span>
          <button className="secondary-button small" onClick={onLogin}>Login</button>
        </div>
      )}

      <form className="form-panel" onSubmit={onSubmit}>
        <label>
          Service title
          <input
            value={newService.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="Logo design for Pi apps"
          />
        </label>

        <label>
          Category
          <select
            value={newService.category}
            onChange={(event) => updateField('category', event.target.value)}
          >
            {categories.filter((category) => category !== 'All').map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <label>
            Price Pi
            <input
              value={newService.pricePi}
              onChange={(event) => updateField('pricePi', event.target.value)}
              inputMode="decimal"
              placeholder="18"
            />
          </label>
          <label>
            Deposit Pi
            <input
              value={newService.depositPi}
              onChange={(event) => updateField('depositPi', event.target.value)}
              inputMode="decimal"
              placeholder="5"
            />
          </label>
        </div>
        {depositPi > pricePi && (
          <p className="field-hint">Deposit should be equal to or lower than the full price.</p>
        )}

        <div className="form-row">
          <label>
            Delivery days
            <input
              value={newService.deliveryDays}
              onChange={(event) => updateField('deliveryDays', event.target.value)}
              inputMode="numeric"
              placeholder="2"
            />
          </label>
          <label>
            Icon letters
            <input
              value={newService.icon}
              onChange={(event) => updateField('icon', event.target.value)}
              maxLength={3}
              placeholder="CV"
            />
          </label>
        </div>

        <div className="swatch-row" aria-label="Service color">
          {accentOptions.map((accent) => (
            <button
              key={accent}
              type="button"
              className={newService.accent === accent ? 'swatch active' : 'swatch'}
              style={{ '--accent': accent }}
              onClick={() => updateField('accent', accent)}
              aria-label={`Use color ${accent}`}
            />
          ))}
        </div>

        <label>
          Summary
          <textarea
            value={newService.summary}
            onChange={(event) => updateField('summary', event.target.value)}
            rows={4}
            placeholder="Describe the digital result the buyer receives"
          />
        </label>

        <label>
          Terms
          <textarea
            value={newService.terms}
            onChange={(event) => updateField('terms', event.target.value)}
            rows={3}
            placeholder="State what the buyer must provide and what is excluded"
          />
        </label>

        <label>
          Experience
          <textarea
            value={newService.experience}
            onChange={(event) => updateField('experience', event.target.value)}
            rows={3}
            placeholder="Briefly describe your relevant digital service experience"
          />
        </label>

        <label>
          Requirements from buyer
          <textarea
            value={newService.requirementsFromBuyer}
            onChange={(event) => updateField('requirementsFromBuyer', event.target.value)}
            rows={3}
            placeholder="List the exact files, text, references, or details you need from the buyer"
          />
        </label>

        <label>
          Revision policy
          <textarea
            value={newService.revisionPolicy}
            onChange={(event) => updateField('revisionPolicy', event.target.value)}
            rows={3}
            placeholder="Example: one small revision after first delivery"
          />
        </label>

        <label>
          Portfolio URL
          <input
            value={newService.portfolioUrl}
            onChange={(event) => updateField('portfolioUrl', event.target.value)}
            placeholder="https://example.com/portfolio"
          />
        </label>

        <label>
          Proof link
          <input
            value={newService.proofLink}
            onChange={(event) => updateField('proofLink', event.target.value)}
            placeholder="https://example.com/work-samples"
          />
        </label>

        <p className="field-hint">Do not include phone numbers, email, messaging apps, or social contact links. Admin reviews listings before publishing.</p>

        <button className="primary-button" disabled={!canSubmit || !user}>
          <Plus size={19} />
          Submit for admin review
        </button>
      </form>
    </section>
  );
}

function OrdersView({
  user,
  orderTab,
  setOrderTab,
  buyerOrders,
  sellerOrders,
  services,
  deliveryDrafts,
  updateDeliveryDraft,
  openService,
  onPay,
  onStartOrder,
  onDeliverOrder,
  onConfirmDelivery,
  onRateOrder,
  onCancelOrder,
  onDisputeOrder,
  onLogin,
}) {
  const visibleOrders = orderTab === 'buyer' ? buyerOrders : sellerOrders;

  return (
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Orders dashboard</span>
          <h1>Orders</h1>
        </div>
        <div className="segmented">
          {['buyer', 'seller'].map((tab) => (
            <button key={tab} className={orderTab === tab ? 'active' : ''} onClick={() => setOrderTab(tab)}>
              {tab === 'buyer' ? 'Buying' : 'Selling'}
            </button>
          ))}
        </div>
      </div>

      {!user && (
        <div className="inline-callout">
          <LogIn size={18} />
          <span>Connect Pi to view buyer and seller orders.</span>
          <button className="secondary-button small" onClick={onLogin}>Login</button>
        </div>
      )}

      <div className="list-panel">
        {visibleOrders.map((order) => {
          const service = services.find((item) => item.id === order.serviceId);
          if (!service) return null;

          return (
            <OrderCard
              key={order.id}
              order={order}
              service={service}
              mode={orderTab}
              draft={deliveryDrafts[order.id] ?? {}}
              updateDeliveryDraft={updateDeliveryDraft}
              openService={openService}
              onPay={onPay}
              onStartOrder={onStartOrder}
              onDeliverOrder={onDeliverOrder}
              onConfirmDelivery={onConfirmDelivery}
              onRateOrder={onRateOrder}
              onCancelOrder={onCancelOrder}
              onDisputeOrder={onDisputeOrder}
            />
          );
        })}

        {visibleOrders.length === 0 && (
          <div className="empty-state">
            <BriefcaseBusiness size={24} />
            <p>{user ? 'No orders in this tab yet.' : 'Pi login required for orders.'}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function OrderCard({
  order,
  service,
  mode,
  draft,
  updateDeliveryDraft,
  openService,
  onPay,
  onStartOrder,
  onDeliverOrder,
  onConfirmDelivery,
  onRateOrder,
  onCancelOrder,
  onDisputeOrder,
}) {
  const hasDeliveryContent = Boolean(
    draft.deliveryMessage?.trim() || draft.deliveryLink?.trim() || draft.deliveryFileName,
  );
  const counterpart = mode === 'seller' ? `Buyer: ${order.buyerName}` : `Seller: ${order.sellerName}`;

  return (
    <article className="order-card">
      <button className="order-title" onClick={() => openService(service.id)}>
        <span>{service.title}</span>
        <StatusBadge status={order.status} />
      </button>
      <p>{counterpart}. {order.buyerNote || 'No buyer note added.'}</p>
      <OrderMaterials order={order} />
      <div className="order-meta-grid">
        <Metric label="Paid" value={`${order.paidPi || 0} Pi`} />
        <Metric label="Fee 5%" value={`${order.platformFeePi || 0} Pi`} />
        <Metric label="Mode" value={order.paymentMode ?? 'Not paid'} />
      </div>

      {mode === 'buyer' && order.status === ORDER_STATUS.PENDING_PAYMENT && (
        <div className="payment-actions">
          <button className="primary-button" onClick={() => onPay(order.id, 'deposit')}>
            Pay {service.depositPi} Pi deposit
          </button>
          <button className="secondary-button" onClick={() => onPay(order.id, 'full')}>
            Pay {service.pricePi} Pi full
          </button>
          <button className="ghost-button small" onClick={() => onCancelOrder(order.id)}>
            Cancel
          </button>
        </div>
      )}

      {mode === 'seller' && order.status === ORDER_STATUS.PAID && (
        <button className="secondary-button" onClick={() => onStartOrder(order.id)}>
          <Clock3 size={18} />
          Start work
        </button>
      )}

      {mode === 'seller' && order.status === ORDER_STATUS.IN_PROGRESS && (
        <div className="delivery-form">
          <label>
            Delivery message
            <textarea
              value={draft.deliveryMessage ?? ''}
              onChange={(event) => updateDeliveryDraft(order.id, 'deliveryMessage', event.target.value)}
              rows={3}
              placeholder="Describe the completed work"
            />
          </label>
          <label>
            Delivery link
            <input
              value={draft.deliveryLink ?? ''}
              onChange={(event) => updateDeliveryDraft(order.id, 'deliveryLink', event.target.value)}
              placeholder="https://example.com/mock-delivery"
            />
          </label>
          <label className="file-field">
            Delivery file
            <input
              type="file"
              onChange={(event) => updateDeliveryDraft(order.id, filePatchFromInput(event, 'delivery'))}
            />
            <span>
              {draft.deliveryFileName
                ? `${draft.deliveryFileName} ${draft.deliveryFileSize ? `(${draft.deliveryFileSize})` : ''}`
                : 'No file selected'}
            </span>
          </label>
          <button className="primary-button" onClick={() => onDeliverOrder(order.id)} disabled={!hasDeliveryContent}>
            <Upload size={18} />
            Submit delivery
          </button>
        </div>
      )}

      {mode === 'buyer' && order.status === ORDER_STATUS.DELIVERED && (
        <div className="delivery-box">
          <span className="eyebrow">Seller delivery</span>
          <p>{order.deliveryMessage}</p>
          {order.deliveryLink && (
            <span className="delivery-link"><LinkIcon size={15} /> {order.deliveryLink}</span>
          )}
          {order.deliveryFileName && (
            <span className="delivery-link">
              <Paperclip size={15} />
              {order.deliveryFileName} {order.deliveryFileSize ? `(${order.deliveryFileSize})` : ''}
            </span>
          )}
          <button className="secondary-button" onClick={() => onConfirmDelivery(order.id)}>
            Confirm delivery
          </button>
          <button className="ghost-button small" onClick={() => onDisputeOrder(order.id)}>
            Dispute
          </button>
        </div>
      )}

      {mode === 'buyer' && order.status === ORDER_STATUS.COMPLETED && (
        <RatingControl rating={order.rating} onRate={(rating) => onRateOrder(order.id, rating)} compact />
      )}
    </article>
  );
}

function ProfileView({
  user,
  selectedMode,
  setSelectedMode,
  isAdmin,
  userServices,
  buyerOrders,
  sellerOrders,
  onLogin,
  openService,
}) {
  const profileModes = isAdmin ? ['Browse', 'Sell', 'Admin'] : ['Browse', 'Sell'];
  const completedOrders = [...buyerOrders, ...sellerOrders].filter(
    (order) => order.status === ORDER_STATUS.COMPLETED,
  );
  const ratedOrders = [...buyerOrders, ...sellerOrders].filter((order) => order.rating);
  const averageRating = ratedOrders.length
    ? (ratedOrders.reduce((sum, order) => sum + order.rating, 0) / ratedOrders.length).toFixed(1)
    : 'New';

  return (
    <section className="view-stack">
      <div className="profile-panel">
        <div className="profile-avatar">
          <UserRound size={28} />
        </div>
        <div>
          <span className="eyebrow">Profile</span>
          <h1>{user ? user.username : 'Pi user'}</h1>
          <p>{user ? user.walletStatus : 'Login with the Pi placeholder to unlock mock buyer and seller data.'}</p>
        </div>
        {!user && (
          <button className="primary-button" onClick={onLogin}>
            <LogIn size={18} />
            Pi Login
          </button>
        )}
      </div>

      <div className="segmented mode-switch">
        {profileModes.map((mode) => (
          <button key={mode} className={selectedMode === mode ? 'active' : ''} onClick={() => setSelectedMode(mode)}>
            {mode}
          </button>
        ))}
      </div>

      <div className="stats-grid">
        <Metric label="Rating" value={averageRating} />
        <Metric label="Buyer orders" value={buyerOrders.length} />
        <Metric label="Seller orders" value={sellerOrders.length} />
        <Metric label="Completed" value={completedOrders.length} />
      </div>

      <section className="list-panel">
        <div className="section-heading tight">
          <h2>Listed services</h2>
          <span className="count-pill">{userServices.length}</span>
        </div>
        {userServices.map((service) => (
          <button key={service.id} className="profile-service-row" onClick={() => openService(service.id)}>
            <span className="mini-art" style={{ '--accent': service.accent }}>{service.icon}</span>
            <span>
              <strong>{service.title}</strong>
              <small>{service.status}</small>
            </span>
          </button>
        ))}
        {userServices.length === 0 && <p className="muted-line">No services listed by this user yet.</p>}
      </section>
    </section>
  );
}

function AdminGate({ user, onLogin }) {
  return (
    <section className="view-stack">
      <div className="inline-callout">
        <ShieldCheck size={18} />
        <span>
          {user
            ? 'This PiDeal account is not assigned as an admin.'
            : 'Admin moderation requires a PiDeal admin account.'}
        </span>
        {!user && <button className="secondary-button small" onClick={onLogin}>Login</button>}
      </div>
      <div className="empty-state">
        <Gauge size={24} />
        <p>Only users with role admin in the backend database can review, approve, reject, block, or remove services.</p>
      </div>
    </section>
  );
}

function AdminView({
  adminTab,
  setAdminTab,
  services,
  orders,
  reports,
  moderateService,
  updateSellerStatus,
  removeService,
  resolveReport,
  refundOrder,
  releaseOrder,
  openService,
}) {
  const pendingCount = services.filter((service) => service.status === 'pending').length;
  const openReports = reports.filter((report) => report.status === 'open');

  return (
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin flow</span>
          <h1>Moderation</h1>
        </div>
        <div className="segmented">
          {['services', 'orders', 'reports'].map((tab) => (
            <button key={tab} className={adminTab === tab ? 'active' : ''} onClick={() => setAdminTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <Metric label="Pending" value={pendingCount} />
        <Metric label="Orders" value={orders.length} />
        <Metric label="Reports" value={openReports.length} />
      </div>

      {adminTab === 'services' && (
        <div className="list-panel">
          {services.map((service) => (
            <article className="moderation-card" key={service.id}>
              <button className="admin-service-title" onClick={() => openService(service.id)}>
                <span className="mini-art" style={{ '--accent': service.accent }}>{service.icon}</span>
                <span>
                  <strong>{service.title}</strong>
                  <small>{service.category} · {service.status}</small>
                </span>
              </button>
              <p>{service.summary}</p>
              <p className="muted-line">Seller status: {formatSellerStatus(service.sellerStatus)}</p>
              <div className="moderation-actions">
                <button className="secondary-button small" onClick={() => moderateService(service.id, 'approved')}>
                  Approve
                </button>
                <button className="ghost-button small" onClick={() => moderateService(service.id, 'rejected')}>
                  Reject
                </button>
                <button className="ghost-button small danger" onClick={() => moderateService(service.id, 'blocked')}>
                  <Ban size={15} />
                  Block
                </button>
                <button className="ghost-button small danger" onClick={() => removeService(service.id)}>
                  Remove
                </button>
                <button className="ghost-button small" onClick={() => updateSellerStatus(service.sellerId, 'verified')}>
                  Verify seller
                </button>
                <button className="ghost-button small danger" onClick={() => updateSellerStatus(service.sellerId, 'blocked')}>
                  Block seller
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {adminTab === 'orders' && (
        <div className="list-panel">
          {orders.map((order) => {
            const service = services.find((item) => item.id === order.serviceId);
            return (
              <article className="order-card" key={order.id}>
                <div className="order-title static">
                  <span>{service?.title ?? 'Removed service'}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p>Buyer: {order.buyerName} · Seller: {order.sellerName}</p>
                <div className="order-meta-grid">
                  <Metric label="Paid" value={`${order.paidPi || 0} Pi`} />
                  <Metric label="Fee 5%" value={`${order.platformFeePi || 0} Pi`} />
                  <Metric label="Created" value={order.createdAt} />
                </div>
                {order.status === ORDER_STATUS.DISPUTED && (
                  <div className="moderation-actions">
                    <button className="secondary-button small" onClick={() => releaseOrder(order.id)}>
                      Release to seller
                    </button>
                    <button className="ghost-button small danger" onClick={() => refundOrder(order.id)}>
                      Refund buyer
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {adminTab === 'reports' && (
        <div className="list-panel">
          {reports.map((report) => (
            <article className="report-card" key={report.id}>
              <div>
                <span className="eyebrow">{report.status}</span>
                <h2>{report.serviceTitle}</h2>
                <p>{report.reason}</p>
              </div>
              {report.status === 'open' ? (
                <button className="secondary-button small" onClick={() => resolveReport(report.id)}>
                  Resolve
                </button>
              ) : (
                <StatusHint icon={<CheckCircle2 size={18} />} text="Resolved" />
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }) {
  const isGood = [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED].includes(status);
  const isRisk = [ORDER_STATUS.DISPUTED, ORDER_STATUS.REFUNDED, ORDER_STATUS.CANCELLED].includes(status);
  return <span className={isRisk ? 'status risk' : isGood ? 'status success' : 'status'}>{status}</span>;
}

function StatusHint({ icon, text }) {
  return (
    <div className="status-hint">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function RatingControl({ rating, onRate, compact = false }) {
  return (
    <div className={compact ? 'rating-control compact-rating' : 'rating-control'}>
      {!compact && <span className="eyebrow">Seller rating</span>}
      <div>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            className={value <= (rating ?? 0) ? 'star-button active' : 'star-button'}
            onClick={() => onRate(value)}
            aria-label={`Rate ${value} stars`}
          >
            <Star size={compact ? 16 : 20} />
          </button>
        ))}
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button className={active ? 'nav-item active' : 'nav-item'} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function filePatchFromInput(event, scope = 'request') {
  const file = event.target.files?.[0];
  const fileNameKey = scope === 'delivery' ? 'deliveryFileName' : 'fileName';
  const fileSizeKey = scope === 'delivery' ? 'deliveryFileSize' : 'fileSize';

  return {
    [fileNameKey]: file?.name || '',
    [fileSizeKey]: file ? formatFileSize(file.size) : '',
  };
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatSellerStatus(status) {
  if (status === 'verified') return 'Verified';
  if (status === 'blocked') return 'Blocked';
  return 'New seller';
}

export default App;
