import { VerticalProfile, Vertical, ToneGuidance } from './types';

/**
 * MENA sample content per vertical.
 *
 * Purpose: give a brand-new account something real to look at on day one, and
 * give the agent/template layer a grounded starting point instead of generic
 * "engage your audience!" filler. Every caption is written for the Gulf
 * market — bilingual, weekend-correct, and mindful of what a local audience
 * actually responds to.
 *
 * `{{placeholders}}` are intentional: the onboarding flow binds them from the
 * organisation profile.
 */

const SHARED_MENA_TONE_NOTES = {
  do: {
    en: [
      'Write Arabic as Arabic, not as a translation — reorder the sentence if it reads stiff.',
      'Post the Arabic and English as separate posts, or Arabic first in a bilingual caption.',
      'Respect the local week: the Gulf weekend is Fri–Sat (Sun–Thu working), except the UAE, which is Sat–Sun.',
      'Peak engagement is evening, roughly 20:00–23:00 local, and later during Ramadan.',
      'Use Western digits for prices and times even inside Arabic copy — that is the Gulf norm.',
    ],
    ar: [
      'اكتب العربية عربيةً لا ترجمةً؛ وأعد ترتيب الجملة إن جاءت متكلّفة.',
      'انشر العربية والإنجليزية في منشورين منفصلين، أو ابدأ بالعربية في التسمية الثنائية.',
      'راعِ الأسبوع المحلي: عطلة الخليج الجمعة والسبت (والدوام من الأحد إلى الخميس)، عدا الإمارات فعطلتها السبت والأحد.',
      'ذروة التفاعل مساءً، بين الثامنة والحادية عشرة تقريبًا بالتوقيت المحلي، وتتأخر أكثر في رمضان.',
      'استخدم الأرقام الغربية للأسعار والمواعيد حتى داخل النص العربي؛ فهذا هو العُرف في الخليج.',
    ],
  },
  dont: {
    en: [
      'Do not machine-translate a Latin caption into Arabic and ship it unread.',
      'Do not use Arabic transliterated in Latin letters ("Arabizi") in brand copy.',
      'Do not apply letter-spacing to Arabic — it severs the letter joins.',
      'Do not schedule around a Mon–Fri working week.',
      'Do not use imagery of alcohol, or of unrelated men and women in close physical contact.',
    ],
    ar: [
      'لا تترجم التسمية آليًا إلى العربية وتنشرها دون مراجعة.',
      'لا تستخدم العربية المكتوبة بحروف لاتينية («العربيزي») في محتوى العلامة.',
      'لا تطبّق تباعد الأحرف على النص العربي؛ فذلك يقطع اتصال الحروف.',
      'لا تجدول منشوراتك على أساس أسبوع عمل من الاثنين إلى الجمعة.',
      'تجنّب صور المشروبات الكحولية، أو التقارب الجسدي بين رجال ونساء من غير المحارم.',
    ],
  },
};

const tone = (
  summaryEn: string,
  summaryAr: string,
  greetEn: string[],
  greetAr: string[]
): ToneGuidance => ({
  summary: { en: summaryEn, ar: summaryAr },
  do: SHARED_MENA_TONE_NOTES.do,
  dont: SHARED_MENA_TONE_NOTES.dont,
  greetings: { en: greetEn, ar: greetAr },
});

