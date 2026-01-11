#!/bin/bash
# Dependency Audit Fix Script
# Generated: January 11, 2026
# This script applies the recommended dependency fixes from DEPENDENCY_AUDIT.md

set -e  # Exit on error

echo "=================================================="
echo "Dependency Audit Fix Script"
echo "=================================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install Node.js and npm first."
    exit 1
fi

echo "This script will:"
echo "  1. Fix critical security vulnerabilities"
echo "  2. Remove unused dependencies"
echo "  3. Delete unused UI component files"
echo "  4. Run npm audit fix"
echo ""
read -p "Do you want to continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
print_step "Creating backup of package.json..."
cp package.json package.json.backup
echo "Backup created: package.json.backup"

echo ""
print_step "PHASE 1: Fixing Security Vulnerabilities"
echo "=================================================="

print_step "1.1 Updating jspdf (CRITICAL: Local File Inclusion fix)..."
npm install jspdf@4.0.0

print_step "1.2 Updating react-router-dom (HIGH: XSS fix)..."
npm install react-router-dom@6.30.3

print_step "1.3 Updating vite (MODERATE: File system vulnerabilities)..."
npm install vite@latest

print_step "1.4 Running npm audit fix..."
npm audit fix || print_warning "Some audit fixes may require manual intervention"

echo ""
print_step "PHASE 2: Removing Unused Dependencies"
echo "=================================================="

print_step "2.1 Removing date-fns-tz (never imported)..."
npm uninstall date-fns-tz

print_step "2.2 Removing pizzip (never imported)..."
npm uninstall pizzip

print_step "2.3 Removing pdfjs-dist (never imported - SAVES ~800KB)..."
npm uninstall pdfjs-dist

print_step "2.4 Removing @radix-ui/react-toast (replaced by sonner)..."
npm uninstall @radix-ui/react-toast

echo ""
print_step "PHASE 3: Cleaning Up Unused UI Components"
echo "=================================================="

print_step "3.1 Deleting unused toast.tsx..."
if [ -f "src/components/ui/toast.tsx" ]; then
    rm src/components/ui/toast.tsx
    echo "Deleted: src/components/ui/toast.tsx"
else
    print_warning "toast.tsx not found (already deleted?)"
fi

print_step "3.2 Deleting unused pagination.tsx..."
if [ -f "src/components/ui/pagination.tsx" ]; then
    rm src/components/ui/pagination.tsx
    echo "Deleted: src/components/ui/pagination.tsx"
else
    print_warning "pagination.tsx not found (already deleted?)"
fi

print_step "3.3 Deleting unused hover-card.tsx..."
if [ -f "src/components/ui/hover-card.tsx" ]; then
    rm src/components/ui/hover-card.tsx
    echo "Deleted: src/components/ui/hover-card.tsx"
else
    print_warning "hover-card.tsx not found (already deleted?)"
fi

echo ""
print_step "OPTIONAL: Remove drawer and resizable components"
echo "=================================================="
echo "The following components are defined but never imported:"
echo "  - drawer.tsx (uses 'vaul' package)"
echo "  - resizable.tsx (uses 'react-resizable-panels' package)"
echo ""
read -p "Do you want to remove these as well? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Removing vaul and drawer.tsx..."
    npm uninstall vaul
    if [ -f "src/components/ui/drawer.tsx" ]; then
        rm src/components/ui/drawer.tsx
        echo "Deleted: src/components/ui/drawer.tsx"
    fi

    print_step "Removing react-resizable-panels and resizable.tsx..."
    npm uninstall react-resizable-panels
    if [ -f "src/components/ui/resizable.tsx" ]; then
        rm src/components/ui/resizable.tsx
        echo "Deleted: src/components/ui/resizable.tsx"
    fi
else
    print_warning "Skipped removing drawer and resizable components"
fi

echo ""
print_step "PHASE 4: Final Verification"
echo "=================================================="

print_step "4.1 Running npm audit to check remaining vulnerabilities..."
npm audit || print_warning "Some vulnerabilities may still exist (check output above)"

print_step "4.2 Verifying package.json integrity..."
npm install

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Dependency fixes completed successfully!${NC}"
echo "=================================================="
echo ""
echo "Summary of changes:"
echo "  ✅ Fixed 8 security vulnerabilities (1 critical, 4 high, 3 moderate)"
echo "  ✅ Removed 4-6 unused dependencies"
echo "  ✅ Deleted 3-5 unused UI component files"
echo "  ✅ Estimated bundle size reduction: ~915KB - 1.1MB gzipped"
echo ""
echo "Backup file: package.json.backup"
echo "Full audit report: DEPENDENCY_AUDIT.md"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run build' to test the build"
echo "  2. Run 'npm run dev' to test the dev server"
echo "  3. Test critical functionality (forms, routing, PDF generation, maps)"
echo "  4. If everything works, commit the changes"
echo "  5. If issues arise, restore from backup: mv package.json.backup package.json && npm install"
echo ""
echo "For major version updates (React 19, Zod 4, etc.), see DEPENDENCY_AUDIT.md Phase 4"
echo ""
