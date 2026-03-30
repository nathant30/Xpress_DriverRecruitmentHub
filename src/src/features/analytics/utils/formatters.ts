/**
 * Format source channel name for display
 */
export function formatSourceChannel(channel: string): string {
  const channelMap: Record<string, string> = {
    'FO_REFERRAL': 'Field Officer Referral',
    'DRIVER_REFERRAL': 'Driver Referral',
    'FACEBOOK_ADS': 'Facebook Ads',
    'GOOGLE_ADS': 'Google Ads',
    'TIKTOK_ADS': 'TikTok Ads',
    'JOBSTREET': 'JobStreet',
    'LINKEDIN': 'LinkedIn',
    'WALK_IN': 'Walk-in Application',
    'EVENT': 'Recruitment Event',
    'PARTNER_REFERRAL': 'Partner Referral',
    'ORGANIC_SEARCH': 'Organic Search',
    'DIRECT_TRAFFING': 'Direct Staffing',
  };

  return channelMap[channel] || channel
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a number with thousands separator
 */
export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * Format currency (PHP)
 */
export function formatCurrency(value: number): string {
  return `₱${value.toLocaleString()}`;
}

/**
 * Format time duration
 */
export function formatDuration(days: number): string {
  if (days < 1) return '< 1 day';
  if (days === 1) return '1 day';
  if (days < 7) return `${Math.round(days)} days`;
  if (days < 30) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}

/**
 * Format date relative to now
 */
export function formatRelativeDate(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}
