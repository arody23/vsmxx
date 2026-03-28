import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MultiImageUploaderProps {
  values: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  max?: number;
}

const MultiImageUploader = ({ values, onChange, folder = "products", max = 6 }: MultiImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (values.length >= max) {
      toast({ title: "Maximum atteint", description: `Max ${max} images`, variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage.from("images").upload(fileName, file);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
    onChange([...values, urlData.publicUrl]);
    setUploading(false);
  };

  const removeImage = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      <div className="grid grid-cols-3 gap-2">
        {values.map((url, i) => (
          <div key={i} className="relative group">
            <img src={url} alt="" className="h-24 w-full rounded-sm border border-border object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3 text-destructive-foreground" />
            </button>
          </div>
        ))}
        {values.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            <span className="text-[10px]">Ajouter</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MultiImageUploader;
