/**
 * Icon Registry - Maps icon keys to Lucide React components
 * 
 * PURPOSE:
 * Provides a centralized mapping of icon identifiers (strings) to actual Lucide icon components.
 * This allows icons to be stored as simple string keys in the database instead of requiring
 * React components to be serialized.
 * 
 * DESIGN DECISION: Approach 3 (Hybrid)
 * - Primary: Use icon keys from this registry (predefined set of Lucide icons)
 * - Override: Allow custom image URLs for maximum flexibility
 * - Fallback: Use a default icon if key not found
 * 
 * USAGE:
 * 1. Backend stores iconKey: "map-pin" in EntityTypeConfiguration
 * 2. Frontend resolves with: iconRegistry.getIcon("map-pin")
 * 3. Returns: <MapPin className="..." />
 * 4. If customIconUrl exists, frontend uses: <img src={customIconUrl} />
 * 
 * ADDING NEW ICONS:
 * 1. Import icon from lucide-react
 * 2. Add entry to iconRegistry below
 * 3. Done - no code changes needed elsewhere
 */

import React from 'react';
import {
  Home,
  MapPin,
  Building2,
  TagIcon,
  BrickWallIcon,
  Settings,
  Users,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Filter,
  Download,
  Upload,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Grid,
  List,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  HelpCircle,
  Clock,
  Calendar,
  MapIcon,
} from 'lucide-react';

/**
 * Registry of available icons.
 * Keys are kebab-case strings (as stored in database).
 * Values are Lucide React icon components.
 */
export const iconRegistry: Record<string, React.ComponentType<any>> = {
  // Navigation and common
  'home': Home,
  'map-pin': MapPin,
  'building': Building2,
  'tag': TagIcon,
  'brick': BrickWallIcon,
  'settings': Settings,
  'users': Users,
  'plus': Plus,
  'edit': Edit2,
  'trash': Trash2,
  'eye': Eye,
  'eye-off': EyeOff,
  'filter': Filter,
  'download': Download,
  'upload': Upload,
  'save': Save,
  'close': X,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'copy': Copy,
  'layers': Layers,
  'grid': Grid,
  'list': List,
  'search': Search,
  
  // Status icons
  'alert': AlertCircle,
  'check': CheckCircle,
  'error': XCircle,
  'info': Info,
  'help': HelpCircle,
  
  // Time/Date
  'clock': Clock,
  'calendar': Calendar,
  
  // Domain-specific
  'location': MapIcon,
  'street': MapPin,
  'district': Layers,
  'structure': Building2,
  'category': TagIcon,
  'itemtype': BrickWallIcon,
};

/**
 * Get an icon component by key.
 * Returns the icon if found, or a default icon if not.
 * 
 * @param iconKey - Kebab-case icon identifier (e.g., "map-pin")
 * @param defaultKey - Fallback icon key if not found (defaults to "help")
 * @returns Icon component
 * 
 * @example
 * const MapIcon = iconRegistry.getIcon('map-pin');
 * const FallbackIcon = iconRegistry.getIcon('unknown-key'); // Returns help icon
 */
export function getIcon(iconKey: string | null | undefined, defaultKey: string = 'help'): React.ComponentType<any> {
  if (!iconKey || iconKey.trim() === '') {
    return iconRegistry[defaultKey] || iconRegistry['help'];
  }
  
  const normalized = iconKey.toLowerCase().trim();
  return iconRegistry[normalized] || iconRegistry[defaultKey];
}

/**
 * Get all available icon keys.
 * Useful for admin UI dropdowns when selecting icons.
 * 
 * @returns Array of icon keys
 * 
 * @example
 * const allKeys = iconRegistry.getAvailableKeys();
 * // Returns: ['home', 'map-pin', 'building', ...]
 */
export function getAvailableKeys(): string[] {
  return Object.keys(iconRegistry).sort();
}

/**
 * Check if an icon key exists in the registry.
 * 
 * @param iconKey - Icon key to check
 * @returns true if icon exists, false otherwise
 */
export function hasIcon(iconKey: string | null | undefined): boolean {
  if (!iconKey) return false;
  return iconRegistry.hasOwnProperty(iconKey.toLowerCase().trim());
}

/**
 * Render an icon with default styling.
 * Used in UI components that need standard icon sizes.
 * 
 * @param iconKey - Icon key
 * @param className - Tailwind classes (defaults to "h-5 w-5")
 * @param defaultKey - Fallback icon key
 * @returns JSX element
 * 
 * @example
 * <IconRegistry.renderIcon('map-pin', 'h-6 w-6 text-blue-600') />
 */
export function renderIcon(
  iconKey: string | null | undefined,
  className: string = 'h-5 w-5',
  defaultKey: string = 'help'
): React.ReactElement {
  const IconComponent = getIcon(iconKey, defaultKey);
  return React.createElement(IconComponent, { className });
}

export default {
  getIcon,
  getAvailableKeys,
  hasIcon,
  renderIcon,
};
