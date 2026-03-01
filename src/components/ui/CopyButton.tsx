import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'ghost' | 'outline' | 'secondary';
}

export function CopyButton({
  value,
  label,
  className,
  iconOnly = true,
  size = 'icon',
  variant = 'ghost',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label || 'Value'} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        "transition-all shrink-0",
        size === 'icon' && "h-6 w-6",
        size === 'sm' && "h-7 px-2 text-[10px] font-black uppercase tracking-wider gap-1",
        className
      )}
      onClick={handleCopy}
      title={`Copy ${label || value}`}
      data-no-click="true"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {!iconOnly && <span>{label || 'Copy'}</span>}
    </Button>
  );
}
