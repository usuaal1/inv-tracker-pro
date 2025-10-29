import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const History = () => {
  const { data: movements, isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select(`
          *,
          products (name),
          profiles (full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Historial de Movimientos</h1>
        <p className="text-muted-foreground">Registro completo de entradas y salidas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 100 Movimientos</CardTitle>
          <CardDescription>Historial ordenado por fecha</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : movements && movements.length > 0 ? (
            <div className="space-y-2">
              {movements.map((movement: any) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      movement.movement_type === 'entry' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {movement.movement_type === 'entry' ? (
                        <ArrowUp className="h-5 w-5" />
                      ) : (
                        <ArrowDown className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{movement.products?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {movement.profiles?.full_name || "Usuario desconocido"} • {" "}
                        {format(new Date(movement.created_at), "PPp", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={movement.movement_type === 'entry' ? 'default' : 'secondary'}>
                      {movement.movement_type === 'entry' ? '+' : '-'}
                      {movement.quantity_pieces?.toLocaleString()} piezas
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No hay movimientos registrados
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