export const RESTAURANTS: VerticalProfile = {
  id: 'restaurants',
  name: { en: 'Restaurants & cafés', ar: 'المطاعم والمقاهي' },
  audience: {
    en:
      'Residents and visitors deciding where to eat tonight or this weekend. Highly ' +
      'visual, decides fast, checks opening hours and location before anything else.',
    ar:
      'مقيمون وزوّار يقرّرون أين يتناولون العشاء الليلة أو في نهاية الأسبوع. ' +
      'يتأثرون بالصورة، ويقرّرون سريعًا، ويبحثون عن المواعيد والموقع قبل أي شيء آخر.',
  },
  tone: tone(
    'Appetite first, information second, offer third. Food photography carries the post; the ' +
      'caption exists to answer "where, when, how much".',
    'الشهية أولًا، ثم المعلومة، ثم العرض. الصورة هي التي تحمل المنشور، والتسمية تجيب عن: أين ومتى وبكم.',
    ['Come hungry'],
    ['أهلًا بكم']
  ),
  contentPillars: {
    en: [
      'Dish of the week — one plate, shot well',
      'Behind the pass — the kitchen, the team, the sourcing',
      'Weekend / brunch programming',
      'Customer photos and reviews, reposted with credit',
      'Practical: hours, delivery, parking, reservations',
    ],
    ar: [
      'طبق الأسبوع — طبق واحد بصورة متقنة',
      'من داخل المطبخ — الفريق ومصادر المكوّنات',
      'برنامج نهاية الأسبوع والفطور المتأخر',
      'صور العملاء وتقييماتهم مع ذكر أصحابها',
      'معلومات عملية: المواعيد والتوصيل والمواقف والحجز',
    ],
  },
  samples: [
    {
      id: 'rest_dish_of_week',
      vertical: 'restaurants',
      title: { en: 'Dish of the week', ar: 'طبق الأسبوع' },
      caption: {
        en: '{{dishName}}. {{oneLineDescription}}. On the menu all week. {{price}}',
        ar: '{{dishName}}. {{oneLineDescription}}. متوفّر طوال الأسبوع. {{price}}',
      },
      hashtags: {
        en: ['#DubaiFood', '#DubaiEats', '#UAERestaurants'],
        ar: ['#مطاعم_دبي', '#اكل_الامارات', '#مطاعم_الإمارات'],
      },
      mediaBrief: {
        en: 'One plate, overhead or 45°, natural light, minimal props. Steam is worth the extra take.',
        ar: 'طبق واحد من الأعلى أو بزاوية 45°، بضوء طبيعي وبأقل عدد من الإكسسوارات. والبخار يستحق لقطة إضافية.',
      },
      suggestedTime: '19:30',
    },
    {
      id: 'rest_weekend',
      vertical: 'restaurants',
      title: { en: 'Weekend programming', ar: 'برنامج نهاية الأسبوع' },
      caption: {
        en:
          'Weekend at {{businessName}}: {{weekendOffer}}. Friday and Saturday, {{hours}}. ' +
          'Booking on {{contact}}.',
        ar:
          'نهاية الأسبوع في {{businessName}}: {{weekendOffer}}. الجمعة والسبت، {{hours}}. ' +
          'للحجز: {{contact}}.',
      },
      hashtags: {
        en: ['#WeekendBrunch', '#DubaiWeekend'],
        ar: ['#نهاية_الأسبوع', '#فطور_متأخر'],
      },
      mediaBrief: {
        en: 'Full table, several hands reaching in. Communal, not a solo diner.',
        ar: 'مائدة كاملة وأيادٍ متعددة تمتد إليها. أجواء جماعية لا فردية.',
      },
      suggestedTime: '20:00',
    },
    {
      id: 'rest_team',
      vertical: 'restaurants',
      title: { en: 'Meet the kitchen', ar: 'تعرّف على المطبخ' },
      caption: {
        en:
          'This is {{staffName}}, who has been making {{dishName}} here for {{duration}}. ' +
          'Ask for it by name.',
        ar:
          'هذا {{staffName}}، وهو من يُعدّ {{dishName}} عندنا منذ {{duration}}. اطلبه باسمه.',
      },
      hashtags: { en: ['#MeetTheTeam'], ar: ['#تعرف_على_الفريق'] },
      mediaBrief: {
        en: 'Candid portrait at the station, mid-work. Not a staged headshot.',
        ar: 'صورة عفوية في موقع العمل أثناء الانشغال، لا صورة شخصية مُعدّة.',
      },
      suggestedTime: '13:00',
    },
    {
      id: 'rest_hours',
      vertical: 'restaurants',
      title: { en: 'Hours & delivery', ar: 'المواعيد والتوصيل' },
      caption: {
        en:
          'Open {{hours}}, every day. Delivery on {{deliveryApps}}. We are on {{location}} — ' +
          'parking is {{parkingNote}}.',
        ar:
          'مفتوحون {{hours}} يوميًا. والتوصيل عبر {{deliveryApps}}. موقعنا في {{location}} — ' +
          'والمواقف {{parkingNote}}.',
      },
      hashtags: { en: ['#DubaiFood'], ar: ['#مطاعم_دبي'] },
      mediaBrief: {
        en: 'Storefront or interior wide shot so people recognise the place when they arrive.',
        ar: 'لقطة واسعة للواجهة أو الداخل ليتعرّف الناس على المكان عند وصولهم.',
      },
      suggestedTime: '11:00',
    },
  ],
};

