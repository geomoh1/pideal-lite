import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserRound,
  WalletCards,
} from 'lucide-react';
import {
  authenticateWithPi,
  completeIncompletePiPayment,
  confirmPiDeliveryPayment,
  createPiDepositPayment,
  getPiIntegrationStatus,
  isPiBrowserRuntime,
  shouldAutoAuthenticateWithPi,
} from './piPlaceholders.js';
import {
  acceptOrder as acceptOrderApi,
  cancelOrder as cancelOrderApi,
  createOrder as createOrderApi,
  createReport as createReportApi,
  createService as createServiceApi,
  deliverOrder as deliverOrderApi,
  disputeOrder as disputeOrderApi,
  fetchNotifications as fetchNotificationsApi,
  fetchCurrentSession,
  fetchMarketplaceData,
  markBuyerRefundPaid as markBuyerRefundPaidApi,
  markSellerPayoutPaid as markSellerPayoutPaidApi,
  removeServiceById,
  refundOrder as refundOrderApi,
  releaseDueEscrows as releaseDueEscrowsApi,
  releaseOrder as releaseOrderApi,
  resolveReportById,
  reviewOrder as reviewOrderApi,
  startOrder as startOrderApi,
  syncUserSession,
  updatePayoutWallet as updatePayoutWalletApi,
  updateSellerStatus as updateSellerStatusApi,
  updateServiceStatus,
} from './api.js';
import {
  getInitialLanguage,
  I18nProvider,
  isRtlLanguage,
  localizeTree,
  saveLanguagePreference,
  useLocale,
} from './i18n.js';

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

const orderFlowSteps = [
  { status: ORDER_STATUS.REQUESTED, label: 'Request' },
  { status: ORDER_STATUS.PENDING_PAYMENT, label: 'Accept' },
  { status: ORDER_STATUS.DEPOSIT_PAID, label: 'Deposit' },
  { status: ORDER_STATUS.IN_PROGRESS, label: 'Work' },
  { status: ORDER_STATUS.DELIVERED, label: 'Delivery' },
  { status: ORDER_STATUS.COMPLETED, label: 'Balance' },
];

function App() {
  const legalRoute = getLegalRoute();
  if (legalRoute) {
    return <LegalPage route={legalRoute} />;
  }

  return <MarketplaceApp />;
}

const legalDocuments = {
  privacy: {
    eyebrow: 'Privacy Policy',
    title: 'PiDeal Privacy Policy',
    updated: 'Last updated: May 17, 2026',
    intro:
      'PiDeal is a Pi Network powered marketplace for digital services. This policy explains what data we collect, why we collect it, and how we protect marketplace payments, escrow, delivery, and disputes.',
    sections: [
      {
        title: 'Information We Collect',
        items: [
          'Pi login information verified through the Pi SDK, including your Pi user id and username.',
          'Marketplace profile information such as seller status, service listings, order details, reviews, reports, and payout wallet address if you choose to provide one.',
          'Payment records needed for Pi payment approval, completion, escrow accounting, platform fee calculation, payout tracking, and dispute handling.',
          'Delivery and request metadata such as notes, links, file names, and file sizes. PiDeal currently records metadata and does not ask for wallet passphrases.',
        ],
      },
      {
        title: 'How We Use Information',
        items: [
          'To authenticate users with verified Pi identity and prevent impersonation.',
          'To run orders, escrow status, protected delivery, reviews, reports, and admin moderation.',
          'To verify Pi payments, track deposits and remaining balances, queue seller payouts, and resolve disputes.',
          'To protect buyers and sellers from fraud, unsafe links, external payment attempts, and policy abuse.',
        ],
      },
      {
        title: 'Payments, Escrow, And Payouts',
        items: [
          'Buyer payments are processed through Pi payment flows and recorded by PiDeal after backend approval and completion.',
          'Funds are treated as held by app escrow until delivery, buyer completion, dispute review, or release after the dispute window.',
          'Seller payouts may be manually verified by an admin and can include a public payout transaction id.',
          'PiDeal never asks for, stores, or needs your Pi wallet passphrase, private key, or seed phrase.',
        ],
      },
      {
        title: 'Sharing And Disclosure',
        items: [
          'Normal users only receive order information related to their own buyer or seller orders.',
          'Admins may access reports, disputes, orders, and payout information to operate the marketplace safely.',
          'Public service pages may show service title, description, price, delivery time, seller display name, rating, and trust markers.',
          'We do not sell personal data.',
        ],
      },
      {
        title: 'Data Security And Retention',
        items: [
          'PiDeal uses backend authentication, httpOnly session cookies, ownership checks, URL safety rules, and admin-only moderation endpoints.',
          'Order, payment, report, review, and payout records may be retained as needed for marketplace integrity, accounting, abuse prevention, and dispute history.',
          'If you believe a record is inaccurate or unsafe, contact the developer support email below.',
        ],
      },
    ],
  },
  terms: {
    eyebrow: 'Terms of Service',
    title: 'PiDeal Terms of Service',
    updated: 'Last updated: May 17, 2026',
    intro:
      'These terms describe the basic rules for using PiDeal as a buyer, seller, or admin-reviewed marketplace participant.',
    sections: [
      {
        title: 'Marketplace Role',
        items: [
          'PiDeal provides a marketplace layer for digital services, Pi identity, escrow-style order tracking, protected delivery, and dispute handling.',
          'Sellers are responsible for accurately describing services, delivery scope, timelines, revision policy, and buyer requirements.',
          'Buyers are responsible for providing clear order requirements and paying required deposits or remaining balances through approved Pi flows.',
        ],
      },
      {
        title: 'Escrow And Delivery',
        items: [
          'Deposits and full payments are recorded by the backend only after Pi payment approval and completion.',
          'Delivery assets may remain locked from the buyer until the remaining balance is completed.',
          'After completion, escrow may remain pending during the configured dispute window before seller payout is queued.',
          'A payout marked as settled is an internal escrow decision; a payout marked as paid requires a recorded manual transfer transaction id.',
        ],
      },
      {
        title: 'Prohibited Behavior',
        items: [
          'Do not request or share wallet passphrases, private keys, seed phrases, or other secrets.',
          'Do not use listings, requests, delivery notes, or reports to move transactions outside PiDeal escrow.',
          'Do not post malicious links, short links, external payment links, direct contact links, spam, illegal content, or misleading service claims.',
          'PiDeal may reject, block, remove, refund, or escalate activity that appears unsafe or abusive.',
        ],
      },
      {
        title: 'Disputes And Admin Review',
        items: [
          'Buyers may open disputes for eligible delivered or completed orders before escrow is finally resolved.',
          'Admins may review reports, disputes, services, users, payment records, and delivery metadata to make marketplace decisions.',
          'Admin decisions can result in refund records, seller settlement, seller payout queueing, service rejection, or seller blocking.',
        ],
      },
      {
        title: 'Availability And Changes',
        items: [
          'PiDeal is provided as a digital marketplace service and may change as Pi Network platform requirements evolve.',
          'Features, fees, escrow windows, moderation rules, and payout procedures may be updated for security, compliance, or operational reasons.',
          'Continued use of PiDeal means you accept the current terms and marketplace safety rules.',
        ],
      },
    ],
  },
  contact: {
    eyebrow: 'Contact Developer',
    title: 'Contact PiDeal Developer Support',
    updated: 'Support channel for Pi Browser and PiNet review',
    intro:
      'For privacy questions, payment support, reports, dispute follow-up, app review, or developer contact, use the official support details below.',
    sections: [
      {
        title: 'Support Email',
        items: [
          'Email: pideal.support@gmail.com',
          'Use this email for account, privacy, payment, escrow, dispute, seller payout, or app review questions.',
          'Never send a wallet passphrase, private key, or seed phrase. PiDeal support will never ask for secrets.',
        ],
      },
      {
        title: 'Repository',
        items: [
          'GitHub: https://github.com/geomoh1/pideal-lite',
          'Repository visibility may depend on the project owner settings.',
        ],
      },
      {
        title: 'Recommended Pi Developer Portal Values',
        items: [
          'Privacy Policy URL: /privacy',
          'Terms URL: /terms',
          'Contact Developer: pideal.support@gmail.com',
          'Repository: https://github.com/geomoh1/pideal-lite',
        ],
      },
    ],
  },
};

