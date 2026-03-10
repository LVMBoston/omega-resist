import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Shield, Eye, EyeOff, QrCode, Share2, MapPin, ChevronDown, Lock, Trash2, Users } from "lucide-react";
import omegaLogo from "@/assets/omega-logo.png";
import FeatureGrid from "@/components/landing/FeatureGrid";
import CampaignStructureDiagram from "@/components/landing/CampaignStructureDiagram";

const LandingPage = () => {
  useEffect(() => {
    document.title = "OMEGA — Underground Infrastructure for Resistance";
  }, []);

  const scrollToContent = () => {
    document.getElementById("the-problem")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── HERO ── */}
      <section className="min-h-screen flex flex-col items-center justify-center p-8 relative">
        <img src={omegaLogo} alt="Omega" className="w-64 md:w-80 mb-8" />
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-center mb-4">
          OMEGA
        </h1>
        <p className="text-lg md:text-2xl text-zinc-400 text-center max-w-xl leading-relaxed">
          Underground infrastructure for campaigns of resistance
        </p>
        <button
          onClick={scrollToContent}
          className="absolute bottom-12 animate-bounce text-zinc-500 hover:text-white transition-colors"
          aria-label="Scroll to learn more"
        >
          <ChevronDown className="w-8 h-8" />
        </button>
      </section>

      {/* ── THE PROBLEM ── */}
      <section id="the-problem" className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold text-red-500">
            They control the platforms.
          </h2>
          <div className="space-y-6 text-lg md:text-xl text-zinc-300 leading-relaxed">
            <p>
              Social media accounts get suspended. Posts get shadow-banned. 
              Algorithms decide who sees what. Every click, every share, every 
              connection is logged and profiled.
            </p>
            <p>
              Traditional digital outreach leaves footprints everywhere — 
              footprints that can be used to identify, target, and silence 
              organizers and supporters.
            </p>
            <div className="flex items-center gap-4 pt-4 text-zinc-500">
              <Eye className="w-10 h-10 shrink-0" />
              <p className="text-base italic">
                Surveillance chills organizing. When people fear being watched, 
                they stop speaking up.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE SAMIZDAT WAY ── */}
      <section className="py-24 md:py-32 px-6 bg-zinc-950">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold text-amber-400">
            The Samizdat Way
          </h2>
          <div className="space-y-6 text-lg md:text-xl text-zinc-300 leading-relaxed">
            <p>
              In the Soviet Union, <em className="text-white font-semibold">samizdat</em> was 
              underground literature — hand-copied and passed person to person. No publisher. 
              No distribution center. No single point of failure. It couldn't be shut down 
              because it lived in the hands of ordinary people.
            </p>
            <p>
              Omega brings this model into the digital age. Physical cards and posters carry 
              QR codes that unlock content and create <span className="text-amber-400 font-semibold">invisible 
              trust chains</span> — spreading messages through human networks, not corporate platforms.
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-5xl font-bold text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                <QrCode className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold">1. Discover</h3>
              <p className="text-zinc-400">
                Someone finds a card at a coffee shop, a poster on a wall, a sticker on a lamppost.
              </p>
            </div>
            {/* Step 2 */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                <Eye className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold">2. See the Message</h3>
              <p className="text-zinc-400">
                They scan the QR code and instantly see your content — no app download, 
                no account creation, no barriers.
              </p>
            </div>
            {/* Step 3 */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                <Share2 className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold">3. Pass It Forward</h3>
              <p className="text-zinc-400">
                They share it with friends via text, signal, or word of mouth. 
                Each share extends the chain — anonymously.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BUILT FOR ANONYMITY ── */}
      <section className="py-24 md:py-32 px-6 bg-zinc-950">
        <div className="max-w-3xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-5xl font-bold text-emerald-400 text-center">
            Built for Anonymity
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center space-y-3">
              <EyeOff className="w-10 h-10 text-emerald-400" />
              <h3 className="font-bold text-lg">No Accounts</h3>
              <p className="text-sm text-zinc-400">
                Nobody needs to sign up. No emails collected. No profiles created.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <Trash2 className="w-10 h-10 text-emerald-400" />
              <h3 className="font-bold text-lg">IPs Purged</h3>
              <p className="text-sm text-zinc-400">
                IP addresses are automatically deleted. We see geography, not identity.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <Lock className="w-10 h-10 text-emerald-400" />
              <h3 className="font-bold text-lg">Trust, Not Tracking</h3>
              <p className="text-sm text-zinc-400">
                Content spreads through human relationships — not surveillance infrastructure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE GRID ── */}
      <FeatureGrid />

      {/* ── CAMPAIGN STRUCTURE DIAGRAM ── */}
      <CampaignStructureDiagram />

      {/* ── THE IMPACT ── */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold text-center">
            The Impact
          </h2>
          <div className="space-y-6 text-lg md:text-xl text-zinc-300 leading-relaxed text-center">
            <p>
              Organizers see how far their message travels — across cities, states, 
              and borders — without ever knowing <em>who</em> carried it.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 pt-8">
            <div className="flex flex-col items-center text-center space-y-2">
              <MapPin className="w-8 h-8 text-zinc-500" />
              <p className="text-2xl font-bold">Geographic Reach</p>
              <p className="text-sm text-zinc-500">See where your message lands on a live map</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <Share2 className="w-8 h-8 text-zinc-500" />
              <p className="text-2xl font-bold">Chain Depth</p>
              <p className="text-sm text-zinc-500">Measure how many times a message gets re-shared</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <Users className="w-8 h-8 text-zinc-500" />
              <p className="text-2xl font-bold">Viral Coefficient</p>
              <p className="text-sm text-zinc-500">Understand which content resonates and spreads</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER / CTA ── */}
      <footer className="py-16 px-6 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto flex flex-col items-center space-y-6">
          <Shield className="w-12 h-12 text-zinc-600" />
          <p className="text-zinc-400 text-center text-lg">
            The resistance doesn't need another platform. It needs infrastructure.
          </p>
          <div className="flex gap-4 pt-4">
            <Link
              to="/auth"
              className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-4"
            >
              Organizer Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
