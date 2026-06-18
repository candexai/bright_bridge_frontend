export type ParentSegment = 'new_parent' | 'current_family' | 'unknown';

export function getSegmentLabel(segment?: ParentSegment): string {
  if (segment === 'current_family') return 'Current Family';
  if (segment === 'unknown') return 'Unknown';
  return 'New Parent';
}

export function getSegmentBadgeClassName(segment?: ParentSegment): string {
  switch (segment) {
    case 'current_family':
      return 'bg-violet-50 text-violet-800 border-violet-200';
    case 'unknown':
      return 'bg-stone-100 text-stone-600 border-stone-300';
    case 'new_parent':
    default:
      return 'bg-sky-50 text-sky-800 border-sky-200';
  }
}

export function getSegmentFilterButtonClassName(segment: ParentSegment, active: boolean): string {
  if (active) {
    switch (segment) {
      case 'current_family':
        return 'bg-violet-600 text-white border border-violet-600 shadow-sm';
      case 'unknown':
        return 'bg-stone-600 text-white border border-stone-600 shadow-sm';
      case 'new_parent':
      default:
        return 'bg-sky-600 text-white border border-sky-600 shadow-sm';
    }
  }
  switch (segment) {
    case 'current_family':
      return 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100';
    case 'unknown':
      return 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100';
    case 'new_parent':
    default:
      return 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100';
  }
}

export function getSegmentTagClassName(tag: string): string | null {
  const lower = tag.toLowerCase();
  if (lower === 'new parent') return getSegmentBadgeClassName('new_parent');
  if (lower === 'current family') return getSegmentBadgeClassName('current_family');
  if (lower === 'unknown') return getSegmentBadgeClassName('unknown');
  if (lower.includes('email missing')) return getTourEmailMissingBadgeClassName();
  return null;
}

export function getTourBookedBadgeClassName(): string {
  return 'bg-emerald-100 text-emerald-900 border-emerald-300';
}

export function getTourEmailMissingBadgeClassName(): string {
  return 'bg-rose-100 text-rose-900 border-rose-300';
}

export const TOUR_EMAIL_MISSING_LABEL = 'Email missing';
