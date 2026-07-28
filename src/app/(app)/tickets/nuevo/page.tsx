import { NuevoTicketForm } from "@/components/tickets/nuevo-ticket-form";

export default function NuevoTicketPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo ticket</h1>
        <p className="text-sm mt-1 opacity-70">
          Solo necesitas llenar los datos de tu solicitud — Mesa de Control y el abogado asignado
          se encargan del resto.
        </p>
      </div>
      <NuevoTicketForm />
    </div>
  );
}
