import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  className?: string;
}

const ImageUploader = ({ value, onChange, folder = "products", className }: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Erreur", description: "Seules les images sont acceptées", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erreur", description: "L'image ne doit pas dépasser 5 Mo", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage.from("images").upload(fileName, file);
    if (error) {
      toast({ title: "Erreur d'upload", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
    onChange(urlData.publicUrl);
    setUploading(false);
    toast({ title: "Image uploadée" });
  };

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      
      {value ? (
        <div className="relative group">
          <img src={value} alt="Preview" className="h-32 w-full rounded-sm border border-border object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-sm bg-background/80 opacity-0 transition-opacity group-hover:opacity-100">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onChange("")}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-border bg-secondary/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Cliquez pour uploader</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default ImageUploader;
