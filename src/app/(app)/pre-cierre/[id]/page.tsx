import { PreCierreDetalle } from "@/components/pre-cierre/pre-cierre-detalle";

export default function PreCierreDetallePage({ params }: { params: { id: string } }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PreCierreDetalle id={params.id} />
    </div>
  );
}
