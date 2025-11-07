import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, FileDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const Movements = () => {
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

  const exportToPDF = () => {
    if (!movements || movements.length === 0) {
      toast.error("No hay movimientos para exportar");
      return;
    }

    const doc = new jsPDF();
    
    const img = new Image();
    img.src = logo;
    doc.addImage(img, "PNG", 170, 10, 25, 10);
    
    doc.setFontSize(18);
    doc.text("Historial de Movimientos", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generado: ${format(new Date(), "PPp", { locale: es })}`, 14, 30);

    const tableData = movements.map((movement: any) => [
      format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: es }),
      movement.products?.name || "N/A",
      movement.movement_type === "entry" ? "Entrada" : "Salida",
      movement.quantity_pieces?.toLocaleString() || "0",
      movement.profiles?.full_name || "Usuario desconocido",
    ]);

    autoTable(doc, {
      head: [["Fecha", "Producto", "Tipo", "Piezas", "Usuario"]],
      body: tableData,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 8, lineWidth: 0.1, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [0, 168, 89] },
    });

    doc.save(`movimientos_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    toast.success("PDF generado exitosamente");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Movimientos de Inventario</h1>
          <p className="text-muted-foreground">Registro completo de entradas y salidas</p>
        </div>
        <Button onClick={exportToPDF} variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
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

export default Movements;
