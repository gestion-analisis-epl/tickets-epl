import { TicketDetail } from "@/components/tickets/ticket-detail";

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8">
      <TicketDetail id={params.id} />
    </div>
  );
}