const legalDocumentsAr = {
  privacy: {
    eyebrow: 'سياسة الخصوصية',
    title: 'سياسة خصوصية PiDeal',
    updated: 'آخر تحديث: 17 مايو 2026',
    intro:
      'PiDeal هو سوق خدمات رقمية يعمل مع Pi Network. توضح هذه السياسة البيانات التي نجمعها، وكيف نستخدم تسجيل الدخول عبر Pi، وكيف نحمي المدفوعات والضمان والتسليم والنزاعات.',
    sections: [
      {
        title: 'المعلومات التي نجمعها',
        items: [
          'معلومات تسجيل الدخول عبر Pi التي يتم التحقق منها من خلال Pi SDK، وتشمل معرف مستخدم Pi واسم المستخدم.',
          'معلومات ملف السوق مثل حالة البائع، الخدمات المنشورة، تفاصيل الطلبات، التقييمات، البلاغات، وعنوان محفظة الاستلام إذا اخترت إضافته.',
          'سجلات الدفع المطلوبة لاعتماد وإكمال مدفوعات Pi، وحساب الضمان، ورسوم المنصة، وتتبع دفعات البائعين، ومعالجة النزاعات.',
          'بيانات الطلب والتسليم مثل الملاحظات، الروابط، أسماء الملفات، وأحجام الملفات. PiDeal يسجل بيانات وصفية فقط ولا يطلب passphrase للمحفظة.',
        ],
      },
      {
        title: 'كيف نستخدم المعلومات',
        items: [
          'للتحقق من هوية المستخدم عبر Pi ومنع انتحال الحسابات.',
          'لتشغيل الطلبات، حالة الضمان، التسليم المحمي، التقييمات، البلاغات، ومراجعة الأدمن.',
          'للتحقق من مدفوعات Pi، وتتبع العربون والمتبقي، وتجهيز دفعات البائعين، وحل النزاعات.',
          'لحماية المشترين والبائعين من الاحتيال، الروابط غير الآمنة، محاولات الدفع الخارجي، ومخالفة السياسات.',
        ],
      },
      {
        title: 'المدفوعات والضمان والدفعات',
        items: [
          'تتم معالجة مدفوعات المشتري عبر تدفقات Pi، ويتم تسجيلها في PiDeal بعد اعتمادها وإكمالها من الخادم.',
          'تُعامل المبالغ كأموال محجوزة في ضمان التطبيق حتى التسليم، أو تأكيد المشتري، أو مراجعة النزاع، أو انتهاء فترة النزاع.',
          'قد يتم التحقق من دفعات البائعين يدويًا بواسطة الأدمن، ويمكن تسجيل معرف معاملة التحويل.',
          'PiDeal لا يطلب ولا يخزن ولا يحتاج passphrase أو private key أو seed phrase لمحفظة Pi.',
        ],
      },
      {
        title: 'المشاركة والإفصاح',
        items: [
          'المستخدمون العاديون لا يحصلون إلا على معلومات الطلبات المرتبطة بهم كمشترين أو بائعين.',
          'قد يصل الأدمن إلى البلاغات، النزاعات، الطلبات، ومعلومات الدفعات لتشغيل السوق بأمان.',
          'صفحات الخدمات العامة قد تعرض عنوان الخدمة، الوصف، السعر، مدة التسليم، اسم البائع الظاهر، التقييم، وعلامات الثقة.',
          'نحن لا نبيع البيانات الشخصية.',
        ],
      },
      {
        title: 'الأمان والاحتفاظ بالبيانات',
        items: [
          'يستخدم PiDeal تحققًا من الجلسة في الخادم، وملفات cookie من نوع httpOnly، وفحص ملكية الطلبات، وقواعد أمان للروابط، ونقاط إدارة محمية للأدمن.',
          'قد يتم الاحتفاظ بسجلات الطلبات، المدفوعات، البلاغات، التقييمات، والدفعات حسب الحاجة لحماية السوق، والمحاسبة، ومنع الإساءة، وسجل النزاعات.',
          'إذا كنت تعتقد أن سجلًا ما غير دقيق أو غير آمن، تواصل مع بريد دعم المطور أدناه.',
        ],
      },
    ],
  },
  terms: {
    eyebrow: 'شروط الخدمة',
    title: 'شروط خدمة PiDeal',
    updated: 'آخر تحديث: 17 مايو 2026',
    intro:
      'توضح هذه الشروط القواعد الأساسية لاستخدام PiDeal كمشترٍ أو بائع أو مستخدم داخل سوق يخضع لمراجعة الأدمن.',
    sections: [
      {
        title: 'دور السوق',
        items: [
          'يوفر PiDeal طبقة سوق للخدمات الرقمية، وهوية Pi، وتتبع ضمان الطلبات، والتسليم المحمي، ومعالجة النزاعات.',
          'البائع مسؤول عن وصف الخدمة بدقة، ونطاق التسليم، والمدة، وسياسة التعديلات، ومتطلبات المشتري.',
          'المشتري مسؤول عن تقديم متطلبات واضحة ودفع العربون أو المتبقي عبر تدفقات Pi المعتمدة.',
        ],
      },
      {
        title: 'الضمان والتسليم',
        items: [
          'لا يتم تسجيل العربون أو الدفع الكامل إلا بعد اعتماد وإكمال مدفوعات Pi من الخادم.',
          'قد تبقى ملفات أو روابط التسليم مقفلة عن المشتري حتى يتم دفع المتبقي.',
          'بعد اكتمال الطلب، قد يبقى الضمان في حالة انتظار خلال فترة النزاع قبل تجهيز دفعة البائع.',
          'اعتبار الضمان مسوى هو قرار محاسبي داخلي؛ أما اعتبار دفعة البائع مدفوعة فيحتاج إلى معرف معاملة تحويل مسجل.',
        ],
      },
      {
        title: 'السلوك الممنوع',
        items: [
          'لا تطلب أو تشارك passphrase أو private key أو seed phrase أو أي أسرار للمحفظة.',
          'لا تستخدم الخدمات أو الطلبات أو ملاحظات التسليم أو البلاغات لنقل الصفقة خارج ضمان PiDeal.',
          'لا تنشر روابط ضارة، روابط مختصرة، روابط دفع خارجي، روابط تواصل مباشر، رسائل مزعجة، محتوى غير قانوني، أو وعود خدمة مضللة.',
          'قد يرفض PiDeal أو يحظر أو يزيل أو يرد المبلغ أو يصعّد أي نشاط يبدو غير آمن أو مسيئًا.',
        ],
      },
      {
        title: 'النزاعات ومراجعة الأدمن',
        items: [
          'يمكن للمشتري فتح نزاع للطلبات المؤهلة بعد التسليم أو الإكمال وقبل حل الضمان نهائيًا.',
          'قد يراجع الأدمن البلاغات، النزاعات، الخدمات، المستخدمين، سجلات الدفع، وبيانات التسليم لاتخاذ قرارات السوق.',
          'قد تؤدي قرارات الأدمن إلى تسجيل رد مبلغ، أو تسوية لصالح البائع، أو تجهيز دفعة البائع، أو رفض خدمة، أو حظر بائع.',
        ],
      },
      {
        title: 'التوفر والتغييرات',
        items: [
          'يقدم PiDeal كسوق خدمات رقمية وقد يتغير مع تطور متطلبات منصة Pi Network.',
          'قد يتم تحديث الميزات، الرسوم، مدة الضمان، قواعد المراجعة، وإجراءات الدفعات لأسباب أمنية أو تشغيلية أو امتثال.',
          'استمرار استخدام PiDeal يعني قبولك للشروط الحالية وقواعد أمان السوق.',
        ],
      },
    ],
  },
  contact: {
    eyebrow: 'التواصل مع المطور',
    title: 'دعم مطور PiDeal',
    updated: 'قناة دعم لمتصفح Pi ومراجعة PiNet',
    intro:
      'لأسئلة الخصوصية، دعم المدفوعات، البلاغات، متابعة النزاعات، مراجعة التطبيق، أو التواصل مع المطور، استخدم بيانات الدعم الرسمية أدناه.',
    sections: [
      {
        title: 'بريد الدعم',
        items: [
          'Email: pideal.support@gmail.com',
          'استخدم هذا البريد لأسئلة الحساب، الخصوصية، الدفع، الضمان، النزاعات، دفعات البائعين، أو مراجعة التطبيق.',
          'لا ترسل passphrase أو private key أو seed phrase أبدًا. دعم PiDeal لن يطلب منك أسرار المحفظة.',
        ],
      },
      {
        title: 'المستودع',
        items: [
          'GitHub: https://github.com/geomoh1/pideal-lite',
          'قد تعتمد إمكانية عرض المستودع على إعدادات مالك المشروع.',
        ],
      },
      {
        title: 'القيم المقترحة في Pi Developer Portal',
        items: [
          'رابط سياسة الخصوصية: /privacy',
          'رابط الشروط: /terms',
          'Contact Developer: pideal.support@gmail.com',
          'Repository: https://github.com/geomoh1/pideal-lite',
        ],
      },
    ],
  },
};

const legalLabels = {
  en: {
    openApp: 'Open PiDeal',
    navLabel: 'Legal pages',
    privacy: 'Privacy',
    terms: 'Terms',
    contact: 'Contact',
    language: 'Language',
  },
  ar: {
    openApp: 'فتح PiDeal',
    navLabel: 'الصفحات القانونية',
    privacy: 'الخصوصية',
    terms: 'الشروط',
    contact: 'التواصل',
    language: 'اللغة',
  },
};

