import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

const History = () => {
  const { data: scrapRecords, isLoading } = useQuery({
    queryKey: ["scrap-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrap_records")
        .select(`
          *,
          products (name)
        `)
        .order("record_date", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  const exportToPDF = () => {
    if (!scrapRecords || scrapRecords.length === 0) {
      toast.error("No hay registros de scrap para exportar");
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Historial de Scrap", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generado: ${format(new Date(), "PPp", { locale: es })}`, 14, 30);

    const tableData = scrapRecords.map((record: any) => [
      format(new Date(record.record_date), "dd/MM/yyyy", { locale: es }),
      record.products?.name || "N/A",
      record.machine_name,
      record.scrap_type,
      `${record.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG`,
    ]);

    autoTable(doc, {
      head: [["Fecha", "Producto", "Máquina", "Tipo", "Cantidad"]],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] },
    });

    doc.save(`scrap_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    toast.success("PDF generado exitosamente");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Historial de Scrap</h1>
          <p className="text-muted-foreground">Registro completo de scrap por máquina</p>
        </div>
        <Button onClick={exportToPDF} variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 100 Registros</CardTitle>
          <CardDescription>Historial ordenado por fecha</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : scrapRecords && scrapRecords.length > 0 ? (
            <div className="space-y-2">
              {scrapRecords.map((record: any) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{record.products?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {record.machine_name} • {format(new Date(record.record_date), "PPP", { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{record.scrap_type}</Badge>
                    <Badge variant="destructive">{record.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No hay registros de scrap
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
