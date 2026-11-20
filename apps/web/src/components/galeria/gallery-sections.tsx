"use client";

import type { Cents } from "@juntos/core";
import { Bell, Download, FileUp, House, Plus, Search, Settings, Trash2, Upload } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { DailyBalance } from "@/components/charts/daily-balance";
import { Donut } from "@/components/charts/donut";
import { FlowBar } from "@/components/charts/flow-bar";
import { MonthBars } from "@/components/charts/month-bars";
import { Amount } from "@/components/ui/amount";
import { Avatar, type AvatarKey, AvatarPicker } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CommandPalette } from "@/components/ui/command-palette";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CountBadge } from "@/components/ui/count-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { MoneyInput } from "@/components/ui/money-input";
import { type MonthPeriod, MonthPicker } from "@/components/ui/month-picker";
import { Progress } from "@/components/ui/progress";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import { DEMO_BARS, DEMO_PARTS, DEMO_YM, demoDailyPoints } from "./gallery-home";

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 scroll-mt-24">
      <h2 id={id} className="mb-4 text-xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line py-4 first:border-t-0 first:pt-0 lg:flex-row lg:items-center lg:gap-6">
      <p className="w-40 shrink-0 text-sm text-muted">{label}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function ControlsSection() {
  const [chip, setChip] = useState("todos");
  const [kind, setKind] = useState<"out" | "in" | "save">("out");
  const [on, setOn] = useState(true);
  return (
    <Section id="g-controles" title="Botões e controles">
      <Card>
        <Row label="Botões">
          <Button icon={<Plus />}>Novo lançamento</Button>
          <Button variant="line">Exportar</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="quiet">Fantasma</Button>
          <Button variant="danger" icon={<Trash2 />}>
            Excluir
          </Button>
          <Button variant="link">Ver todos</Button>
          <Button disabled>Desabilitado</Button>
        </Row>
        <Row label="Tamanhos">
          <Button size="sm">Pequeno</Button>
          <Button>Médio</Button>
          <Button size="lg">Grande</Button>
          <Button block className="lg:w-64">
            Bloco
          </Button>
        </Row>
        <Row label="Ícone e contador">
          <IconButton label="Buscar" icon={<Search />} />
          <IconButton label="Avisos" icon={<Bell />} count={3} />
          <IconButton label="Ajustes" icon={<Settings />} size="sm" />
          <span className="inline-flex items-center gap-2">
            Notificações <CountBadge count={12} />
          </span>
          <CountBadge count={140} />
        </Row>
        <Row label="Chips">
          {[
            ["todos", "Todos"],
            ["aberto", "Em aberto"],
            ["in", "Entradas"],
            ["out", "Saídas"],
            ["save", "Guardado"],
          ].map(([v, l]) => (
            <Chip key={v} selected={chip === v} onClick={() => setChip(v as string)}>
              {l}
            </Chip>
          ))}
        </Row>
        <Row label="Etiquetas">
          <Tag kind="late" />
          <Tag kind="installment" current={5} total={54} />
          <Tag kind="annual" />
          <Tag kind="personal" />
          <Tag kind="ok">Pago</Tag>
          <Tag kind="new">Novo</Tag>
        </Row>
        <Row label="Segmentado">
          <Segmented
            label="Tipo do lançamento"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "out", label: "Saída" },
              { value: "in", label: "Entrada" },
              { value: "save", label: "Guardado" },
            ]}
            className="w-full lg:w-80"
          />
        </Row>
        <Row label="Interruptor">
          <Switch
            checked={on}
            onCheckedChange={setOn}
            label="Contas atrasadas"
            description="Avisa no dia seguinte ao vencimento"
            className="w-full lg:w-96"
          />
        </Row>
        <Row label="Teclas">
          <Kbd>Ctrl K</Kbd>
          <Kbd>N</Kbd>
          <Kbd>/</Kbd>
          <Kbd>Esc</Kbd>
        </Row>
      </Card>
    </Section>
  );
}

export function FormsSection() {
  const [value, setValue] = useState<Cents | null>(8600);
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const nameError = submitted && name.trim() === "" ? "Escreva uma descrição, por exemplo: Mercado." : null;
  const valueError = submitted && (value === null || value <= 0) ? "Informe um valor maior que zero." : null;
  return (
    <Section id="g-forms" title="Formulários">
      <Card>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="grid gap-5 lg:grid-cols-2"
        >
          <Field label="Valor" error={valueError} required className="lg:col-span-2">
            <MoneyInput size="lg" value={value} onValueChange={setValue} />
          </Field>
          <Field label="Descrição" error={nameError} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Mercado do mês" />
          </Field>
          <Field label="Categoria" hint="Sugerida pelo nome; dá para trocar.">
            <Select
              defaultValue="mercado"
              options={[
                { value: "mercado", label: "Mercado" },
                { value: "moradia", label: "Moradia" },
                { value: "transporte", label: "Transporte" },
              ]}
            />
          </Field>
          <Field label="Valor pequeno">
            <MoneyInput value={null} onValueChange={() => undefined} placeholder="0,00" />
          </Field>
          <Field label="Desabilitado">
            <Input disabled defaultValue="Só quem edita pode mudar" />
          </Field>
          <Field label="Observação" className="lg:col-span-2">
            <Textarea placeholder="Opcional" />
          </Field>
          <div className="flex gap-2 lg:col-span-2">
            <Button type="submit">Salvar lançamento</Button>
            <Button variant="ghost" onClick={() => setSubmitted(false)}>
              Limpar erros
            </Button>
          </div>
        </form>
      </Card>
    </Section>
  );
}