export const AGENCIES: VerticalProfile = {
  id: 'agencies',
  name: { en: 'Agencies', ar: 'وكالات التسويق' },
  audience: {
    en:
      'Marketing managers and founders evaluating whether you can be trusted with a budget. ' +
      'They read results, not adjectives.',
    ar:
      'مديرو تسويق ومؤسّسون يقيّمون ما إذا كانت ميزانيتهم في أيدٍ أمينة. ' +
      'يقرأون النتائج لا الصفات.',
  },
  tone: tone(
    'Evidence over enthusiasm. Show a number, a before/after, or a decision you made and why. ' +
      'Agencies that post generic marketing advice are indistinguishable from each other.',
    'الدليل أهم من الحماس. اعرض رقمًا أو مقارنة قبل/بعد أو قرارًا اتخذته ولماذا. ' +
      'فالوكالات التي تنشر نصائح تسويقية عامة لا يميّزها شيء عن غيرها.',
    ['Let us talk'],
    ['لنتحدث']
  ),
  contentPillars: {
    en: [
      'Case study — one client, one metric, one honest constraint',
      'Point of view on a live regional campaign',
      'Team and hiring',
      'Process transparency — how you actually price and scope',
      'Client-facing FAQ answered publicly',
    ],
    ar: [
      'دراسة حالة — عميل واحد ومؤشر واحد وقيد واحد بصراحة',
      'رأي في حملة إقليمية قائمة',
      'الفريق والتوظيف',
      'شفافية في آلية العمل — كيف تسعّرون وتحدّدون النطاق فعليًا',
      'أسئلة العملاء الشائعة والإجابة عنها علنًا',
    ],
  },
  samples: [
    {
      id: 'agency_case_study',
      vertical: 'agencies',
      title: { en: 'Case study', ar: 'دراسة حالة' },
      caption: {
        en:
          '{{clientType}}, {{market}}. {{metricName}} went from {{before}} to {{after}} in ' +
          '{{duration}}. What actually moved it: {{keyLever}}. What did not: {{failedApproach}}.',
        ar:
          '{{clientType}} في {{market}}. ارتفع {{metricName}} من {{before}} إلى {{after}} خلال ' +
          '{{duration}}. وما أحدث الفرق فعلًا: {{keyLever}}. وما لم ينفع: {{failedApproach}}.',
      },
      hashtags: {
        en: ['#MENAMarketing', '#CaseStudy'],
        ar: ['#تسويق_رقمي', '#دراسة_حالة'],
      },
      mediaBrief: {
        en: 'A single clean chart or a before/after pair. Readable at thumbnail size.',
        ar: 'رسم بياني واحد واضح أو مقارنة قبل/بعد، تُقرأ بحجم الصورة المصغّرة.',
      },
      suggestedTime: '09:00',
    },
    {
      id: 'agency_pov',
      vertical: 'agencies',
      title: { en: 'Point of view', ar: 'وجهة نظر' },
      caption: {
        en:
          '{{brandName}} ran {{campaignDescription}} last week. It worked because {{reason}}. ' +
          'The version most brands here would have shipped instead: {{commonMistake}}.',
        ar:
          'أطلقت {{brandName}} {{campaignDescription}} الأسبوع الماضي، ونجحت لأن {{reason}}. ' +
          'أما النسخة التي كانت أغلب العلامات هنا ستطلقها فهي: {{commonMistake}}.',
      },
      hashtags: { en: ['#MENAMarketing'], ar: ['#التسويق_في_المنطقة'] },
      mediaBrief: {
        en: 'Screenshot of the campaign creative with your annotation on top.',
        ar: 'لقطة من تصميم الحملة مع تعليقك التوضيحي فوقها.',
      },
      suggestedTime: '10:00',
    },
    {
      id: 'agency_pricing',
      vertical: 'agencies',
      title: { en: 'How we price', ar: 'كيف نسعّر' },
      caption: {
        en:
          'We get asked this constantly, so: {{pricingModel}}. Retainers start at {{startingPrice}}. ' +
          'We are a bad fit if {{badFitCriteria}}.',
        ar:
          'يتكرّر هذا السؤال كثيرًا، فإليكم الإجابة: {{pricingModel}}. تبدأ العقود الشهرية من {{startingPrice}}. ' +
          'ولسنا الخيار المناسب إذا {{badFitCriteria}}.',
      },
      hashtags: { en: ['#AgencyLife'], ar: ['#وكالات_التسويق'] },
      mediaBrief: {
        en: 'Plain text card. No stock photography — it undercuts the candour.',
        ar: 'بطاقة نصية بسيطة. بلا صور جاهزة، فهي تُضعف انطباع الصراحة.',
      },
      suggestedTime: '11:00',
    },
  ],
};

