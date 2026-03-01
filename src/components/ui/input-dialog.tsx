import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  inputType?: "text" | "number" | "email";
  onConfirm: (value: string) => void;
  confirmText?: string;
  cancelText?: string;
  min?: number;
}

export function InputDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  defaultValue = "",
  placeholder,
  inputType = "text",
  onConfirm,
  confirmText = "Save",
  cancelText = "Cancel",
  min,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const handleConfirm = () => {
    onConfirm(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl border-muted/20 shadow-2xl bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">{title}</DialogTitle>
          {description && <DialogDescription className="font-medium">{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            {label && <Label htmlFor="dialog-input" className="text-xs font-black uppercase tracking-widest opacity-70">{label}</Label>}
            <Input
              id="dialog-input"
              type={inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="col-span-3 h-11 rounded-xl font-medium"
              autoFocus
              min={min}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">{cancelText}</Button>
          <Button onClick={handleConfirm} className="rounded-xl font-black uppercase tracking-widest px-6">{confirmText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
