import { TicketDetail } from "@/components/tickets/ticket-detail";

export default async function TicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TicketDetail id={params.id} />
    </div>
  );
}
