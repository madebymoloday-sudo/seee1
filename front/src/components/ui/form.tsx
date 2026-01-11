import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {}

const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ className, ...props }, ref) => {
    return <form ref={ref} className={cn(className)} {...props} />;
  }
);
Form.displayName = "Form";

interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    );
  }
);
FormField.displayName = "FormField";

interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {}

const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("space-y-2", className)} {...props} />;
  }
);
FormItem.displayName = "FormItem";

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, ...props }, ref) => {
    return <Label ref={ref} className={className} {...props} />;
  }
);
FormLabel.displayName = "FormLabel";

interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  message?: string;
}

const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, message, ...props }, ref) => {
    if (!message) {
      return null;
    }

    return (
      <p
        ref={ref}
        className={cn("text-sm font-medium", className || "text-destructive")}
        {...props}
      >
        {message}
      </p>
    );
  }
);
FormMessage.displayName = "FormMessage";

interface FormDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  FormDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
};

