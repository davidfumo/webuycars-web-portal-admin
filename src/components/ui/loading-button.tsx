"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LoadingButtonProps = ButtonProps & {
  loading?: boolean;
};

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ className, loading, disabled, children, ...props }, ref) => (
    <Button
      ref={ref}
      className={cn(loading && "cursor-wait", className)}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  ),
);
LoadingButton.displayName = "LoadingButton";

export { LoadingButton };
