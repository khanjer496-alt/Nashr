import { ToneGuidance } from './types';

/**
 * Shared editorial guardrails, referenced by the campaign templates.
 *
 * The single most common failure mode for non-MENA brands is treating a
 * religious observance as a retail event. Ramadan is a month of fasting,
 * prayer, charity and family — a discount code is not a greeting. These
 * objects exist so that guidance ships with the template instead of living in
 * a brand deck nobody opens.
 */

export const RAMADAN_TONE: ToneGuidance = {
  summary: {
    en:
      'Ramadan is a month of fasting, reflection, charity and family — not a sale. ' +
      'Lead with respect and usefulness; let the commercial message be secondary and quiet. ' +
      'Time posts around the daily rhythm: mornings are slow, engagement peaks after Iftar ' +
      'and again late at night before Suhoor.',
    ar:
      'رمضان شهر صيام وتأمّل وصدقة وصلة رحم، وليس مناسبة تخفيضات. ' +
      'ابدأ بالاحترام وبما ينفع الجمهور، واجعل الرسالة التجارية ثانوية وهادئة. ' +
      'وزّع منشوراتك وفق إيقاع اليوم: الصباح هادئ، ويبلغ التفاعل ذروته بعد الإفطار ثم في وقت متأخر قبل السحور.',
  },
  do: {
    en: [
      'Open with a sincere greeting (Ramadan Kareem / Ramadan Mubarak) before anything commercial.',
      'Publish practical value: Iftar and Suhoor timings, adjusted opening hours, delivery cut-offs.',
      'Show community — sharing a meal, giving, family gatherings after Iftar.',
      'Schedule the heaviest posting between Iftar and midnight, local time.',
      'Mention any charity or Zakat contribution factually and without boasting.',
      'Use calm, warm visuals: lanterns, crescent, dates, muted golds and deep blues.',
    ],
    ar: [
      'ابدأ بتحية صادقة (رمضان كريم / رمضان مبارك) قبل أي محتوى تجاري.',
      'انشر ما ينفع فعلًا: مواعيد الإفطار والسحور، وساعات العمل المعدّلة، وآخر موعد للتوصيل.',
      'أبرز معاني التكافل: تشارك الطعام، والعطاء، ولقاءات العائلة بعد الإفطار.',
      'ركّز النشر بين الإفطار ومنتصف الليل بالتوقيت المحلي.',
      'اذكر أي مساهمة خيرية أو زكاة بصيغة خبرية دون مباهاة.',
      'استخدم صورًا هادئة ودافئة: الفوانيس، والهلال، والتمر، وألوان ذهبية خافتة وزرقاء عميقة.',
    ],
  },
  dont: {
    en: [
      'Do not post food or drink imagery during fasting hours — it reads as inconsiderate.',
      'Do not use "party", "celebration" or nightlife framing; Ramadan is not Eid.',
      'Do not lead with a discount percentage or a countdown-to-sale.',
      'Do not use religious verses or the word "Allah" as decorative copy in an ad.',
      'Do not wish "Happy Ramadan" — the established greeting is Kareem / Mubarak.',
      'Do not depict people eating or drinking in daylight scenes.',
    ],
    ar: [
      'لا تنشر صور الطعام أو الشراب في ساعات الصيام؛ فذلك يُقرأ على أنه قلة مراعاة.',
      'تجنّب صياغة «حفلة» أو «احتفال» أو أجواء السهر؛ فرمضان ليس العيد.',
      'لا تبدأ بنسبة خصم أو عدّ تنازلي لتخفيضات.',
      'لا تستخدم الآيات القرآنية أو لفظ الجلالة كزينة في إعلان.',
      'لا تستخدم عبارة «رمضان سعيد»؛ التحية المتعارف عليها هي «رمضان كريم» أو «رمضان مبارك».',
      'تجنّب إظهار أشخاص يأكلون أو يشربون في مشاهد نهارية.',
    ],
  },
  greetings: {
    en: ['Ramadan Kareem', 'Ramadan Mubarak', 'Wishing you a blessed Ramadan'],
    ar: ['رمضان كريم', 'رمضان مبارك', 'كل عام وأنتم بخير'],
  },
};

