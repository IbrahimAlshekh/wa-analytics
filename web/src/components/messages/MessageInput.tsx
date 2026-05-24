import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MessageInputProps {
  onSend: (text: string, file?: File) => void;
  disabled: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) return;
    onSend(text, file || undefined);
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <form className="flex items-end gap-2" onSubmit={handleSubmit}>
      <div className="flex-1 flex flex-col gap-1.5">
        {file && (
          <div className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs">
            <span className="flex-1 truncate">📎 {file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <Input
          placeholder={t("messages.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title={t("messages.attachFile")}
      >
        <Paperclip className="size-4" />
      </Button>
      <Button
        type="submit"
        size="icon"
        className="size-9"
        disabled={disabled || (!text.trim() && !file)}
      >
        <Send className="size-4" />
      </Button>
    </form>
  );
}
