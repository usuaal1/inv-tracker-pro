import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

  const addScrap = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("scrap_records")
        .insert({
          machine_name: machine,
          product_id: productId,
          scrap_type: scrapType,
          quantity: parseInt(quantity),
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine || !productId || !scrapType || !quantity) {
      toast.error("Completa todos los campos");
      return;
    }
    addScrap.mutate();
  };

  // Calculate daily totals by product
  const dailyTotals = todayScrap?.reduce((acc, record: any) => {
    const productName = record.products?.name || "Desconocido";
    if (!acc[productName]) {
      acc[productName] = 0;
    }
    acc[productName] += record.quantity;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Registro de Scrap</h1>
        <p className="text-muted-foreground">Seguimiento diario de scrap por máquina</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Registro</CardTitle>
            <CardDescription>Registra el scrap de producción</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Máquina</Label>
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
                <Label>Producto</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Scrap</Label>
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
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="1"
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
            <CardTitle>Resumen del Día</CardTitle>
            <CardDescription>Total acumulado por producto (hoy)</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyTotals && Object.keys(dailyTotals).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(dailyTotals).map(([productName, total]) => (
                  <div key={productName} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <span className="font-medium">{productName}</span>
                    <Badge variant="outline">{total.toLocaleString()} unidades</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay registros de scrap hoy
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registros de Hoy</CardTitle>
          <CardDescription>Detalle de todos los registros del día</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {todayScrap && todayScrap.length > 0 ? (
              todayScrap.map((record: any) => (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{record.products?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {record.machine_name} • {record.scrap_type}
                    </p>
                  </div>
                  <Badge>{record.quantity.toLocaleString()}</Badge>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay registros de scrap hoy
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Scrap;
