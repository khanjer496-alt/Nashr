import { CampaignTemplate, CampaignId } from './types';
import { RAMADAN_TONE, EID_TONE, NATIONAL_DAY_TONE } from './tone';

/**
 * Bilingual campaign templates.
 *
 * Anchor dates are declarative, not baked-in Gregorian dates:
 *  - Hijri campaigns resolve through `fromHijri()` in `@gitroom/nashr-i18n`
 *    and are ALWAYS approximate (moon sighting varies by country).
 *  - Fixed campaigns carry an `anchorYear` so the ordinal ("the 55th") can be
 *    computed rather than hardcoded and left to rot.
 *
 * `offsetDays` is relative to the anchor. Ramadan's anchor is 1 Ramadan, so
 * its in-month posts have positive offsets; the Eids anchor on the day itself.
 */

const ALL_GULF = ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'] as const;
const ALL_MENA = [...ALL_GULF, 'EG', 'JO'] as const;

export const RAMADAN: CampaignTemplate = {
  id: 'ramadan',
  name: { en: 'Ramadan', ar: 'رمضان' },
  description: {
    en:
      'A month-long arc: prepare, greet, be useful daily, then hand over to Eid. ' +
      'The commercial ask stays small throughout.',
    ar:
      'حملة تمتد شهرًا كاملًا: التحضير، ثم التهنئة، ثم تقديم ما ينفع يوميًا، ثم التمهيد للعيد. ' +
      'ويبقى الجانب التجاري محدودًا طوال الشهر.',
  },
  anchor: { basis: 'hijri', month: 9, day: 1 },
  approximate: true,
  markets: [...ALL_MENA],
  window: { startOffsetDays: -10, endOffsetDays: 29 },
  tone: RAMADAN_TONE,
  posts: [
    {
      id: 'ramadan_prep',
      phase: 'lead_up',
      offsetDays: -7,
      caption: {
        en:
          'Ramadan is almost here. We are adjusting our hours and getting everything ready so ' +
          'your month runs smoothly. Full timings coming this week.',
        ar:
          'اقترب شهر رمضان المبارك. نعدّل ساعات عملنا ونجهّز كل شيء ليمرّ شهركم بيسر. ' +
          'سنعلن المواعيد كاملة خلال هذا الأسبوع.',
      },
      hashtags: {
        en: ['#Ramadan', '#RamadanPrep', '#UAE'],
        ar: ['#رمضان', '#استعداد_رمضان', '#الإمارات'],
      },
      mediaBrief: {
        en: 'Calm, warm still life. Lanterns or a crescent, muted gold on deep blue. No food.',
        ar: 'لقطة ساكنة هادئة ودافئة: فانوس أو هلال بألوان ذهبية خافتة على أزرق عميق. بلا طعام.',
      },
    },
    {
      id: 'ramadan_greeting',
      phase: 'peak',
      offsetDays: 0,
      caption: {
        en:
          'Ramadan Kareem from all of us at {{businessName}}. May this month bring you peace, ' +
          'health and good company.',
        ar:
          'رمضان كريم من فريق {{businessName}}. نسأل الله أن يكون شهرًا مباركًا عليكم بالسكينة والصحة وطيب الصحبة.',
      },
      hashtags: {
        en: ['#RamadanKareem', '#RamadanMubarak'],
        ar: ['#رمضان_كريم', '#رمضان_مبارك'],
      },
      mediaBrief: {
        en: 'Greeting card only. No price, no product, no discount badge.',
        ar: 'بطاقة تهنئة فقط. بلا سعر ولا منتج ولا شارة خصم.',
      },
    },
    {
      id: 'ramadan_hours',
      phase: 'peak',
      offsetDays: 1,
      caption: {
        en:
          'Our Ramadan hours: {{ramadanHours}}. Last orders before Iftar at {{lastOrderTime}}. ' +
          'Save this post — we know everyone asks.',
        ar:
          'مواعيدنا في رمضان: {{ramadanHours}}. آخر موعد للطلبات قبل الإفطار الساعة {{lastOrderTime}}. ' +
          'احفظ المنشور — نعلم أن الجميع يسأل عنه.',
      },
      hashtags: {
        en: ['#RamadanHours', '#Iftar'],
        ar: ['#مواعيد_رمضان', '#إفطار'],
      },
      mediaBrief: {
        en: 'Legible timings card. High contrast, large numerals, readable on a phone at a glance.',
        ar: 'بطاقة مواعيد واضحة: تباين عالٍ وأرقام كبيرة تُقرأ من الهاتف بنظرة واحدة.',
      },
    },
    {
      id: 'ramadan_iftar_offer',
      phase: 'peak',
      offsetDays: 4,
      caption: {
        en:
          'Iftar with us this Ramadan. {{offerDetail}} — for families, for colleagues, for ' +
          'whoever you are breaking your fast with. Booking: {{contact}}',
        ar:
          'أفطر معنا هذا الرمضان. {{offerDetail}} — للعائلة وللزملاء ولكل من تشاركهم مائدة الإفطار. ' +
          'للحجز: {{contact}}',
      },
      hashtags: {
        en: ['#Iftar', '#RamadanIftar'],
        ar: ['#إفطار', '#إفطار_رمضان'],
      },
      mediaBrief: {
        en:
          'Table set for sharing, warm light, people present but not eating. ' +
          'Schedule this AFTER Maghrib only.',
        ar:
          'مائدة معدّة للمشاركة بإضاءة دافئة، مع وجود أشخاص دون إظهار الأكل. ' +
          'يُنشر بعد أذان المغرب فقط.',
      },
      verticals: ['restaurants', 'small_business'],
    },
    {
      id: 'ramadan_giving',
      phase: 'peak',
      offsetDays: 12,
      caption: {
        en:
          'Giving is part of the month. This Ramadan we are supporting {{causeName}}. ' +
          'No campaign, no hashtag needed — just something we felt was right.',
        ar:
          'العطاء جزء أصيل من هذا الشهر. نساهم هذا العام في دعم {{causeName}}. ' +
          'دون حملة ولا وسم — إنما لأننا رأيناه أمرًا صائبًا.',
      },
      hashtags: { en: ['#Ramadan', '#Giving'], ar: ['#رمضان', '#العطاء'] },
      mediaBrief: {
        en: 'Documentary, unstyled. Avoid logo-forward framing — this should not look like an ad.',
        ar: 'صورة توثيقية بلا تنميق. تجنّب إبراز الشعار؛ يجب ألا يبدو المنشور إعلانًا.',
      },
    },
    {
      id: 'ramadan_last_ten',
      phase: 'wind_down',
      offsetDays: 20,
      caption: {
        en:
          'The last ten nights. Things get quieter in the day and busier after Taraweeh — ' +
          'we have adjusted accordingly. {{lastTenDetail}}',
        ar:
          'العشر الأواخر. تهدأ الحركة نهارًا وتزدحم بعد التراويح، وقد عدّلنا مواعيدنا وفق ذلك. ' +
          '{{lastTenDetail}}',
      },
      hashtags: {
        en: ['#LastTenNights', '#Ramadan'],
        ar: ['#العشر_الأواخر', '#رمضان'],
      },
      mediaBrief: {
        en: 'Night scene, low light, quiet. No product hero shot.',
        ar: 'مشهد ليلي بإضاءة خافتة وأجواء هادئة. بلا لقطة منتج بارزة.',
      },
    },
  ],
};

