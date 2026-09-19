// Deterministic Vedic astrology and numerology facts computed from a real DOB.
// Fed into Acharya Madhav's LLM context as ground truth so that readings are anchored
// to authentic planetary calculations and relatable life facts.

export interface MulankInfo {
  number: number;
  rulingPlanet: string;
  rulingPlanetHindi: string;
  deity: string;
  element: string;
  personalityTraits: string[];
  lifeFacts: string[];
  remedyHint: string;
  beejMantra: string;
  luckyDays: string[];
  luckyColors: string[];
}

export interface BhagyankInfo {
  number: number;
  rulingPlanet: string;
  destinyTheme: string;
  strength: string;
  karmicChallenge: string;
}

export interface ZodiacSignInfo {
  sign: string;
  hindiName: string;
  element: string;
  rulingPlanet: string;
  nature: string;
}

export interface KundliFacts {
  dobFormatted: string;
  dobIso: string;
  mulank: MulankInfo;
  bhagyank: BhagyankInfo;
  sunSign: ZodiacSignInfo;
  coreRealities: string[];
  luckyDay: string;
  luckyColor: string;
  aaradhyaDeva: string;
  beejMantra: string;
  planetaryEnergySummary: string;
}

const ZODIAC_TABLE: Array<{
  sign: string;
  hindiName: string;
  endMonth: number;
  endDay: number;
  element: string;
  rulingPlanet: string;
  nature: string;
}> = [
  { sign: 'Capricorn', hindiName: 'Makar (मकर)', endMonth: 1, endDay: 19, element: 'Prithvi (Earth)', rulingPlanet: 'Shani (Saturn)', nature: 'Disciplined, ambitious & patient' },
  { sign: 'Aquarius', hindiName: 'Kumbh (कुंभ)', endMonth: 2, endDay: 18, element: 'Vayu (Air)', rulingPlanet: 'Shani / Rahu', nature: 'Visionary, humanitarian & deep thinker' },
  { sign: 'Pisces', hindiName: 'Meen (मीन)', endMonth: 3, endDay: 20, element: 'Jal (Water)', rulingPlanet: 'Guru (Jupiter)', nature: 'Compassionate, intuitive & spiritual' },
  { sign: 'Aries', hindiName: 'Mesh (मेष)', endMonth: 4, endDay: 19, element: 'Agni (Fire)', rulingPlanet: 'Mangal (Mars)', nature: 'Dynamic, courageous & natural leader' },
  { sign: 'Taurus', hindiName: 'Vrishabha (वृषभ)', endMonth: 5, endDay: 20, element: 'Prithvi (Earth)', rulingPlanet: 'Shukra (Venus)', nature: 'Grounded, aesthetic lover & loyal' },
  { sign: 'Gemini', hindiName: 'Mithun (मिथुन)', endMonth: 6, endDay: 20, element: 'Vayu (Air)', rulingPlanet: 'Budh (Mercury)', nature: 'Witty, multi-tasker & communicative' },
  { sign: 'Cancer', hindiName: 'Kark (कर्क)', endMonth: 7, endDay: 22, element: 'Jal (Water)', rulingPlanet: 'Chandra (Moon)', nature: 'Emotional, protective & deeply caring' },
  { sign: 'Leo', hindiName: 'Simha (सिंह)', endMonth: 8, endDay: 22, element: 'Agni (Fire)', rulingPlanet: 'Surya (Sun)', nature: 'Self-respecting, magnetic & authoritative' },
  { sign: 'Virgo', hindiName: 'Kanya (कन्या)', endMonth: 9, endDay: 22, element: 'Prithvi (Earth)', rulingPlanet: 'Budh (Mercury)', nature: 'Analytical, perfectionist & helpful' },
  { sign: 'Libra', hindiName: 'Tula (तुला)', endMonth: 10, endDay: 22, element: 'Vayu (Air)', rulingPlanet: 'Shukra (Venus)', nature: 'Balanced, peace-loving & artistic' },
  { sign: 'Scorpio', hindiName: 'Vrishchik (वृश्चिक)', endMonth: 11, endDay: 21, element: 'Jal (Water)', rulingPlanet: 'Mangal / Ketu', nature: 'Intense, intuitive & strong-willed' },
  { sign: 'Sagittarius', hindiName: 'Dhanu (धनु)', endMonth: 12, endDay: 21, element: 'Agni (Fire)', rulingPlanet: 'Guru (Jupiter)', nature: 'Optimistic, freedom-loving & truth-seeker' },
  { sign: 'Capricorn', hindiName: 'Makar (मकर)', endMonth: 12, endDay: 31, element: 'Prithvi (Earth)', rulingPlanet: 'Shani (Saturn)', nature: 'Disciplined, ambitious & patient' },
];

