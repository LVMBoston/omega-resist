- *Save Form Inventory to Documentation*

## What

Create a single markdown file documenting every data-collection form in the application, organized by sidebar navigation section, with all fields listed per form.

## File

`docs/decisions/forms/2026-02-28_form-inventory_feature-doc_lovable.md`

## Content

The document will include:

- **Status**: Approved & Implemented
- **Date**: 2026-02-28

### Campaign Orchestration

**Campaign Create/Edit** (`CampaignManager.tsx`)

- Title (text, required)
- Code (text, required, regex-validated via Zod)
- Description (textarea, optional)

**Campaign Clone** (`CampaignManager.tsx`)

- New Code (text, required, regex-validated)

**EoA Create/Edit** (`EoaForm.tsx`)

- Event Code (text + Mobilize fetch button)
- UTM ID (text, max 8 chars, persisted to localStorage)
- Type (select: canvass | phone_bank | rally | other)
- Site Name (text)
- City (text)
- State (text)
- Zip Code (text)
- Timezone (select)
- End Date/Time (datetime-local)
- Description (textarea)
- Assigned Deck (select from available decks)

**EoA Bulk Update** (`CampaignEoaManager.tsx`)

- Deck Assignment (select)
- UTM ID (text)
- End Date/Time (datetime-local)
- Auto-mint L00 toggle

**QR Defaults** (`QrDefaultsDialog.tsx`)

- Size preset (select)
- Caption text (text)
- Foreground color (color)
- Background color (color)

### Decks

**Deck Builder -- ZIP Upload** (`DeckBuilder.tsx`)

- Deck Slug (text, Zod-validated)
- ZIP file (file input, .zip)
- Compress images (checkbox)

**Deck Builder -- Google Slides** (`DeckBuilder.tsx`)

- Deck Slug (text, Zod-validated)
- Google Slides URL (text, Zod URL-validated)

**Deck Editor -- Save As** (`DeckEditor.tsx`)

- New Slug (text, prompted inline)

**Deck Editor -- Image/ZIP Import** (`DeckEditor.tsx`)

- Image files (file input or paste, multi)
- ZIP file (file input)

**Deck Management -- Google Slides Import** (`DeckManagement.tsx`)

- Deck Slug (text)
- Google Slides URL (text)

**Interactive Template Create/Edit** (`InteractiveTemplates.tsx`)

- Template Name (text, required)
- Slug (text, required)
- Description (textarea)
- Background Image (file upload)
- Hotspot configuration (visual editor: position, size, type, label, URL)
- Is Default (checkbox)

**Data Template Editor** (`DataTemplateEditor.tsx`)

- Template Name (text, required)
- Slug (text, required)
- Description (textarea)
- Background (image upload or solid color picker)
- Hotspot configuration (visual editor: position, size, data binding, font, color, alignment)

### Analytics

No data-collection forms in this section.

### Admin

**Settings -- Email** (`Settings.tsx`)

- Various key-value text/textarea fields (from settings table, category "email")

**Settings -- SMS** (`Settings.tsx`)

- Various key-value text/textarea fields (category "sms")

**Settings -- UTM** (`Settings.tsx`)

- UTM value lists (textarea, category "utm")

**Settings -- General** (`Settings.tsx`)

- General config key-value pairs (category "general")

**Settings -- Branding** (`Settings.tsx`)

- Logo upload (`LogoUpload` component)
- Branding key-value pairs (category "branding")

**Settings -- QR Defaults** (`Settings.tsx`)

- Size presets (radio/select)
- Caption (text)
- Foreground/Background color (color pickers)
- Border (slider)
- Corner radius (slider)
- Error correction level (select)

**User Role Assignment** (`Admin.tsx`)

- User (implicit from list)
- Role (select: admin | manager | viewer)

**Dashboard Share Creation** (`Admin.tsx`)

- Campaign (select)
- Expiration period (select: 7d | 30d | 90d | never)

**Data Deletion** (`Admin.tsx`)

- Delete target (radio: time | source | campaign)
- Time range (date pickers) or Source (select) or Campaign (select)

**QR Debug Tool** (`QrDebugTool.tsx`)

- URL (text)
- Size (slider)
- Label Top/Bottom (text)
- Foreground/Background color (color)
- Error correction level (select)
- Module shape (select: square | rounded | dots)
- Border width (slider)
- Corner radius (slider)
- Logo (file upload)

**Re-point QR Tool** (`RepointQrTool.tsx`)

- Short Code (search/autocomplete)
- Campaign (select)
- Event/Action (select)
- Reset clicks (checkbox)

**Simulator** (`Simulator.tsx`)

- Campaign (select)
- EOA selection (multi-checkbox)
- L00 Count (number)
- L01/L02/L03 branching factors (number)

**Zip Code Importer** (`ZipCodeImporter.tsx`)

- Excel file (file input, .xlsx/.xls)

**Auth** (`Auth.tsx`)

- Email (text)
- Password (password)
- (Sign up / Sign in / Forgot password modes)

### Observations -- Repeated Field Patterns


| Pattern        | Appears In                                                                                | Fields                     |
| -------------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| Location group | EoaForm, Simulator (via EOA data)                                                         | city, state, zip, timezone |
| Deck selection | EoaForm, Bulk Update, DeckManagement, InteractiveTemplates                                | deck slug dropdown         |
| UTM ID         | EoaForm, Bulk Update                                                                      | 8-char text input          |
| Color pickers  | QR Debug, QR Defaults, Settings QR, DataTemplateEditor                                    | fg/bg hex color            |
| Slug input     | DeckBuilder, DeckEditor Save-As, DeckManagement, InteractiveTemplates, DataTemplateEditor | validated text             |


These repeated patterns are candidates for shared reusable form components.

## Technical Details

Single new file creation. No code or schema changes.