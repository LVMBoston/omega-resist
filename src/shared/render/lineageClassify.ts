// Editor-side re-export of the shared lineage-row classifier. See
// `supabase/functions/_shared/render/lineageClassify.ts` for the
// canonical implementation; both the metric layer and the XLSX exporter
// must import through here so the two never drift.
export * from "../../../supabase/functions/_shared/render/lineageClassify";