export const EID_AL_FITR: CampaignTemplate = {
  id: 'eid_al_fitr',
  name: { en: 'Eid al-Fitr', ar: 'عيد الفطر' },
  description: {
    en:
      'Three days of celebration closing Ramadan. Greeting first, offers second, ' +
      'hours always. Date confirmed only shortly beforehand.',
    ar:
      'ثلاثة أيام من الاحتفال تختم شهر رمضان. التهنئة أولًا، ثم العروض، والمواعيد دائمًا. ' +
      'ولا يُعتمد التاريخ إلا قبل موعده بقليل.',
  },
  anchor: { basis: 'hijri', month: 10, day: 1 },
  approximate: true,
  markets: [...ALL_MENA],
  window: { startOffsetDays: -3, endOffsetDays: 3 },
  tone: EID_TONE,
  posts: [
    {
      id: 'eid_fitr_eve',
      phase: 'lead_up',
      offsetDays: -1,
      caption: {
        en:
          'Eid is expected tomorrow, subject to the moon sighting. Our Eid hours: {{eidHours}}. ' +
          'We will confirm as soon as it is announced.',
        ar:
          'يُتوقع أن يكون العيد غدًا، وذلك رهنٌ بثبوت رؤية الهلال. مواعيدنا في العيد: {{eidHours}}. ' +
          'وسنؤكد فور صدور الإعلان الرسمي.',
      },
      hashtags: { en: ['#Eid', '#EidAlFitr'], ar: ['#العيد', '#عيد_الفطر'] },
      mediaBrief: {
        en: 'Transitional: crescent, evening sky. Bridges Ramadan calm into Eid brightness.',
        ar: 'مشهد انتقالي: هلال وسماء مسائية، ينقل هدوء رمضان إلى إشراق العيد.',
      },
    },
    {
      id: 'eid_fitr_greeting',
      phase: 'peak',
      offsetDays: 0,
      caption: {
        en:
          'Eid Mubarak. From everyone at {{businessName}}, we hope your day is spent with the ' +
          'people you love. May it return to you in goodness.',
        ar:
          'عيد مبارك. من فريق {{businessName}} جميعًا، نتمنى أن تقضوا يومكم بين من تحبون. ' +
          'وكل عام وأنتم بخير.',
      },
      hashtags: {
        en: ['#EidMubarak', '#EidAlFitr'],
        ar: ['#عيد_مبارك', '#عيد_الفطر', '#عيدكم_مبارك'],
      },
      mediaBrief: {
        en: 'Bright, generous, saturated. Greeting only — no offer anywhere on the creative.',
        ar: 'تصميم مشرق وسخي ومتشبّع الألوان. تهنئة فقط، بلا أي عرض في التصميم.',
      },
    },
    {
      id: 'eid_fitr_offer',
      phase: 'peak',
      offsetDays: 1,
      caption: {
        en: 'Eid at {{businessName}}: {{offerDetail}}. Open {{eidHours}} all three days.',
        ar: 'العيد في {{businessName}}: {{offerDetail}}. أبوابنا مفتوحة {{eidHours}} طوال أيام العيد الثلاثة.',
      },
      hashtags: { en: ['#EidOffer', '#Eid'], ar: ['#عروض_العيد', '#العيد'] },
      mediaBrief: {
        en: 'Product-forward is fine here — the greeting post has already done its job.',
        ar: 'لا بأس بإبراز المنتج هنا؛ فمنشور التهنئة قد أدّى دوره.',
      },
    },
    {
      id: 'eid_fitr_thanks',
      phase: 'wind_down',
      offsetDays: 3,
      caption: {
        en: 'Thank you for a busy, warm Eid. Back to regular hours from {{returnDate}}.',
        ar: 'شكرًا لكم على عيد دافئ ومزدحم. نعود إلى مواعيدنا المعتادة اعتبارًا من {{returnDate}}.',
      },
      hashtags: { en: ['#Eid'], ar: ['#العيد'] },
      mediaBrief: {
        en: 'Behind the scenes, team candid. Human, not polished.',
        ar: 'لقطة من كواليس العمل وفريقك على طبيعته. إنسانية لا منمّقة.',
      },
    },
  ],
};

