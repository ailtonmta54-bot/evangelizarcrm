import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, GripVertical } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  phone: string;
  column: string;
}

const initialLeads: Lead[] = [
  { id: "1", name: "Maria Santos", phone: "(11) 99999-1234", column: "novo" },
  { id: "2", name: "Carlos Oliveira", phone: "(21) 98888-5678", column: "novo" },
  { id: "3", name: "Ana Costa", phone: "(31) 97777-9012", column: "atendimento" },
  { id: "4", name: "Pedro Lima", phone: "(41) 96666-3456", column: "proposta" },
  { id: "5", name: "Juliana Rocha", phone: "(51) 95555-7890", column: "proposta" },
  { id: "6", name: "Roberto Alves", phone: "(61) 94444-2345", column: "fechado" },
];

const columns = [
  { id: "novo", title: "Novo Lead", color: "bg-info" },
  { id: "atendimento", title: "Em Atendimento", color: "bg-warning" },
  { id: "proposta", title: "Proposta", color: "bg-primary" },
  { id: "fechado", title: "Fechado", color: "bg-success" },
];

export default function Crm() {
  const [leads, setLeads] = useState(initialLeads);
  const [dragging, setDragging] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragging(id);

  const handleDrop = (column: string) => {
    if (!dragging) return;
    setLeads((prev) =>
      prev.map((l) => (l.id === dragging ? { ...l, column } : l))
    );
    setDragging(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CRM Pipeline</h1>
        <p className="text-muted-foreground">Gerencie seus leads no funil de vendas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => l.column === col.id);
          return (
            <div
              key={col.id}
              className="bg-muted/50 rounded-lg p-3 min-h-[400px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                <h3 className="font-semibold text-sm">{col.title}</h3>
                <span className="ml-auto text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                  {colLeads.length}
                </span>
              </div>
              <div className="space-y-2">
                {colLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={() => handleDragStart(lead.id)}
                    className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{lead.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{lead.phone}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
