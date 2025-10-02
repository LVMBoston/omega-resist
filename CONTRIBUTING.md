# Contributing Guidelines

This document outlines the development standards and practices for this project. All contributors must follow these rules to ensure consistency, quality, and maintainability.

---

## 1. Test-First Development

**Rule**: Write tests before implementing any code.

### Requirements
- **Unit tests**: Test individual functions and components in isolation
- **Integration tests**: Test interactions between modules and data flow
- Test files should be co-located with source files using the `.test.ts` or `.test.tsx` extension

### Example Structure
```
src/
  components/
    Button/
      Button.tsx
      Button.test.tsx
  lib/
    utils.ts
    utils.test.ts
```

### Best Practices
- Test edge cases and error states
- Use descriptive test names: `it('should display error message when API call fails')`
- Mock external dependencies (APIs, Supabase, etc.)
- Aim for meaningful coverage, not just high percentages

---

## 2. Documentation Standards

**Rule**: Every module must be thoroughly documented.

### Required Documentation

#### Module README.md
Each logical module or feature must include a `README.md` with:
- **Purpose**: What the module does and why it exists
- **Inputs**: Parameters, props, or data it accepts
- **Outputs**: Return values, rendered UI, or side effects
- **Dependencies**: Related modules and external packages
- **Examples**: Usage examples for common scenarios

#### Inline Comments
- Explain **why**, not **what** (the code shows what)
- Document non-obvious logic, algorithms, or business rules
- Add TODO comments with context: `// TODO: Optimize query for large datasets (see ticket #123)`

#### Cross-References
Link to related modules using relative paths:
```typescript
// Related: See @/lib/analytics for event tracking
// Dependencies: @/hooks/useAuth, @/lib/supabase
```

---

## 3. UI Element Identifiers

**Rule**: Every UI element must have a unique 2-character identifier.

### Purpose
Enables unambiguous reference to UI elements in discussions, documentation, and issue tracking.

### Format
- Two uppercase characters in square brackets: `[DB]`, `[SD]`, `[HM]`
- Place identifier at the start of component names or in comments
- Document identifiers in component README or inline comments

### Example
```tsx
// [HM] Header Menu - Main navigation component
export const HeaderMenu = () => {
  return (
    <nav>
      {/* [LG] Logo */}
      <Logo />
      {/* [NV] Navigation Links */}
      <NavLinks />
    </nav>
  );
};
```

### Registry
Maintain a UI identifier registry in `/docs/UI_IDENTIFIERS.md` to prevent duplicates.

---

## 4. Design System

**Rule**: Use Tailwind CSS semantic tokens exclusively. No direct color classes.

### Allowed Classes
```tsx
// ✅ CORRECT - Semantic tokens
className="text-foreground bg-background border-border"
className="text-primary bg-primary-foreground"
className="text-muted-foreground bg-secondary"

// ❌ WRONG - Direct colors
className="text-white bg-black border-gray-300"
className="text-blue-500 bg-red-100"
```

### Design Token Management
- Define all design tokens in `src/index.css` (HSL format only)
- Extend tokens in `tailwind.config.ts` as needed
- Use CSS variables for custom values: `--radius`, `--sidebar-width`

### Color System
All colors must be defined as HSL values in `:root` and `.dark` selectors:
```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --foreground: 222.2 84% 4.9%;
}
```

---

## 5. Component Styling

**Rule**: Use shadcn/ui component variants. No raw Tailwind classes in components.

### Variant System
Create semantic variants in component definitions:
```tsx
// ❌ WRONG - Raw classes in usage
<Button className="bg-blue-500 text-white hover:bg-blue-600">
  Click me
</Button>

// ✅ CORRECT - Semantic variant
<Button variant="primary">
  Click me
</Button>
```

### Creating Variants
Extend shadcn components with custom variants:
```tsx
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        hero: "bg-accent text-accent-foreground border-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      }
    }
  }
);
```

---

## 6. Code Organization

**Rule**: Follow strict directory structure and use path aliases.

### Directory Structure
```
src/
  components/       # Reusable UI components
    ui/            # shadcn/ui components
    features/      # Feature-specific components
  pages/           # Route pages
  hooks/           # Custom React hooks
  lib/             # Utilities, helpers, constants
    supabase.ts    # Supabase client
    utils.ts       # General utilities
  types/           # TypeScript type definitions
  tests/           # Global test setup and utilities
```

### Import Aliases
Always use `@/` for imports:
```tsx
// ✅ CORRECT
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

// ❌ WRONG
import { Button } from "../../components/ui/button";
import { supabase } from "../lib/supabase";
```

---

## 7. Backend & Data Layer

**Rule**: Supabase is the backend. Use async/await with proper error handling.

### Async/Await Pattern
```tsx
// ✅ CORRECT - Complete error handling
const fetchUser = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error; // Re-throw for component error handling
  }
};
```

### UI State Management
Always handle loading and error states:
```tsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSubmit = async () => {
  setLoading(true);
  setError(null);
  
  try {
    await submitData();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'An error occurred');
  } finally {
    setLoading(false);
  }
};
```

### Best Practices
- Use TypeScript types for Supabase queries
- Implement Row Level Security (RLS) policies
- Never expose sensitive data in client-side code
- Use Supabase Edge Functions for sensitive operations

---

## 8. Privacy & Analytics

**Rule**: Privacy-first tracking. No PII, no device IDs.

### Data Collection Principles
- **No Personal Identifiable Information (PII)**: No names, emails, phone numbers, or IP addresses
- **No Device Identifiers**: No device IDs, fingerprints, or persistent tracking tokens
- **Aggregate Only**: Track events and metrics, not individuals
- **Transparent**: Users should understand what data is collected

### Schema Compliance
Follow the `DF-Virality-DB` schema for all analytics:
- Use anonymous session IDs (short-lived, non-persistent)
- Store only necessary event metadata
- Implement data retention policies
- Provide clear opt-out mechanisms

### Implementation
```tsx
// ✅ CORRECT - Privacy-first
trackEvent('button_clicked', {
  component: 'hero_cta',
  timestamp: Date.now(),
  // No user ID, no device ID
});

// ❌ WRONG - Contains PII
trackEvent('button_clicked', {
  userId: 'user@email.com',
  deviceId: 'abc123',
  ipAddress: '192.168.1.1',
});
```

---

## 9. Terminology & Glossary

**Rule**: Use consistent terminology across codebase and documentation.

### Standard Terms
All code, comments, and documentation must use terms from `Glossary.md`:
- **PR**: Page Rank
- **UTM**: Urchin Tracking Module (source, medium, campaign)
- **L00–L03**: Funnel levels (Awareness → Conversion)
- **K**: Viral coefficient
- **Breadth**: Number of shares per user
- **Depth**: Conversion rate at each level

### Reference
See `/docs/Glossary.md` for complete terminology definitions.

### Naming Conventions
```tsx
// ✅ CORRECT - Uses glossary terms
const calculateViralCoefficient = (breadth: number, depth: number): number => {
  return breadth * depth;
};

// ❌ WRONG - Inconsistent terminology
const calcK = (shares: number, convRate: number): number => {
  return shares * convRate;
};
```

---

## Development Workflow

1. **Create issue**: Document the feature or bug
2. **Write tests**: Define expected behavior
3. **Implement code**: Make tests pass
4. **Document**: Add README and comments
5. **Review**: Self-review against these guidelines
6. **Submit PR**: Include test results and documentation updates

---

## Questions or Clarifications?

If any guideline is unclear or needs refinement, open an issue for discussion before proceeding. These rules are designed to maintain code quality and team alignment.

**Last Updated**: 2025-10-02
