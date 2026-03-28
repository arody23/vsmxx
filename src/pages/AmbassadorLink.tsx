import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const REF_STORAGE_KEY = "vsm_ref";

const AmbassadorLink = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    const ref = (slug || "").trim().toUpperCase();
    if (!ref) {
      navigate("/", { replace: true });
      return;
    }

    (async () => {
      const { data: link } = await supabase
        .from("ambassador_links")
        .select("id")
        .eq("slug", ref)
        .eq("active", true)
        .maybeSingle();

      if (link) {
        localStorage.setItem(
          REF_STORAGE_KEY,
          JSON.stringify({ linkId: link.id, slug: ref, ts: Date.now() })
        );

        await supabase.from("ambassador_clicks").insert({
          link_id: link.id,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent || null,
        });
      }

      // Keep existing behaviour: homepage can also read ?ref=
      navigate(`/?ref=${encodeURIComponent(ref)}`, { replace: true });
    })();
  }, [navigate, slug]);

  return null;
};

export default AmbassadorLink;

