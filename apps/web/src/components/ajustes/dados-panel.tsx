import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SettingRow } from "./setting-row";

/** Atalhos para o que mora em outras telas: importar e exportar planilhas, e a cópia dos dados da conta. */
export function DadosPanel() {
  return (
    <Card className="max-w-3xl">
      <SettingRow
        title="Importar e exportar"
        description="Traga a planilha do Excel (você revisa antes de confirmar) ou exporte em Excel, PDF ou CSV."
        action={
          <Button asChild size="sm">
            <Link href="/dados">Abrir</Link>
          </Button>
        }
      />
      <SettingRow
        title="Baixar meus dados"
        description="Um arquivo com tudo o que você lançou, para guardar uma cópia."
        action={
          <Button asChild variant="ghost" size="sm">
            <a href="/api/conta/exportar" download>
              Baixar
            </a>
          </Button>
        }
      />
    </Card>
  );
}
