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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Printer, Pencil, Trash2, Filter, ArrowUpDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";

const MACHINES = [
  "ISBM 3", "ISBM 4", "ISBM 5", "ISBM 6", "ISBM 7", "ISBM 8",
  "ISBM 9", "ISBM 10", "ISBM 12", "INY 1", "INY 3", "INY 4",
  "INY 5", "INY 6", "INY 7", "INY 8", "INY 11"
];

const SCRAP_TYPES = ["SCRAP", "PLASTA", "PURGA", "PREFORMA"];

const Scrap = () => {
  const [machine, setMachine] = useState("");
  const [productId, setProductId] = useState("");
  const [scrapType, setScrapType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [filterQuantity, setFilterQuantity] = useState<"all" | "low" | "high">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newOrderProductId, setNewOrderProductId] = useState("");
  const [newOrderQuantity, setNewOrderQuantity] = useState("");
  const [newOrderMachine, setNewOrderMachine] = useState("");
  const [newOrderNotes, setNewOrderNotes] = useState("");
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
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

  const { data: todayScrap } = useQuery({
    queryKey: ["todayScrap"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("scrap_records")
        .select(`
          *,
          products (name)
        `)
        .eq("record_date", today)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: productionOrders } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products (name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const addScrap = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("scrap_records")
        .insert({
          machine_name: machine,
          product_id: productId && productId !== "none" ? productId : null,
          scrap_type: scrapType,
          quantity: parseFloat(quantity),
          user_id: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todayScrap"] });
      toast.success("Scrap registrado");
      setMachine("");
      setProductId("");
      setScrapType("");
      setQuantity("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateScrap = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("scrap_records")
        .update({
          machine_name: editingRecord.machine_name,
          product_id: editingRecord.product_id,
          scrap_type: editingRecord.scrap_type,
          quantity: parseFloat(editingRecord.quantity),
        })
        .eq("id", editingRecord.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todayScrap"] });
      toast.success("Registro actualizado");
      setIsEditDialogOpen(false);
      setEditingRecord(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteScrap = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scrap_records")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todayScrap"] });
      toast.success("Registro eliminado");
    },
    onError: (error: any) => {
      toast.error(error.message);
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
      toast.success("Orden creada");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine || !scrapType || !quantity) {
      toast.error("Completa máquina, tipo de scrap y cantidad");
      return;
    }
    addScrap.mutate();
  };

  const handleEdit = (record: any) => {
    setEditingRecord({...record});
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Eliminar este registro?")) {
      deleteScrap.mutate(id);
    }
  };

  const exportScrapToPDF = () => {
    const doc = new jsPDF();
    
    const img = new Image();
    img.src = logo;
    doc.addImage(img, "PNG", 170, 10, 25, 10);
    
    doc.setFontSize(18);
    doc.text("Reporte de Scrap", 14, 20);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    const summaryData = scrapSummaryArray.map((item: any) => [
      item.machineName,
      `${item.SCRAP.toFixed(2)} KG`,
      `${item.PLASTA.toFixed(2)} KG`,
      `${item.PURGA.toFixed(2)} KG`,
      `${item.PREFORMA.toFixed(2)} KG`,
      `${item.total.toFixed(2)} KG`,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Máquina", "Scrap", "Plasta", "Purga", "Preforma", "Total"]],
      body: summaryData,
      theme: 'grid',
      styles: { lineWidth: 0.1, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [0, 168, 89] },
    });

    doc.save(`scrap_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // Calculate summary by machine and type
  const scrapSummary = todayScrap?.reduce((acc: any, record: any) => {
    const key = record.machine_name;
    if (!acc[key]) {
      acc[key] = {
        machineName: record.machine_name,
        SCRAP: 0,
        PLASTA: 0,
        PURGA: 0,
        PREFORMA: 0,
        total: 0,
      };
    }
    const qty = parseFloat(record.quantity) || 0;
    acc[key][record.scrap_type] += qty;
    acc[key].total += qty;
    return acc;
  }, {});

  const scrapSummaryArray = Object.values(scrapSummary || {});

  // Filter and sort records
  const filteredRecords = todayScrap?.filter((record: any) => {
    if (filterQuantity === "all") return true;
    const qty = parseFloat(record.quantity) || 0;
    if (filterQuantity === "low") return qty < 5;
    if (filterQuantity === "high") return qty >= 5;
    return true;
  }).sort((a: any, b: any) => {
    const qtyA = parseFloat(a.quantity) || 0;
    const qtyB = parseFloat(b.quantity) || 0;
    return sortOrder === "asc" ? qtyA - qtyB : qtyB - qtyA;
  });

  return (
    <div className="space-y-4 p-2 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Registro de Scrap</h1>
          <p className="text-sm text-muted-foreground">Seguimiento diario de scrap por máquina</p>
        </div>
        <Button onClick={exportScrapToPDF} variant="outline" size="sm">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Nuevo Registro</CardTitle>
            <CardDescription className="text-xs md:text-sm">Registra el scrap de producción</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Máquina</Label>
                <Select value={machine} onValueChange={setMachine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una máquina" />
                  </SelectTrigger>
                  <SelectContent>
                    {MACHINES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Producto (opcional)</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin producto especificado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin producto</SelectItem>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Tipo de Scrap</Label>
                <Select value={scrapType} onValueChange={setScrapType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCRAP_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Cantidad (KG)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                />
              </div>

              <Button type="submit" className="w-full" disabled={addScrap.isPending}>
                {addScrap.isPending ? "Registrando..." : "Registrar Scrap"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg md:text-xl">Órdenes en Producción</CardTitle>
                <CardDescription className="text-xs md:text-sm">Órdenes pendientes</CardDescription>
              </div>
              <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">+ Nueva</Button>
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
                          {products?.map((p) => (
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
          </CardHeader>
          <CardContent>
            {productionOrders && productionOrders.length > 0 ? (
              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {productionOrders.map((order: any) => (
                  <div key={order.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{order.products?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.machine_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cantidad: {parseFloat(order.quantity_ordered).toLocaleString()} unidades
                        </p>
                        {order.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.notes}</p>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => completeOrder.mutate(order.id)}
                        className="shrink-0"
                      >
                        Completar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No hay órdenes pendientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Resumen del Día por Máquina</CardTitle>
          <CardDescription className="text-xs md:text-sm">Total acumulado separado por máquina y tipo de scrap</CardDescription>
        </CardHeader>
        <CardContent>
          {scrapSummaryArray.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No hay registros de scrap hoy</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">Máquina</th>
                    <th className="text-right py-2 px-2 font-medium">Scrap</th>
                    <th className="text-right py-2 px-2 font-medium">Plasta</th>
                    <th className="text-right py-2 px-2 font-medium">Purga</th>
                    <th className="text-right py-2 px-2 font-medium">Preforma</th>
                    <th className="text-right py-2 px-2 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapSummaryArray.map((item: any) => (
                    <tr key={item.machineName} className="border-b">
                      <td className="py-2 px-2">{item.machineName}</td>
                      <td className="text-right py-2 px-2">{item.SCRAP.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">{item.PLASTA.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">{item.PURGA.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">{item.PREFORMA.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 font-bold">
                        <Badge variant="outline">{item.total.toFixed(2)} KG</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-lg md:text-xl">Registros de Hoy</CardTitle>
              <CardDescription className="text-xs md:text-sm">Detalle de todos los registros del día</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterQuantity} onValueChange={(v: any) => setFilterQuantity(v)}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">&lt; 5 KG</SelectItem>
                  <SelectItem value="high">≥ 5 KG</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{sortOrder === "asc" ? "Menor" : "Mayor"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredRecords && filteredRecords.length > 0 ? (
              filteredRecords.map((record: any) => (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{record.products?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.machine_name} • {record.scrap_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="shrink-0">
                      {record.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleEdit(record)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => handleDelete(record.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm">
                {filterQuantity !== "all" ? "No hay registros con ese filtro" : "No hay registros de scrap hoy"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Registro de Scrap</DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Máquina</Label>
                <Select
                  value={editingRecord.machine_name}
                  onValueChange={(v) => setEditingRecord({ ...editingRecord, machine_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MACHINES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Producto</Label>
                <Select
                  value={editingRecord.product_id}
                  onValueChange={(v) => setEditingRecord({ ...editingRecord, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Tipo de Scrap</Label>
                <Select
                  value={editingRecord.scrap_type}
                  onValueChange={(v) => setEditingRecord({ ...editingRecord, scrap_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCRAP_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Cantidad (KG)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingRecord.quantity}
                  onChange={(e) => setEditingRecord({ ...editingRecord, quantity: e.target.value })}
                />
              </div>

              <Button
                onClick={() => updateScrap.mutate()}
                className="w-full"
                disabled={updateScrap.isPending}
              >
                {updateScrap.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Scrap;