const MULANK_DATA: Record<number, Omit<MulankInfo, 'number'>> = {
  1: {
    rulingPlanet: 'Sun',
    rulingPlanetHindi: 'Surya (सूर्य)',
    deity: 'Lord Surya / Gayatri Mata',
    element: 'Agni (Fire)',
    personalityTraits: ['Natural leader', 'High self-respect', 'Direct and candid', 'Ambitious'],
    lifeFacts: [
      'Aap kisi ke dabav ya control me kaam nahi kar sakte; self-respect aapke liye sabse pehle hai.',
      'Dil ke saaf hain par gusse me kabhi-kabhi seedhi baat muh par bol dete hain, jisse log galat samajh lete hain.',
      'Apne dum par aage badhne ka jazba hai, par father/authorities ke sath vicharo me matbhed ho sakta hai.',
    ],
    remedyHint: 'Surya Dev ko jal arpan karna aur Manokamna prapte ke liye Aditya Hriday Stotra ya Surya Beej Mantra labhdayak hai.',
    beejMantra: 'ॐ ह्रां ह्रीं ह्रौं सः सूर्याय नमः',
    luckyDays: ['Ravivar (Sunday)', 'Somwar (Monday)'],
    luckyColors: ['Saffron', 'Gold', 'Ruby Red', 'Orange'],
  },
  2: {
    rulingPlanet: 'Moon',
    rulingPlanetHindi: 'Chandra (चन्द्र)',
    deity: 'Lord Shiva / Chandra Dev',
    element: 'Jal (Water)',
    personalityTraits: ['Highly empathetic', 'Intuitive heart', 'Sensitive', 'Creative imagination'],
    lifeFacts: [
      'Aap dil se sochte hain aur logon par bahut jaldi vishwas kar lete hain, jiska log fayda utha lete hain.',
      'Aapka mood swings aur overthinking ki wajah se man ashaant rehta hai; choti baaton ko dil se laga lete hain.',
      'Dusron ke dukh me turant pighal jaate hain, par jab khud ko emotional support chahiye hota hai toh akele mehsoos karte hain.',
    ],
    remedyHint: 'Chandra ki shanti aur man ki sthirta ke liye Mahadev ki pooja aur Shiv dhyan atyant shubh hai.',
    beejMantra: 'ॐ सों सोमाय नमः / ॐ नमः शिवाय',
    luckyDays: ['Somwar (Monday)', 'Ravivar (Sunday)'],
    luckyColors: ['White', 'Pearl Cream', 'Silver', 'Light Green'],
  },
  3: {
    rulingPlanet: 'Jupiter',
    rulingPlanetHindi: 'Guru / Brihaspati (बृहस्पति)',
    deity: 'Lord Vishnu / Brihaspati Dev',
    element: 'Agni-Aakash (Fire-Ether)',
    personalityTraits: ['Wisdom-driven', 'Natural advisor', 'Respect-seeking', 'Spiritual mindset'],
    lifeFacts: [
      'Log aapse salaah (advice) lene aate hain aur aapki guide karne ki shakti se unke kaam bante hain.',
      'Aapke andar hamesha kuch naya seekhne ki lalak rehti hai, par financially dusron par zyada bharosa karne par paisa atak sakta hai.',
      'Society me maan-samman aapke liye daulat se zyada keemti hai.',
    ],
    remedyHint: 'Brihaspati ki kripa se gyaan aur bhagya me vriddhi hoti hai; Vishnu Sahasranama ya Guru Mantra ka jaap karein.',
    beejMantra: 'ॐ बृं बृहस्पतये नमः',
    luckyDays: ['Guruwar (Thursday)', 'Mangalwar (Tuesday)'],
    luckyColors: ['Yellow', 'Haldi Pila', 'Golden'],
  },
  4: {
    rulingPlanet: 'Rahu',
    rulingPlanetHindi: 'Rahu (राहु)',
    deity: 'Maa Durga / Bhairav Dev',
    element: 'Vayu (Air)',
    personalityTraits: ['Unconventional genius', 'Out-of-the-box thinking', 'Hardworking', 'Technical brain'],
    lifeFacts: [
      'Aapki life me sabkuch achanak (sudden) hota hai — achanak faayda ya achanak rukawat.',
      'Jitni mehnat aap karte hain, uska credit pehle turant nahi milta; log shuru me criticize karte hain baad me tareef karte hain.',
      'Raat ke samay dimaag me hazar thoughts chalte hain aur restlessness rehti hai.',
    ],
    remedyHint: 'Rahu ke prabhav ko positive banane aur achanak rukawaton ko dur karne ke liye Durga Kavach ya Rahu mantra faydemand hai.',
    beejMantra: 'ॐ भ्रां भ्रीं भ्रौं सः राहवे नमः',
    luckyDays: ['Budhwar (Wednesday)', 'Shanivar (Saturday)'],
    luckyColors: ['Electric Blue', 'Grey', 'Smoke', 'Navy'],
  },
  5: {
    rulingPlanet: 'Mercury',
    rulingPlanetHindi: 'Budh (बुध)',
    deity: 'Lord Ganesha / Budh Dev',
    element: 'Prithvi (Earth)',
    personalityTraits: ['Sharp intellect', 'Quick-witted', 'Business acumen', 'Multi-tasker'],
    lifeFacts: [
      'Aapka dimaag bahut tezz daudta hai; aap ek sath kai kaamo ka hisaab laga lete hain.',
      'Routine boring kaam aap se zyada din nahi hota; hamesha naya excitement aur variety chahiye hoti hai.',
      'Logon ko apni baaton aur sense of humor se turant impress kar lete hain, par decision lene me kabhi-kabhi double minded ho jaate hain.',
    ],
    remedyHint: 'Budh ko balwan karne aur vyapar/buddhi me barkat ke liye Ganpati Bappa ki aradhana aur Budh beej mantra shreshth hai.',
    beejMantra: 'ॐ ब्रां ब्रीं ब्रौं सः बुधाय नमः / ॐ गं गणपतये नमः',
    luckyDays: ['Budhwar (Wednesday)', 'Shukrawar (Friday)'],
    luckyColors: ['Emerald Green', 'Pista Green', 'Light Blue'],
  },
  6: {
    rulingPlanet: 'Venus',
    rulingPlanetHindi: 'Shukra (शुक्र)',
    deity: 'Maa Lakshmi / Shukra Dev',
    element: 'Jal (Water)',
    personalityTraits: ['Aesthetic sense', 'Magnetic charm', 'Family-oriented', 'Luxury & comfort lover'],
    lifeFacts: [
      'Aap sundarta, saaf-safai aur standard of living ko prefer karte hain; presentation me perfect rehte hain.',
      'Relationships aur dosti me dil khol kar spend karte hain, par badle me waisi care na milne par gehra dukh hota hai.',
      'Aapke andar logon ko attract karne ki aakarshak urja hai, par family expectations ka bojh bana rehta hai.',
    ],
    remedyHint: 'Shukra ki kripa se sukh-samriddhi aur rishton me madhurta aati hai; Maha Lakshmi ya Shukra mantra ka jaap karein.',
    beejMantra: 'ॐ शुं शुक्राय नमः / ॐ श्रीं महालक्ष्म्यै नमः',
    luckyDays: ['Shukrawar (Friday)', 'Somwar (Monday)'],
    luckyColors: ['White', 'Light Pink', 'Silver', 'Pastel Cream'],
  },
  7: {
    rulingPlanet: 'Ketu',
    rulingPlanetHindi: 'Ketu (केतु)',
    deity: 'Lord Shiva / Lord Ganesha',
    element: 'Jal-Agni (Water-Fire)',
    personalityTraits: ['Deep thinker', 'Mystical 6th sense', 'Truth seeker', 'Detached soul'],
    lifeFacts: [
      'Aapke paas ek powerful intuition (sixth sense) hai — kisi insaan ya ghatna ke baare me aapka andaza aksar sach nikalta hai.',
      'Dikhawa aur fake logon se aapko chidh hai; aapko shant vatavaran aur akelaapan (solitude) pasand hai.',
      'Life me kai baar un logon se dhokha ya misunderstanding milti hai jin par aapne sabse zyada trust kiya hota hai.',
    ],
    remedyHint: 'Ketu ke spiritual tezz aur man ke bhatkaav ko rokhne ke liye Mahadev dhyan aur Ganesha aradhana kalyankari hai.',
    beejMantra: 'ॐ स्रां स्रीं स्रौं सः केतवे नमः / ॐ नमः शिवाय',
    luckyDays: ['Somwar (Monday)', 'Guruwar (Thursday)'],
    luckyColors: ['Light Yellow', 'Olive Green', 'White', 'Smoke Grey'],
  },
  8: {
    rulingPlanet: 'Saturn',
    rulingPlanetHindi: 'Shani (शनि)',
    deity: 'Lord Shani / Hanuman Ji',
    element: 'Vayu-Prithvi (Air-Earth)',
    personalityTraits: ['Resilient fighter', 'Hardworking', 'Karmic justice believer', 'Disciplined'],
    lifeFacts: [
      'Aapko life me kuch bhi bina mehnat ke aasaani se nahi mila; shuruaat me struggle aur zimmedariyan zyada rehti hain.',
      'Lekin aap jo ek baar thaan lete hain, use poora karke hi dum lete hain — late success par permanent stability milti hai.',
      'Dil ke sachhe hain aur jo kehte hain use nibhaate hain; dikhawe se hamesha koson door rehte hain.',
    ],
    remedyHint: 'Shani Dev ki pariksha ko aashirwaad me badalne ke liye Hanuman Chalisa aur Shani Beej Mantra sarvashreshth hai.',
    beejMantra: 'ॐ प्रां प्रीं प्रौं सः शनैश्चराय नमः / ॐ हं हनुमते नमः',
    luckyDays: ['Shanivar (Saturday)', 'Budhwar (Wednesday)'],
    luckyColors: ['Navy Blue', 'Black', 'Dark Charcoal', 'Deep Violet'],
  },
  9: {
    rulingPlanet: 'Mars',
    rulingPlanetHindi: 'Mangal (मंगल)',
    deity: 'Sankatmochan Hanuman Ji / Mangal Dev',
    element: 'Agni (Fire)',
    personalityTraits: ['Fearless energy', 'Protector', 'Courageous', 'Direct speaker'],
    lifeFacts: [
      'Aap doosro ki madad ke liye hamesha pehle khade ho jaate hain, bina apna faayda soche.',
      'Jo baat dil me hoti hai muh par bol dete hain — peeth peeche baat karna bilkul pasand nahi.',
      'Gussa jaldi aata hai aur jaldi shaant bhi ho jata hai, par us gusse me kiya gaya faisla kabhi-kabhi nuksan kar deta hai.',
    ],
    remedyHint: 'Mangal ke tezz ko sahi disha dene aur krodh/rukawat ko shant karne ke liye Hanuman ji ki upasana atyant shaktishali hai.',
    beejMantra: 'ॐ क्रां क्रीं क्रौं सः भौमाय नमः / ॐ हनुमते नमः',
    luckyDays: ['Mangalwar (Tuesday)', 'Ravivar (Sunday)'],
    luckyColors: ['Red', 'Saffron', 'Coral', 'Deep Crimson'],
  },
};

