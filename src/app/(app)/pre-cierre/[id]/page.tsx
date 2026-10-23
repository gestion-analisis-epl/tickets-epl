import { PreCierreDetalle } from "@/components/pre-cierre/pre-cierre-detalle";

export default async function PreCierreDetallePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PreCierreDetalle id={params.id} />
    </div>
  );
}
