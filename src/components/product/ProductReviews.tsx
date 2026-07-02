import { useEffect, useState } from "react";
import { Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Review {
  id: number;
  client_name: string;
  rating: number;
  comment: string | null;
  image_url: string | null;
  created_at: string | null;
}

const ProductReviews = ({ productId }: { productId: number }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = async () => {
    const { data } = await (supabase as any)
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setReviews((data || []) as Review[]);
  };

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) {
      toast({ title: "Champs requis", description: "Nom et avis obligatoires.", variant: "destructive" });
      return;
    }
    if (rating < 1) {
      toast({ title: "Note requise", description: "Choisissez une note entre 1 et 5 étoiles.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `reviews/${productId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("images").upload(path, imageFile, { upsert: true });
        if (upErr) {
          console.warn("Review image upload failed:", upErr.message);
          toast({
            title: "Photo non envoyée",
            description: "Votre avis sera publié sans photo.",
          });
        } else {
          const { data: pub } = supabase.storage.from("images").getPublicUrl(path);
          imageUrl = pub.publicUrl;
        }
      }

      const { error } = await (supabase as any).from("product_reviews").insert({
        product_id: productId,
        client_name: name.trim(),
        rating,
        comment: comment.trim(),
        image_url: imageUrl,
      });
      if (error) throw error;

      toast({ title: "Merci!", description: "Votre avis a été publié." });
      setName("");
      setComment("");
      setRating(0);
      setImageFile(null);
      loadReviews();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : err instanceof Error
            ? err.message
            : "Impossible d'envoyer l'avis";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="font-display text-2xl font-bold uppercase">Avis clients</h2>
      <p className="mt-1 text-sm text-muted-foreground">Sans compte — partagez votre expérience.</p>

      <form onSubmit={submitReview} className="mt-6 vsm-card space-y-4 p-5">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" required />
        <div>
          <p className="mb-2 text-sm font-medium">Note</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} étoiles`}>
                <Star className={`h-6 w-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          {rating === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Cliquez pour noter (1 à 5 étoiles)</p>
          )}
        </div>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Votre avis" rows={4} required />
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4" /> Photo (optionnel)
          </label>
          <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        </div>
        <Button type="submit" disabled={submitting}>{submitting ? "Envoi…" : "Publier mon avis"}</Button>
      </form>

      <div className="mt-8 space-y-4">
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Soyez le premier à laisser un avis.</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="vsm-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{r.client_name}</p>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  ))}
                </div>
              </div>
              {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
              {r.image_url && (
                <img src={r.image_url} alt="Avis client" className="mt-3 max-h-48 rounded-sm object-cover" />
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default ProductReviews;
