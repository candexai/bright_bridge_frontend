/** Keep tour-card "What they asked about" to real school/KB topics — not booking recap. */
const BOOKING_ONLY_PATTERNS = [
  /book(?:ed|ing)?\s+(?:a\s+)?tour/i,
  /wanted\s+to\s+book/i,
  /express(?:ed)?\s+interest/i,
  /tour\s+was\s+(?:successfully\s+)?schedul/i,
  /successfully\s+scheduled\s+for/i,
  /scheduled\s+(?:the\s+)?tour/i,
  /all\s+required\s+information\s+was\s+collected/i,
  /enroll(?:ment)?\s+as\s+soon\s+as/i,
  /immediate\s+need\s+for\s+enroll/i,
  /tour\s+for\s+their\s+child/i,
  /tour\s+schedul/i,
  /schedul.*\btour\b/i,
  /enrollment\s+timing/i,
  /enrollment\s+urgency/i,
  /enrollment\s+target/i,
  /when\s+(?:are\s+you\s+)?hoping\s+to\s+enroll/i,
  /caller.{0,60}(?:book|schedul|enroll)/i,
];

const SCHOOL_KB_PATTERNS = [
  /\b(?:tuition|price|cost|fee|afford|billing|payment)\b|financial aid/i,
  /\b(?:hours|pickup|drop[\s-]?off|holiday|closure)\b|\b(?:open|close)\b/i,
  /\b(?:meal|food|lunch|snack|allerg\w*|nutrition|diet)\b/i,
  /\b(?:ratio|teacher|staff|classroom|credential)\b|certif/i,
  /\b(?:curriculum|program|montessori|reggio|learning|development)\b/i,
  /\b(?:camera|security|safety|lock|visitor)\b/i,
  /\b(?:nap|sleep|rest time)\b/i,
  /\b(?:bus|transport)\b/i,
  /after[\s-]?school|summer camp|extended care/i,
  /\b(?:waitlist|availability|spots?|opening|capacity)\b/i,
  /\b(?:infant|toddler|preschool|kindergarten)\b|pre[\s-]?k|age group/i,
];

function isTourBookingOrEnrollmentLogistics(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return true;
  if (BOOKING_ONLY_PATTERNS.some((pattern) => pattern.test(t))) return true;
  if (/\btour\b/i.test(t)) return true;
  if (/\bschedul(?:ed|ing)\b/i.test(t) && !/\b(?:hours|pickup|drop[\s-]?off)\b/i.test(t)) return true;
  return false;
}

function isSchoolKbTopic(text: string): boolean {
  if (isTourBookingOrEnrollmentLogistics(text)) return false;
  return SCHOOL_KB_PATTERNS.some((pattern) => pattern.test(text));
}

export function filterTourCardQuestions(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items || []) {
    const label = String(item || '').trim();
    if (!label || isTourBookingOrEnrollmentLogistics(label)) continue;
    if (!isSchoolKbTopic(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function filterTourCardTalkingPoints(items: string[]): string[] {
  return filterTourCardQuestions(items);
}