export const EID_AL_ADHA: CampaignTemplate = {
  id: 'eid_al_adha',
  name: { en: 'Eid al-Adha', ar: 'عيد الأضحى' },
  description: {
    en:
      'The greater Eid, tied to Hajj and the Day of Arafah. More solemn in register than ' +
      'Eid al-Fitr; sacrifice and sharing are the themes, not shopping.',
    ar:
      'العيد الأكبر، المرتبط بموسم الحج ويوم عرفة. طابعه أوقر من عيد الفطر، ' +
      'ومعانيه الأضحية والمشاركة لا التسوّق.',
  },
  anchor: { basis: 'hijri', month: 12, day: 10 },
  approximate: true,
  markets: [...ALL_MENA],
  window: { startOffsetDays: -2, endOffsetDays: 4 },
  tone: EID_TONE,
  posts: [
    {
      id: 'adha_arafah',
      phase: 'lead_up',
      offsetDays: -1,
      caption: {
        en:
          'Today is the Day of Arafah. To everyone performing Hajj and everyone fasting today — ' +
          'our thoughts are with you.',
        ar:
          'اليوم هو يوم عرفة. إلى كل من يؤدي فريضة الحج وإلى كل صائم اليوم — تقبّل الله منكم صالح الأعمال.',
      },
      hashtags: { en: ['#Arafah', '#Hajj'], ar: ['#يوم_عرفة', '#الحج'] },
      mediaBrief: {
        en: 'Restrained and reverent. No product, no logo lockup larger than a footer mark.',
        ar: 'تصميم متحفّظ ووقور. بلا منتج، ولا شعار أكبر من علامة صغيرة في الأسفل.',
      },
    },
    {
      id: 'adha_greeting',
      phase: 'peak',
      offsetDays: 0,
      caption: {
        en:
          'Eid al-Adha Mubarak. May your sacrifices and prayers be accepted, and may the day ' +
          'be spent among family.',
        ar: 'عيد أضحى مبارك. تقبّل الله منا ومنكم صالح الأعمال، وجعل يومكم بين الأهل والأحبة.',
      },
      hashtags: {
        en: ['#EidAlAdha', '#EidMubarak'],
        ar: ['#عيد_الأضحى', '#عيد_مبارك', '#تقبل_الله_منا_ومنكم'],
      },
      mediaBrief: {
        en:
          'Warm and dignified. Absolutely no graphic imagery of the sacrifice — ' +
          'suggest sharing a meal instead.',
        ar:
          'تصميم دافئ ووقور. تجنّب تمامًا الصور المباشرة للأضحية، ' +
          'واكتفِ بالإيحاء بمشاركة الطعام.',
      },
    },
    {
      id: 'adha_sharing',
      phase: 'peak',
      offsetDays: 1,
      caption: {
        en:
          'A third for family, a third for neighbours, a third for those in need. ' +
          'However you are sharing today, we hope it is a good one. {{optionalOffer}}',
        ar:
          'ثلث للأهل، وثلث للجيران، وثلث لمن يحتاج. مهما كانت طريقتكم في المشاركة اليوم، ' +
          'نتمنى لكم عيدًا طيبًا. {{optionalOffer}}',
      },
      hashtags: { en: ['#EidAlAdha', '#Sharing'], ar: ['#عيد_الأضحى', '#المشاركة'] },
      mediaBrief: {
        en: 'Communal table, plates being passed. People, not product.',
        ar: 'مائدة جماعية وأطباق تُمرَّر بين الأيدي. الناس هم البطل لا المنتج.',
      },
    },
  ],
};

