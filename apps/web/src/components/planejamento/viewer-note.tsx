/** Aviso para quem só vê o espaço: as ações de mudar ficam escondidas e esta frase explica por quê. */
export function ViewerNote() {
  return (
    <p role="note" className="mb-4 rounded-field bg-surface3 px-4 py-3 text-sm text-muted">
      Você só pode ver este espaço. Peça a quem o criou a permissão de editar para mudar limites, metas e categorias.
    </p>
  );
}