function LegalPage({ route }) {
  const [language, setLanguage] = useState(getInitialLanguage);
  const isArabic = language === 'ar';
  const documents = isArabic ? legalDocumentsAr : legalDocuments;
  const labels = isArabic ? legalLabels.ar : legalLabels.en;
  const document = documents[route] || documents.privacy;

  useEffect(() => {
    saveLanguagePreference(language);
    window.document.documentElement.lang = language;
    window.document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    window.document.title = `${document.title} | PiDeal`;
  }, [document.title, isArabic, language]);

  return (
    <main className="legal-shell" lang={language} dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="legal-header">
        <a className="legal-brand" href="/" aria-label={labels.openApp}>
          <img src="/pideal-logo.svg" alt="PiDeal" />
        </a>
        <nav className="legal-nav" aria-label={labels.navLabel}>
          <a className={route === 'privacy' ? 'active' : ''} href={`/privacy?lang=${language}`}>{labels.privacy}</a>
          <a className={route === 'terms' ? 'active' : ''} href={`/terms?lang=${language}`}>{labels.terms}</a>
          <a className={route === 'contact' ? 'active' : ''} href={`/contact?lang=${language}`}>{labels.contact}</a>
        </nav>
        <label className="language-switch legal-language-switch" aria-label={labels.language}>
          <span>{labels.language}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </header>

      <section className="legal-hero">
        <span className="eyebrow">{document.eyebrow}</span>
        <h1>{document.title}</h1>
        <p>{document.intro}</p>
        <small>{document.updated}</small>
      </section>

      <section className="legal-content">
        {document.sections.map((section) => (
          <article className="legal-section" key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{formatLegalItem(item)}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}

function formatLegalItem(item) {
  if (item.startsWith('Email: ')) {
    const email = item.replace('Email: ', '');
    return (
      <>
        Email: <a href={`mailto:${email}`}>{email}</a>
      </>
    );
  }

  if (item.startsWith('GitHub: ')) {
    const url = item.replace('GitHub: ', '');
    return (
      <>
        GitHub: <a href={url} rel="noreferrer" target="_blank">{url}</a>
      </>
    );
  }

  if (item.startsWith('Repository: https://')) {
    const url = item.replace('Repository: ', '');
    return (
      <>
        Repository: <a href={url} rel="noreferrer" target="_blank">{url}</a>
      </>
    );
  }

  return item;
}

function MarketplaceApp() {
  const [language, setLanguage] = useState(getInitialLanguage);
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
  const [orderTab, setOrderTab] = useState('action');
  const [adminTab, setAdminTab] = useState('review');
  const [deliveryDrafts, setDeliveryDrafts] = useState({});
  const [disputeDrafts, setDisputeDrafts] = useState({});
  const [payoutWalletDraft, setPayoutWalletDraft] = useState('');
  const [flowError, setFlowError] = useState('');
  const [flowNotice, setFlowNotice] = useState('');
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState('');
  const [appRefreshing, setAppRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [autoAuthAttempted, setAutoAuthAttempted] = useState(false);
  const [initialServiceSlug, setInitialServiceSlug] = useState(() => getInitialServiceSlugFromUrl());
  const [piBrowserGateService, setPiBrowserGateService] = useState(null);
  const piIntegrationStatus = getPiIntegrationStatus();
  const appDirection = isRtlLanguage(language) ? 'rtl' : 'ltr';

  const currentUserId = user?.uid;
  const isAdmin = user?.appRole === 'admin';

  useEffect(() => {
    saveLanguagePreference(language);
    document.documentElement.lang = language;
    document.documentElement.dir = appDirection;
  }, [appDirection, language]);

  useEffect(() => {
    setPayoutWalletDraft(user?.piWalletAddress || '');
  }, [user?.piWalletAddress]);

  const refreshAppData = useCallback(async ({
    actor = null,
    showRefreshIndicator = false,
    shouldApply = () => true,
  } = {}) => {
    try {
      if (showRefreshIndicator) {
        setAppRefreshing(true);
      } else {
        setMarketplaceLoading(true);
      }

      const data = await fetchMarketplaceData(actor);
      if (!shouldApply()) return data;

      setServices(data.services);
      setOrders(data.orders);
      setReports(data.reports);
      setMarketplaceError('');
      return data;
    } catch (error) {
      if (shouldApply()) {
        setMarketplaceError(getErrorMessage(error, 'Could not load marketplace data from the backend.'));
      }
      return null;
    } finally {
      if (shouldApply()) {
        if (showRefreshIndicator) {
          setAppRefreshing(false);
        } else {
          setMarketplaceLoading(false);
        }
      }
    }
  }, []);

  const refreshNotifications = useCallback(async (actor) => {
    if (!actor?.uid) {
      setNotifications([]);
      setNotificationCount(0);
      return;
    }

    try {
      setNotificationsLoading(true);
      const data = await fetchNotificationsApi(actor);
      setNotifications(data.notifications);
      setNotificationCount(data.count);
    } catch (error) {
      console.error('Notifications could not be loaded.', error);
      setNotifications([]);
      setNotificationCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const sessionUser = await fetchCurrentSession();
        if (!isMounted) return;

        const restoredUser = buildAppUser(
          {
            uid: sessionUser.uid,
            username: sessionUser.username,
            walletStatus: 'Backend session restored',
            authProvider: 'server-session',
          },
          sessionUser,
        );
        setUser(restoredUser);
        if (restoredUser.appRole !== 'admin' && selectedMode === 'Admin') {
          setSelectedMode('Browse');
        }
        await refreshAppData({ actor: restoredUser, shouldApply: () => isMounted });
        void refreshNotifications(restoredUser);
      } catch {
        await refreshAppData({ shouldApply: () => isMounted });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshAppData, refreshNotifications]);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setNotificationCount(0);
      setNotificationsOpen(false);
      return;
    }

    refreshNotifications(user);
  }, [refreshNotifications, user]);

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

  useEffect(() => {
    if (!initialServiceSlug || !services.length) return;

    const sharedService = services.find(
      (service) => service.slug === initialServiceSlug || service.id === initialServiceSlug,
    );
    if (!sharedService) return;

    setSelectedServiceId(sharedService.id);
    setActiveView('detail');
    setInitialServiceSlug('');
  }, [initialServiceSlug, services]);

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
  const selectedBuyerServiceOrders = orders.filter(
    (order) => order.serviceId === selectedService?.id && order.buyerId === currentUserId,
  );
  const activeOrder = selectedBuyerServiceOrders.find((order) => !isClosedBuyerOrder(order));
  const previousOrder = selectedBuyerServiceOrders.find(
    (order) => isClosedBuyerOrder(order) && order.id !== activeOrder?.id,
  );

  const userBuyerOrders = orders.filter((order) => order.buyerId === currentUserId);
  const userSellerOrders = orders.filter((order) => order.sellerId === currentUserId);
  const userServices = services.filter((service) => service.sellerId === currentUserId);
  const isInitialMarketplaceLoading =
    marketplaceLoading && services.length === 0 && orders.length === 0 && reports.length === 0;

  async function handleLogoRefresh() {
    await refreshAppData({ actor: user, showRefreshIndicator: true });
    if (user) {
      await refreshNotifications(user);
    }
  }

  function handleNotificationClick(notification) {
    setNotificationsOpen(false);

    if (notification.targetType === 'order') {
      const targetOrder = orders.find((order) => order.id === notification.targetId);
      setOrderTab(targetOrder?.sellerId === currentUserId ? 'seller' : 'buyer');
      setActiveView('orders');
      return;
    }

    if (notification.targetType === 'admin') {
      if (notification.targetId === 'reports') {
        setAdminTab('reports');
      } else if (notification.targetId === 'orders') {
        setAdminTab('orders');
      } else if (notification.targetId === 'payouts') {
        setAdminTab('payouts');
      } else if (notification.targetId === 'refunds') {
        setAdminTab('refunds');
      } else {
        setAdminTab('services');
      }
      setActiveView('admin');
      return;
    }

    if (notification.targetType === 'service' && notification.targetId) {
      openService(notification.targetId);
    }
  }

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
    if (authenticatedUser.incompletePayments?.length) {
      await recoverIncompletePayments(authenticatedUser.incompletePayments);
    }

    return buildAppUser(authenticatedUser, sessionUser);
  }

  async function recoverIncompletePayments(incompletePayments) {
    const recoveries = await Promise.allSettled(
      incompletePayments.map((payment) => completeIncompletePiPayment(payment)),
    );
    recoveries
      .filter((result) => result.status === 'rejected')
      .forEach((result) => console.error('Incomplete Pi payment could not be completed by the backend.', result.reason));
  }

  function buildAppUser(authenticatedUser, sessionUser) {
    return {
      ...authenticatedUser,
      uid: sessionUser.uid,
      username: sessionUser.username,
      appRole: sessionUser.role,
      sellerStatus: sessionUser.sellerStatus,
      piWalletAddress: sessionUser.piWalletAddress || '',
      piWalletVerifiedAt: sessionUser.piWalletVerifiedAt || '',
    };
  }

  async function getAuthenticatedPiUser({ forcePiAuth = false } = {}) {
    if (user && !forcePiAuth) return user;

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
      void refreshAppData({ actor: sessionUser, showRefreshIndicator: true });
      void refreshNotifications(sessionUser);
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

  async function handleShareService(service) {
    const shareUrl = getServiceShareUrl(service, language);
    const shareData = {
      title: service.title,
      text: service.summary || 'Order this service securely with PiDeal escrow.',
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setFlowNotice('Share sheet opened.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setFlowNotice('Service link copied.');
      } else {
        setFlowNotice(shareUrl);
      }
      setFlowError('');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setFlowError(getErrorMessage(error, 'Service link could not be shared.'));
      setFlowNotice('');
    }
  }

  useEffect(() => {
    if (autoAuthAttempted || user || !shouldAutoAuthenticateWithPi()) return;

    setAutoAuthAttempted(true);
    getAuthenticatedPiUser();
  }, [autoAuthAttempted, user]);

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
    if (!user) {
      setFlowError('Pi login is required before submitting a listing.');
      setFlowNotice('');
      return;
    }

    const pricePi = Number(newService.pricePi);
    const depositPi = Number(newService.depositPi);
    const deliveryDays = Number(newService.deliveryDays);

    const listing = {
      title: newService.title.trim(),
      category: newService.category,
      sellerHandle: `@${user.username}`,
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
      deliverables: ['Digital delivery message or link', 'Buyer confirmation required', 'Pi escrow payment'],
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
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Service could not be submitted to the backend.'));
      setFlowNotice('');
    }
  }

  async function handleRequestService(service) {
    if (!requestNote.trim()) {
      setFlowError('Add a brief before requesting this service.');
      setFlowNotice('');
      return;
    }

    if (!isPiBrowserRuntime()) {
      setPiBrowserGateService(service);
      setFlowError('');
      setFlowNotice('');
      return;
    }

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
      buyerNote: requestNote.trim(),
      requestSourceText: requestAsset.sourceText.trim(),
      requestReferenceLink: requestAsset.referenceLink.trim(),
      requestFileName: requestAsset.fileName,
      requestFileSize: requestAsset.fileSize,
    };

    try {
      const createdOrder = await createOrderApi(orderRequest);
      setFlowError('');
      setFlowNotice('Request sent. Waiting for the seller to accept before deposit payment.');
      setOrders((current) => [createdOrder, ...current.filter((item) => item.id !== createdOrder.id)]);
      setRequestNote('');
      setRequestAsset(blankRequestAsset);
      void refreshNotifications(buyer);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be created on the backend.'));
      setFlowNotice('');
    }
  }

  async function handlePayOrder(orderId, mode) {
    const order = orders.find((item) => item.id === orderId);
    const service = services.find((item) => item.id === order?.serviceId);
    if (!order || !service) return;

    const paymentUser = await getAuthenticatedPiUser({
      forcePiAuth: user?.authProvider !== 'pi-sdk',
    });
    if (!paymentUser) return;

    const paymentIsAllowed =
      (mode === 'deposit' && order.status === ORDER_STATUS.PENDING_PAYMENT) ||
      (mode === 'balance' && order.status === ORDER_STATUS.DELIVERED) ||
      (mode === 'full' && order.status === ORDER_STATUS.PENDING_PAYMENT);

    if (!paymentIsAllowed) {
      setFlowError('This order is not ready for that payment step.');
      setFlowNotice('');
      return;
    }

    const remainingPi = getRemainingPi(order, service);
    const amountPi = mode === 'balance' ? remainingPi : mode === 'full' ? service.pricePi : service.depositPi;
    if (mode === 'balance' && remainingPi <= 0) {
      setFlowError('No remaining balance is due for this order.');
      setFlowNotice('');
      return;
    }

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
      });
      const expectedStatuses =
        mode === 'balance'
          ? [ORDER_STATUS.COMPLETED]
          : [ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.PAID];
      if (!expectedStatuses.includes(paymentResult.order?.status)) {
        throw new Error('Payment server did not move this order to the expected escrow state.');
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

    setFlowNotice(
      mode === 'balance'
        ? 'Remaining balance completed. Delivery is unlocked and escrow is pending release after the dispute window.'
        : 'Deposit completed by the backend. The seller can start work now.',
    );
    setOrders((current) =>
      current.map((item) =>
        item.id === orderId ? { ...paymentResult.order, payment: paymentResult.payment } : item,
      ),
    );
    void refreshNotifications(paymentUser);
  }

  async function handleAcceptOrder(orderId) {
    try {
      const updatedOrder = await acceptOrderApi(orderId);
      setFlowNotice('Request accepted. Buyer can pay the deposit now.');
      setFlowError('');
      replaceOrder(updatedOrder);
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order request could not be accepted.'));
      setFlowNotice('');
    }
  }

  async function handleStartOrder(orderId) {
    try {
      const updatedOrder = await startOrderApi(orderId);
      setFlowNotice('Order moved to In Progress.');
      setFlowError('');
      replaceOrder(updatedOrder);
      void refreshNotifications(user);
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

  function updateDisputeDraft(orderId, value) {
    setDisputeDrafts((current) => ({ ...current, [orderId]: value }));
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
      void refreshNotifications(user);
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
      setFlowError('Delivery confirmation failed. Pay the remaining balance first if any amount is still due.');
      setFlowNotice('');
      return;
    }

    setFlowNotice('Delivery confirmed and fully paid. You can rate the seller now.');
    void refreshNotifications(user);
  }

  async function handleRateOrder(orderId, rating) {
    try {
      const updatedOrder = await reviewOrderApi(orderId, rating);
      setFlowNotice(`Seller rated ${rating} stars.`);
      setFlowError('');
      replaceOrder(updatedOrder);
      void refreshNotifications(user);
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
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be cancelled.'));
      setFlowNotice('');
    }
  }

  async function handleDisputeOrder(orderId, reason) {
    const disputeReason = String(reason || '').trim();
    if (disputeReason.length < 10) {
      setFlowError('Add a clear dispute reason before opening admin review.');
      setFlowNotice('');
      return;
    }

    try {
      const updatedOrder = await disputeOrderApi(orderId, disputeReason);
      setFlowNotice('Order marked as disputed for admin review.');
      setFlowError('');
      replaceOrder(updatedOrder);
      setDisputeDrafts((current) => ({ ...current, [orderId]: '' }));
      void refreshNotifications(user);
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
      void refreshNotifications(user);
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
      void refreshNotifications(user);
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
      void refreshNotifications(user);
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
        reason: 'Buyer reported this digital service for admin review.',
      });
      setFlowNotice('Report sent to admin moderation.');
      setFlowError('');
      setReports((current) => [report, ...current.filter((item) => item.id !== report.id)]);
      void refreshNotifications(user);
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
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Report could not be resolved.'));
      setFlowNotice('');
    }
  }

  async function refundOrder(orderId) {
    try {
      const updatedOrder = await refundOrderApi(orderId, user);
      setFlowNotice('Dispute resolved: buyer refund recorded. Manual refund required.');
      setFlowError('');
      replaceOrder(updatedOrder);
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Order could not be marked refunded.'));
      setFlowNotice('');
    }
  }

  async function releaseOrder(orderId) {
    try {
      const updatedOrder = await releaseOrderApi(orderId, user);
      setFlowNotice('Dispute resolved: escrow settled for seller payout.');
      setFlowError('');
      replaceOrder(updatedOrder);
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Escrow could not be settled for seller payout.'));
      setFlowNotice('');
    }
  }

  async function releaseDueEscrows() {
    try {
      const result = await releaseDueEscrowsApi(user);
      setFlowNotice(`${result.releasedCount || 0} escrow settlements prepared for manual payout.`);
      setFlowError('');
      await refreshAppData({ actor: user, showRefreshIndicator: true });
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Due escrow releases could not be processed.'));
      setFlowNotice('');
    }
  }

  async function markSellerPayoutPaid(payoutId, payoutTxid) {
    try {
      const result = await markSellerPayoutPaidApi(payoutId, payoutTxid, user);
      if (result.order) replaceOrder(result.order);
      setFlowNotice('Seller payout marked completed.');
      setFlowError('');
      await refreshAppData({ actor: user, showRefreshIndicator: true });
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Seller payout could not be marked completed.'));
      setFlowNotice('');
    }
  }

  async function markBuyerRefundPaid(refundId, refundTxid) {
    try {
      const result = await markBuyerRefundPaidApi(refundId, refundTxid, user);
      if (result.order) replaceOrder(result.order);
      setFlowNotice('Buyer refund marked completed.');
      setFlowError('');
      await refreshAppData({ actor: user, showRefreshIndicator: true });
      void refreshNotifications(user);
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Buyer refund could not be marked completed.'));
      setFlowNotice('');
    }
  }

  async function savePayoutWallet() {
    if (!user) {
      setFlowError('Pi Login is required before saving a payout wallet.');
      setFlowNotice('');
      return;
    }

    try {
      const updatedUser = await updatePayoutWalletApi(payoutWalletDraft, user);
      setUser((current) => ({ ...current, ...updatedUser }));
      setFlowNotice('Payout wallet address saved.');
      setFlowError('');
      await refreshAppData({ actor: { ...user, ...updatedUser }, showRefreshIndicator: true });
    } catch (error) {
      setFlowError(getErrorMessage(error, 'Payout wallet address could not be saved.'));
      setFlowNotice('');
    }
  }

  return (
    <I18nProvider language={language}>
      <Localized>
        <div className="app-shell" lang={language} dir={appDirection}>
      <header className="top-bar">
        <button
          className={appRefreshing ? 'brand-button is-refreshing' : 'brand-button'}
          onClick={handleLogoRefresh}
          aria-label="Refresh PiDeal"
          aria-busy={appRefreshing}
        >
          <img className="brand-logo" src="/pideal-logo.svg" alt="" />
          {appRefreshing && <span className="refresh-spinner" aria-hidden="true" />}
        </button>
        <div className="top-actions">
          <LanguageSwitch language={language} onLanguageChange={setLanguage} />
          <NotificationCenter
            user={user}
            notifications={notifications}
            count={notificationCount}
            isOpen={notificationsOpen}
            isLoading={notificationsLoading}
            onToggle={() => setNotificationsOpen((current) => !current)}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      </header>

      <main>
        <PiAccessStrip
          user={user}
          selectedMode={selectedMode}
          piIntegrationStatus={piIntegrationStatus}
          onLogin={handlePiLogin}
        />
        {flowError && <FlowError message={flowError} />}
        {flowNotice && <FlowNotice message={flowNotice} />}
        {marketplaceError && <FlowError message={marketplaceError} />}
        {piBrowserGateService && (
          <PiBrowserGate
            service={piBrowserGateService}
            onClose={() => setPiBrowserGateService(null)}
          />
        )}
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
            previousOrder={previousOrder}
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
            disputeDrafts={disputeDrafts}
            updateDisputeDraft={updateDisputeDraft}
            onReportService={reportService}
            onShareService={handleShareService}
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
            disputeDrafts={disputeDrafts}
            updateDisputeDraft={updateDisputeDraft}
            openService={openService}
            onPay={handlePayOrder}
            onAcceptOrder={handleAcceptOrder}
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
            payoutWalletDraft={payoutWalletDraft}
            setPayoutWalletDraft={setPayoutWalletDraft}
            onSavePayoutWallet={savePayoutWallet}
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
              releaseDueEscrows={releaseDueEscrows}
              markSellerPayoutPaid={markSellerPayoutPaid}
              markBuyerRefundPaid={markBuyerRefundPaid}
              openService={openService}
            />
          ) : (
            <AdminGate user={user} onLogin={handlePiLogin} />
          )
        )}
      </main>

      <AppLegalLinks />

      <nav className="bottom-nav" aria-label="Primary">
        <NavItem icon={<Home size={20} />} label="Home" active={activeView === 'home'} onClick={() => setActiveView('home')} />
        <NavItem icon={<FilePlus2 size={20} />} label="Sell" active={activeView === 'add'} onClick={() => setActiveView('add')} />
        <NavItem icon={<BriefcaseBusiness size={20} />} label="Orders" active={activeView === 'orders'} onClick={() => setActiveView('orders')} />
        <NavItem icon={<UserRound size={20} />} label="Profile" active={activeView === 'profile'} onClick={() => setActiveView('profile')} />
        {isAdmin && <NavItem icon={<Gauge size={20} />} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />}
      </nav>
        </div>
      </Localized>
    </I18nProvider>
  );
}