export const UAE_NATIONAL_DAY: CampaignTemplate = {
  id: 'uae_national_day',
  name: { en: 'UAE National Day', ar: 'اليوم الوطني لدولة الإمارات' },
  description: {
    en:
      'Also called Eid Al Etihad (Union Day), 2 December, marking the 1971 union. ' +
      'Widely observed 1–3 December. The edition number increments every year.',
    ar:
      'ويُعرف أيضًا بـ«عيد الاتحاد»، ويوافق 2 ديسمبر إحياءً لقيام الاتحاد عام 1971. ' +
      'ويُحتفى به عادةً من 1 إلى 3 ديسمبر. ويتغيّر رقم النسخة كل عام.',
  },
  anchor: {
    basis: 'fixed',
    month: 12,
    day: 2,
    anchorYear: 1971,
    editionCounting: 'gregorian',
  },
  approximate: false,
  markets: ['AE'],
  window: { startOffsetDays: -3, endOffsetDays: 1 },
  tone: NATIONAL_DAY_TONE,
  posts: [
    {
      id: 'und_lead_up',
      phase: 'lead_up',
      offsetDays: -3,
      caption: {
        en:
          'Eid Al Etihad is almost here. {{businessName}} will be {{holidayHours}} over the ' +
          'National Day holiday.',
        ar:
          'يقترب عيد الاتحاد. ستكون مواعيد {{businessName}} {{holidayHours}} خلال عطلة اليوم الوطني.',
      },
      hashtags: {
        en: ['#UAENationalDay', '#EidAlEtihad', '#UAE'],
        ar: ['#اليوم_الوطني_الإماراتي', '#عيد_الاتحاد', '#الإمارات'],
      },
      mediaBrief: {
        en: 'Red, green, white, black in correct proportion. Local landmark or skyline.',
        ar: 'الأحمر والأخضر والأبيض والأسود بنسبها الصحيحة، مع معلم محلي أو أفق المدينة.',
      },
    },
    {
      id: 'und_day',
      phase: 'peak',
      offsetDays: 0,
      caption: {
        en:
          'Happy {{edition}} National Day. To the country that has been home to our team, ' +
          'our customers and our work — thank you.',
        ar:
          'عيد اتحاد {{edition}} سعيد. إلى الوطن الذي احتضن فريقنا وعملاءنا وعملنا — شكرًا لك.',
      },
      hashtags: {
        en: ['#UAENationalDay', '#EidAlEtihad', '#SpiritOfTheUnion'],
        ar: ['#اليوم_الوطني_الإماراتي', '#عيد_الاتحاد', '#روح_الاتحاد'],
      },
      mediaBrief: {
        en:
          'Flag treated respectfully — no recolouring, no discount badge overlaid. ' +
          'Compute {{edition}} from the 1971 anchor year; never hardcode it.',
        ar:
          'تعامل مع العلم باحترام: بلا تغيير ألوان وبلا شارة خصم فوقه. ' +
          'واحسب {{edition}} انطلاقًا من سنة 1971، ولا تكتبه ثابتًا.',
      },
    },
    {
      id: 'und_offer',
      phase: 'wind_down',
      offsetDays: 1,
      caption: {
        en: 'National Day at {{businessName}}: {{offerDetail}}. Until {{endDate}}.',
        ar: 'اليوم الوطني في {{businessName}}: {{offerDetail}}. حتى {{endDate}}.',
      },
      hashtags: {
        en: ['#UAENationalDay', '#UAE'],
        ar: ['#اليوم_الوطني_الإماراتي', '#الإمارات'],
      },
      mediaBrief: {
        en: 'Offer creative kept visually separate from the flag imagery used the day before.',
        ar: 'تصميم العرض منفصل بصريًا عن رموز العلم المستخدمة في اليوم السابق.',
      },
    },
  ],
};