export const SALONS: VerticalProfile = {
  id: 'salons',
  name: { en: 'Salons & beauty', ar: 'صالونات التجميل' },
  audience: {
    en:
      'Mostly repeat local clients within a short drive. Books by WhatsApp, decides on the ' +
      'strength of before/after work and on whether the space looks clean.',
    ar:
      'عملاء محليون متكرّرون في نطاق قريب. يحجزون عبر واتساب، ويقرّرون بناءً على نتائج ' +
      'قبل/بعد وعلى مدى نظافة المكان في الصور.',
  },
  tone: tone(
    'Results and hygiene, in that order. Always obtain explicit permission before posting a ' +
      'client\'s face — in the Gulf many clients will consent to the work being shown but not ' +
      'their identity, and getting this wrong is a serious breach of trust.',
    'النتائج والنظافة، بهذا الترتيب. واحصل دائمًا على إذن صريح قبل نشر صورة وجه أي عميلة؛ ' +
      'ففي الخليج كثيرات يوافقن على عرض النتيجة دون إظهار الهوية، والخطأ في ذلك خرق جسيم للثقة.',
    ['Welcome'],
    ['أهلًا وسهلًا']
  ),
  contentPillars: {
    en: [
      'Before / after — with documented consent',
      'Hygiene and sterilisation standards',
      'New service or product launch',
      'Stylist spotlight',
      'Booking, hours and the ladies-only / private-room policy',
    ],
    ar: [
      'قبل وبعد — بموافقة موثّقة',
      'معايير النظافة والتعقيم',
      'إطلاق خدمة أو منتج جديد',
      'تعريف بأحد أفراد الفريق',
      'الحجز والمواعيد وسياسة الأقسام النسائية والغرف الخاصة',
    ],
  },
  samples: [
    {
      id: 'salon_before_after',
      vertical: 'salons',
      title: { en: 'Before / after', ar: 'قبل وبعد' },
      caption: {
        en:
          '{{serviceName}} by {{stylistName}}. {{durationOfAppointment}} in the chair. ' +
          'Shared with our client\'s permission. Book on {{contact}}.',
        ar:
          '{{serviceName}} على يد {{stylistName}}. {{durationOfAppointment}} من الجلسة. ' +
          'نُشر بإذن عميلتنا. للحجز: {{contact}}.',
      },
      hashtags: {
        en: ['#DubaiSalon', '#DubaiBeauty'],
        ar: ['#صالون_دبي', '#تجميل_الإمارات'],
      },
      mediaBrief: {
        en:
          'Identical angle and lighting for both frames or the comparison is worthless. ' +
          'Crop to the work, not the face, unless consent explicitly covers the face.',
        ar:
          'الزاوية والإضاءة نفسها في اللقطتين، وإلا فلا قيمة للمقارنة. ' +
          'واقتصر على موضع العمل لا الوجه، ما لم تشمل الموافقة الوجه صراحةً.',
      },
      suggestedTime: '18:00',
    },
    {
      id: 'salon_hygiene',
      vertical: 'salons',
      title: { en: 'How we sterilise', ar: 'كيف نعقّم' },
      caption: {
        en:
          'Every tool is {{sterilisationProcess}} between clients. Single-use items are ' +
          '{{singleUseList}}. If you ever want to see it done, ask — we will show you.',
        ar:
          'تُعقَّم كل الأدوات عبر {{sterilisationProcess}} بين عميلة وأخرى. والمستهلكات ذات ' +
          'الاستخدام الواحد هي {{singleUseList}}. وإن أردتِ رؤية ذلك بنفسك، فاسألينا وسنُريكِ.',
      },
      hashtags: { en: ['#SalonHygiene'], ar: ['#تعقيم', '#نظافة_الصالون'] },
      mediaBrief: {
        en: 'Short video of the actual process. Claim without footage reads as marketing.',
        ar: 'مقطع قصير للعملية الفعلية. فالادّعاء دون تصوير يُقرأ كدعاية.',
      },
      suggestedTime: '12:00',
    },
    {
      id: 'salon_booking',
      vertical: 'salons',
      title: { en: 'Booking & hours', ar: 'الحجز والمواعيد' },
      caption: {
        en:
          'Open {{hours}}. {{privacyPolicy}}. WhatsApp {{contact}} to book — we usually reply ' +
          'within {{responseTime}}.',
        ar:
          'مفتوحون {{hours}}. {{privacyPolicy}}. للحجز عبر واتساب: {{contact}} — ' +
          'ونردّ عادةً خلال {{responseTime}}.',
      },
      hashtags: { en: ['#DubaiSalon'], ar: ['#صالون_دبي'] },
      mediaBrief: {
        en: 'Interior wide shot, well lit, tidy. This image is the cleanliness claim.',
        ar: 'لقطة داخلية واسعة بإضاءة جيدة ومكان مرتّب؛ فهذه الصورة هي الدليل على النظافة.',
      },
      suggestedTime: '10:00',
    },
  ],
};