function AppLegalLinks() {
  const { language } = useLocale();
  const labels = language === 'ar' ? legalLabels.ar : legalLabels.en;

  return (
    <footer className="app-legal-links" aria-label="App information">
      <a href={`/privacy?lang=${language}`}>{labels.privacy}</a>
      <a href={`/terms?lang=${language}`}>{labels.terms}</a>
      <a href={`/contact?lang=${language}`}>{labels.contact}</a>
    </footer>
  );
}

function Localized({ children }) {
  const { language } = useLocale();
  return localizeTree(children, language);
}

function LanguageSwitch({ language, onLanguageChange }) {
  return (
    <Localized>
    <label className="language-switch" aria-label="Language">
      <span>Language</span>
      <select value={language} onChange={(event) => onLanguageChange(event.target.value)}>
        <option value="en">English</option>
        <option value="ar">Arabic</option>
      </select>
    </label>
    </Localized>
  );
}

function NotificationCenter({
  user,
  notifications,
  count,
  isOpen,
  isLoading,
  onToggle,
  onNotificationClick,
}) {
  return (
    <Localized>
    <div className="notification-center">
      <button
        className="icon-button notification-button"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <Bell size={19} />
        {count > 0 && <span className="notification-badge">{count > 9 ? '9+' : count}</span>}
      </button>

      {isOpen && (
        <div className="notification-menu" role="menu">
          <div className="notification-menu-header">
            <strong>Action center</strong>
            <span>{isLoading ? 'Loading' : <><span>Pending actions</span>: {count}</>}</span>
          </div>

          {!user && <p className="notification-empty">Login to see actions.</p>}

          {user && !isLoading && notifications.length === 0 && (
            <p className="notification-empty">No pending actions.</p>
          )}

          {user && notifications.map((notification) => (
            <button
              key={notification.id}
              className={`notification-item ${notification.severity || 'info'}`}
              type="button"
              role="menuitem"
              onClick={() => onNotificationClick(notification)}
            >
              <span>
                <strong>{notification.title}</strong>
                <small>{notification.message}</small>
              </span>
              <em>{notification.actionLabel}</em>
            </button>
          ))}
        </div>
      )}
    </div>
    </Localized>
  );
}

function PiAccessStrip({ user, selectedMode, piIntegrationStatus, onLogin }) {
  const isRealPiUser = user?.authProvider === 'pi-sdk';

  return (
    <Localized>
    <section className="wallet-strip">
      <div className="wallet-copy">
        <div>
          <span className="eyebrow">Pi Browser ready</span>
          <p>
            {user
              ? `Signed in as ${user.username}. Active mode: ${selectedMode}.`
              : `Sign in with Pi Browser to buy, sell, and manage orders. Mode: ${piIntegrationStatus.mode}.`}
          </p>
        </div>
      </div>
      <button className="primary-button compact" onClick={onLogin}>
        {user ? <BadgeCheck size={17} /> : <LogIn size={17} />}
        {user ? 'Connected' : 'Sign in with Pi'}
      </button>
    </section>
    </Localized>
  );
}

function PiBrowserGate({ service, onClose }) {
  const executionUrl = getPrivateExecutionUrl(service);

  return (
    <Localized>
    <div className="pi-gate" role="dialog" aria-modal="true" aria-label="Open in Pi Browser">
      <div className="pi-gate-panel">
        <button className="icon-button pi-gate-close" onClick={onClose} aria-label="Close">
          x
        </button>
        <span className="eyebrow">Protected checkout</span>
        <h2>Orders and payments work inside Pi Browser</h2>
        <p>
          PiDeal protects both buyer and seller through escrow, verified Pi identity,
          protected delivery, and dispute resolution.
        </p>
        <div className="gate-points">
          <span>Escrow protected</span>
          <span>Secure Pi payment</span>
          <span>Verified Pi identity</span>
          <span>Dispute support</span>
        </div>
        <div className="payment-actions">
          <a className="primary-button" href={executionUrl}>
            Open in Pi Browser
          </a>
          <a className="secondary-button" href="https://minepi.com/pi-browser/" target="_blank" rel="noreferrer">
            Get Pi Browser
          </a>
        </div>
      </div>
    </div>
    </Localized>
  );
}

function FlowError({ message }) {
  return (
    <Localized>
    <div className="flow-error" role="alert">
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
    </Localized>
  );
}

function FlowNotice({ message }) {
  return (
    <Localized>
    <div className="flow-notice" role="status">
      <CheckCircle2 size={18} />
      <span>{message}</span>
    </div>
    </Localized>
  );
}

function LoadingState({ message }) {
  return (
    <Localized>
    <div className="empty-state loading-state" role="status">
      <Clock3 size={24} />
      <p>{message}</p>
    </div>
    </Localized>
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
  const platformFeePercent = latestServices[0]?.platformFeePercent ?? featuredServices[0]?.platformFeePercent ?? '5%';

  return (
    <Localized>
    <section className="view-stack">
      <div className="home-hero">
        <div>
          <span className="eyebrow">PiDeal Lite</span>
          <h1>Fast digital services for Pi Network users.</h1>
          <p>Browse, order, pay securely with Pi, receive delivery, confirm, and rate.</p>
        </div>
        <div className="hero-metrics">
          <Metric label="Commission" value={platformFeePercent} />
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
    </Localized>
  );
}

function ServiceSection({ title, services, openService }) {
  return (
    <Localized>
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
              <small>{service.pricePi} Pi - {service.deliveryDays}d</small>
            </span>
          </button>
        ))}
      </div>
    </section>
    </Localized>
  );
}

function ServiceCard({ service, onClick }) {
  return (
    <Localized>
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
    </Localized>
  );
}

function DetailView({
  user,
  service,
  activeOrder,
  previousOrder,
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
  disputeDrafts,
  updateDisputeDraft,
  onReportService,
  onShareService,
}) {
  const deliveryConfirmed = activeOrder?.status === ORDER_STATUS.COMPLETED;
  const canConfirm = activeOrder?.status === ORDER_STATUS.DELIVERED;
  const isOwnListing = user?.uid === service.sellerId;
  const isBlockedSeller = service.sellerStatus === 'blocked';
  const requestBriefReady = requestNote.trim().length > 0;

  return (
    <Localized>
    <section className="view-stack">
      <div className="detail-actions">
        <button className="ghost-button back-button" onClick={onBack}>
          <ChevronLeft size={18} />
          Home
        </button>
        <button className="secondary-button small" onClick={() => onShareService(service)}>
          <Share2 size={16} />
          Share
        </button>
      </div>

      <article className="detail-panel">
        <div className="detail-hero" style={{ '--accent': service.accent }}>
          <span>{service.category}</span>
          <h1>{service.title}</h1>
          <p><LinkifiedText text={service.summary} /></p>
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
            <p><LinkifiedText text={service.terms} /></p>
          </div>
          <div className="terms-box">
            <span className="eyebrow">Trust signals</span>
            <p><LinkifiedText text={service.experience || 'New seller profile.'} /></p>
            <p><strong>Requirements:</strong> <LinkifiedText text={service.requirementsFromBuyer || 'Buyer brief required before work starts.'} /></p>
            <p><strong>Revision policy:</strong> <LinkifiedText text={service.revisionPolicy || 'Revision policy not provided.'} /></p>
            {service.portfolioUrl && (
              <ExternalTextLink href={service.portfolioUrl} icon={<LinkIcon size={15} />} />
            )}
            {service.proofLink && (
              <ExternalTextLink href={service.proofLink} icon={<LinkIcon size={15} />} />
            )}
          </div>
        </div>
      </article>

      <section className="action-panel request-panel">
        <div className="section-heading tight">
          <div>
            <h2>Request service</h2>
            <span className="request-step-pill">Fill request details first</span>
          </div>
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
            <div className="request-callout">
              <BriefcaseBusiness size={18} />
              <span>Tell the seller exactly what you need before sending the order request.</span>
            </div>
            <label>
              <span className="field-label-row">
                <span>Brief</span>
                <em>Required</em>
              </span>
              <textarea
                className={requestBriefReady ? '' : 'field-attention'}
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Describe what the seller should create or edit"
                rows={4}
                required
              />
            </label>
            <label>
              <span className="field-label-row">
                <span>Source text</span>
                <em>Optional</em>
              </span>
              <textarea
                value={requestAsset.sourceText}
                onChange={(event) => updateRequestAsset('sourceText', event.target.value)}
                placeholder="Paste text for translation, CV edits, prompts, or copy work"
                rows={4}
              />
            </label>
            <label>
              <span className="field-label-row">
                <span>Reference link</span>
                <em>Optional</em>
              </span>
              <input
                type="url"
                value={requestAsset.referenceLink}
                onChange={(event) => updateRequestAsset('referenceLink', event.target.value)}
                placeholder="https://drive.google.com/file/d/..."
              />
            </label>
            <p className="field-hint">To send files or images, upload them to Google Drive, Dropbox, GitHub, Figma, Canva, Notion, or trusted storage, then paste the share link here. Messaging, social, payment, and short links are not accepted.</p>
            <button className="primary-button" onClick={() => onRequest(service)} disabled={!requestBriefReady}>
              <WalletCards size={19} />
              {user ? 'Request service' : 'Pi Login to order'}
            </button>
            {!requestBriefReady && (
              <p className="request-required-note">Write a short brief to unlock the request button.</p>
            )}
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
            disputeReason={disputeDrafts[activeOrder.id] ?? ''}
            updateDisputeDraft={updateDisputeDraft}
            deliveryConfirmed={deliveryConfirmed}
            canConfirm={canConfirm}
          />
        )}

        {!activeOrder && previousOrder && (
          <PreviousOrderSummary order={previousOrder} service={service} />
        )}
      </section>
    </section>
    </Localized>
  );
}

