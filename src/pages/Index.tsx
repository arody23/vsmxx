import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSlider from "@/components/HeroSlider";
import BestSellers from "@/components/BestSellers";
import BrandValues from "@/components/BrandValues";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

const REF_STORAGE_KEY = "vsm_ref";

const Index = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;

    // Track the click for this ambassador link
    (async () => {
      const { data: link } = await supabase
        .from("ambassador_links")
        .select("id")
        .eq("slug", ref.toUpperCase())
        .eq("active", true)
        .maybeSingle();

      if (link) {
        // Persist referral to be attached at checkout
        localStorage.setItem(
          REF_STORAGE_KEY,
          JSON.stringify({ linkId: link.id, slug: ref.toUpperCase(), ts: Date.now() })
        );

        await supabase.from("ambassador_clicks").insert({
          link_id: link.id,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent || null,
        });
      }
    })();
  }, [searchParams]);

  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSlider />
      <BestSellers />
      <BrandValues />
      <Footer />
    </main>
  );
};

export default Index;