export const EID_TONE: ToneGuidance = {
  summary: {
    en:
      'Eid is celebratory and family-centred. Warmth and gratitude first; keep any offer short ' +
      'and secondary. Note that the exact date is confirmed only shortly beforehand, so prepare ' +
      'the creative early and hold publication until the announcement.',
    ar:
      'العيد مناسبة فرح وتجمّع عائلي. قدّم الدفء والامتنان أولًا، واجعل أي عرض تجاري قصيرًا وثانويًا. ' +
      'وانتبه إلى أن التاريخ لا يُعتمد إلا قبل موعده بقليل، فجهّز المحتوى مبكرًا وأجّل النشر حتى الإعلان الرسمي.',
  },
  do: {
    en: [
      'Greet first: Eid Mubarak / Eid Saeed. Keep the greeting post free of any offer.',
      'Acknowledge family, visiting, new clothes, gifts for children (Eidiyah).',
      'Publish revised opening hours — Eid schedules differ and customers check.',
      'Prepare creative in advance but wait for the official announcement before publishing.',
      'Use bright, generous visuals; Eid palettes are warmer and more saturated than Ramadan.',
    ],
    ar: [
      'ابدأ بالتحية: «عيد مبارك» أو «عيد سعيد»، واجعل منشور التهنئة خاليًا من أي عرض.',
      'اذكر معاني العائلة والزيارات والملابس الجديدة والعيديّة للأطفال.',
      'انشر ساعات العمل المعدّلة؛ فمواعيد العيد تختلف ويبحث عنها العملاء.',
      'جهّز التصاميم مبكرًا وانتظر الإعلان الرسمي قبل النشر.',
      'استخدم ألوانًا مشرقة وسخية؛ فألوان العيد أدفأ وأكثر تشبّعًا من رمضان.',
    ],
  },
  dont: {
    en: [
      'Do not schedule the greeting on a fixed date — the date can shift by a day.',
      'Do not merge the greeting and the sale into one post.',
      'Do not reuse Ramadan visuals (crescent + lanterns) unchanged; the mood has changed.',
      'For Eid al-Adha, do not use graphic imagery of the sacrifice.',
    ],
    ar: [
      'لا تجدول التهنئة على تاريخ ثابت؛ فقد يتقدّم الموعد أو يتأخر يومًا.',
      'لا تدمج التهنئة والعرض التجاري في منشور واحد.',
      'لا تعِد استخدام تصاميم رمضان كما هي؛ فالأجواء اختلفت.',
      'في عيد الأضحى، تجنّب الصور المباشرة للأضحية.',
    ],
  },
  greetings: {
    en: ['Eid Mubarak', 'Eid Saeed', 'May it return to you in goodness'],
    ar: ['عيد مبارك', 'عيد سعيد', 'كل عام وأنتم بخير', 'تقبّل الله منا ومنكم'],
  },
};

export const NATIONAL_DAY_TONE: ToneGuidance = {
  summary: {
    en:
      'National days are proud, civic and optimistic. Reference the country by name, use the ' +
      'official flag colours correctly, and be careful with imagery of leadership — never edit, ' +
      'crop or stylise an official portrait. When in doubt, celebrate the people, not the state.',
    ar:
      'الأعياد الوطنية مناسبات فخر ومشاعر مدنية وتفاؤل. اذكر اسم الدولة صراحة، والتزم بألوان العلم الرسمية، ' +
      'وتعامل بحذر مع صور القيادة؛ فلا تُعدَّل أو تُقتطع أو تُضاف إليها مؤثرات. وعند الشك، احتفِ بالناس لا بالمؤسسة.',
  },
  do: {
    en: [
      'Use the country name explicitly and the correct official occasion name.',
      'Respect flag colours and proportions; do not recolour or distort the flag.',
      'Reference the correct edition number where you use one — it increments yearly.',
      'Feature local landmarks, local people, local craft.',
      'Keep any commercial offer visually separate from the national imagery.',
    ],
    ar: [
      'اذكر اسم الدولة صراحةً والاسم الرسمي الصحيح للمناسبة.',
      'التزم بألوان العلم ونِسَبه؛ ولا تغيّر ألوانه أو تشوّه شكله.',
      'استخدم الرقم الصحيح للنسخة إن ذكرته؛ فهو يتغير سنويًا.',
      'أبرز المعالم المحلية والناس والحرف المحلية.',
      'افصل أي عرض تجاري بصريًا عن الرموز الوطنية.',
    ],
  },
  dont: {
    en: [
      'Do not place a discount badge on top of the flag or an official portrait.',
      'Do not mix the symbols of two countries in one creative.',
      'Do not make political statements or reference regional disputes.',
      'Do not reuse last year’s edition number.',
    ],
    ar: [
      'لا تضع شارة خصم فوق العلم أو صورة رسمية.',
      'لا تجمع رموز دولتين في تصميم واحد.',
      'تجنّب أي طرح سياسي أو إشارة إلى خلافات إقليمية.',
      'لا تعِد استخدام رقم النسخة الخاص بالعام الماضي.',
    ],
  },
  greetings: {
    en: ['Happy National Day', 'With pride, always'],
    ar: ['كل عام والوطن بخير', 'عيد وطني سعيد', 'بكل فخر'],
  },
};
