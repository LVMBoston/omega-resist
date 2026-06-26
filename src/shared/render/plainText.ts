// Re-export of the canonical shared plain-text renderer. Source-of-truth
// lives in `supabase/functions/_shared/render/plainText.ts` so the Supabase
// edge-function bundler can ship it.
export {
  renderPlainTextSvg,
  type PlainTextBox,
  type PlainTextStyle,
} from "../../../supabase/functions/_shared/render/plainText";
