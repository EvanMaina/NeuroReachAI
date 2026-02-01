/**
 * API client configuration with robust error handling.
 * 
 * Features:
 * - Token refresh with retry logic
 * - Exponential backoff for failed requests
 * - Proper error boundaries
 * - Request deduplication
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// Empty string → Axios uses relative URLs, Vite proxy forwards /api/* to the backend.
// Set VITE_API_URL only for production deployments pointing at an absolute origin.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Token storage keys
const TOKEN_KEY = 'nr_access_token';
const REFRESH_TOKEN_KEY = 'nr_refresh_token';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds

// Track if we're currently refreshing the token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

/**
 * Process queued requests after token refresh
 */
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token && prom.config.headers) {
      prom.config.headers['Authorization'] = `Bearer ${token}`;
      prom.resolve(apiClient(prom.config));
    }
  });
  failedQueue = [];
};

/**
 * Get stored access token
 */
export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Set stored access token
 */
export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clear stored tokens
 */
export function clearStoredTokens(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(retryCount: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 500;
  return Math.min(delay + jitter, MAX_RETRY_DELAY);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: AxiosError): boolean {
  // Network errors (no response)
  if (!error.response) {
    return true;
  }
  
  // Server errors (5xx) - except 501 Not Implemented
  const status = error.response.status;
  if (status >= 500 && status !== 501) {
    return true;
  }
  
  // Rate limiting
  if (status === 429) {
    return true;
  }
  
  // Request timeout
  if (status === 408) {
    return true;
  }
  
  return false;
}

/**
 * Configured axios instance for API calls.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling with retry logic
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: number; _isRetry?: boolean };
    
    if (!originalRequest) {
      return Promise.reject(error);
    }
    
    // Initialize retry count
    if (originalRequest._retry === undefined) {
      originalRequest._retry = 0;
    }
    
    // Handle 401 Unauthorized - Token refresh logic
    if (error.response?.status === 401 && !originalRequest._isRetry) {
      // Don't retry if this is already a retry or if it's the login/refresh endpoint
      if (originalRequest.url?.includes('/auth/login') || 
          originalRequest.url?.includes('/auth/refresh')) {
        clearStoredTokens();
        // Dispatch session expired event
        window.dispatchEvent(new CustomEvent('session:expired', {
          detail: { reason: 'login_failed' }
        }));
        return Promise.reject(error);
      }
      
      originalRequest._isRetry = true;
      
      if (isRefreshing) {
        // Token refresh in progress - queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }
      
      isRefreshing = true;
      
      try {
        // Try to refresh the token
        const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
        
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token } = response.data;
          setStoredToken(access_token);
          
          // Update the original request with new token
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
          }
          
          // Process queued requests
          processQueue(null, access_token);
          
          isRefreshing = false;
          
          console.log('✅ Token refreshed successfully');
          
          // Retry the original request
          return apiClient(originalRequest);
        } else {
          // No refresh token - clear auth and redirect
          throw new Error('No refresh token available');
        }
      } catch (refreshError) {
        // Token refresh failed - clear auth state
        console.error('❌ Token refresh failed - session expired');
        processQueue(refreshError as Error, null);
        isRefreshing = false;
        clearStoredTokens();
        
        // Dispatch session expired event for the app to handle
        window.dispatchEvent(new CustomEvent('session:expired', {
          detail: { reason: 'refresh_failed' }
        }));
        
        return Promise.reject(refreshError);
      }
    }
    
    // Handle 403 Forbidden - Insufficient permissions or session expired
    if (error.response?.status === 403) {
      console.warn('⛔ Access forbidden - may indicate session expiry or insufficient permissions');
      // Check if it's a session-related 403
      const responseData = error.response.data as any;
      if (responseData?.detail?.toLowerCase().includes('deactivated') || 
          responseData?.detail?.toLowerCase().includes('session')) {
        clearStoredTokens();
        window.dispatchEvent(new CustomEvent('session:expired', {
          detail: { reason: 'account_deactivated' }
        }));
        return Promise.reject(error);
      }
    }
    
    // Handle retryable errors with exponential backoff
    if (isRetryableError(error) && originalRequest._retry < MAX_RETRIES) {
      originalRequest._retry++;
      
      const delay = getRetryDelay(originalRequest._retry);
      console.log(`Retrying request (attempt ${originalRequest._retry}/${MAX_RETRIES}) after ${delay}ms`);
      
      await sleep(delay);
      
      return apiClient(originalRequest);
    }
    
    // Handle specific error statuses
    if (error.response) {
      const status = error.response.status;
      
      if (status === 401) {
        console.error('❌ Unauthorized access - session expired');
      } else if (status === 403) {
        console.error('⛔ Access forbidden - insufficient permissions');
      } else if (status === 422) {
        // Validation error - log details for debugging
        console.error('⚠️ Validation error:', error.response.data);
      } else if (status >= 500) {
        console.error('🔥 Server error occurred');
        // Dispatch server error event
        window.dispatchEvent(new CustomEvent('api:server-error', {
          detail: { status, url: originalRequest.url }
        }));
      }
    } else if (error.request) {
      // Request made but no response received - network error
      console.error('📡 Network error - no response received');
      // Dispatch network error event
      window.dispatchEvent(new CustomEvent('api:network-error'));
    } else {
      // Error setting up request
      console.error('⚙️ Request configuration error');
    }
    
    return Promise.reject(error);
  }
);

/**
 * Check if the current token is valid (not expired)
 * This should be called on app load and periodically
 */
export function checkTokenValidity(): boolean {
  const token = getStoredToken();
  if (!token) return false;
  
  try {
    // Decode JWT to check expiry
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    
    // Token expires in less than 5 minutes - consider it invalid
    const buffer = 5 * 60 * 1000;
    return exp > (now + buffer);
  } catch (error) {
    console.error('Failed to validate token:', error);
    return false;
  }
}

/**
 * Set refresh token
 */
export function setStoredRefreshToken(token: string): void {
  sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Get refresh token
 */
export function getStoredRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Generic API error type.
 */
export interface IApiError {
  success: false;
  error: string;
  message: string;
  details?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Extract error message from API error response.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as IApiError;
    
    // Handle 422 validation errors specially
    if (error.response?.status === 422) {
      if (apiError?.details && Array.isArray(apiError.details)) {
        // Return first validation error message
        const firstError = apiError.details[0];
        if (firstError?.message) {
          return firstError.message;
        }
      }
      // FastAPI pydantic validation format
      const detail = (error.response?.data as any)?.detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const firstError = detail[0];
        if (typeof firstError === 'object' && firstError.msg) {
          const field = firstError.loc?.slice(-1)[0] || 'field';
          return `${field}: ${firstError.msg}`;
        }
        if (typeof firstError === 'string') {
          return firstError;
        }
      }
      if (typeof detail === 'string') {
        return detail;
      }
    }
    
    if (apiError?.message) {
      return apiError.message;
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Create a request with automatic retry for idempotent operations
 */
export async function requestWithRetry<T>(
  config: AxiosRequestConfig,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await apiClient.request<T>(config);
      return response.data;
    } catch (error) {
      lastError = error as Error;
      
      if (axios.isAxiosError(error) && isRetryableError(error) && attempt < maxRetries) {
        const delay = getRetryDelay(attempt);
        console.log(`Request failed, retrying (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
        await sleep(delay);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}
