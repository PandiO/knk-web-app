/**
 * Resolves multi-layer dependency paths through form context data.
 * 
 * Supports navigating through related entities to extract property values.
 * Examples:
 * - "WgRegionId" (Layer 0): Direct property from formContext
 * - "Town.WgRegionId" (Layer 1): Navigate to Town, get WgRegionId
 * - "District.Town.WgRegionId" (Layer 2): Navigate through multiple relations
 */

/**
 * Resolve a dependency path from form context data.
 * 
 * @param formContext - The form context containing field values (entities, primitives, etc.)
 * @param dependencyFieldName - The field name to start from in formContext
 * @param dependencyPath - Path to navigate from the dependency field value (e.g., "Town.WgRegionId")
 * @returns The resolved value, or null if path cannot be resolved
 * 
 * @example
 * // Given formContext = { Town: { id: 4, wgRegionId: "town_1", name: "Cinix" }, ... }
 * resolveDependencyPath(formContext, "Town", "wgRegionId")
 * // Returns: "town_1"
 * 
 * @example
 * // For multi-layer navigation
 * // Given formContext = { Structure: { id: 1, district: { town: { wgRegionId: "town_2" } } } }
 * resolveDependencyPath(formContext, "Structure", "district.town.wgRegionId")
 * // Returns: "town_2"
 */
export function resolveDependencyPath(
  formContext: Record<string, unknown> | undefined,
  dependencyFieldName: string | undefined,
  dependencyPath: string | undefined
): unknown {
  if (!formContext || !dependencyFieldName) {
    return null;
  }

  // Get the starting field from context
  const fieldValue = formContext[dependencyFieldName];

  // If no path specified, return the field value itself (Layer 0)
  if (!dependencyPath || dependencyPath.trim() === '') {
    return fieldValue;
  }

  // Navigate through the path
  return navigatePath(fieldValue, dependencyPath);
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
 * Parse a dependency path to understand the navigation layers.
 * 
 * @returns Object with segments and depth
 * @example
 * parsePath("Town.WgRegionId") // Returns { segments: ["Town", "WgRegionId"], depth: 1 }
 * parsePath("District.Town.WgRegionId") // Returns { segments: ["District", "Town", "WgRegionId"], depth: 2 }
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
 * Get the field reference from a dependency field name.
 * Handles both direct field names and prefixed references.
 * 
 * @example
 * getFieldReference("Town") // Returns "Town"
 * getFieldReference("Town.Name") // Returns "Town" (first segment)
 */
export function getFieldReference(dependencyPath: string | undefined): string | null {
  if (!dependencyPath || dependencyPath.trim() === '') {
    return null;
  }

  // Get the first segment before the first dot
  const firstSegment = dependencyPath.split('.')[0];
  return firstSegment || null;
}

/**
 * Get the property path (navigation path) from a full dependency path.
 * 
 * @example
 * getPropertyPath("Town.WgRegionId") // Returns "WgRegionId"
 * getPropertyPath("District.Town.WgRegionId") // Returns "Town.WgRegionId"
 */
export function getPropertyPath(dependencyPath: string | undefined): string | null {
  if (!dependencyPath || dependencyPath.trim() === '') {
    return null;
  }

  const segments = dependencyPath.split('.');
  if (segments.length <= 1) {
    // No property path - it's a direct field
    return null;
  }

  // Return all segments after the first
  return segments.slice(1).join('.');
}
