import { Construction } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-card bg-lime-50">
        <Construction className="h-8 w-8 text-lime-600" />
      </div>
      <h1 className="text-2xl font-semibold text-dark">{title}</h1>
      <p className="max-w-md text-center text-muted-foreground">
        {description || "This page is under construction and will be available soon."}
      </p>
    </div>
  );
}
