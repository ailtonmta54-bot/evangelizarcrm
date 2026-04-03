import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const conversations = [
  { id: 1, name: "Maria Santos", lastMessage: "Olá, gostaria de saber mais sobre o produto", time: "10:30", unread: 2 },
  { id: 2, name: "Carlos Oliveira", lastMessage: "Obrigado pelo retorno!", time: "09:15", unread: 0 },
  { id: 3, name: "Ana Costa", lastMessage: "Qual o valor do plano premium?", time: "Ontem", unread: 1 },
  { id: 4, name: "Pedro Lima", lastMessage: "Vou pensar e retorno amanhã", time: "Ontem", unread: 0 },
  { id: 5, name: "Juliana Rocha", lastMessage: "Perfeito, vamos fechar!", time: "Seg", unread: 0 },
];

const messages = [
  { id: 1, text: "Olá, gostaria de saber mais sobre o produto", sent: false, time: "10:28" },
  { id: 2, text: "Olá Maria! Claro, temos várias opções disponíveis.", sent: true, time: "10:29" },
  { id: 3, text: "Qual plano você recomenda para uma empresa pequena?", sent: false, time: "10:30" },
  { id: 4, text: "Para empresas pequenas, recomendo o plano Starter. Inclui até 500 contatos e integração com WhatsApp.", sent: true, time: "10:31" },
];

export default function Inbox() {
  const [selected, setSelected] = useState(conversations[0]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col bg-card shrink-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto scrollbar-thin">
          {filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelected(conv)}
              className={cn(
                "w-full flex items-start gap-3 p-3 text-left hover:bg-accent transition-colors",
                selected.id === conv.id && "bg-accent"
              )}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                {conv.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-sm truncate">{conv.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{conv.time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
              </div>
              {conv.unread > 0 && (
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                  {conv.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b flex items-center px-4 gap-3 bg-card shrink-0">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
            {selected.name.charAt(0)}
          </div>
          <span className="font-medium">{selected.name}</span>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 scrollbar-thin">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.sent ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-2 text-sm",
                  msg.sent
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                )}
              >
                <p>{msg.text}</p>
                <span className={cn("text-[10px] mt-1 block", msg.sent ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {msg.time}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t bg-card flex gap-2">
          <Input
            placeholder="Digite uma mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setNewMessage("")}
            className="flex-1"
          />
          <Button size="icon" onClick={() => setNewMessage("")}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