const BHAGYANK_DATA: Record<number, { rulingPlanet: string; destinyTheme: string; strength: string; karmicChallenge: string }> = {
  1: { rulingPlanet: 'Sun', destinyTheme: 'Leadership, innovation and independent path', strength: 'Unshakable will & pioneering spirit', karmicChallenge: 'Ego management & listening to others' },
  2: { rulingPlanet: 'Moon', destinyTheme: 'Harmonizer, partnership and diplomatic healing', strength: 'High emotional intelligence & empathy', karmicChallenge: 'Over-dependence on others appreciation' },
  3: { rulingPlanet: 'Jupiter', destinyTheme: 'Expression, teaching, counseling and creative expansion', strength: 'Spiritual wisdom & inspiring communication', karmicChallenge: 'Scattered focus & excessive optimism' },
  4: { rulingPlanet: 'Rahu', destinyTheme: 'Building solid foundations through unconventional methods', strength: 'Perseverance, technical precision & originality', karmicChallenge: 'Patience during sudden delays' },
  5: { rulingPlanet: 'Mercury', destinyTheme: 'Adaptability, commercial success and networking', strength: 'Quick problem solving & magnetic speech', karmicChallenge: 'Restlessness and frequent mind changes' },
  6: { rulingPlanet: 'Venus', destinyTheme: 'Responsibility, nurturing, design and community harmony', strength: 'Unconditional warmth, aesthetic mastery & trust', karmicChallenge: 'Over-sacrificing for ungrateful people' },
  7: { rulingPlanet: 'Ketu', destinyTheme: 'Research, spiritual enlightenment and metaphysical mastery', strength: 'Deep penetrating intuition & analytical brilliance', karmicChallenge: 'Isolation and difficulty in trusting others' },
  8: { rulingPlanet: 'Saturn', destinyTheme: 'Material mastery, enduring legacy and karmic balance', strength: 'Iron resilience, financial organization & endurance', karmicChallenge: 'Carrying too much burden alone' },
  9: { rulingPlanet: 'Mars', destinyTheme: 'Universal service, fighting injustice and high achievements', strength: 'Boundless courage & compassionate leadership', karmicChallenge: 'Managing fiery temper and impulsiveness' },
  11: { rulingPlanet: 'Master Spiritual (Moon/Ketu)', destinyTheme: 'Spiritual illumination and higher visionary guidance', strength: 'Prophetic intuition & charismatic influence', karmicChallenge: 'Nervous tension & high sensitivity' },
  22: { rulingPlanet: 'Master Builder (Rahu/Saturn)', destinyTheme: 'Transforming grand dreams into concrete material reality', strength: 'Limitless potential to construct large systems', karmicChallenge: 'Fear of failure on large projects' },
  33: { rulingPlanet: 'Master Teacher (Jupiter/Venus)', destinyTheme: 'Universal compassion and supreme altruistic guidance', strength: 'Selfless devotion to uplifting humanity', karmicChallenge: 'Emotional exhaustion from bearing others burdens' },
};