function OrderProgress({
  order,
  service,
  onPay,
  onConfirmDelivery,
  onRateOrder,
  onDisputeOrder,
  disputeReason,
  updateDisputeDraft,
  deliveryConfirmed,
  canConfirm,
}) {
  const remainingPi = getRemainingPi(order, service);
  const showDeliveryBox = canConfirm || deliveryConfirmed;
  const deliveryAssetsLocked = order.deliveryAssetsLocked || (canConfirm && remainingPi > 0);
  const disputeWindowOpen = canOpenOrderDispute(order, remainingPi);
  const resolvedOrderHint = getResolvedOrderHint(order);

  return (
    <Localized>
    <div className="order-status">
      <div>
        <span className="eyebrow">Order status</span>
        <strong>{order.status}</strong>
        <p><LinkifiedText text={order.buyerNote || 'No buyer note added.'} /></p>
      </div>
      <OrderMaterials order={order} />
      <StatusTimeline status={order.status} />
      <EscrowSummary order={order} />

      {order.status === ORDER_STATUS.REQUESTED && (
        <StatusHint icon={<Clock3 size={18} />} text="Waiting for seller acceptance before deposit payment." />
      )}

      {order.status === ORDER_STATUS.PENDING_PAYMENT && (
        <div className="payment-actions">
          <button className="primary-button" onClick={() => onPay(order.id, 'deposit')}>
            <CircleDollarSign size={18} />
            Pay {service.depositPi} Pi deposit
          </button>
        </div>
      )}

      {[ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.PAID, ORDER_STATUS.IN_PROGRESS].includes(order.status) && (
        <StatusHint icon={<Clock3 size={18} />} text="Waiting for seller delivery." />
      )}

      {showDeliveryBox && (
        <div className="delivery-box">
          <span className="eyebrow">Seller delivery</span>
          <p><LinkifiedText text={order.deliveryMessage || 'Work delivered. Pay remaining amount to unlock full delivery files.'} /></p>
          {deliveryAssetsLocked && (
            <StatusHint
              icon={<ShieldCheck size={18} />}
              text="Work delivered. Pay remaining amount to unlock full delivery files."
            />
          )}
          {!deliveryAssetsLocked && (
            <>
              {order.deliveryLink && (
                <ExternalTextLink href={order.deliveryLink} icon={<LinkIcon size={15} />} />
              )}
              {order.deliveryFileName && (
                <span className="delivery-link">
                  <Paperclip size={15} />
                  {order.deliveryFileName} {order.deliveryFileSize ? `(${order.deliveryFileSize})` : ''}
                </span>
              )}
            </>
          )}
          {resolvedOrderHint && (
            <StatusHint icon={<ShieldCheck size={18} />} text={resolvedOrderHint} />
          )}
          {remainingPi > 0 ? (
            <button className="secondary-button" onClick={() => onPay(order.id, 'balance')}>
              <CircleDollarSign size={18} />
              Pay remaining {remainingPi} Pi
            </button>
          ) : canConfirm ? (
            <button className="secondary-button" onClick={() => onConfirmDelivery(order.id)}>
              <ShieldCheck size={18} />
              Confirm delivery
            </button>
          ) : null}
          {!deliveryAssetsLocked && disputeWindowOpen && (
            <DisputeAction
              orderId={order.id}
              reason={disputeReason}
              updateDisputeDraft={updateDisputeDraft}
              onDisputeOrder={onDisputeOrder}
            />
          )}
        </div>
      )}

      {deliveryConfirmed && (
        <RatingControl
          rating={order.rating}
          onRate={(rating) => onRateOrder(order.id, rating)}
        />
      )}
    </div>
    </Localized>
  );
}

function PreviousOrderSummary({ order, service }) {
  const remainingPi = getRemainingPi(order, service);

  return (
    <Localized>
    <div className="previous-order-summary">
      <span className="eyebrow">Previous order</span>
      <div className="order-title static">
        <span>Last order for this service</span>
        <StatusBadge status={order.status} />
      </div>
      <p>{getResolvedOrderHint(order) || 'This previous order is closed. You can request this service again.'}</p>
      <div className="order-meta-grid compact">
        <Metric label="Paid" value={`${order.paidPi || 0} Pi`} />
        <Metric label="Remaining" value={`${remainingPi} Pi`} />
      </div>
    </div>
    </Localized>
  );
}