export const SAUDI_NATIONAL_DAY: CampaignTemplate = {
  id: 'saudi_national_day',
  name: { en: 'Saudi National Day', ar: 'اليوم الوطني السعودي' },
  description: {
    en:
      '23 September, marking the 1932 unification of the Kingdom. Green is the ' +
      'dominant colour. The Saudi flag carries the Shahada — it must never be ' +
      'cropped, reversed, worn as clothing, or printed on anything disposable.',
    ar:
      'يوافق 23 سبتمبر إحياءً لتوحيد المملكة عام 1932، واللون الأخضر هو الطاغي. ' +
      'ويحمل العلم السعودي الشهادتين، فلا يجوز اقتطاعه أو عكسه أو استخدامه ملبسًا ' +
      'أو طباعته على ما يُرمى بعد الاستعمال.',
  },
  anchor: {
    basis: 'fixed',
    month: 9,
    day: 23,
    anchorYear: 1932,
    // Saudi editions are counted in HIJRI years, so they run ahead of the
    // Gregorian gap: 2025 was officially the 95th, not 2025 - 1932 = 93.
    // These are the announced numbers; add each new year from the official
    // announcement rather than extrapolating.
    editionCounting: 'hijri_verified',
    knownEditions: { 2022: 92, 2023: 93, 2024: 94, 2025: 95 },
  },
  approximate: false,
  markets: ['SA'],
  window: { startOffsetDays: -3, endOffsetDays: 1 },
  tone: NATIONAL_DAY_TONE,
  posts: [
    {
      id: 'snd_lead_up',
      phase: 'lead_up',
      offsetDays: -2,
      caption: {
        en:
          'National Day is coming. {{businessName}} will be {{holidayHours}} — ' +
          'and we have something planned.',
        ar: 'يقترب اليوم الوطني. ستكون مواعيد {{businessName}} {{holidayHours}}، ولدينا ما نُعدّه لكم.',
      },
      hashtags: {
        en: ['#SaudiNationalDay', '#SaudiArabia'],
        ar: ['#اليوم_الوطني_السعودي', '#السعودية'],
      },
      mediaBrief: {
        en: 'Saudi green dominant. Landmark or contemporary Saudi design motif.',
        ar: 'الأخضر السعودي هو الطاغي، مع معلم أو زخرفة سعودية معاصرة.',
      },
    },
    {
      id: 'snd_day',
      phase: 'peak',
      offsetDays: 0,
      caption: {
        en:
          'Happy {{edition}} Saudi National Day. Proud to be part of what is being built here.',
        ar: 'اليوم الوطني السعودي الـ{{edition}}. فخورون بأن نكون جزءًا مما يُبنى هنا.',
      },
      hashtags: {
        en: ['#SaudiNationalDay', '#SaudiArabia'],
        ar: ['#اليوم_الوطني_السعودي', '#السعودية', '#هي_لنا_دار'],
      },
      mediaBrief: {
        en:
          'Flag handled per protocol: never cropped, reversed, or overlaid with commercial ' +
          'badges — it bears the Shahada. Compute {{edition}} from 1932.',
        ar:
          'تعامل مع العلم وفق البروتوكول: لا اقتطاع ولا عكس ولا شارات تجارية فوقه، ' +
          'فهو يحمل الشهادتين. واحسب {{edition}} انطلاقًا من عام 1932.',
      },
    },
    {
      id: 'snd_offer',
      phase: 'wind_down',
      offsetDays: 1,
      caption: {
        en: 'National Day offer at {{businessName}}: {{offerDetail}}. Until {{endDate}}.',
        ar: 'عرض اليوم الوطني في {{businessName}}: {{offerDetail}}. حتى {{endDate}}.',
      },
      hashtags: {
        en: ['#SaudiNationalDay'],
        ar: ['#اليوم_الوطني_السعودي'],
      },
      mediaBrief: {
        en: 'Green palette without using the flag itself. Keeps the offer clear of protocol risk.',
        ar: 'لوحة ألوان خضراء دون استخدام العلم نفسه، تجنّبًا لأي مخالفة بروتوكولية.',
      },
    },
  ],
};