export function calculateMulank(day: number): number {
  let n = day;
  while (n > 9) {
    n = String(n).split('').reduce((sum, d) => sum + Number(d), 0);
  }
  return n;
}

export function calculateBhagyank(dob: Date): number {
  const digits = `${dob.getUTCFullYear()}${String(dob.getUTCMonth() + 1).padStart(2, '0')}${String(dob.getUTCDate()).padStart(2, '0')}`;
  let n = digits.split('').reduce((sum, d) => sum + Number(d), 0);
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((sum, d) => sum + Number(d), 0);
  }
  return n;
}

export function sunSignFromDob(dob: Date): ZodiacSignInfo {
  const month = dob.getUTCMonth() + 1;
  const day = dob.getUTCDate();
  const match = ZODIAC_TABLE.find((r) => month === r.endMonth && day <= r.endDay) ??
    ZODIAC_TABLE.find((r) => month < r.endMonth) ??
    ZODIAC_TABLE[ZODIAC_TABLE.length - 1]!;
  return {
    sign: match.sign,
    hindiName: match.hindiName,
    element: match.element,
    rulingPlanet: match.rulingPlanet,
    nature: match.nature,
  };
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Parses various DOB formats like "15-08-1995", "1995-08-15", "15 Aug 1995", etc. */
export function parseDob(raw: string): Date | null {
  if (!raw) return null;
  const clean = raw.trim();

  // Try standard ISO / Date constructor first
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1920 && y <= new Date().getFullYear()) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }

  // Common Indian format DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1920 && y <= new Date().getFullYear()) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }

  // Words format e.g. "15 August 1995" or "15th Aug 1995"
  const wordsMatch = clean.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)[,\s]+(\d{4})$/i);
  if (wordsMatch && wordsMatch[1] && wordsMatch[2] && wordsMatch[3]) {
    const d = Number(wordsMatch[1]);
    const monthStr = wordsMatch[2].toLowerCase();
    const y = Number(wordsMatch[3]);
    const m = MONTH_NAMES[monthStr];
    if (m !== undefined && d >= 1 && d <= 31 && y >= 1920 && y <= new Date().getFullYear()) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }

  // Direct Date fallback
  const d = new Date(clean);
  if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1920 && d.getTime() <= Date.now()) {
    return d;
  }

  return null;
}

