import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MessageTravelDiagram,
  CampaignAnatomyDiagram,
  PrivacyDiagram,
} from "@/components/explainer/ExplainerDiagrams";

/**
 * Public explainer at /explainer.
 * Written for curious readers and prospective volunteers — no jargon.
 * The "Download PDF" button uses window.print(), which renders the
 * same page via the print stylesheet defined at the bottom of this file.
 */

const sections = [
  { id: "why", num: "1", title: "Why this exists" },
  { id: "experience", num: "2", title: "What it feels like to receive one" },
  { id: "organizer", num: "3", title: "How an organizer uses it" },
  { id: "privacy", num: "4", title: "Privacy and trust" },
  { id: "glossary", num: "5", title: "A small glossary" },
  { id: "more", num: "6", title: "Want to know more?" },
];

const Explainer = () => {
  const handleDownload = () => window.print();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/landing" className="text-sm text-muted-foreground hover:text-foreground">
            ← Omega
          </Link>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Printer className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 lg:py-16 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
        {/* Sticky TOC */}
        <aside className="hidden lg:block print:hidden">
          <nav className="sticky top-8 text-sm space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Contents
            </p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-muted-foreground hover:text-foreground transition-colors leading-snug"
              >
                <span className="text-foreground/40 mr-2">{s.num}.</span>
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Body */}
        <article className="prose-explainer max-w-2xl">
          <header className="mb-12">
            <h1 className="text-4xl lg:text-5xl font-serif font-medium tracking-tight">
              What is Samizdat?
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              A short, plain-language guide to what this project is, what it
              feels like to use, and why it can be trusted.
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70 italic">
              Reading time: about 6 minutes.
            </p>
          </header>

          {/* Mobile TOC */}
          <nav className="lg:hidden mb-12 p-4 rounded-lg border border-border bg-card/30 print:hidden">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Contents
            </p>
            <ol className="text-sm space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">
                    {s.num}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* 1. Why */}
          <section id="why" className="mb-16">
            <h2 className="section-heading">
              <span className="text-muted-foreground mr-3">1.</span>Why this exists
            </h2>
            <p>
              In the Soviet Union, people who wanted to share banned ideas
              couldn't print them. They couldn't broadcast them. So they did
              something stubborn and human: they copied texts by hand or on home
              typewriters, and passed them from one trusted person to the next.
              The Russian word for it is <em>samizdat</em> — literally,{" "}
              <em>self-published</em>.
            </p>
            <p>
              It worked because every copy was handed over by someone you knew.
              The trust was built into the act of giving. There were no servers,
              no accounts, no ads. Nobody was watching.
            </p>
            <p>
              But samizdat had a blind spot. The person who started a chain had
              no way of knowing whether the message had actually traveled —
              whether it had reached one more person, or a hundred, or had
              quietly stopped on someone's shelf.
            </p>
            <p>
              This project keeps the trust of samizdat and adds the one thing it
              never had: a quiet, anonymous way to see that the message is
              spreading.
            </p>
          </section>

          {/* 2. Experience */}
          <section id="experience" className="mb-16">
            <h2 className="section-heading">
              <span className="text-muted-foreground mr-3">2.</span>
              What it feels like to receive one
            </h2>
            <p>
              Imagine someone hands you a small card at a community meeting. On
              the card is a short message and a QR code.
            </p>
            <p>
              You point your phone at the code. A page opens — no app to
              download, no account to create. You see a few short slides: a
              photo, a question, a short video. You tap something that catches
              your eye. You watch. Maybe you answer a quick question at the end.
            </p>

            <figure className="my-8 p-6 rounded-lg border border-border bg-card/30">
              <MessageTravelDiagram />
              <figcaption className="mt-3 text-xs text-center text-muted-foreground">
                A card is scanned by one person, who shares it with two more.
              </figcaption>
            </figure>

            <p>
              Then a button: <em>share this with someone you trust.</em> You
              pick a friend. You text them the link. They open it on their
              phone, the same way you did.
            </p>
            <p>
              That's the whole experience. A card, a scan, a short story on your
              phone, and a choice about whether to pass it on.
            </p>
            <p className="font-medium">What you never had to do:</p>
            <ul>
              <li>Sign up for anything.</li>
              <li>Download an app.</li>
              <li>Give your name, your email, or your phone number.</li>
              <li>Create a password.</li>
            </ul>
            <p>
              You're not a user. You're a person who was handed a card and chose
              to look.
            </p>
          </section>

          {/* 3. Organizer */}
          <section id="organizer" className="mb-16">
            <h2 className="section-heading">
              <span className="text-muted-foreground mr-3">3.</span>
              How an organizer uses it
            </h2>
            <p>
              Behind the scenes, someone — an organizer, a chapter lead, a
              volunteer captain — is the one who printed and handed out those
              cards. Here's what that looks like for them.
            </p>
            <p>An organizer's work has four nested pieces:</p>
            <ul>
              <li>
                A <strong>campaign</strong> is the whole effort — for example, a
                get-out-the-vote push, or a public-health message.
              </li>
              <li>
                A campaign is made up of <strong>chapters</strong>, one per
                city or region or local group.
              </li>
              <li>
                Each chapter runs <strong>actions</strong> — a tabling event, a
                canvass, a community meeting.
              </li>
              <li>
                At each action, the organizer hands out{" "}
                <strong>cards and links</strong> — the physical objects and
                short URLs that carry the message into the world.
              </li>
            </ul>

            <figure className="my-8 p-6 rounded-lg border border-border bg-card/30">
              <CampaignAnatomyDiagram />
              <figcaption className="mt-3 text-xs text-center text-muted-foreground">
                The four nested pieces of an organizer's work.
              </figcaption>
            </figure>

            <p>The work is mostly three steps:</p>
            <ol>
              <li>
                <strong>Build a short deck.</strong> A handful of slides —
                pictures, a video, a question. The kind of thing someone can
                finish on a phone in under a minute.
              </li>
              <li>
                <strong>Mint the cards and links.</strong> Each chapter and
                each action gets its own batch, so the organizer can later tell
                which card, handed out at which event, started which chain of
                shares.
              </li>
              <li>
                <strong>Watch the map fill in.</strong> As people scan and
                share, dots appear on a map of the country. The organizer can
                see, roughly, where the message has reached — not who reached
                it, just where.
              </li>
            </ol>
            <p>
              What the organizer sees is deliberately simple: a map, a short
              written story of how the message has traveled so far ("the
              fastest share happened 14 minutes after the card was handed
              out"), and a few honest counts. No dashboard full of charts to
              interpret. No personal data about anyone.
            </p>
          </section>

          {/* 4. Privacy */}
          <section id="privacy" className="mb-16">
            <h2 className="section-heading">
              <span className="text-muted-foreground mr-3">4.</span>
              Privacy and trust
            </h2>
            <p>
              This is the part that matters most, so it's worth being plain
              about.
            </p>
            <p className="font-medium">
              What we never collect from someone who scans a card:
            </p>
            <ul>
              <li>Their name.</li>
              <li>Their email address.</li>
              <li>Their phone number.</li>
              <li>Their precise location.</li>
              <li>Anything that would let us, or anyone else, identify them.</li>
            </ul>
            <p className="font-medium">What we do see:</p>
            <ul>
              <li>
                That <em>a</em> scan happened, and roughly where (a city or
                region — accurate to about the level of a zip code, not a
                street).
              </li>
              <li>
                How a share traveled from one person to the next, as an
                anonymous chain of hops.
              </li>
              <li>
                Which channel each hop used — a text message, an email, another
                QR code.
              </li>
            </ul>

            <figure className="my-8 p-6 rounded-lg border border-border bg-card/30">
              <PrivacyDiagram />
              <figcaption className="mt-3 text-xs text-center text-muted-foreground">
                IP addresses are used once to find a rough zip code, then
                discarded.
              </figcaption>
            </figure>

            <p>
              <strong>The IP-address promise.</strong> When your phone opens the
              page, the internet briefly tells our system your IP address. We
              use it for one thing only: to figure out your approximate zip
              code. Then we delete it. We don't store it, we don't link it to
              your scan, and we don't share it.
            </p>
            <p>
              This is deliberate. The whole point of samizdat is that the
              network of trust belongs to the people in it — not to a platform,
              not to advertisers, not to anyone watching. We measure the{" "}
              <em>shape</em> of the spread, never the people doing the
              spreading.
            </p>
          </section>

          {/* 5. Glossary */}
          <section id="glossary" className="mb-16">
            <h2 className="section-heading">
              <span className="text-muted-foreground mr-3">5.</span>
              A small glossary
            </h2>
            <p>
              You may hear an organizer use these words. Here's what they mean
              in plain English.
            </p>
            <dl className="space-y-3 mt-4">
              {[
                ["Deck", "the short set of slides that opens on your phone after you scan."],
                ["Slide", "one screen in the deck. A picture, a video, a question."],
                ["Card", "the physical thing handed to you, with a QR code on it."],
                ["Chapter", "a local group within a larger campaign (usually a city or region)."],
                ["Action", "a real-world event where cards get handed out (a meeting, a canvass, a table at a fair)."],
                ["Share", "when someone forwards the link to one more person."],
                ["Trust chain", "the anonymous record of how a single card traveled, hand to hand, through a series of shares."],
                ["Hotspot", "a tappable area on a slide that opens a video, a question, or another slide."],
              ].map(([term, def]) => (
                <div key={term} className="grid grid-cols-[120px_1fr] gap-4">
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-muted-foreground">{def}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* 6. More */}
          <section id="more" className="mb-16">
            <h2 className="section-heading">
              <span className="text-muted-foreground mr-3">6.</span>
              Want to know more?
            </h2>
            <p>
              If you'd like to dig deeper, the{" "}
              <Link to="/landing" className="underline underline-offset-4">
                public landing page
              </Link>{" "}
              has more on what we're building and who we're building it for. If
              you're thinking about helping run a campaign, the easiest next
              step is to talk to whoever handed you the card — they can
              introduce you to their chapter.
            </p>
          </section>

          <footer className="mt-16 pt-6 border-t border-border text-sm text-muted-foreground">
            Last updated: June 7, 2026.
          </footer>
        </article>
      </div>

      {/* Page-scoped styles */}
      <style>{`
        .prose-explainer { line-height: 1.7; }
        .prose-explainer p { margin: 0 0 1rem; }
        .prose-explainer ul, .prose-explainer ol { margin: 0 0 1.25rem 1.5rem; }
        .prose-explainer ul { list-style: disc; }
        .prose-explainer ol { list-style: decimal; }
        .prose-explainer li { margin-bottom: 0.4rem; }
        .prose-explainer em { font-style: italic; }
        .section-heading {
          font-family: ui-serif, Georgia, serif;
          font-size: 1.875rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          margin: 0 0 1.25rem;
          scroll-margin-top: 2rem;
        }

        @media print {
          @page { size: letter; margin: 0.75in; }
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .prose-explainer { max-width: none; }
          .section-heading { page-break-after: avoid; }
          figure, ul, ol { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default Explainer;
