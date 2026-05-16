import {
  Children,
  cloneElement,
  createContext,
  createElement,
  isValidElement,
  useContext,
} from 'react';

const LANGUAGE_STORAGE_KEY = 'pideal-language';
const SUPPORTED_LANGUAGES = new Set(['en', 'ar']);
const RTL_LANGUAGES = new Set(['ar']);
const TRANSLATABLE_PROPS = new Set(['alt', 'aria-label', 'label', 'message', 'placeholder', 'text', 'title']);

const ar = {
  'Refresh PiDeal': 'تحديث PiDeal',
  'Action center': 'مركز الإجراءات',
  Loading: 'جار التحميل',
  Close: 'إغلاق',
  'Pending actions': 'إجراءات معلقة',
  'Login to see actions.': 'سجل الدخول لعرض الإجراءات.',
  'No pending actions.': 'لا توجد إجراءات معلقة.',
  'Order accepted by seller': 'قبل البائع الطلب',
  'Pay deposit': 'ادفع العربون',
  'Order delivered': 'تم تسليم الطلب',
  'Pay remaining / review delivery': 'ادفع المتبقي / راجع التسليم',
  'Dispute resolved': 'تم حل النزاع',
  'Check dispute result': 'راجع نتيجة النزاع',
  'New order requested': 'طلب جديد',
  'Accept or reject order': 'اقبل أو ارفض الطلب',
  'Deposit paid': 'تم دفع العربون',
  'Buyer completed payment': 'أكمل المشتري الدفع',
  'Order completed': 'الطلب مكتمل',
  'Dispute opened': 'تم فتح نزاع',
  'Respond / wait for admin': 'رد أو انتظر الأدمن',
  'Pending services': 'خدمات بانتظار المراجعة',
  'Review services': 'راجع الخدمات',
  'Pending reports': 'بلاغات بانتظار المراجعة',
  'Pending disputes': 'نزاعات بانتظار المراجعة',
  'Resolve reports': 'حل البلاغات',
  'Sellers awaiting verification': 'بائعون بانتظار التحقق',
  'Review sellers': 'راجع البائعين',
  'Work delivered. Pay remaining amount to unlock full delivery files.':
    'تم تسليم العمل. ادفع المبلغ المتبقي لفتح ملفات التسليم الكاملة.',
  Escrow: 'الضمان',
  Held: 'محتجز',
  'Seller net': 'صافي البائع',
  Refunded: 'مسترد',
  'Deposit held': 'العربون محتجز',
  'Full amount held': 'كامل المبلغ محتجز',
  'Release pending': 'بانتظار التحرير',
  Released: 'تم التحرير',
  'Not funded': 'غير ممول',
  'Escrow paused for admin dispute review.': 'تم إيقاف الضمان مؤقتًا لمراجعة النزاع من الأدمن.',
  'Buyer payment is held by app escrow until delivery and dispute checks complete.':
    'دفعة المشتري محتجزة في ضمان التطبيق حتى اكتمال التسليم وفحوص النزاع.',
  'Remaining balance completed. Delivery is unlocked and escrow is pending release after the dispute window.':
    'تم دفع المتبقي. تم فتح التسليم والضمان بانتظار التحرير بعد فترة النزاع.',
  'Release due escrows': 'حرر الضمانات المستحقة',
  'Due escrow releases could not be processed.': 'تعذر تنفيذ تحرير الضمانات المستحقة.',
  Share: 'مشاركة',
  'Share sheet opened.': 'تم فتح نافذة المشاركة.',
  'Service link copied.': 'تم نسخ رابط الخدمة.',
  'Service link could not be shared.': 'تعذر مشاركة رابط الخدمة.',
  'Protected checkout': 'دفع محمي',
  'Orders and payments work inside Pi Browser': 'الطلبات والمدفوعات تعمل داخل Pi Browser',
  'PiDeal protects both buyer and seller through escrow, verified Pi identity, protected delivery, and dispute resolution.':
    'يحمي PiDeal المشتري والبائع عبر الضمان، وهوية Pi الموثقة، والتسليم المحمي، وحل النزاعات.',
  'Escrow protected': 'محمي بالضمان',
  'Secure Pi payment': 'دفع Pi آمن',
  'Verified Pi identity': 'هوية Pi موثقة',
  'Dispute support': 'دعم النزاعات',
  'Open in Pi Browser': 'افتح في Pi Browser',
  'Get Pi Browser': 'حمّل Pi Browser',
  'PiDeal home': 'الرئيسية في PiDeal',
  Notifications: 'الإشعارات',
  Primary: 'التنقل الرئيسي',
  Language: 'اللغة',
  English: 'English',
  Arabic: 'العربية',
  'Buy and sell digital services with Pi.': 'اشترِ وبِع خدمات رقمية باستخدام Pi Network.',
  'Pi Browser ready': 'جاهز لـ Pi Browser',
  'Sign in with Pi Browser to buy, sell, and manage orders.': 'سجل الدخول عبر Pi Browser للشراء والبيع وإدارة الطلبات.',
  Connected: 'متصل',
  'Pi Login': 'دخول Pi',
  'Sign in with Pi': 'تسجيل الدخول بـ Pi',
  Login: 'دخول',
  Home: 'الرئيسية',
  Sell: 'بيع',
  Orders: 'الطلبات',
  Profile: 'الملف',
  Admin: 'الأدمن',
  Browse: 'تصفح',
  Buying: 'شراء',
  Selling: 'بيع',

  All: 'الكل',
  Design: 'تصميم',
  Writing: 'كتابة',
  Translation: 'ترجمة',
  Images: 'صور',
  Code: 'برمجة',
  Prompts: 'برومبتات',
  Templates: 'قوالب',

  'PiDeal Lite': 'PiDeal Lite',
  'Fast digital services for Pi Network users.': 'خدمات رقمية احترافية وسريعة لمستخدمي Pi Network.',
  'Browse, order, pay securely with Pi, receive delivery, confirm, and rate.':
    'تصفح الخدمات، اطلب ما تحتاجه، ادفع بأمان عبر Pi Network، استلم العمل، ثم أكد وقيّم.',
  Commission: 'العمولة',
  Scope: 'النطاق',
  'Digital only': 'رقمي فقط',
  'Search digital services': 'ابحث عن خدمات رقمية',
  'Search services': 'البحث في الخدمات',
  'Service categories': 'تصنيفات الخدمات',
  'Featured services': 'خدمات مميزة',
  'Latest services': 'أحدث الخدمات',
  Marketplace: 'السوق',
  'Browse all': 'تصفح الكل',
  live: 'متاحة',
  'No approved service matches this search.': 'لا توجد خدمة مقبولة تطابق هذا البحث.',

  New: 'جديد',
  Verified: 'موثق',
  Blocked: 'محظور',
  'New seller': 'بائع جديد',
  Price: 'السعر',
  Deposit: 'العربون',
  Delivery: 'التسليم',
  Terms: 'الشروط',
  'Trust signals': 'إشارات الثقة',
  'New seller profile.': 'ملف بائع جديد.',
  'Requirements:': 'المتطلبات:',
  'Buyer brief required before work starts.': 'يجب أن يرسل المشتري التفاصيل قبل بدء العمل.',
  'Revision policy:': 'سياسة التعديلات:',
  'Revision policy not provided.': 'لم يتم تحديد سياسة التعديلات.',
  'Request service': 'طلب الخدمة',
  Report: 'بلاغ',
  Brief: 'التفاصيل',
  'Describe what the seller should create or edit': 'اشرح ما تريد من البائع إنشاءه أو تعديله',
  'Source text': 'النص الأصلي',
  'Paste text for translation, CV edits, prompts, or copy work':
    'الصق نص الترجمة أو تعديل السيرة أو البرومبتات أو الكتابة',
  'Reference link': 'رابط مرجعي',
  'Reference file': 'ملف مرجعي',
  'No file selected': 'لم يتم اختيار ملف',
  'Pi Login to order': 'سجل دخول Pi للطلب',
  'Request sent. Waiting for the seller to accept before deposit payment.':
    'تم إرسال الطلب. بانتظار قبول البائع قبل دفع العربون.',
  'This order is not ready for that payment step.': 'هذا الطلب غير جاهز لخطوة الدفع هذه.',
  'No remaining balance is due for this order.': 'لا يوجد مبلغ متبق لهذا الطلب.',
  'Payment server did not move this order to the expected escrow state.':
    'سيرفر الدفع لم ينقل الطلب إلى حالة الضمان المتوقعة.',
  'Remaining balance completed. The order is now complete and ready for rating.':
    'تم دفع المتبقي. أصبح الطلب مكتملًا وجاهزًا للتقييم.',
  'Deposit completed by the backend. The seller can start work now.':
    'تم دفع العربون عبر الباكند. يمكن للبائع بدء العمل الآن.',
  'Request accepted. Buyer can pay the deposit now.': 'تم قبول الطلب. يمكن للمشتري دفع العربون الآن.',
  'Order request could not be accepted.': 'تعذر قبول الطلب.',
  'Delivery confirmation failed. Pay the remaining balance first if any amount is still due.':
    'فشل تأكيد التسليم. ادفع المتبقي أولًا إذا كان هناك مبلغ مستحق.',
  'Delivery confirmed and fully paid. You can rate the seller now.':
    'تم تأكيد التسليم ودفع المبلغ كاملًا. يمكنك الآن تقييم البائع.',
  'This is your listing. New buyer requests appear in Orders > Selling.':
    'هذه خدمتك. طلبات المشترين الجديدة تظهر في الطلبات > البيع.',
  'This seller is blocked while admin reviews trust and safety reports.':
    'هذا البائع محظور أثناء مراجعة الأدمن لبلاغات الثقة والسلامة.',

  Pay: 'ادفع',
  Request: 'الطلب',
  Accept: 'القبول',
  Deposit: 'العربون',
  Balance: 'المتبقي',
  Paid: 'مدفوع',
  Work: 'العمل',
  Rating: 'التقييم',
  'Order progress': 'تقدم الطلب',
  'Order status': 'حالة الطلب',
  Requested: 'بانتظار قبول البائع',
  'Pending Payment': 'بانتظار الدفع',
  'Deposit Paid': 'العربون مدفوع',
  'In Progress': 'قيد التنفيذ',
  Delivered: 'تم التسليم',
  Completed: 'مكتمل',
  Disputed: 'نزاع',
  Refunded: 'مسترد',
  Cancelled: 'ملغي',
  'No buyer note added.': 'لم يضف المشتري ملاحظة.',
  'Waiting for seller acceptance before deposit payment.': 'بانتظار قبول البائع قبل دفع العربون.',
  'Waiting for seller delivery.': 'بانتظار تسليم البائع.',
  'Seller delivery': 'تسليم البائع',
  'Confirm delivery': 'تأكيد التسليم',
  Dispute: 'فتح نزاع',
  'Buyer materials': 'مواد المشتري',
  Remaining: 'المتبقي',

  'Seller flow': 'مسار البائع',
  'Add service': 'إضافة خدمة',
  'Pi login': 'دخول Pi',
  'Pi login is required before submitting a listing.': 'يجب تسجيل الدخول بـ Pi قبل إرسال خدمة.',
  'Service title': 'عنوان الخدمة',
  'Logo design for Pi apps': 'تصميم شعار لتطبيقات Pi',
  Category: 'التصنيف',
  'Price Pi': 'السعر بـ Pi',
  'Deposit Pi': 'العربون بـ Pi',
  'Deposit should be equal to or lower than the full price.':
    'يجب أن يكون العربون مساويًا للسعر الكامل أو أقل منه.',
  'Delivery days': 'مدة التسليم بالأيام',
  'Icon letters': 'حروف الأيقونة',
  'Service color': 'لون الخدمة',
  Summary: 'الملخص',
  'Describe the digital result the buyer receives': 'صف النتيجة الرقمية التي سيحصل عليها المشتري',
  'State what the buyer must provide and what is excluded': 'اذكر ما يجب على المشتري توفيره وما هو غير مشمول',
  Experience: 'الخبرة',
  'Briefly describe your relevant digital service experience': 'اكتب باختصار خبرتك في هذه الخدمة الرقمية',
  'Requirements from buyer': 'المطلوب من المشتري',
  'List the exact files, text, references, or details you need from the buyer':
    'اذكر الملفات أو النصوص أو المراجع أو التفاصيل المطلوبة من المشتري',
  'Revision policy': 'سياسة التعديلات',
  'Example: one small revision after first delivery': 'مثال: تعديل بسيط واحد بعد التسليم الأول',
  'Portfolio URL': 'رابط معرض الأعمال',
  'Proof link': 'رابط إثبات العمل',
  'Do not include phone numbers, email, messaging apps, or social contact links. Admin reviews listings before publishing.':
    'لا تضع أرقام هاتف أو بريدًا أو تطبيقات مراسلة أو روابط تواصل اجتماعي. الأدمن يراجع الخدمات قبل نشرها.',
  'Submit for admin review': 'إرسال للمراجعة',

  'Orders dashboard': 'لوحة الطلبات',
  'Connect Pi to view buyer and seller orders.': 'سجل دخول Pi لعرض طلبات الشراء والبيع.',
  'No orders in this tab yet.': 'لا توجد طلبات في هذا التبويب بعد.',
  'Pi login required for orders.': 'تسجيل دخول Pi مطلوب للطلبات.',
  Fee: 'العمولة',
  'Fee 5%': 'عمولة 5%',
  Mode: 'النوع',
  'Not paid': 'غير مدفوع',
  Cancel: 'إلغاء',
  'Start work': 'بدء العمل',
  'Accept request': 'قبول الطلب',
  'Delivery message': 'رسالة التسليم',
  'Describe the completed work': 'صف العمل المكتمل',
  'Delivery link': 'رابط التسليم',
  'Delivery file': 'ملف التسليم',
  'Submit delivery': 'إرسال التسليم',
  'Remaining balance': 'المبلغ المتبقي',
  'Seller rating': 'تقييم البائع',

  'Pi user': 'مستخدم Pi',
  'Sign in with Pi Browser to view your buyer and seller data.':
    'سجل الدخول عبر Pi Browser لعرض بيانات الشراء والبيع الخاصة بك.',
  'Buyer orders': 'طلبات الشراء',
  'Seller orders': 'طلبات البيع',
  'Listed services': 'الخدمات المعروضة',
  'No services listed by this user yet.': 'لا توجد خدمات لهذا المستخدم بعد.',

  'This PiDeal account is not assigned as an admin.': 'هذا الحساب غير معين كأدمن في PiDeal.',
  'Admin moderation requires a PiDeal admin account.': 'مراجعة الأدمن تتطلب حساب أدمن في PiDeal.',
  'Only users with role admin in the backend database can review, approve, reject, block, or remove services.':
    'فقط المستخدمون بدور admin في قاعدة بيانات الباكند يمكنهم المراجعة أو القبول أو الرفض أو الحظر أو الحذف.',
  'Admin flow': 'مسار الأدمن',
  Moderation: 'المراجعة',
  Pending: 'بانتظار المراجعة',
  Reports: 'البلاغات',
  services: 'الخدمات',
  orders: 'الطلبات',
  reports: 'البلاغات',
  pending: 'قيد المراجعة',
  approved: 'مقبولة',
  rejected: 'مرفوضة',
  blocked: 'محظورة',
  open: 'مفتوح',
  resolved: 'محلول',
  'Seller status:': 'حالة البائع:',
  Approve: 'قبول',
  Reject: 'رفض',
  Block: 'حظر',
  Remove: 'حذف',
  'Verify seller': 'توثيق البائع',
  'Block seller': 'حظر البائع',
  'Removed service': 'خدمة محذوفة',
  Created: 'تاريخ الإنشاء',
  'Release to seller': 'تحرير للبائع',
  'Refund buyer': 'استرداد للمشتري',
  Resolve: 'حل البلاغ',
  Resolved: 'تم الحل',

  'Digital delivery message or link': 'رسالة أو رابط تسليم رقمي',
  'Buyer confirmation required': 'تأكيد المشتري مطلوب',
  'Pi escrow payment': 'دفع Pi عبر الضمان',
  'Minimal logo design sprint': 'تصميم شعار سريع وبسيط',
  'Clean logo concepts for Pi apps, shops, and community projects.':
    'أفكار شعارات نظيفة لتطبيقات Pi والمتاجر ومشاريع المجتمع.',
  'Professional CV rewrite': 'إعادة كتابة سيرة ذاتية احترافية',
  'Sharper CV wording for tech, business, and remote roles.':
    'صياغة أقوى للسيرة الذاتية للوظائف التقنية والتجارية والعمل عن بعد.',
  'Arabic to English translation': 'ترجمة من العربية إلى الإنجليزية',
  'Clear translation for profiles, app copy, and short documents.':
    'ترجمة واضحة للملفات الشخصية ونصوص التطبيقات والمستندات القصيرة.',
  'Product image cleanup': 'تحسين صور المنتجات',
  'Background cleanup, crop, contrast, and listing-ready export.':
    'تنظيف الخلفية، القص، تحسين التباين، وتجهيز الصورة للنشر.',
  'Simple React bug fix': 'إصلاح بسيط في React',
  'Small React fixes for forms, layout issues, and state bugs.':
    'إصلاحات React صغيرة للنماذج ومشاكل التخطيط وحالات الواجهة.',
};

