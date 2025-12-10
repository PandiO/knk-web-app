// Hook for parsing template text with ${...} variables
import { useMemo } from 'react';

export function useTemplateParser() {
  const parseTemplate = useMemo(() => {
    return (template: string, data: Record<string, unknown>): string => {
      // Regex to match ${...} patterns
      const variableRegex = /\$\{([^}]+)\}/g;

      return template.replace(variableRegex, (match, expression) => {
        try {
          const trimmed = expression.trim();

          // Check if it's a calculation (contains operators)
          if (/[+\-*/]/.test(trimmed)) {
            return evaluateCalculation(trimmed, data);
          }

          // Simple property access
          const value = getNestedValue(data, trimmed);
          return value !== null && value !== undefined ? String(value) : '';
        } catch (error) {
          console.warn(`Failed to parse template variable: ${expression}`, error);
          return match; // Return original ${...} on error
        }
      });
    };
  }, []);

  return { parseTemplate };
}

// Helper: Get nested property value (supports "street.name" and "Districts.Count")
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    // Special handling for .Count on arrays
    if (part === 'Count' && Array.isArray(current)) {
      return current.length;
    }

    if (current === null || current === undefined) {
      return null;
    }

    // Type guard for object access
    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return current;
}

// Helper: Evaluate simple calculations like "${Districts.Count + Streets.Count}"
function evaluateCalculation(expression: string, data: Record<string, unknown>): string {
  // Split by operators while preserving them
  const tokens = expression.split(/([+\-*/])/);
  
  let result = 0;
  let currentOp = '+';

  for (const token of tokens) {
    const trimmed = token.trim();
    
    if (['+', '-', '*', '/'].includes(trimmed)) {
      currentOp = trimmed;
      continue;
    }

    // Get value (either number literal or property path)
    let value: number;
    if (!isNaN(Number(trimmed))) {
      value = Number(trimmed);
    } else {
      const propValue = getNestedValue(data, trimmed);
      value = typeof propValue === 'number' ? propValue : Number(propValue) || 0;
    }

    switch (currentOp) {
      case '+': result += value; break;
      case '-': result -= value; break;
      case '*': result *= value; break;
      case '/': result /= value; break;
    }
  }

  return String(result);
}