function LinkifiedText({ text }) {
  if (!text) return null;

  const parts = String(text).split(/(https?:\/\/[^\s<>"']+)/g);

  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s<>"']+$/.test(part)) {
      return (
        <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer">
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function ExternalTextLink({ href, children, className = 'delivery-link', icon = null }) {
  if (!href) return null;

  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {icon}
      {children || href}
    </a>
  );
}

function DisputeAction({ orderId, reason, updateDisputeDraft, onDisputeOrder }) {
  const disputeReason = String(reason || '');
  const canOpenDispute = disputeReason.trim().length >= 10;

  return (
    <Localized>
    <div className="dispute-action">
      <label>
        Dispute reason
        <textarea
          value={disputeReason}
          onChange={(event) => updateDisputeDraft(orderId, event.target.value)}
          rows={3}
          placeholder="Explain what is wrong with the delivery before admin review"
        />
      </label>
      <button
        className="ghost-button small"
        onClick={() => onDisputeOrder(orderId, disputeReason)}
        disabled={!canOpenDispute}
      >
        <AlertTriangle size={16} />
        Dispute
      </button>
      {!canOpenDispute && (
        <p className="field-hint">Add a clear reason so admin can review the order fairly.</p>
      )}
    </div>
    </Localized>
  );
}

function StatusTimeline({ status }) {
  const timelineStatus = status === ORDER_STATUS.PAID ? ORDER_STATUS.DEPOSIT_PAID : status;
  const activeIndex = orderFlowSteps.findIndex((step) => step.status === timelineStatus);
  const isStopped = [ORDER_STATUS.DISPUTED, ORDER_STATUS.REFUNDED, ORDER_STATUS.CANCELLED].includes(status);

  return (
    <Localized>
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
    </Localized>
  );
}

function OrderMaterials({ order }) {
  const hasMaterials = Boolean(
    order.requestSourceText || order.requestReferenceLink || order.requestFileName,
  );

  if (!hasMaterials) return null;

  return (
    <Localized>
    <div className="material-list">
      <span className="eyebrow">Buyer materials</span>
      {order.requestSourceText && <p><LinkifiedText text={order.requestSourceText} /></p>}
      {order.requestReferenceLink && (
        <ExternalTextLink href={order.requestReferenceLink} icon={<LinkIcon size={15} />} />
      )}
      {order.requestFileName && (
        <span className="delivery-link">
          <Paperclip size={15} />
          {order.requestFileName} {order.requestFileSize ? `(${order.requestFileSize})` : ''}
        </span>
      )}
    </div>
    </Localized>
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
    <Localized>
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
              <option key={category} value={category}>{category}</option>
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
            type="url"
            value={newService.portfolioUrl}
            onChange={(event) => updateField('portfolioUrl', event.target.value)}
            placeholder="https://github.com/yourname/portfolio"
          />
        </label>
        <p className="field-hint">Use a trusted work-sample link such as GitHub, Behance, Dribbble, Figma, Canva, Google Drive/Docs, Dropbox, Notion, Medium, or CodePen. HTTPS only.</p>

        <label>
          Proof link
          <input
            type="url"
            value={newService.proofLink}
            onChange={(event) => updateField('proofLink', event.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
          />
        </label>
        <p className="field-hint">Use proof of previous digital work. Do not use WhatsApp, Telegram, Instagram, Facebook, Discord, TikTok, payment pages, or short links.</p>

        <p className="field-hint">Do not include phone numbers, email, messaging apps, or social contact links. Admin reviews listings before publishing.</p>

        <button className="primary-button" disabled={!canSubmit || !user}>
          <Plus size={19} />
          Submit for admin review
        </button>
      </form>
    </section>
    </Localized>
  );
}

function getOrderActionLabel(order, service, mode) {
  const remainingPi = getRemainingPi(order, service);

  if (mode === 'buyer') {
    if (order.status === ORDER_STATUS.PENDING_PAYMENT) return 'Pay deposit';
    if (order.status === ORDER_STATUS.DELIVERED && remainingPi > 0) return 'Pay remaining';
    if (order.status === ORDER_STATUS.DELIVERED && remainingPi <= 0) return 'Review delivery';
    if (order.status === ORDER_STATUS.COMPLETED && canOpenOrderDispute(order, remainingPi)) {
      return 'Review before dispute deadline';
    }
    return '';
  }

  if (mode === 'seller') {
    if (order.status === ORDER_STATUS.REQUESTED) return 'Accept or reject order';
    if ([ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.PAID].includes(order.status)) return 'Start work';
    if (order.status === ORDER_STATUS.IN_PROGRESS) return 'Submit delivery';
  }

  return '';
}

function getOrderActionGuidance(order, service, mode) {
  const remainingPi = getRemainingPi(order, service);

  if (mode === 'buyer') {
    if (order.status === ORDER_STATUS.PENDING_PAYMENT) {
      return {
        notice: 'Open details to pay the deposit for this order.',
        detailsLabel: 'Show details and pay deposit',
      };
    }
    if (order.status === ORDER_STATUS.DELIVERED && remainingPi > 0) {
      return {
        notice: 'Open details to pay the remaining balance and unlock delivery files.',
        detailsLabel: 'Show details and pay remaining',
      };
    }
    if (order.status === ORDER_STATUS.DELIVERED && remainingPi <= 0) {
      return {
        notice: 'Open details to review the delivery and confirm or open a dispute.',
        detailsLabel: 'Show details and review delivery',
      };
    }
    if (order.status === ORDER_STATUS.COMPLETED && canOpenOrderDispute(order, remainingPi)) {
      return {
        notice: 'Open details to review delivery before the dispute deadline.',
        detailsLabel: 'Show details and review delivery',
      };
    }
  }

  if (mode === 'seller') {
    if (order.status === ORDER_STATUS.REQUESTED) {
      return {
        notice: 'Open details to accept or reject this order.',
        detailsLabel: 'Show details and accept/reject',
      };
    }
    if ([ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.PAID].includes(order.status)) {
      return {
        notice: 'Open details to start work on this paid order.',
        detailsLabel: 'Show details and start work',
      };
    }
    if (order.status === ORDER_STATUS.IN_PROGRESS) {
      return {
        notice: 'Open details to submit the delivery message or link.',
        detailsLabel: 'Show details and submit delivery',
      };
    }
  }

  if (mode === 'admin' && order.status === ORDER_STATUS.DISPUTED) {
    return {
      notice: 'Review dispute details below, then settle for seller or refund buyer.',
      detailsLabel: 'Review dispute',
    };
  }

  return null;
}

function getActionOrderMode(order, userId, service) {
  if (order.buyerId === userId && getOrderActionLabel(order, service, 'buyer')) return 'buyer';
  if (order.sellerId === userId && getOrderActionLabel(order, service, 'seller')) return 'seller';
  return order.sellerId === userId ? 'seller' : 'buyer';
}

function uniqueOrders(orders) {
  return Array.from(new Map(orders.map((order) => [order.id, order])).values());
}

function isClosedBuyerOrder(order) {
  if (!order) return false;
  if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED].includes(order.status)) return true;
  if (order.status === ORDER_STATUS.COMPLETED) {
    return ['released', 'refunded'].includes(order.escrowStatus) || order.sellerPayoutStatus === 'paid';
  }
  return false;
}

function canOpenOrderDispute(order, remainingPi = 0) {
  if (!order || remainingPi > 0) return false;
  if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED].includes(order.status)) return false;
  if (order.escrowStatus !== 'release_pending') return false;

  if (order.releaseEligibleAt) {
    const releaseAt = new Date(order.releaseEligibleAt).getTime();
    if (!Number.isNaN(releaseAt) && releaseAt <= Date.now()) return false;
  }

  return true;
}

function getResolvedOrderHint(order) {
  if (!order) return '';
  if (order.escrowStatus === 'released') {
    return order.sellerPayoutStatus === 'paid'
      ? 'Order closed. Seller payout completed.'
      : 'Order closed. Seller payout is queued for manual transfer.';
  }
  if (order.escrowStatus === 'refunded') {
    return 'Order closed. Buyer refund is recorded.';
  }
  return '';
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
  disputeDrafts,
  updateDisputeDraft,
  openService,
  onPay,
  onAcceptOrder,
  onStartOrder,
  onDeliverOrder,
  onConfirmDelivery,
  onRateOrder,
  onCancelOrder,
  onDisputeOrder,
  onLogin,
}) {
  const [expandedOrders, setExpandedOrders] = useState({});
  const userId = user?.uid;
  const allUserOrders = uniqueOrders([...buyerOrders, ...sellerOrders]);
  const actionOrders = allUserOrders.filter((order) => {
    const service = services.find((item) => item.id === order.serviceId);
    if (!service) return false;
    const mode = getActionOrderMode(order, userId, service);
    return Boolean(getOrderActionLabel(order, service, mode));
  });
  const visibleOrders =
    orderTab === 'action'
      ? actionOrders
      : orderTab === 'buyer'
        ? buyerOrders
        : sellerOrders;

  function toggleOrderDetails(orderId) {
    setExpandedOrders((current) => ({ ...current, [orderId]: !current[orderId] }));
  }

  return (
    <Localized>
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Orders dashboard</span>
          <h1>Orders</h1>
        </div>
        <div className="segmented">
          {['action', 'buyer', 'seller'].map((tab) => (
            <button key={tab} className={orderTab === tab ? 'active' : ''} onClick={() => setOrderTab(tab)}>
              {tab === 'action' ? 'Action needed' : tab === 'buyer' ? 'Buying' : 'Selling'}
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
          const mode = orderTab === 'action' ? getActionOrderMode(order, userId, service) : orderTab;
          const actionLabel = getOrderActionLabel(order, service, mode);

          return (
            <OrderCard
              key={order.id}
              order={order}
              service={service}
              mode={mode}
              actionLabel={actionLabel}
              expanded={Boolean(expandedOrders[order.id])}
              onToggleDetails={toggleOrderDetails}
              draft={deliveryDrafts[order.id] ?? {}}
              updateDeliveryDraft={updateDeliveryDraft}
              disputeReason={disputeDrafts[order.id] ?? ''}
              updateDisputeDraft={updateDisputeDraft}
              openService={openService}
              onPay={onPay}
              onAcceptOrder={onAcceptOrder}
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
            <p>{user ? (orderTab === 'action' ? 'No orders need action right now.' : 'No orders in this tab yet.') : 'Pi login required for orders.'}</p>
          </div>
        )}
      </div>
    </section>
    </Localized>
  );
}

function getOrderDetailsButtonLabel(order, service, mode, expanded) {
  if (expanded) return 'Hide details';
  return getOrderActionGuidance(order, service, mode)?.detailsLabel || 'Show details';
}

function OrderCard({
  order,
  service,
  mode,
  actionLabel,
  expanded,
  onToggleDetails,
  draft,
  updateDeliveryDraft,
  disputeReason,
  updateDisputeDraft,
  openService,
  onPay,
  onAcceptOrder,
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
  const remainingPi = getRemainingPi(order, service);
  const deliveryAssetsLocked = order.deliveryAssetsLocked || (order.status === ORDER_STATUS.DELIVERED && remainingPi > 0);
  const showBuyerDelivery = mode === 'buyer' && [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED].includes(order.status);
  const disputeWindowOpen = canOpenOrderDispute(order, remainingPi);
  const resolvedOrderHint = getResolvedOrderHint(order);
  const detailsId = `order-details-${order.id}`;
  const actionGuidance = getOrderActionGuidance(order, service, mode);

  return (
    <Localized>
    <article className="order-card">
      <div className="order-card-summary">
        <button className="order-title" onClick={() => openService(service.id)}>
          <span>{service.title}</span>
          <StatusBadge status={order.status} />
        </button>
        {actionLabel && <span className="next-action-pill">{actionLabel}</span>}
        <p>{counterpart}. <LinkifiedText text={order.buyerNote || 'No buyer note added.'} /></p>
        <div className="order-meta-grid compact">
          <Metric label="Paid" value={`${order.paidPi || 0} Pi`} />
          <Metric label="Remaining" value={`${remainingPi} Pi`} />
        </div>
        {actionGuidance?.notice && (
          <StatusHint
            icon={<AlertTriangle size={18} />}
            text={actionGuidance.notice}
          />
        )}
        <button
          className="ghost-button small"
          onClick={() => onToggleDetails(order.id)}
          aria-expanded={expanded}
          aria-controls={detailsId}
        >
          {getOrderDetailsButtonLabel(order, service, mode, expanded)}
        </button>
      </div>

      {expanded && (
      <div className="order-card-details" id={detailsId}>
      <OrderMaterials order={order} />
      <StatusTimeline status={order.status} />
      <div className="order-meta-grid">
        <Metric label="Paid" value={`${order.paidPi || 0} Pi`} />
        <Metric label="Remaining" value={`${remainingPi} Pi`} />
        <Metric label={`Fee ${order.platformFeePercent || '5%'}`} value={`${order.platformFeePi || 0} Pi`} />
      </div>
      <EscrowSummary order={order} />

      {mode === 'seller' && order.status === ORDER_STATUS.REQUESTED && (
        <div className="payment-actions">
          <button className="secondary-button" onClick={() => onAcceptOrder(order.id)}>
            <CheckCircle2 size={18} />
            Accept request
          </button>
          <button className="ghost-button small" onClick={() => onCancelOrder(order.id)}>
            Reject
          </button>
        </div>
      )}

      {mode === 'buyer' && order.status === ORDER_STATUS.REQUESTED && (
        <StatusHint icon={<Clock3 size={18} />} text="Waiting for seller acceptance before deposit payment." />
      )}

      {mode === 'buyer' && order.status === ORDER_STATUS.PENDING_PAYMENT && (
        <div className="payment-actions">
          <button className="primary-button" onClick={() => onPay(order.id, 'deposit')}>
            Pay {service.depositPi} Pi deposit
          </button>
          <button className="ghost-button small" onClick={() => onCancelOrder(order.id)}>
            Cancel
          </button>
        </div>
      )}

      {mode === 'seller' && [ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.PAID].includes(order.status) && (
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
              type="url"
              value={draft.deliveryLink ?? ''}
              onChange={(event) => updateDeliveryDraft(order.id, 'deliveryLink', event.target.value)}
              placeholder="https://www.dropbox.com/s/..."
            />
          </label>
          <p className="field-hint">To deliver files or images, upload them to Drive, Dropbox, GitHub/GitLab, Vercel, Netlify, Notion, or trusted storage, then paste the HTTPS delivery link here. Direct contact, external payment, and short links are blocked.</p>
          <button className="primary-button" onClick={() => onDeliverOrder(order.id)} disabled={!hasDeliveryContent}>
            <Upload size={18} />
            Submit delivery
          </button>
        </div>
      )}

      {showBuyerDelivery && (
        <div className="delivery-box">
          <span className="eyebrow">Seller delivery</span>
          <p><LinkifiedText text={order.deliveryMessage || 'Work delivered. Pay remaining amount to unlock full delivery files.'} /></p>
          {deliveryAssetsLocked && (
            <StatusHint
              icon={<ShieldCheck size={18} />}
              text="Work delivered. Pay remaining amount to unlock full delivery files."
            />
          )}
          {!deliveryAssetsLocked && (
            <>
              {order.deliveryLink && (
                <ExternalTextLink href={order.deliveryLink} icon={<LinkIcon size={15} />} />
              )}
              {order.deliveryFileName && (
                <span className="delivery-link">
                  <Paperclip size={15} />
                  {order.deliveryFileName} {order.deliveryFileSize ? `(${order.deliveryFileSize})` : ''}
                </span>
              )}
            </>
          )}
          {resolvedOrderHint && (
            <StatusHint icon={<ShieldCheck size={18} />} text={resolvedOrderHint} />
          )}
          {remainingPi > 0 ? (
            <button className="secondary-button" onClick={() => onPay(order.id, 'balance')}>
              Pay remaining {remainingPi} Pi
            </button>
          ) : order.status === ORDER_STATUS.DELIVERED ? (
            <button className="secondary-button" onClick={() => onConfirmDelivery(order.id)}>
              Confirm delivery
            </button>
          ) : null}
          {!deliveryAssetsLocked && disputeWindowOpen && (
            <DisputeAction
              orderId={order.id}
              reason={disputeReason}
              updateDisputeDraft={updateDisputeDraft}
              onDisputeOrder={onDisputeOrder}
            />
          )}
        </div>
      )}

      {mode === 'buyer' && order.status === ORDER_STATUS.COMPLETED && (
        <RatingControl rating={order.rating} onRate={(rating) => onRateOrder(order.id, rating)} compact />
      )}
      </div>
      )}
    </article>
    </Localized>
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
  payoutWalletDraft,
  setPayoutWalletDraft,
  onSavePayoutWallet,
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
    <Localized>
    <section className="view-stack">
      <div className="profile-panel">
        <div className="profile-avatar">
          <UserRound size={28} />
        </div>
        <div>
          <span className="eyebrow">Profile</span>
          <h1>{user ? user.username : 'Pi user'}</h1>
          <p>{user ? user.walletStatus : 'Sign in with Pi Browser to view your buyer and seller data.'}</p>
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

      {user && (
        <section className="list-panel">
          <div className="section-heading tight">
            <h2>Payout / refund wallet address</h2>
            {user.piWalletAddress && <span className="count-pill">saved</span>}
          </div>
          <div className="request-materials">
            <label>
              Public Pi wallet address
              <input
                type="text"
                value={payoutWalletDraft}
                onChange={(event) => setPayoutWalletDraft(event.target.value)}
                placeholder="G..."
                autoComplete="off"
                spellCheck="false"
              />
            </label>
            <p className="field-hint">Enter your public Pi wallet address only for seller payouts or buyer refunds. Never enter your passphrase, private key, or seed phrase.</p>
            <button
              className="secondary-button"
              onClick={onSavePayoutWallet}
              disabled={!payoutWalletDraft.trim() || payoutWalletDraft.trim() === (user.piWalletAddress || '')}
            >
              Save wallet address
            </button>
          </div>
        </section>
      )}

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
    </Localized>
  );
}

function AdminGate({ user, onLogin }) {
  return (
    <Localized>
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
    </Localized>
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
  releaseDueEscrows,
  markSellerPayoutPaid,
  markBuyerRefundPaid,
  openService,
}) {
  const [payoutTxids, setPayoutTxids] = useState({});
  const [refundTxids, setRefundTxids] = useState({});
  const [pendingServiceAction, setPendingServiceAction] = useState('');
  const pendingCount = services.filter((service) => service.status === 'pending').length;
  const openReports = reports.filter((report) => report.status === 'open');
  const payoutOrders = orders.filter((order) => order.sellerPayoutStatus);
  const pendingPayoutOrders = payoutOrders.filter((order) => order.sellerPayoutStatus === 'manual_required');
  const refundOrders = orders.filter((order) => order.buyerRefundStatus);
  const pendingRefundOrders = refundOrders.filter((order) => order.buyerRefundStatus === 'manual_required');
  const disputedOrders = orders.filter((order) => order.status === ORDER_STATUS.DISPUTED);
  const reviewCount = disputedOrders.length + pendingPayoutOrders.length + pendingRefundOrders.length + openReports.length;

  function updatePayoutTxid(payoutId, value) {
    setPayoutTxids((current) => ({ ...current, [payoutId]: value }));
  }

  function updateRefundTxid(refundId, value) {
    setRefundTxids((current) => ({ ...current, [refundId]: value }));
  }

  async function submitPayout(order) {
    if (!order.sellerPayoutId) return;
    const payoutTxid = String(payoutTxids[order.sellerPayoutId] || '').trim();
    if (!payoutTxid) return;
    await markSellerPayoutPaid(order.sellerPayoutId, payoutTxid);
    setPayoutTxids((current) => ({ ...current, [order.sellerPayoutId]: '' }));
  }

  async function submitRefund(order) {
    if (!order.buyerRefundId) return;
    const refundTxid = String(refundTxids[order.buyerRefundId] || '').trim();
    if (!refundTxid) return;
    await markBuyerRefundPaid(order.buyerRefundId, refundTxid);
    setRefundTxids((current) => ({ ...current, [order.buyerRefundId]: '' }));
  }

  async function confirmServiceAction(actionKey, action) {
    if (pendingServiceAction !== actionKey) {
      setPendingServiceAction(actionKey);
      return;
    }

    await action();
    setPendingServiceAction('');
  }

  return (
    <Localized>
    <section className="view-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin flow</span>
          <h1>Moderation</h1>
        </div>
        <div className="segmented">
          {['review', 'services', 'orders', 'payouts', 'refunds', 'reports'].map((tab) => (
            <button key={tab} className={adminTab === tab ? 'active' : ''} onClick={() => setAdminTab(tab)}>
              {tab === 'review' ? 'Needs review' : tab}
            </button>
          ))}
        </div>
        {['review', 'orders', 'payouts'].includes(adminTab) && (
          <button className="secondary-button small" onClick={releaseDueEscrows}>
            Settle due escrows
          </button>
        )}
      </div>

      <div className="stats-grid">
        <Metric label="Needs review" value={reviewCount} />
        <Metric label="Pending" value={pendingCount} />
        <Metric label="Orders" value={orders.length} />
        <Metric label="Payouts due" value={pendingPayoutOrders.length} />
        <Metric label="Refunds due" value={pendingRefundOrders.length} />
        <Metric label="Reports" value={openReports.length} />
      </div>

      {adminTab === 'review' && (
        <div className="list-panel">
          {reviewCount === 0 && <p className="muted-line">No admin actions need review right now.</p>}

          {disputedOrders.length > 0 && (
            <AdminReviewSection title="Open disputes" count={disputedOrders.length}>
              {disputedOrders.map((order) => {
                const service = services.find((item) => item.id === order.serviceId);
                return (
                  <AdminOrderCard
                    key={order.id}
                    order={order}
                    service={service}
                    releaseOrder={releaseOrder}
                    refundOrder={refundOrder}
                  />
                );
              })}
            </AdminReviewSection>
          )}

          {pendingPayoutOrders.length > 0 && (
            <AdminReviewSection title="Seller payouts due" count={pendingPayoutOrders.length}>
              {pendingPayoutOrders.map((order) => {
                const service = services.find((item) => item.id === order.serviceId);
                const txidDraft = payoutTxids[order.sellerPayoutId] || '';
                return (
                  <article className="order-card" key={order.sellerPayoutId || order.id}>
                    <div className="order-title static">
                      <span>{service?.title ?? 'Removed service'}</span>
                      <StatusBadge status={formatSellerPayoutStatus(order.sellerPayoutStatus)} />
                    </div>
                    <p>Seller: {order.sellerName}. Net due: {order.sellerPayoutPi || 0} Pi</p>
                    {order.sellerWalletAddress ? (
                      <div className="wallet-address-row">
                        <span>
                          <strong>Seller wallet address</strong>
                          <code>{order.sellerWalletAddress}</code>
                        </span>
                        <button className="ghost-button small" onClick={() => copyText(order.sellerWalletAddress)}>
                          Copy address
                        </button>
                      </div>
                    ) : (
                      <StatusHint icon={<AlertTriangle size={18} />} text="Seller payout wallet address is missing." />
                    )}
                    <div className="payout-form">
                      <input
                        type="text"
                        value={txidDraft}
                        onChange={(event) => updatePayoutTxid(order.sellerPayoutId, event.target.value)}
                        placeholder="Manual payout transaction ID"
                      />
                      <button
                        className="secondary-button small"
                        onClick={() => submitPayout(order)}
                        disabled={!order.sellerPayoutId || !txidDraft.trim()}
                      >
                        Mark payout completed
                      </button>
                    </div>
                  </article>
                );
              })}
            </AdminReviewSection>
          )}

          {pendingRefundOrders.length > 0 && (
            <AdminReviewSection title="Buyer refunds due" count={pendingRefundOrders.length}>
              {pendingRefundOrders.map((order) => {
                const service = services.find((item) => item.id === order.serviceId);
                const txidDraft = refundTxids[order.buyerRefundId] || '';
                return (
                  <article className="order-card" key={order.buyerRefundId || order.id}>
                    <div className="order-title static">
                      <span>{service?.title ?? 'Removed service'}</span>
                      <StatusBadge status={formatBuyerRefundStatus(order.buyerRefundStatus)} />
                    </div>
                    <p>Buyer: {order.buyerName}. Refund due: {order.refundedPi || 0} Pi</p>
                    {order.buyerWalletAddress ? (
                      <div className="wallet-address-row">
                        <span>
                          <strong>Buyer refund wallet address</strong>
                          <code>{order.buyerWalletAddress}</code>
                        </span>
                        <button className="ghost-button small" onClick={() => copyText(order.buyerWalletAddress)}>
                          Copy address
                        </button>
                      </div>
                    ) : (
                      <StatusHint icon={<AlertTriangle size={18} />} text="Buyer refund wallet address is missing." />
                    )}
                    <div className="payout-form">
                      <input
                        type="text"
                        value={txidDraft}
                        onChange={(event) => updateRefundTxid(order.buyerRefundId, event.target.value)}
                        placeholder="Manual refund transaction ID"
                      />
                      <button
                        className="secondary-button small"
                        onClick={() => submitRefund(order)}
                        disabled={!order.buyerRefundId || !txidDraft.trim()}
                      >
                        Mark refund completed
                      </button>
                    </div>
                  </article>
                );
              })}
            </AdminReviewSection>
          )}

          {openReports.length > 0 && (
            <AdminReviewSection title="Open reports" count={openReports.length}>
              {openReports.map((report) => (
                <article className="report-card" key={report.id}>
                  <div>
                    <span className="eyebrow">{report.status}</span>
                    <h2>{report.serviceTitle}</h2>
                    <p>{report.reason}</p>
                  </div>
                  <button className="secondary-button small" onClick={() => resolveReport(report.id)}>
                    Resolve
                  </button>
                </article>
              ))}
            </AdminReviewSection>
          )}
        </div>
      )}

      {adminTab === 'services' && (
        <div className="list-panel">
          {services.map((service) => (
            <article className="moderation-card" key={service.id}>
              <button className="admin-service-title" onClick={() => openService(service.id)}>
                <span className="mini-art" style={{ '--accent': service.accent }}>{service.icon}</span>
                <span>
                  <strong>{service.title}</strong>
                  <small>{service.category} - {service.status}</small>
                </span>
              </button>
              <p>{service.summary}</p>
              <p className="muted-line">Seller status: {formatSellerStatus(service.sellerStatus)}</p>
              <div className="moderation-action-groups">
                <div className="moderation-actions">
                  <SafeAdminButton
                    actionKey={`${service.id}:approve`}
                    pendingKey={pendingServiceAction}
                    className="secondary-button small"
                    label="Approve"
                    confirmLabel="Confirm approval"
                    disabled={service.status === 'approved'}
                    onAction={() => confirmServiceAction(`${service.id}:approve`, () => moderateService(service.id, 'approved'))}
                  />
                  <SafeAdminButton
                    actionKey={`${service.id}:reject`}
                    pendingKey={pendingServiceAction}
                    className="ghost-button small"
                    label="Reject"
                    confirmLabel="Confirm rejection"
                    disabled={service.status === 'rejected'}
                    onAction={() => confirmServiceAction(`${service.id}:reject`, () => moderateService(service.id, 'rejected'))}
                  />
                  <SafeAdminButton
                    actionKey={`${service.id}:block-service`}
                    pendingKey={pendingServiceAction}
                    className="ghost-button small danger"
                    label="Block"
                    confirmLabel="Confirm block"
                    disabled={service.status === 'blocked'}
                    icon={<Ban size={15} />}
                    onAction={() => confirmServiceAction(`${service.id}:block-service`, () => moderateService(service.id, 'blocked'))}
                  />
                  <SafeAdminButton
                    actionKey={`${service.id}:remove`}
                    pendingKey={pendingServiceAction}
                    className="ghost-button small danger"
                    label="Remove"
                    confirmLabel="Confirm remove"
                    disabled={service.status === 'removed'}
                    onAction={() => confirmServiceAction(`${service.id}:remove`, () => removeService(service.id))}
                  />
                </div>
                <div className="moderation-actions seller-actions">
                  <SafeAdminButton
                    actionKey={`${service.sellerId}:verify-seller`}
                    pendingKey={pendingServiceAction}
                    className="ghost-button small"
                    label="Verify seller"
                    confirmLabel="Confirm verify"
                    disabled={service.sellerStatus === 'verified'}
                    onAction={() => confirmServiceAction(`${service.sellerId}:verify-seller`, () => updateSellerStatus(service.sellerId, 'verified'))}
                  />
                  <SafeAdminButton
                    actionKey={`${service.sellerId}:block-seller`}
                    pendingKey={pendingServiceAction}
                    className="ghost-button small danger"
                    label="Block seller"
                    confirmLabel="Confirm seller block"
                    disabled={service.sellerStatus === 'blocked'}
                    onAction={() => confirmServiceAction(`${service.sellerId}:block-seller`, () => updateSellerStatus(service.sellerId, 'blocked'))}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {adminTab === 'orders' && (
        <div className="list-panel">
          {orders.map((order) => {
            const service = services.find((item) => item.id === order.serviceId);
            const isOpenSellerOrder = ![ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED].includes(order.status);
            const isSellerBlocked = isOpenSellerOrder && (order.sellerStatus === 'blocked' || service?.sellerStatus === 'blocked');
            return (
              <article className="order-card" key={order.id}>
                <div className="order-title static">
                  <span>{service?.title ?? 'Removed service'}</span>
                  <StatusBadge status={order.status} />
                  {isSellerBlocked && <span className="status risk">Seller blocked</span>}
                </div>
                <p>Buyer: {order.buyerName} - Seller: {order.sellerName}</p>
                <div className="order-meta-grid">
                  <Metric label="Paid" value={`${order.paidPi || 0} Pi`} />
                  <Metric label={`Fee ${order.platformFeePercent || '5%'}`} value={`${order.platformFeePi || 0} Pi`} />
                  <Metric label="Escrow" value={formatEscrowStatus(order.escrowStatus)} />
                  <Metric label="Created" value={order.createdAt} />
                </div>
                <EscrowSummary order={order} />
                {order.status === ORDER_STATUS.DISPUTED && (
                  <>
                    <AdminDisputeReview order={order} service={service} />
                    <div className="moderation-actions">
                      <button className="secondary-button small" onClick={() => releaseOrder(order.id)}>
                        Settle for seller
                      </button>
                      <button className="ghost-button small danger" onClick={() => refundOrder(order.id)}>
                        Refund buyer
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {adminTab === 'payouts' && (
        <div className="list-panel">
          <div className="section-note">
            <strong>Pending seller payouts</strong>
            <p>Settle due escrows first, send Pi manually from the app wallet, then record the payout transaction ID.</p>
          </div>
          {payoutOrders.length === 0 ? (
            <p className="muted-line">No seller payouts are queued.</p>
          ) : (
            payoutOrders.map((order) => {
              const service = services.find((item) => item.id === order.serviceId);
              const txidDraft = payoutTxids[order.sellerPayoutId] || '';
              return (
                <article className="order-card" key={order.sellerPayoutId || order.id}>
                  <div className="order-title static">
                    <span>{service?.title ?? 'Removed service'}</span>
                    <StatusBadge status={formatSellerPayoutStatus(order.sellerPayoutStatus)} />
                  </div>
                  <p>Seller: {order.sellerName} - Order: {order.id}</p>
                  <div className="order-meta-grid">
                    <Metric label="Gross" value={`${order.amountPi || order.paidPi || 0} Pi`} />
                    <Metric label={`Fee ${order.platformFeePercent || '5%'}`} value={`${order.platformFeePi || 0} Pi`} />
                    <Metric label="Seller net" value={`${order.sellerPayoutPi || 0} Pi`} />
                    <Metric label="Settled" value={formatDateTimeLabel(order.releasedAt)} />
                  </div>
                  {order.sellerWalletAddress ? (
                    <div className="wallet-address-row">
                      <span>
                        <strong>Seller wallet address</strong>
                        <code>{order.sellerWalletAddress}</code>
                      </span>
                      <button className="ghost-button small" onClick={() => copyText(order.sellerWalletAddress)}>
                        Copy address
                      </button>
                    </div>
                  ) : (
                    <StatusHint icon={<AlertTriangle size={18} />} text="Seller payout wallet address is missing." />
                  )}
                  {order.sellerPayoutStatus === 'manual_required' ? (
                    <div className="payout-form">
                      <input
                        type="text"
                        value={txidDraft}
                        onChange={(event) => updatePayoutTxid(order.sellerPayoutId, event.target.value)}
                        placeholder="Manual payout transaction ID"
                      />
                      <button
                        className="secondary-button small"
                        onClick={() => submitPayout(order)}
                        disabled={!order.sellerPayoutId || !txidDraft.trim()}
                      >
                        Mark payout completed
                      </button>
                    </div>
                  ) : order.sellerPayoutStatus === 'paid' ? (
                    <StatusHint
                      icon={<ShieldCheck size={18} />}
                      text={`Payout completed. Transaction ID: ${order.sellerPayoutTxid || 'recorded'}`}
                    />
                  ) : (
                    <StatusHint icon={<Clock3 size={18} />} text={formatSellerPayoutStatus(order.sellerPayoutStatus)} />
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {adminTab === 'refunds' && (
        <div className="list-panel">
          <div className="section-note">
            <strong>Buyer refunds</strong>
            <p>Resolve buyer-favor disputes first, send Pi manually from the app wallet, then record the refund transaction ID.</p>
          </div>
          {refundOrders.length === 0 ? (
            <p className="muted-line">No buyer refunds are queued.</p>
          ) : (
            refundOrders.map((order) => {
              const service = services.find((item) => item.id === order.serviceId);
              const txidDraft = refundTxids[order.buyerRefundId] || '';
              return (
                <article className="order-card" key={order.buyerRefundId || order.id}>
                  <div className="order-title static">
                    <span>{service?.title ?? 'Removed service'}</span>
                    <StatusBadge status={formatBuyerRefundStatus(order.buyerRefundStatus)} />
                  </div>
                  <p>Buyer: {order.buyerName} - Order: {order.id}</p>
                  <div className="order-meta-grid">
                    <Metric label="Paid" value={`${order.paidPi || 0} Pi`} />
                    <Metric label="Refund" value={`${order.refundedPi || 0} Pi`} />
                    <Metric label="Recorded" value={formatDateTimeLabel(order.refundRecordedAt)} />
                    <Metric label="Escrow" value={formatEscrowStatus(order.escrowStatus)} />
                  </div>
                  {order.buyerWalletAddress ? (
                    <div className="wallet-address-row">
                      <span>
                        <strong>Buyer refund wallet address</strong>
                        <code>{order.buyerWalletAddress}</code>
                      </span>
                      <button className="ghost-button small" onClick={() => copyText(order.buyerWalletAddress)}>
                        Copy address
                      </button>
                    </div>
                  ) : (
                    <StatusHint icon={<AlertTriangle size={18} />} text="Buyer refund wallet address is missing." />
                  )}
                  {order.buyerRefundStatus === 'manual_required' ? (
                    <div className="payout-form">
                      <input
                        type="text"
                        value={txidDraft}
                        onChange={(event) => updateRefundTxid(order.buyerRefundId, event.target.value)}
                        placeholder="Manual refund transaction ID"
                      />
                      <button
                        className="secondary-button small"
                        onClick={() => submitRefund(order)}
                        disabled={!order.buyerRefundId || !txidDraft.trim()}
                      >
                        Mark refund completed
                      </button>
                    </div>
                  ) : order.buyerRefundStatus === 'paid' ? (
                    <StatusHint
                      icon={<ShieldCheck size={18} />}
                      text={`Refund completed. Transaction ID: ${order.buyerRefundTxid || order.refundTxid || 'recorded'}`}
                    />
                  ) : (
                    <StatusHint icon={<Clock3 size={18} />} text={formatBuyerRefundStatus(order.buyerRefundStatus)} />
                  )}
                </article>
              );
            })
          )}
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
    </Localized>
  );
}

function AdminReviewSection({ title, count, children }) {
  return (
    <Localized>
    <section className="admin-review-section">
      <div className="section-heading tight">
        <h2>{title}</h2>
        <span className="count-pill">{count}</span>
      </div>
      <div className="admin-review-list">
        {children}
      </div>
    </section>
    </Localized>
  );
}

function AdminOrderCard({ order, service, releaseOrder, refundOrder }) {
  const isOpenSellerOrder = ![ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED].includes(order.status);
  const isSellerBlocked = isOpenSellerOrder && (order.sellerStatus === 'blocked' || service?.sellerStatus === 'blocked');
  const actionGuidance = getOrderActionGuidance(order, service, 'admin');

  return (
    <Localized>
    <article className="order-card">
      <div className="order-title static">
        <span>{service?.title ?? 'Removed service'}</span>
        <StatusBadge status={order.status} />
        {isSellerBlocked && <span className="status risk">Seller blocked</span>}
      </div>
      <p>Buyer: {order.buyerName} - Seller: {order.sellerName}</p>
      {actionGuidance?.notice && (
        <StatusHint icon={<AlertTriangle size={18} />} text={actionGuidance.notice} />
      )}
      <div className="order-meta-grid">
        <Metric label="Paid" value={`${order.paidPi || 0} Pi`} />
        <Metric label={`Fee ${order.platformFeePercent || '5%'}`} value={`${order.platformFeePi || 0} Pi`} />
        <Metric label="Escrow" value={formatEscrowStatus(order.escrowStatus)} />
        <Metric label="Created" value={order.createdAt} />
      </div>
      <EscrowSummary order={order} />
      {order.status === ORDER_STATUS.DISPUTED && (
        <>
          <AdminDisputeReview order={order} service={service} />
          <div className="moderation-actions">
            <button className="secondary-button small" onClick={() => releaseOrder(order.id)}>
              Settle for seller
            </button>
            <button className="ghost-button small danger" onClick={() => refundOrder(order.id)}>
              Refund buyer
            </button>
          </div>
        </>
      )}
    </article>
    </Localized>
  );
}

function AdminDisputeReview({ order, service }) {
  const serviceTitle = service?.title || order.serviceTitle || 'Removed service';
  const serviceSummary = service?.summary || order.serviceSummary || 'No service summary available.';
  const serviceTerms = service?.terms || order.serviceTerms || 'No service terms recorded.';
  const revisionPolicy = service?.revisionPolicy || order.serviceRevisionPolicy || 'No revision policy recorded.';
  const buyerRequirements =
    service?.requirementsFromBuyer || order.serviceRequirementsFromBuyer || 'No buyer requirements recorded.';
  const disputeDeadline = order.disputeWindowEndsAt || order.releaseEligibleAt || '';

  return (
    <Localized>
    <div className="admin-dispute-review">
      <span className="eyebrow">Dispute review</span>
      <div className="admin-review-grid">
        <div className="admin-review-block">
          <strong>Dispute reason</strong>
          <p><LinkifiedText text={order.disputeReason || 'No dispute reason was recorded for this order.'} /></p>
        </div>
        <div className="admin-review-block">
          <strong>Seller service post</strong>
          <p><b>{serviceTitle}</b></p>
          <p><LinkifiedText text={serviceSummary} /></p>
          <p><b>Terms:</b> <LinkifiedText text={serviceTerms} /></p>
          <p><b>Revision policy:</b> <LinkifiedText text={revisionPolicy} /></p>
          <p><b>Buyer requirements:</b> <LinkifiedText text={buyerRequirements} /></p>
        </div>
        <div className="admin-review-block">
          <strong>Buyer request</strong>
          <p><LinkifiedText text={order.buyerNote || 'No buyer note added.'} /></p>
          {order.requestSourceText && <p><LinkifiedText text={order.requestSourceText} /></p>}
          {order.requestReferenceLink && (
            <ExternalTextLink href={order.requestReferenceLink} icon={<LinkIcon size={15} />} />
          )}
          {order.requestFileName && (
            <span className="delivery-link">
              <Paperclip size={15} />
              {order.requestFileName} {order.requestFileSize ? `(${order.requestFileSize})` : ''}
            </span>
          )}
        </div>
        <div className="admin-review-block">
          <strong>Seller delivery</strong>
          <p><LinkifiedText text={order.deliveryMessage || 'No seller delivery message recorded.'} /></p>
          {order.deliveryLink && (
            <ExternalTextLink href={order.deliveryLink} icon={<LinkIcon size={15} />} />
          )}
          {order.deliveryFileName && (
            <span className="delivery-link">
              <Paperclip size={15} />
              {order.deliveryFileName} {order.deliveryFileSize ? `(${order.deliveryFileSize})` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="order-meta-grid">
        <Metric label="Paid by buyer" value={`${order.paidPi || 0} Pi`} />
        <Metric label={`Platform fee ${order.platformFeePercent || '5%'}`} value={`${order.platformFeePi || 0} Pi`} />
        <Metric label="Seller net" value={`${order.sellerPayoutPi || 0} Pi`} />
        <Metric label="Dispute deadline" value={formatDateTimeLabel(disputeDeadline)} />
      </div>
    </div>
    </Localized>
  );
}

function SafeAdminButton({
  actionKey,
  pendingKey,
  className,
  label,
  confirmLabel,
  disabled,
  icon,
  onAction,
}) {
  const isConfirming = pendingKey === actionKey;

  return (
    <Localized>
    <button
      type="button"
      className={`${className}${isConfirming ? ' confirming' : ''}`}
      onClick={onAction}
      disabled={disabled}
      aria-pressed={isConfirming}
    >
      {icon}
      {isConfirming ? confirmLabel : label}
    </button>
    </Localized>
  );
}

function EscrowSummary({ order }) {
  const hasEscrow = Boolean(order?.escrowStatus && order.escrowStatus !== 'not_funded') || Number(order?.paidPi || 0) > 0;
  if (!hasEscrow) return null;

  const hint = getEscrowHint(order);

  return (
    <Localized>
    <div className="escrow-summary">
      <div className="escrow-summary-head">
        <span className="eyebrow">Escrow</span>
        <strong>{formatEscrowStatus(order.escrowStatus)}</strong>
      </div>
      <div className="order-meta-grid">
        <Metric label="Held" value={`${order.escrowHeldPi || 0} Pi`} />
        <Metric label="Seller net" value={`${order.sellerPayoutPi || 0} Pi`} />
        <Metric label="Refunded" value={`${order.refundedPi || 0} Pi`} />
      </div>
      {hint && <StatusHint icon={hint.icon} text={hint.text} />}
    </div>
    </Localized>
  );
}

function Metric({ label, value }) {
  return (
    <Localized>
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
    </Localized>
  );
}

function StatusBadge({ status }) {
  const isGood = [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED].includes(status);
  const isRisk = [ORDER_STATUS.DISPUTED, ORDER_STATUS.REFUNDED, ORDER_STATUS.CANCELLED].includes(status);
  return (
    <Localized>
      <span className={isRisk ? 'status risk' : isGood ? 'status success' : 'status'}>{status}</span>
    </Localized>
  );
}

function StatusHint({ icon, text }) {
  return (
    <Localized>
    <div className="status-hint">
      {icon}
      <span>{text}</span>
    </div>
    </Localized>
  );
}

function RatingControl({ rating, onRate, compact = false }) {
  return (
    <Localized>
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
    </Localized>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <Localized>
    <button className={active ? 'nav-item active' : 'nav-item'} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
    </Localized>
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

function getRemainingPi(order, service) {
  const pricePi = Number(service?.pricePi || 0);
  const paidPi = Number(order?.paidPi || 0);
  return Number(Math.max(pricePi - paidPi, 0).toFixed(2));
}

function getEscrowHint(order) {
  if (!order) return null;

  if (order.escrowStatus === 'release_pending' && order.releaseEligibleAt) {
    return {
      icon: <Clock3 size={18} />,
      text: `Funds are held in app escrow. Release available after dispute window: ${formatDateTimeLabel(order.releaseEligibleAt)}`,
    };
  }

  if (order.escrowStatus === 'released') {
    if (order.sellerPayoutStatus === 'paid') {
      return {
        icon: <ShieldCheck size={18} />,
        text: `Payout completed. Transaction ID: ${order.sellerPayoutTxid || 'recorded'}`,
      };
    }

    return {
      icon: <ShieldCheck size={18} />,
      text: 'Escrow settled. Seller payout pending manual transfer.',
    };
  }

  if (order.escrowStatus === 'disputed') {
    return {
      icon: <AlertTriangle size={18} />,
      text: 'Escrow paused for admin dispute review.',
    };
  }

  if (order.escrowStatus === 'refunded') {
    if (order.buyerRefundStatus === 'paid') {
      return {
        icon: <ShieldCheck size={18} />,
        text: `Refund completed. Transaction ID: ${order.buyerRefundTxid || order.refundTxid || 'recorded'}`,
      };
    }

    return {
      icon: <CircleDollarSign size={18} />,
      text: `Refund recorded. Manual buyer refund required: ${formatDateTimeLabel(order.refundRecordedAt)}`,
    };
  }

  if (['holding', 'holding_deposit', 'holding_full'].includes(order.escrowStatus)) {
    return {
      icon: <WalletCards size={18} />,
      text: 'Buyer payment is held by app escrow until delivery and dispute checks complete.',
    };
  }

  return null;
}

function formatEscrowStatus(status) {
  if (status === 'holding_deposit') return 'Deposit held';
  if (status === 'holding_full') return 'Full amount held';
  if (status === 'holding') return 'Held';
  if (status === 'release_pending') return 'Settlement pending';
  if (status === 'released') return 'Settled';
  if (status === 'disputed') return 'Disputed';
  if (status === 'refunded') return 'Refunded';
  return 'Not funded';
}

function formatSellerPayoutStatus(status) {
  if (status === 'paid') return 'Payout paid';
  if (status === 'manual_required') return 'Payout pending';
  return 'No payout';
}

function formatBuyerRefundStatus(status) {
  if (status === 'paid') return 'Refund paid';
  if (status === 'manual_required') return 'Refund pending';
  return 'No refund';
}

function formatDateTimeLabel(value) {
  if (!value) return 'not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'not set';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLegalRoute() {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const routes = {
    '/privacy': 'privacy',
    '/privacy-policy': 'privacy',
    '/terms': 'terms',
    '/terms-of-service': 'terms',
    '/contact': 'contact',
  };

  return routes[pathname.toLowerCase()] || '';
}

function getInitialServiceSlugFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('service') || params.get('s') || '';
}

function getServiceShareUrl(service, language = 'en') {
  if (typeof window === 'undefined') return '';
  const configuredBaseUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const baseUrl = configuredBaseUrl || window.location.origin;
  const lang = language === 'ar' ? 'ar' : 'en';
  return `${baseUrl}/service/${encodeURIComponent(service.slug || service.id)}?lang=${lang}`;
}

function getPrivateExecutionUrl(service) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/?service=${encodeURIComponent(service.slug || service.id)}&from=public`;
}

async function copyText(value) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return;
  await navigator.clipboard.writeText(value).catch(() => {});
}

function formatSellerStatus(status) {
  if (status === 'verified') return 'Verified';
  if (status === 'blocked') return 'Blocked';
  return 'New seller';
}

export default App;