export function DataSection() {
  return (
    <Section id="g-dados" title="Cards, números e progresso">
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card>
          <Stat label="Sobrou" value="R$ 4.265,00" hint="5% acima de outubro" size="lg" />
        </Card>
        <Card>
          <Stat label="Guardado ou livre" value="29%" hint="Do que entrou no mês" money={false} size="lg" />
        </Card>
        <Card>
          <Stat label="Passou do limite" value="R$ 492,00" tone="out" hint="Cartões" size="lg" />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Valores" description="Sinal e cor juntos; a cor nunca é o único sinal." />
          <ul className="flex flex-col gap-2">
            <li className="flex justify-between">
              Salário <Amount cents={520000} kind="in" />
            </li>
            <li className="flex justify-between">
              Mercado do mês <Amount cents={57000} kind="out" />
            </li>
            <li className="flex justify-between">
              Reserva de emergência <Amount cents={40000} kind="save" />
            </li>
            <li className="flex justify-between">
              Saldo negativo <Amount cents={-12050} />
            </li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Progresso" />
          <div className="flex flex-col gap-4">
            <Progress value={40} max={100} label="Meta, 40%" />
            <Progress value={88} max={100} tone="auto" label="Mercado, 88% do limite" />
            <Progress value={112} max={100} tone="auto" label="Cartões, 112% do limite" />
            <Progress value={30} max={100} tone="auto" size="sm" label="Transporte, 30% do limite" />
          </div>
        </Card>
      </div>
    </Section>
  );
}

export function StatesSection() {
  return (
    <Section id="g-estados" title="Estados">
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <EmptyState
            art="start"
            title="Comece pelas contas da casa"
            description="Lance o que entra, as contas fixas ou traga a planilha que vocês já usam."
            action={
              <>
                <Button icon={<Plus />}>Novo lançamento</Button>
                <Button variant="line" icon={<Upload />}>
                  Importar planilha
                </Button>
              </>
            }
          />
        </Card>
        <Card aria-busy="true" aria-label="Carregando lançamentos">
          <p className="sr-only">Carregando…</p>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-12 w-56" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mt-5 flex items-center gap-3">
              <Skeleton className="size-11 rounded-[0.7rem]" />
              <div className="flex-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </Card>
        <Card>
          <EmptyState
            size="sm"
            art="search"
            title="Nada encontrado"
            description="Tente outro nome ou busque em todos os meses."
          />
        </Card>
        <Card>
          <EmptyState
            size="sm"
            art="goal"
            title="Nenhuma meta ainda"
            description="Crie uma meta para guardar um pouco por mês."
            action={<Button size="sm">Criar meta</Button>}
          />
        </Card>
        <Card>
          <EmptyState size="sm" art="list" title="Sem lançamentos neste mês" />
        </Card>
        <Card>
          <EmptyState size="sm" art="bell" title="Tudo em dia" description="Nenhum aviso por enquanto." />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Erro e sucesso" />
          <p role="alert" className="mb-4 rounded-field bg-out-soft p-3 text-sm font-medium text-out">
            Não foi possível salvar agora. Confira a conexão e tente de novo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="line"
              onClick={() =>
                toast("Lançamento excluído", {
                  action: { label: "Desfazer", onClick: () => toast("Lançamento restaurado") },
                })
              }
            >
              Toast com desfazer
            </Button>
            <Button variant="line" onClick={() => toast("Lançamento salvo")}>
              Toast de sucesso
            </Button>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Gráficos sem dados" />
          <div className="grid gap-6 lg:grid-cols-2">
            <EmptyState size="sm" art="chart" title="Sem saídas neste mês" />
            <FlowBar paid={0} due={0} saved={0} left={0} />
          </div>
        </Card>
      </div>
    </Section>
  );
}

