/**
 * UTM parameter capture utility.
 * 
 * Captures marketing attribution data from URL parameters.
 */

import type { IUTMParams } from '../types/lead';

/**
 * List of UTM parameters to capture.
 */
const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

/**
 * Storage key for persisting UTM parameters.
 */
const UTM_STORAGE_KEY = 'neuroreach_utm_params';

/**
 * Get UTM parameters from current URL.
 * 
 * @returns Object containing any UTM parameters found
 */
export function getUTMFromURL(): IUTMParams {
  const params: IUTMParams = {};
  
  try {
    const searchParams = new URLSearchParams(window.location.search);
    
    for (const param of UTM_PARAMS) {
      const value = searchParams.get(param);
      if (value) {
        params[param] = value;
      }
    }
  } catch (error) {
    // Silently fail if URL parsing fails
    console.error('Failed to parse UTM parameters from URL');
  }
  
  return params;
}

/**
 * Save UTM parameters to session storage.
 * 
 * Persists UTM data across page navigations within the session.
 * 
 * @param params - UTM parameters to save
 */
export function saveUTMParams(params: IUTMParams): void {
  try {
    if (Object.keys(params).length > 0) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(params));
    }
  } catch (error) {
    // Silently fail if storage is unavailable
    console.error('Failed to save UTM parameters to storage');
  }
}

/**
 * Get UTM parameters from session storage.
 * 
 * @returns Stored UTM parameters or empty object
 */
export function getStoredUTMParams(): IUTMParams {
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as IUTMParams;
    }
  } catch (error) {
    // Silently fail if storage is unavailable
    console.error('Failed to retrieve UTM parameters from storage');
  }
  return {};
}

/**
 * Clear UTM parameters from session storage.
 */
export function clearUTMParams(): void {
  try {
    sessionStorage.removeItem(UTM_STORAGE_KEY);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Get UTM parameters for form submission.
 * 
 * Checks URL first, then falls back to stored params.
 * Saves any new URL params for future use.
 * 
 * @returns UTM parameters for submission
 */
export function captureUTMParams(): IUTMParams {
  // First, try to get from URL
  const urlParams = getUTMFromURL();
  
  // If we found params in URL, save them
  if (Object.keys(urlParams).length > 0) {
    saveUTMParams(urlParams);
    return urlParams;
  }
  
  // Otherwise, return stored params
  return getStoredUTMParams();
}

/**
 * Get the referrer URL for attribution.
 * 
 * @returns Referrer URL or current page URL
 */
export function getReferrerUrl(): string {
  return document.referrer || window.location.href;
}

/**
 * Combine UTM params and referrer for lead submission.
 * 
 * @returns Object with utm_params and referrer_url
 */
export function getMarketingAttribution(): {
  utm_params: IUTMParams;
  referrer_url: string;
} {
  return {
    utm_params: captureUTMParams(),
    referrer_url: getReferrerUrl(),
  };
}
