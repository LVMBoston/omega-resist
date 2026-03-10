import { MessageSquare, FlaskConical, Sparkles } from "lucide-react";

const ChapterBox = ({ label, code }: { label: string; code: string }) => (
  <div className="flex flex-col items-center gap-3">
    {/* Chapter */}
    <div className="border border-amber-400/40 rounded-lg px-5 py-3 bg-amber-400/5 text-center min-w-[140px]">
      <p className="text-sm font-bold text-amber-400">{label}</p>
      <p className="text-xs text-zinc-500">{code}</p>
    </div>
    {/* Connector */}
    <div className="w-px h-4 bg-zinc-700" />
    {/* Actions */}
    <div className="border border-zinc-700 rounded-lg px-4 py-3 bg-zinc-900/60 text-center space-y-1">
      <p className="text-xs font-semibold text-zinc-300">Actions</p>
      <div className="flex gap-2 justify-center">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400">QR</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/10 text-sky-400">SMS</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400">Email</span>
      </div>
    </div>
  </div>
);

const CampaignStructureDiagram = () => (
  <section className="py-24 md:py-32 px-6 bg-zinc-950">
    <div className="max-w-3xl mx-auto space-y-12">
      <h2 className="text-3xl md:text-5xl font-bold text-center">
        How Campaigns Are Organized
      </h2>

      {/* Diagram */}
      <div className="border border-zinc-800 rounded-2xl p-8 md:p-10 bg-black/40 space-y-6">
        {/* Campaign label */}
        <div className="text-center">
          <span className="inline-block border border-zinc-600 rounded-lg px-6 py-2 text-lg font-bold tracking-wide">
            CAMPAIGN
          </span>
        </div>

        {/* Connector */}
        <div className="flex justify-center">
          <div className="w-px h-6 bg-zinc-700" />
        </div>

        {/* Chapters row */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          <ChapterBox label="Chapter A" code="zip / region" />
          <ChapterBox label="Chapter B" code="partner code" />
          <div className="hidden sm:flex flex-col items-center justify-center text-zinc-600 text-2xl font-light">
            …
          </div>
        </div>
      </div>

      {/* Annotations */}
      <div className="grid sm:grid-cols-3 gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <MessageSquare className="w-6 h-6 text-sky-400" />
          <p className="text-sm text-zinc-400">
            Custom subject lines, email & text body per chapter
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <FlaskConical className="w-6 h-6 text-rose-400" />
          <p className="text-sm text-zinc-400">
            Test mode — run a full campaign without polluting real data
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Sparkles className="w-6 h-6 text-violet-400" />
          <p className="text-sm text-zinc-400">
            AI-generated narratives to update stakeholders on progress
          </p>
        </div>
      </div>
    </div>
  </section>
);

export default CampaignStructureDiagram;