const arPatterns = [
  {
    pattern: /^Signed in as (.+)\. Active mode: (.+)\.$/,
    render: ([, username, mode]) => `تم تسجيل الدخول باسم ${username}. الوضع الحالي: ${translateText(mode, 'ar')}.`,
  },
  {
    pattern: /^Sign in with Pi Browser to buy, sell, and manage orders\. Mode: (.+)\.$/,
    render: ([, mode]) => `سجل الدخول عبر Pi Browser للشراء والبيع وإدارة الطلبات. الوضع: ${mode}.`,
  },
  {
    pattern: /^Connected as (.+)\.$/,
    render: ([, username]) => `تم الاتصال باسم ${username}.`,
  },
  {
    pattern: /^Seller rated ([1-5]) stars\.$/,
    render: ([, rating]) => `تم تقييم البائع ${rating} من 5.`,
  },
  {
    pattern: /^Service (approved|rejected|blocked)\.$/,
    render: ([, status]) => `تم تحديث الخدمة إلى ${translateText(status, 'ar')}.`,
  },
  {
    pattern: /^Seller marked (unverified|verified|blocked)\.$/,
    render: ([, status]) => `تم تحديث حالة البائع إلى ${translateText(status, 'ar')}.`,
  },
  {
    pattern: /^(.+) live$/,
    render: ([, count]) => `${count} متاحة`,
  },
  {
    pattern: /^Buyer: (.+)$/,
    render: ([, name]) => `المشتري: ${name}`,
  },
  {
    pattern: /^Seller: (.+)$/,
    render: ([, name]) => `البائع: ${name}`,
  },
  {
    pattern: /^Buyer: (.+) · Seller: (.+)$/,
    render: ([, buyer, seller]) => `المشتري: ${buyer} · البائع: ${seller}`,
  },
  {
    pattern: /^Buyer: (.+) Â· Seller: (.+)$/,
    render: ([, buyer, seller]) => `المشتري: ${buyer} · البائع: ${seller}`,
  },
  {
    pattern: /^Pay (.+) Pi deposit$/,
    render: ([, amount]) => `ادفع عربون ${amount} Pi`,
  },
  {
    pattern: /^Pay remaining (.+) Pi$/,
    render: ([, amount]) => `ادفع المتبقي ${amount} Pi`,
  },
  {
    pattern: /^Escrow releases after dispute window: (.+)$/,
    render: ([, time]) => `يتحرر الضمان بعد فترة النزاع: ${time}`,
  },
  {
    pattern: /^Escrow released to seller record: (.+)$/,
    render: ([, time]) => `تم تسجيل تحرير الضمان للبائع: ${time}`,
  },
  {
    pattern: /^Escrow refunded to buyer record: (.+)$/,
    render: ([, time]) => `تم تسجيل استرداد الضمان للمشتري: ${time}`,
  },
  {
    pattern: /^(.+) escrow releases processed\.$/,
    render: ([, count]) => `تم تنفيذ ${count} من تحريرات الضمان.`,
  },
  {
    pattern: /^Fee (.+)$/,
    render: ([, percent]) => `عمولة ${percent}`,
  },
  {
    pattern: /^Pay (.+) Pi full$/,
    render: ([, amount]) => `ادفع كامل المبلغ ${amount} Pi`,
  },
  {
    pattern: /^Rate ([1-5]) stars$/,
    render: ([, rating]) => `قيّم ${rating} نجوم`,
  },
  {
    pattern: /^Use color (.+)$/,
    render: ([, color]) => `استخدم اللون ${color}`,
  },
];