export const SAUDI_FOUNDING_DAY: CampaignTemplate = {
  id: 'saudi_founding_day',
  name: { en: 'Saudi Founding Day', ar: 'يوم التأسيس السعودي' },
  description: {
    en:
      '22 February, commemorating the founding of the First Saudi State in 1727 — ' +
      'distinct from National Day. The register is heritage, not modernity: ' +
      'historical dress, Najdi architecture, a muted earth-and-brown palette. ' +
      'Using National Day green here is a visible mistake locally.',
    ar:
      'يوافق 22 فبراير إحياءً لتأسيس الدولة السعودية الأولى عام 1727، وهو مختلف عن اليوم الوطني. ' +
      'وطابعه تراثي لا حداثي: الأزياء التاريخية، والعمارة النجدية، ولوحة ألوان ترابية وبنية هادئة. ' +
      'واستخدام أخضر اليوم الوطني هنا خطأ ملحوظ محليًا.',
  },
  anchor: {
    basis: 'fixed',
    month: 2,
    day: 22,
    anchorYear: 1727,
    // Founding Day copy generally speaks of "three centuries" rather than a
    // precise ordinal, and the official framing has varied year to year.
    // Rather than print a number we cannot vouch for, emit none.
    editionCounting: 'none',
  },
  approximate: false,
  markets: ['SA'],
  window: { startOffsetDays: -2, endOffsetDays: 1 },
  tone: NATIONAL_DAY_TONE,
  posts: [
    {
      id: 'sfd_lead_up',
      phase: 'lead_up',
      offsetDays: -2,
      caption: {
        en: 'Founding Day is on Sunday. {{businessName}} hours: {{holidayHours}}.',
        ar: 'يوم التأسيس بعد يومين. مواعيد {{businessName}}: {{holidayHours}}.',
      },
      hashtags: {
        en: ['#FoundingDay', '#SaudiArabia'],
        ar: ['#يوم_التأسيس', '#السعودية'],
      },
      mediaBrief: {
        en: 'Earth tones, mud-brick Najdi architecture, historical texture. No green.',
        ar: 'ألوان ترابية وعمارة نجدية طينية وملمس تاريخي. بلا أخضر.',
      },
    },
    {
      id: 'sfd_day',
      phase: 'peak',
      offsetDays: 0,
      caption: {
        en:
          'Founding Day — {{edition}} years since 1727. Three centuries of a place that ' +
          'knew exactly who it was.',
        ar:
          'يوم التأسيس — {{edition}} عامًا منذ 1727. ثلاثة قرون لأرضٍ عرفت هويتها جيدًا.',
      },
      hashtags: {
        en: ['#FoundingDay', '#SaudiArabia'],
        ar: ['#يوم_التأسيس', '#يوم_بدينا', '#السعودية'],
      },
      mediaBrief: {
        en:
          'Heritage register throughout: historical dress, sadu weaving, date palms, ' +
          'Diriyah. Compute {{edition}} from 1727.',
        ar:
          'طابع تراثي كامل: الأزياء التاريخية، ونسيج السدو، والنخيل، والدرعية. ' +
          'واحسب {{edition}} انطلاقًا من عام 1727.',
      },
    },
  ],
};