/** Extracts DOB embedded inside conversational text like "mera birth 14/07/1998 ko hua tha" */
export function extractDobFromText(text: string): { dob: Date; raw: string } | null {
  if (!text) return null;

  // Pattern 1: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
  if (dmy && dmy[0]) {
    const parsed = parseDob(dmy[0]);
    if (parsed) return { dob: parsed, raw: dmy[0] };
  }

  // Pattern 2: YYYY-MM-DD
  const ymd = text.match(/\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/);
  if (ymd && ymd[0]) {
    const parsed = parseDob(ymd[0]);
    if (parsed) return { dob: parsed, raw: ymd[0] };
  }

  // Pattern 3: 15 August 1995 / 23rd Oct 1998
  const named = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(\d{4})\b/i);
  if (named && named[0]) {
    const parsed = parseDob(named[0]);
    if (parsed) return { dob: parsed, raw: named[0] };
  }

  // Pattern 4: August 15, 1995
  const namedRev = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})\b/i);
  if (namedRev && namedRev[0]) {
    const parsed = parseDob(namedRev[0]);
    if (parsed) return { dob: parsed, raw: namedRev[0] };
  }

  return null;
}

/** Extracts an Indian mobile number from message text */
export function extractPhoneFromText(text: string): string | null {
  if (!text) return null;
  // Matches 10-digit Indian phone numbers with optional country code, +91, 0, dashes or spaces
  const match = text.match(/(?:(?:\+?91|0)[\s\-]?)?([6-9]\d{4}[\s\-]?\d{5}|[6-9]\d{9})\b/);
  if (!match || !match[0]) return null;
  const digits = match[0].replace(/\D/g, '').slice(-10);
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  return null;
}

