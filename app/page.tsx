import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Sparkles, Video, Download } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-secondary/50 text-sm text-muted-foreground mb-8">
          <Sparkles className="w-4 h-4 text-primary" />
          AI-Powered Cinematic Footage
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto">
          Generate Cinematic B-Roll from{" "}
          <span className="text-primary">Any Location</span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
          Transform any city or landmark into stunning cinematic footage.
          Powered by AI image enhancement and video generation.
        </p>

        <div className="flex items-center justify-center gap-4">
          <a href="/new">
            <Button size="lg" className="gap-2">
              Start Creating
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <a href="/gallery">
            <Button variant="outline" size="lg">
              View Gallery
            </Button>
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-24">
          <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Choose Location</h3>
              <p className="text-muted-foreground text-sm">
                Search for any city, town, or landmark worldwide
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. Set Direction</h3>
              <p className="text-muted-foreground text-sm">
                Describe your creative vision - cinematic, aerial, golden hour
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. AI Generation</h3>
              <p className="text-muted-foreground text-sm">
                Our pipeline enhances imagery and generates video clips
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">4. Download</h3>
              <p className="text-muted-foreground text-sm">
                Get your cinematic b-roll clips ready to use
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border">
        <div className="container mx-auto px-4 py-24 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Create Your First Project?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Start generating cinematic b-roll footage in minutes.
            No stock footage libraries, no expensive shoots.
          </p>
          <a href="/new">
            <Button size="lg" className="gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
}
