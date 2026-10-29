interface SeccionFormularioProps {
  id: string;
  numero: number;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}

export function SeccionFormulario({ id, numero, titulo, descripcion, children }: SeccionFormularioProps) {
  return (
    <section id={id} className="section-card p-5 sm:p-6 scroll-mt-36">
      <header className="mb-5">
        <h2 className="section-title"><span className="text-accent mr-2 tabular-nums">{numero}</span>{titulo}</h2>
        {descripcion && <p className="text-sm text-muted mt-1">{descripcion}</p>}
      </header>
      {children}
    </section>
  );
}
