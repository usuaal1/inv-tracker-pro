import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MACHINES = [
  "ISBM 3", "ISBM 4", "ISBM 5", "ISBM 6", "ISBM 7", "ISBM 8",
  "ISBM 9", "ISBM 10", "ISBM 12", "INY 1", "INY 3", "INY 4",
  "INY 5", "INY 6", "INY 7", "INY 8", "INY 11"
];

const ProductionOrders = () => {
  const [newOrderProductId, setNewOrderProductId] = useState("");
  const [newOrderQuantity, setNewOrderQuantity] = useState("");
  const [newOrderMachine, setNewOrderMachine] = useState("");
  const [newOrderNotes, setNewOrderNotes] = useState("");
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("pending");
  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: allOrders } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products (name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const addProductionOrder = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("production_orders")
        .insert({
          product_id: newOrderProductId,
          quantity_ordered: parseFloat(newOrderQuantity),
          machine_name: newOrderMachine,
          notes: newOrderNotes || null,
          user_id: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
      toast.success("Orden creada exitosamente");
      setNewOrderProductId("");
      setNewOrderQuantity("");
      setNewOrderMachine("");
      setNewOrderNotes("");
      setIsOrderDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const completeOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("production_orders")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
      toast.success("Orden completada");
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("production_orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
      toast.success("Orden eliminada");
    },
  });

  const filteredOrders = allOrders?.filter(order => {
    if (filterStatus === "all") return true;
    return order.status === filterStatus;
  });

  const pendingCount = allOrders?.filter(o => o.status === "pending").length || 0;
  const completedCount = allOrders?.filter(o => o.status === "completed").length || 0;

  return (
    <div className="space-y-4 p-2 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Órdenes de Producción</h1>
          <p className="text-sm text-muted-foreground">Gestiona las órdenes de producción</p>
        </div>
        <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Orden
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva Orden de Producción</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Producto</Label>
                <Select value={newOrderProductId} onValueChange={setNewOrderProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Cantidad</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newOrderQuantity}
                  onChange={(e) => setNewOrderQuantity(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Máquina</Label>
                <Select value={newOrderMachine} onValueChange={setNewOrderMachine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona máquina" />
                  </SelectTrigger>
                  <SelectContent>
                    {MACHINES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Notas (opcional)</Label>
                <Textarea
                  value={newOrderNotes}
                  onChange={(e) => setNewOrderNotes(e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={3}
                />
              </div>
              <Button 
                onClick={() => addProductionOrder.mutate()} 
                className="w-full"
                disabled={!newOrderProductId || !newOrderQuantity || !newOrderMachine}
              >
                Crear Orden
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{allOrders?.length || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-orange-500">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completadas</p>
                <p className="text-2xl font-bold text-green-500">{completedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-lg md:text-xl">Listado de Órdenes</CardTitle>
              <CardDescription className="text-xs md:text-sm">Todas las órdenes de producción</CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="completed">Completadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders && filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredOrders.map((order: any) => (
                <div key={order.id} className="border rounded-lg p-3 md:p-4 hover:bg-accent">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm md:text-base truncate">{order.products?.name}</p>
                        <Badge variant={order.status === "pending" ? "default" : "secondary"} className="shrink-0">
                          {order.status === "pending" ? "Pendiente" : "Completada"}
                        </Badge>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {order.machine_name}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        Cantidad: {parseFloat(order.quantity_ordered).toLocaleString()} unidades
                      </p>
                      {order.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Creada: {format(new Date(order.created_at), "PPp", { locale: es })}
                      </p>
                      {order.completed_at && (
                        <p className="text-xs text-muted-foreground">
                          Completada: {format(new Date(order.completed_at), "PPp", { locale: es })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {order.status === "pending" && (
                        <Button 
                          size="sm" 
                          onClick={() => completeOrder.mutate(order.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Completar
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          if (confirm("¿Eliminar esta orden?")) {
                            deleteOrder.mutate(order.id);
                          }
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {filterStatus === "all" ? "No hay órdenes registradas" : `No hay órdenes ${filterStatus === "pending" ? "pendientes" : "completadas"}`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionOrders;