import { QrCode, Film, Layers, BarChart3, FlaskConical, RefreshCw, MessageSquare, Calendar } from "lucide-react";

const features = [
  {
    icon: QrCode,
    title: "Reach Without Risk",
    color: "text-emerald-400",
    description:
      "Zero-friction QR access — no apps, no accounts. Anonymity by design with automatic IP purging. Messages spread through trust, not tracking.",
  },
  {
    icon: Film,
    title: "Rich Interactive Content",
    color: "text-amber-400",
    description:
      "Multimedia decks with videos, GIFs, and images. Tap hotspots to download files, send SMS, compose emails, or open links. Content stays updatable after QR codes are printed.",
    forthcoming: "Anonymous feedback forms · Calendar reminders",
  },
  {
    icon: Layers,
    title: "Campaign Architecture",
    color: "text-sky-400",
    description:
      "Organize campaigns by chapters — zip codes, regions, or partner codes. Each chapter initiates actions via QR, email, or SMS with fully customizable messaging.",
  },
  {
    icon: BarChart3,
    title: "Intelligence & Reporting",
    color: "text-violet-400",
    description:
      "Geographic reach on live maps. Viral coefficient and chain-depth analytics. AI-generated progress narratives and shareable public dashboards for stakeholders.",
  },
  {
    icon: FlaskConical,
    title: "Safe Testing & Deployment",
    color: "text-rose-400",
    description:
      "Simulate entire campaigns without polluting the database. One-click QR generation and short URLs for easy distribution.",
  },
];

const FeatureGrid = () => (
  <section className="py-24 md:py-32 px-6">
    <div className="max-w-4xl mx-auto space-y-12">
      <h2 className="text-3xl md:text-5xl font-bold text-center">
        What You Can Do
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f) => (
          <div
            key={f.title}
            className="border border-zinc-800 rounded-xl p-6 space-y-3 bg-zinc-950/50"
          >
            <f.icon className={`w-8 h-8 ${f.color}`} />
            <h3 className="text-lg font-bold">{f.title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {f.description}
            </p>
            {f.forthcoming && (
              <p className="text-xs text-zinc-600 italic flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Coming soon: {f.forthcoming}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeatureGrid;