export const CLINICS: VerticalProfile = {
  id: 'clinics',
  name: { en: 'Clinics & healthcare', ar: 'العيادات والرعاية الصحية' },
  audience: {
    en:
      'Patients researching a symptom or a procedure, and family members researching on ' +
      'someone else\'s behalf. Anxious, comparison-shopping, and sensitive to overclaiming.',
    ar:
      'مرضى يبحثون عن عَرَض أو إجراء طبي، وأقارب يبحثون نيابةً عن غيرهم. ' +
      'قلقون، ويقارنون بين الخيارات، وحسّاسون تجاه المبالغة في الوعود.',
  },
  tone: tone(
    'Educational and measured. Healthcare advertising is regulated across the Gulf — DHA/DoH ' +
      'in the UAE, the MoH/SFDA in Saudi Arabia — and rules commonly restrict before/after ' +
      'imagery, testimonials, guarantees of outcome and superlatives such as "best" or "safest". ' +
      'Have marketing copy reviewed by the clinic\'s licensing officer before it goes out.',
    'أسلوب تثقيفي ومتزن. فالإعلان الطبي منظَّم في دول الخليج — هيئة الصحة بدبي ودائرة الصحة ' +
      'في أبوظبي بالإمارات، ووزارة الصحة والهيئة العامة للغذاء والدواء في السعودية — ' +
      'وكثيرًا ما تُقيَّد صور قبل/بعد والشهادات وضمانات النتائج وصيغ التفضيل مثل «الأفضل» أو «الأكثر أمانًا». ' +
      'راجِع المحتوى التسويقي مع مسؤول التراخيص في العيادة قبل نشره.',
    ['Take care'],
    ['دمتم بصحة']
  ),
  contentPillars: {
    en: [
      'Explain one condition or procedure plainly',
      'Meet the doctor — credentials, languages spoken, licence number',
      'Seasonal health guidance (heat, dust, flu season, Ramadan fasting and medication)',
      'Practical: insurance accepted, walk-in policy, hours',
      'Myth correction, sourced',
    ],
    ar: [
      'شرح حالة أو إجراء واحد بلغة بسيطة',
      'تعريف بالطبيب — مؤهلاته واللغات التي يتحدثها ورقم ترخيصه',
      'إرشادات صحية موسمية (الحرّ والغبار وموسم الإنفلونزا والصيام والأدوية في رمضان)',
      'معلومات عملية: التأمينات المقبولة وسياسة الزيارة دون موعد والمواعيد',
      'تصحيح المفاهيم الخاطئة مع ذكر المصدر',
    ],
  },
  samples: [
    {
      id: 'clinic_explainer',
      vertical: 'clinics',
      title: { en: 'Condition explainer', ar: 'شرح حالة' },
      caption: {
        en:
          '{{conditionName}}: what it is, what usually causes it, and when it is worth seeing ' +
          'someone. {{plainExplanation}} This is general information, not a diagnosis — ' +
          'please see a doctor about your own case.',
        ar:
          '{{conditionName}}: ما هي، وما أسبابها الشائعة، ومتى يستدعي الأمر مراجعة الطبيب. ' +
          '{{plainExplanation}} وهذه معلومات عامة لا تُغني عن التشخيص — ' +
          'يُرجى مراجعة الطبيب بشأن حالتك.',
      },
      hashtags: { en: ['#HealthEducation'], ar: ['#توعية_صحية', '#صحتك'] },
      mediaBrief: {
        en: 'Simple diagram or plain text card. No stock photo of a smiling model in a coat.',
        ar: 'رسم توضيحي بسيط أو بطاقة نصية. بلا صور جاهزة لعارض يبتسم بمعطف أبيض.',
      },
      suggestedTime: '09:00',
    },
    {
      id: 'clinic_doctor',
      vertical: 'clinics',
      title: { en: 'Meet the doctor', ar: 'تعرّف على الطبيب' },
      caption: {
        en:
          'Dr {{doctorName}}, {{specialty}}. {{qualifications}}. Speaks {{languages}}. ' +
          'Licence {{licenceNumber}}. Booking on {{contact}}.',
        ar:
          'د. {{doctorName}}، {{specialty}}. {{qualifications}}. يتحدث {{languages}}. ' +
          'رقم الترخيص {{licenceNumber}}. للحجز: {{contact}}.',
      },
      hashtags: { en: ['#Healthcare'], ar: ['#الرعاية_الصحية'] },
      mediaBrief: {
        en: 'Professional portrait in the actual clinic. Licence number must be legible if shown.',
        ar: 'صورة مهنية داخل العيادة نفسها، ورقم الترخيص واضح إن ظهر.',
      },
      suggestedTime: '10:00',
    },
    {
      id: 'clinic_ramadan_health',
      vertical: 'clinics',
      title: { en: 'Fasting & medication', ar: 'الصيام والأدوية' },
      caption: {
        en:
          'If you take regular medication, do not change your schedule on your own for Ramadan. ' +
          'Many doses can be safely moved to Suhoor or Iftar, but some cannot. Speak to your ' +
          'doctor before the month starts — {{contact}}.',
        ar:
          'إن كنت تتناول أدوية بانتظام، فلا تغيّر مواعيدها من تلقاء نفسك في رمضان. ' +
          'فبعض الجرعات يمكن نقلها بأمان إلى السحور أو الإفطار، وبعضها لا يمكن. ' +
          'راجِع طبيبك قبل دخول الشهر — {{contact}}.',
      },
      hashtags: {
        en: ['#RamadanHealth', '#Fasting'],
        ar: ['#صحة_رمضان', '#الصيام'],
      },
      mediaBrief: {
        en: 'Calm informational card. Ramadan palette is fine; keep it clinical, not festive.',
        ar: 'بطاقة معلوماتية هادئة. لا بأس بألوان رمضان، مع إبقاء الطابع طبيًا لا احتفاليًا.',
      },
      suggestedTime: '20:30',
    },
  ],
};