export const CAMPAIGNS: CampaignTemplate[] = [
  RAMADAN,
  EID_AL_FITR,
  EID_AL_ADHA,
  UAE_NATIONAL_DAY,
  SAUDI_NATIONAL_DAY,
  SAUDI_FOUNDING_DAY,
];

export const CAMPAIGNS_BY_ID: Record<CampaignId, CampaignTemplate> =
  CAMPAIGNS.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<CampaignId, CampaignTemplate>);

/** Campaigns relevant to a market code. */
export const campaignsForMarket = (market: string): CampaignTemplate[] =>
  CAMPAIGNS.filter((c) => c.markets.includes(market.toUpperCase() as never));

/**
 * Official ordinal edition for a fixed-date campaign in a given Gregorian
 * year, e.g. `editionNumber(UAE_NATIONAL_DAY, 2026)` -> 55.
 *
 * Returns null when the number is not knowable — either the campaign uses no
 * ordinal, or it is Hijri-counted and that year has not been recorded from an
 * official announcement. Callers MUST handle null by omitting the ordinal
 * from the copy. Printing a wrong national-day number is a conspicuous,
 * embarrassing error in-market, so this deliberately refuses to guess.
 */
export const editionNumber = (
  campaign: CampaignTemplate,
  gregorianYear: number
): number | null => {
  const anchor = campaign.anchor;
  if (anchor.basis !== 'fixed') return null;

  const counting = anchor.editionCounting ?? 'gregorian';
  if (counting === 'none') return null;

  if (counting === 'hijri_verified') {
    return anchor.knownEditions?.[gregorianYear] ?? null;
  }

  if (!anchor.anchorYear) return null;
  return gregorianYear - anchor.anchorYear;
};
