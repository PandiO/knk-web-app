/**
 * Resolves dependency paths through entity properties.
 * 
 * This utility supports navigating through entity relationships to extract property values.
 * Aligns with IPathResolutionService backend contract.
 * 
 * Examples:
 * - "wgRegionId" (Layer 0): Direct property from entity
 * - "town.wgRegionId" (Layer 1): Navigate to related entity, then extract property  
 * - "district.town.wgRegionId" (Layer 2): Multi-level navigation
 */

/**
 * Resolve a property path from an entity instance.
 * 
 * This is the primary function used by FormWizard to extract dependency values.
 * It navigates from a given entity through a property path to extract the actual value.
 * 
 * @param entity - The entity instance to navigate (e.g., a Town object)
 * @param propertyPath - Path to navigate from the entity (e.g., "wgRegionId" or "district.name")
 * @returns The resolved value, or null if path cannot be resolved
 * 
 * @example
 * // Given entity = { id: 4, wgRegionId: "town_1", name: "Cinix" }
 * resolveDependencyPath(entity, "wgRegionId")
 * // Returns: "town_1"
 * 
 * @example
 * // For navigation through related entities
 * // Given entity = { id: 1, district: { town: { wgRegionId: "town_2" } } }
 * resolveDependencyPath(entity, "district.town.wgRegionId")
 * // Returns: "town_2"
 */
export function resolveDependencyPath(
  entity: unknown,
  propertyPath: string | undefined
): unknown {
  // If no entity or empty path, return the entity itself
  if (!entity || !propertyPath || propertyPath.trim() === '') {
    return entity;
  }

  // Navigate through the path
  return navigatePath(entity, propertyPath);
}

/**
 * Navigate through a path in an object (entity or plain object).
 */
function navigatePath(value: unknown, path: string): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  const segments = path.split('.');
  let current: unknown = value;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return null;
    }

    // Handle objects (including entities and plain objects)
    if (typeof current === 'object') {
      const obj = current as Record<string, unknown>;
      
      // Try exact match first
      if (segment in obj) {
        current = obj[segment];
      } else {
        // Try case-insensitive match (for camelCase vs PascalCase)
        const lowerSegment = segment.toLowerCase();
        const matchedKey = Object.keys(obj).find(
          (key) => key.toLowerCase() === lowerSegment
        );

        if (matchedKey) {
          current = obj[matchedKey];
        } else {
          // Path segment not found
          console.warn(`Property "${segment}" not found in object`, obj);
          return null;
        }
      }
    } else {
      // Cannot navigate further - value is not an object
      console.warn(`Cannot navigate to property "${segment}" - value is not an object`, current);
      return null;
    }
  }

  return current;
}

/**
 * Parse a property path to understand the navigation layers.
 * 
 * @param path - The property path (e.g., "wgRegionId" or "district.town.wgRegionId")
 * @returns Object with segments and depth
 * 
 * @example
 * parsePath("wgRegionId") 
 * // Returns { segments: ["wgRegionId"], depth: 0 }
 * 
 * @example
 * parsePath("town.wgRegionId") 
 * // Returns { segments: ["town", "wgRegionId"], depth: 1 }
 * 
 * @example
 * parsePath("district.town.wgRegionId") 
 * // Returns { segments: ["district", "town", "wgRegionId"], depth: 2 }
 */
export function parsePath(path: string | undefined): {
  segments: string[];
  depth: number;
} {
  if (!path || path.trim() === '') {
    return { segments: [], depth: 0 };
  }

  const segments = path.split('.').filter((s) => s.trim() !== '');
  return {
    segments,
    depth: Math.max(0, segments.length - 1) // depth = number of navigations
  };
}

/**
 * Get the first navigation segment from a property path.
 * Used to identify which related entity to navigate to first.
 * 
 * @param propertyPath - The property path (e.g., "town.wgRegionId" or "wgRegionId")
 * @returns The first segment (navigation target) or null if path is empty
 * 
 * @example
 * getFirstNavigationSegment("town.wgRegionId") // Returns "town"
 * getFirstNavigationSegment("wgRegionId") // Returns "wgRegionId"
 * getFirstNavigationSegment("") // Returns null
 */
export function getFirstNavigationSegment(propertyPath: string | undefined): string | null {
  if (!propertyPath || propertyPath.trim() === '') {
    return null;
  }

  // Get the first segment before the first dot
  const firstSegment = propertyPath.split('.')[0];
  return firstSegment || null;
}

/**
 * Get the remaining property path after the first navigation.
 * Used to continue navigating through related entities.
 * 
 * @param propertyPath - The property path (e.g., "town.wgRegionId" or "wgRegionId")
 * @returns The remaining path after first segment, or null if only one segment
 * 
 * @example
 * getRemainingPath("district.town.wgRegionId") 
 * // Returns "town.wgRegionId"
 * 
 * @example
 * getRemainingPath("wgRegionId") 
 * // Returns null (no further navigation)
 */
export function getRemainingPath(propertyPath: string | undefined): string | null {
  if (!propertyPath || propertyPath.trim() === '') {
    return null;
  }

  const segments = propertyPath.split('.');
  if (segments.length <= 1) {
    // No more navigation - it's a direct property
    return null;
  }

  // Return all segments after the first
  return segments.slice(1).join('.');
}