export const SMALL_BUSINESS: VerticalProfile = {
  id: 'small_business',
  name: { en: 'Small businesses & retail', ar: 'الأعمال الصغيرة والتجزئة' },
  audience: {
    en:
      'Neighbourhood customers and online browsers within the same emirate or city. ' +
      'Responsive to the owner\'s own voice — small businesses win on personality, not polish.',
    ar:
      'عملاء الحي ومتصفّحون عبر الإنترنت داخل الإمارة أو المدينة نفسها. ' +
      'يتفاعلون مع صوت صاحب العمل نفسه؛ فالأعمال الصغيرة تكسب بالشخصية لا بالتنميق.',
  },
  tone: tone(
    'First person, specific, unpolished. A phone photo with a real story outperforms a stock ' +
      'image every time at this size.',
    'بضمير المتكلم، ومحدّد، وبلا تنميق. فصورة بالهاتف مع قصة حقيقية تتفوّق دائمًا على صورة جاهزة في هذا الحجم.',
    ['Thank you for supporting a small business'],
    ['شكرًا لدعمكم مشروعًا صغيرًا']
  ),
  contentPillars: {
    en: [
      'The story behind one product',
      'New stock / restock announcements',
      'The owner, on camera, talking plainly',
      'Customer shout-outs and repeat regulars',
      'Practical: location pin, hours, delivery radius, payment methods',
    ],
    ar: [
      'قصة وراء منتج واحد',
      'وصول بضاعة جديدة أو إعادة توفّر',
      'صاحب المشروع أمام الكاميرا يتحدث ببساطة',
      'شكر العملاء وذكر الزبائن الدائمين',
      'معلومات عملية: الموقع والمواعيد ونطاق التوصيل وطرق الدفع',
    ],
  },
  samples: [
    {
      id: 'sb_product_story',
      vertical: 'small_business',
      title: { en: 'Product story', ar: 'قصة منتج' },
      caption: {
        en:
          'This is {{productName}}. {{originStory}} It takes {{timeToMake}} to make and we can ' +
          'only do {{quantityPerWeek}} a week. {{price}} — {{contact}}.',
        ar:
          'هذا {{productName}}. {{originStory}} يستغرق إعداده {{timeToMake}}، ولا نستطيع ' +
          'إنتاج أكثر من {{quantityPerWeek}} أسبوعيًا. {{price}} — {{contact}}.',
      },
      hashtags: {
        en: ['#SmallBusinessUAE', '#MadeInUAE', '#ShopLocal'],
        ar: ['#مشاريع_صغيرة', '#صنع_في_الإمارات', '#ادعم_المحلي'],
      },
      mediaBrief: {
        en: 'Hands making it, phone camera, daylight. Imperfection is the point.',
        ar: 'أيادٍ أثناء الصنع، بكاميرا الهاتف وضوء النهار. وعدم الكمال هو المقصود.',
      },
      suggestedTime: '19:00',
    },
    {
      id: 'sb_restock',
      vertical: 'small_business',
      title: { en: 'Back in stock', ar: 'عاد التوفّر' },
      caption: {
        en:
          '{{productName}} is back. {{quantity}} available. Last time this went in ' +
          '{{lastSelloutTime}} — order on {{contact}}.',
        ar:
          'عاد {{productName}}. الكمية المتوفرة {{quantity}}. وفي المرة الماضية نفد خلال ' +
          '{{lastSelloutTime}} — للطلب: {{contact}}.',
      },
      hashtags: { en: ['#BackInStock'], ar: ['#عاد_التوفر'] },
      mediaBrief: {
        en: 'The actual stock as it arrived, boxes and all. Scarcity has to look real.',
        ar: 'البضاعة كما وصلت فعلًا بصناديقها. فالندرة يجب أن تبدو حقيقية.',
      },
      suggestedTime: '20:00',
    },
    {
      id: 'sb_owner_voice',
      vertical: 'small_business',
      title: { en: 'From the owner', ar: 'من صاحب المشروع' },
      caption: {
        en:
          '{{ownerName}} here. {{updateOrStory}} Thank you to everyone who has ordered this ' +
          'month — it genuinely makes a difference at our size.',
        ar:
          'معكم {{ownerName}}. {{updateOrStory}} شكرًا لكل من طلب منّا هذا الشهر — ' +
          'فالأمر يُحدث فرقًا حقيقيًا في مشروع بحجمنا.',
      },
      hashtags: { en: ['#SmallBusinessUAE'], ar: ['#مشاريع_صغيرة'] },
      mediaBrief: {
        en: 'Selfie video, vertical, no script. 30–45 seconds.',
        ar: 'مقطع سيلفي عمودي بلا نص معدّ. من 30 إلى 45 ثانية.',
      },
      suggestedTime: '21:00',
    },
  ],
};

export const VERTICALS: VerticalProfile[] = [
  RESTAURANTS,
  AGENCIES,
  SALONS,
  CLINICS,
  SMALL_BUSINESS,
];

export const VERTICALS_BY_ID: Record<Vertical, VerticalProfile> =
  VERTICALS.reduce((acc, v) => {
    acc[v.id] = v;
    return acc;
  }, {} as Record<Vertical, VerticalProfile>);