export function ChartsSection() {
  return (
    <Section id="g-graficos" title="Gráficos">
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Destino do dinheiro" description="Falta pagar hachurado; sobra negativa vira Falta." />
          <FlowBar paid={641900} due={501600} saved={40000} left={426500} />
          <FlowBar paid={641900} due={801600} saved={40000} left={-150000} className="mt-6" />
        </Card>
        <Card>
          <CardHeader title="Rosca" />
          <Donut parts={DEMO_PARTS} />
        </Card>
        <Card>
          <CardHeader title="Saldo de um mês que já passou" />
          <DailyBalance points={demoDailyPoints()} todayDay={30} monthLabel="outubro" />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Barras sem seleção (Início, período)" />
          <MonthBars rows={DEMO_BARS.slice(6)} currentYm={DEMO_YM} title="Entradas e saídas de julho a dezembro" />
        </Card>
      </div>
    </Section>
  );
}

export function OverlaysSection() {
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [palette, setPalette] = useState(false);
  const [period, setPeriod] = useState<MonthPeriod>({ start: DEMO_YM, span: 1 });
  const [single, setSingle] = useState<MonthPeriod>({ start: "2026-09", span: 1 });
  const [value, setValue] = useState<Cents | null>(null);
  const noop = () => undefined;
  return (
    <Section id="g-camadas" title="Painéis, diálogos e busca">
      <Card>
        <Row label="Seletor de mês">
          <MonthPicker value={period} onChange={setPeriod} currentYm={DEMO_YM} allowRange />
        </Row>
        <Row label="Só um mês">
          <MonthPicker value={single} onChange={setSingle} currentYm={DEMO_YM} />
        </Row>
        <Row label="Camadas">
          <Button onClick={() => setSheet(true)}>Abrir formulário</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Excluir conta
          </Button>
          <Button variant="line" icon={<Search />} onClick={() => setPalette(true)}>
            Buscar
          </Button>
        </Row>
        <Row label="Abas">
          <Tabs defaultValue="orcamento" className="w-full">
            <TabsList>
              <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
              <TabsTrigger value="metas">Metas</TabsTrigger>
              <TabsTrigger value="proximos">Próximos meses</TabsTrigger>
              <TabsTrigger value="simulador">Simulador de quitação</TabsTrigger>
            </TabsList>
            <TabsContent value="orcamento">Conteúdo de Orçamento.</TabsContent>
            <TabsContent value="metas">Conteúdo de Metas.</TabsContent>
            <TabsContent value="proximos">Conteúdo de Próximos meses.</TabsContent>
            <TabsContent value="simulador">Conteúdo do Simulador.</TabsContent>
          </Tabs>
        </Row>
      </Card>
      <ResponsiveSheet
        open={sheet}
        onOpenChange={setSheet}
        title="Nova saída"
        description="Preencha o valor e a descrição."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSheet(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setSheet(false)}>Salvar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Valor">
            <MoneyInput size="lg" value={value} onValueChange={setValue} />
          </Field>
          <Field label="Descrição">
            <Input placeholder="Ex.: Mercado do mês" />
          </Field>
          <Field label="Categoria">
            <Select options={[{ value: "mercado", label: "Mercado" }]} />
          </Field>
        </div>
      </ResponsiveSheet>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title="Excluir a conta?"
        description="Seus dados serão apagados em 30 dias. Até lá, dá para voltar atrás entrando de novo."
        confirmLabel="Excluir conta"
        onConfirm={noop}
      />
      <CommandPalette
        open={palette}
        onOpenChange={setPalette}
        groups={[
          {
            heading: "Ações",
            items: [
              { id: "novo", label: "Novo lançamento", icon: <Plus />, shortcut: "N", onSelect: noop },
              { id: "importar", label: "Importar planilha", icon: <FileUp />, onSelect: noop },
              { id: "exportar", label: "Exportar", icon: <Download />, onSelect: noop },
            ],
          },
          {
            heading: "Páginas",
            items: [
              { id: "inicio", label: "Início", icon: <House />, onSelect: noop },
              { id: "ajustes", label: "Ajustes", icon: <Settings />, onSelect: noop },
            ],
          },
        ]}
      />
    </Section>
  );
}

export function AvatarsSection() {
  const [avatar, setAvatar] = useState<AvatarKey | null>("a2");
  return (
    <Section id="g-avatares" title="Avatares">
      <Card>
        <Row label="Tamanhos">
          <Avatar name="Rafa Souza" avatar="a1" size="xs" />
          <Avatar name="Rafa Souza" avatar="a1" size="sm" />
          <Avatar name="Lu" avatar="a2" size="md" />
          <Avatar name="Gato" avatar="b1" size="lg" />
          <Avatar name="Casa" avatar="c3" size="xl" />
          <Avatar name="Rafa Souza" size="lg" />
        </Row>
        <Row label="Escolher">
          <div className="flex items-center gap-4">
            <Avatar name="Lu" avatar={avatar} size="xl" />
          </div>
          <div className="min-w-0 flex-1">
            <AvatarPicker name="Lu" value={avatar} onValueChange={setAvatar} />
          </div>
        </Row>
      </Card>
    </Section>
  );
}