export function getInitialLanguage() {
  const urlLanguage = getLanguageFromUrl();
  if (urlLanguage) return urlLanguage;

  const savedLanguage = getSavedLanguage();
  if (savedLanguage) return savedLanguage;

  const browserLanguages = getBrowserLanguages();
  return browserLanguages.some((language) => language.toLowerCase().startsWith('ar')) ? 'ar' : 'en';
}

export function isRtlLanguage(language) {
  return RTL_LANGUAGES.has(language);
}

export function saveLanguagePreference(language) {
  if (!SUPPORTED_LANGUAGES.has(language)) return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Pi Browser/local dev can still run without persisted language preferences.
  }
}

export function translateText(text, language) {
  if (language !== 'ar' || typeof text !== 'string') return text;

  const leading = text.match(/^\s*/)?.[0] ?? '';
  const trailing = text.match(/\s*$/)?.[0] ?? '';
  const trimmed = text.trim();
  if (!trimmed) return text;

  const directTranslation = ar[trimmed];
  if (directTranslation) return `${leading}${directTranslation}${trailing}`;

  for (const { pattern, render } of arPatterns) {
    const match = trimmed.match(pattern);
    if (match) return `${leading}${render(match)}${trailing}`;
  }

  return text;
}

export function localizeTree(node, language) {
  if (language !== 'ar') return node;
  return localizeNode(node, language);
}

