import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Package, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  link: string;
}

const initialProducts: Product[] = [
  { id: "1", name: "Plano Starter", description: "Ideal para pequenas empresas. Até 500 contatos.", price: "R$ 97,00", link: "https://exemplo.com/starter" },
  { id: "2", name: "Plano Pro", description: "Para empresas em crescimento. Até 5.000 contatos.", price: "R$ 197,00", link: "https://exemplo.com/pro" },
  { id: "3", name: "Plano Enterprise", description: "Sem limites. Suporte dedicado.", price: "R$ 497,00", link: "https://exemplo.com/enterprise" },
];

export default function Produtos() {
  const [products, setProducts] = useState(initialProducts);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");

  const handleCreate = () => {
    if (!name || !price) return;
    setProducts((prev) => [...prev, { id: Date.now().toString(), name, description, price, link }]);
    setName(""); setDescription(""); setPrice(""); setLink("");
    setOpen(false);
    toast.success("Produto cadastrado!");
  };

  const handleDelete = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Produto removido");
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seus produtos e serviços</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar produto</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Preço</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R$ 0,00" />
              </div>
              <div className="space-y-2">
                <Label>Link externo</Label>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
              </div>
              <Button onClick={handleCreate} className="w-full">Cadastrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((prod) => (
          <Card key={prod.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(prod.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <h3 className="font-semibold">{prod.name}</h3>
              <p className="text-sm text-muted-foreground">{prod.description}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-lg font-bold text-primary">{prod.price}</span>
                {prod.link && (
                  <a href={prod.link} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Link
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