export function computeKundliFacts(dobInput: string | Date): KundliFacts | null {
  const dob = typeof dobInput === 'string' ? parseDob(dobInput) : dobInput;
  if (!dob) return null;

  const day = dob.getUTCDate();
  const mulankNum = calculateMulank(day);
  const bhagyankNum = calculateBhagyank(dob);
  const sunSign = sunSignFromDob(dob);

  const mulankData = MULANK_DATA[mulankNum] ?? MULANK_DATA[1]!;
  const bhagyankData = BHAGYANK_DATA[bhagyankNum] ?? BHAGYANK_DATA[mulankNum] ?? BHAGYANK_DATA[1]!;

  const mulank: MulankInfo = { number: mulankNum, ...mulankData };
  const bhagyank: BhagyankInfo = { number: bhagyankNum, ...bhagyankData };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dobFormatted = `${day} ${monthNames[dob.getUTCMonth()]} ${dob.getUTCFullYear()}`;
  const dobIso = dob.toISOString().slice(0, 10);

  // Synthesize core realities combining Mulank & Bhagyank
  const coreRealities = [
    ...mulank.lifeFacts,
    `Aapka Bhagyank ${bhagyank.number} (${bhagyank.rulingPlanet}) hai — ${bhagyank.destinyTheme}.`,
  ];

  const luckyDay = mulank.luckyDays[0] || 'Guruwar (Thursday)';
  const luckyColor = mulank.luckyColors.slice(0, 2).join(' aur ');
  const aaradhyaDeva = mulank.deity;
  const beejMantra = mulank.beejMantra;

  const planetaryEnergySummary = `Mulank ${mulank.number} (${mulank.rulingPlanetHindi}) + Bhagyank ${bhagyank.number} (${bhagyank.rulingPlanet}) + Rashi ${sunSign.hindiName} (${sunSign.element})`;

  return {
    dobFormatted,
    dobIso,
    mulank,
    bhagyank,
    sunSign,
    coreRealities,
    luckyDay,
    luckyColor,
    aaradhyaDeva,
    beejMantra,
    planetaryEnergySummary,
  };
}

export function formatKundliFactsForPrompt(facts: KundliFacts): string {
  return `
=== VERIFIED VEDIC KUNDLI & NUMEROLOGY FACTS (GROUND YOUR READING DIRECTLY IN THESE) ===
- Birth Date: ${facts.dobFormatted} (${facts.dobIso})
- Surya Rashi (Sun Sign): ${facts.sunSign.hindiName} [Element: ${facts.sunSign.element}, Lord: ${facts.sunSign.rulingPlanet}]
- Mulank (Birth Root Number): ${facts.mulank.number} [Ruling Graha: ${facts.mulank.rulingPlanetHindi}]
- Bhagyank (Destiny/Life Path): ${facts.bhagyank.number} [Ruling Energy: ${facts.bhagyank.rulingPlanet}]
- Ishta / Aaradhya Deva: ${facts.aaradhyaDeva}
- Shubh Din (Lucky Day): ${facts.luckyDay}
- Shubh Rang (Lucky Color): ${facts.luckyColor}
- Recommended Beej Mantra: ${facts.beejMantra}

Astrological Life Facts & Core Tendencies (reveal 2-3 of these relatable facts to make the reading deeply real):
${facts.coreRealities.map((fact, i) => `  ${i + 1}. ${fact}`).join('\n')}

Vedic Energy Note: ${facts.mulank.remedyHint}
========================================================================================
`.trim();
}