export const I18nContext = createContext({ language: 'en' });

export function I18nProvider({ language, children }) {
  return createElement(I18nContext.Provider, { value: { language } }, children);
}

export function useLocale() {
  return useContext(I18nContext);
}

function getSavedLanguage() {
  try {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.has(savedLanguage) ? savedLanguage : '';
  } catch {
    return '';
  }
}

function getLanguageFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const language = new URLSearchParams(window.location.search).get('lang');
    return SUPPORTED_LANGUAGES.has(language) ? language : '';
  } catch {
    return '';
  }
}

function getBrowserLanguages() {
  if (typeof navigator === 'undefined') return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }
  return navigator.language ? [navigator.language] : [];
}

function localizeNode(node, language) {
  if (typeof node === 'string') return translateText(node, language);
  if (Array.isArray(node)) return node.map((child) => localizeNode(child, language));
  if (!isValidElement(node)) return node;

  const nextProps = {};

  for (const propName of TRANSLATABLE_PROPS) {
    if (typeof node.props[propName] === 'string') {
      nextProps[propName] = translateText(node.props[propName], language);
    }
  }

  if (node.props.children !== undefined) {
    nextProps.children = Children.map(node.props.children, (child) => localizeNode(child, language));
  }

  return Object.keys(nextProps).length > 0 ? cloneElement(node, nextProps) : node;
}
