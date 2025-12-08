/**
 * AssetService - Three-tier icon loading with fallback
 * 
 * Loading priority:
 * 1. Local SVG from assets/icons/
 * 2. GitHub CDN with localStorage cache (24hr expiration)
 * 3. Emoji fallback from service catalog
 */

const CACHE_KEY_PREFIX = 'pop_icon_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CDN_TIMEOUT_MS = 5000;
const CDN_BASE_URL = 'https://raw.githubusercontent.com/loganmarchione/homelab-svg-assets/main/assets/';

// Track loading state to avoid duplicate fetches
const loadingPromises = new Map();

/**
 * Load an icon for a service type
 * @param {string} serviceName - Service type name (e.g., 'MODEM', 'FIREWALL')
 * @param {Object} catalogEntry - Service catalog entry with iconPath and icon (emoji fallback)
 * @returns {Promise<{type: 'svg'|'emoji', src: string}>}
 */
export async function loadIcon(serviceName, catalogEntry) {
    const { iconPath, icon: emojiFallback } = catalogEntry || {};
    
    // No icon path configured, use emoji immediately
    if (!iconPath) {
        return { type: 'emoji', src: emojiFallback || '?' };
    }
    
    // Check if already loading
    if (loadingPromises.has(serviceName)) {
        return loadingPromises.get(serviceName);
    }
    
    const loadPromise = (async () => {
        try {
            // Tier 1: Try local asset
            const localPath = `assets/icons/${iconPath}`;
            const localResult = await tryLoadLocal(localPath);
            if (localResult) {
                return { type: 'svg', src: localPath };
            }
            
            // Tier 2: Try CDN with cache
            const cdnResult = await tryLoadCDN(serviceName, iconPath);
            if (cdnResult) {
                return { type: 'svg', src: cdnResult };
            }
            
            // Tier 3: Emoji fallback
            return { type: 'emoji', src: emojiFallback || '?' };
        } catch (err) {
            console.warn(`[AssetService] Failed to load icon for ${serviceName}:`, err);
            return { type: 'emoji', src: emojiFallback || '?' };
        } finally {
            loadingPromises.delete(serviceName);
        }
    })();
    
    loadingPromises.set(serviceName, loadPromise);
    return loadPromise;
}

/**
 * Try loading from local assets folder
 */
async function tryLoadLocal(path) {
    try {
        const response = await fetch(path, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Try loading from CDN with localStorage cache
 */
async function tryLoadCDN(serviceName, iconPath) {
    const cacheKey = CACHE_KEY_PREFIX + serviceName;
    
    // Check cache first
    const cached = getFromCache(cacheKey);
    if (cached) {
        return cached;
    }
    
    // Fetch from CDN with timeout
    const cdnUrl = CDN_BASE_URL + iconPath;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CDN_TIMEOUT_MS);
        
        const response = await fetch(cdnUrl, { 
            signal: controller.signal,
            mode: 'cors'
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return null;
        }
        
        const svgText = await response.text();
        
        // Create data URL for caching and usage
        const dataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
        
        // Cache the result
        saveToCache(cacheKey, dataUrl);
        
        return dataUrl;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn(`[AssetService] CDN timeout for ${iconPath}`);
        }
        return null;
    }
}

/**
 * Get cached icon data URL
 */
function getFromCache(key) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        const { data, timestamp } = JSON.parse(item);
        const age = Date.now() - timestamp;
        
        if (age > CACHE_EXPIRY_MS) {
            localStorage.removeItem(key);
            return null;
        }
        
        return data;
    } catch {
        return null;
    }
}

/**
 * Save icon data URL to cache
 */
function saveToCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (err) {
        // localStorage full or unavailable, fail silently
        console.warn('[AssetService] Cache save failed:', err);
    }
}

/**
 * Clear all cached icons (useful for debugging)
 */
export function clearIconCache() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_KEY_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[AssetService] Cleared ${keysToRemove.length} cached icons`);
}

/**
 * Preload icons for all services (call on startup)
 */
export async function preloadIcons(serviceCatalog) {
    const entries = Object.entries(serviceCatalog);
    const results = await Promise.allSettled(
        entries.map(([name, entry]) => loadIcon(name, entry))
    );
    
    const loaded = results.filter(r => r.status === 'fulfilled' && r.value.type === 'svg').length;
    console.log(`[AssetService] Preloaded ${loaded}/${entries.length} icons as SVG`);
}
