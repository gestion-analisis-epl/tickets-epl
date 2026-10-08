import { PreCierreLista } from "@/components/pre-cierre/pre-cierre-lista";

export default function PreCierrePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="page-rule text-3xl font-semibold">Pre-Cierre</h1>
      <PreCierreLista />
    </div>
  );
}
