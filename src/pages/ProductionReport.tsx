import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileDown, Plus, Trash2, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import logo from "@/assets/logo.png";

interface ProductionReport {
  id: string;
  shift_number: number;
  report_date: string;
  machine_name: string;
  product_name: string | null;
  cycle_time: string | null;
  production_goal: number;
  production_achieved: number;
  notes: string | null;
}

interface Machine {
  id: string;
  name: string;
  status: string;
  current_product_id: string | null;
  products?: {
    name: string;
  };
}

// Helper function to sort machines numerically
const sortMachines = (machines: Machine[]) => {
  return machines.sort((a, b) => {
    const aMatch = a.name.match(/(\D+)(\d+)/);
    const bMatch = b.name.match(/(\D+)(\d+)/);
    
    if (!aMatch || !bMatch) return a.name.localeCompare(b.name);
    
    const [, aPrefix, aNum] = aMatch;
    const [, bPrefix, bNum] = bMatch;
    
    // First sort by prefix (ISBM vs INY)
    if (aPrefix !== bPrefix) {
      return aPrefix.localeCompare(bPrefix);
    }
    
    // Then sort by number
    return parseInt(aNum) - parseInt(bNum);
  });
};

const ProductionReport = () => {
  const [selectedShift, setSelectedShift] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ProductionReport | null>(null);
  const [formData, setFormData] = useState({
    machine_name: "",
    product_name: "",
    cycle_time: "",
    production_goal: "",
    production_achieved: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select(`
          id,
          name,
          status,
          current_product_id,
          products:current_product_id(name)
        `);
      
      if (error) throw error;
      return sortMachines(data as Machine[]);
    },
  });

  const { data: reports, isLoading } = useQuery({
    queryKey: ["production-reports", selectedDate, selectedShift],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_reports")
        .select("*")
        .eq("report_date", selectedDate)
        .eq("shift_number", selectedShift)
        .order("machine_name");
      
      if (error) throw error;
      return data as ProductionReport[];
    },
  });

  const addReport = useMutation({
    mutationFn: async (data: any) => {
      if (editingReport) {
        const { error } = await supabase
          .from("production_reports")
          .update(data)
          .eq("id", editingReport.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("production_reports")
          .insert({
            ...data,
            shift_number: selectedShift,
            report_date: selectedDate,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-reports"] });
      toast.success(editingReport ? "Reporte actualizado" : "Reporte agregado");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("production_reports")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-reports"] });
      toast.success("Reporte eliminado");
    },
  });

  const resetForm = () => {
    setFormData({
      machine_name: "",
      product_name: "",
      cycle_time: "",
      production_goal: "",
      production_achieved: "",
      notes: "",
    });
    setEditingReport(null);
  };

  const handleEdit = (report: ProductionReport) => {
    setEditingReport(report);
    setFormData({
      machine_name: report.machine_name,
      product_name: report.product_name || "",
      cycle_time: report.cycle_time || "",
      production_goal: report.production_goal.toString(),
      production_achieved: report.production_achieved.toString(),
      notes: report.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.machine_name) {
      toast.error("Selecciona una máquina");
      return;
    }
    addReport.mutate({
      machine_name: formData.machine_name,
      product_name: formData.product_name || null,
      cycle_time: formData.cycle_time || null,
      production_goal: parseFloat(formData.production_goal) || 0,
      production_achieved: parseFloat(formData.production_achieved) || 0,
      notes: formData.notes || null,
    });
  };

  const exportToPDF = () => {
    if (!reports || reports.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const doc = new jsPDF();
    
    const img = new Image();
    img.src = logo;
    doc.addImage(img, "PNG", 170, 10, 25, 10);
    
    doc.setFontSize(18);
    doc.text("REPORTE DE PRODUCCIÓN", 14, 20);
    doc.setFontSize(12);
    doc.text(`TURNO ${selectedShift}`, 14, 28);
    doc.text(`Fecha: ${format(new Date(selectedDate), "dd 'de' MMMM, yyyy", { locale: es })}`, 14, 35);

    const tableData = reports.map((report) => [
      report.machine_name,
      report.product_name || "-",
      report.cycle_time || "-",
      report.production_goal.toLocaleString(),
      report.production_achieved.toLocaleString(),
      `${report.production_goal > 0 ? ((report.production_achieved / report.production_goal) * 100).toFixed(1) : 0}%`,
      report.notes || "-",
    ]);

    autoTable(doc, {
      head: [["Máquina", "Producto", "Ciclo", "Meta", "Producido", "%", "Notas"]],
      body: tableData,
      startY: 42,
      theme: 'grid',
      styles: { fontSize: 8, lineWidth: 0.1, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [0, 168, 89] },
    });

    doc.save(`produccion_turno${selectedShift}_${selectedDate}.pdf`);
    toast.success("PDF generado exitosamente");
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4 p-2 md:p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reporte de Producción</h1>
          <p className="text-sm text-muted-foreground">Gestiona los reportes de producción por turno</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seleccionar Turno y Fecha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select value={selectedShift.toString()} onValueChange={(v) => setSelectedShift(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">TURNO 1</SelectItem>
                    <SelectItem value="2">TURNO 2</SelectItem>
                    <SelectItem value="3">TURNO 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                  setIsAddDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button className="flex-1">
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingReport ? "Editar" : "Agregar"} Reporte</DialogTitle>
                      <DialogDescription>
                        Turno {selectedShift} - {format(new Date(selectedDate), "dd/MM/yyyy")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Máquina</Label>
                        <Select value={formData.machine_name} onValueChange={(v) => setFormData({...formData, machine_name: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona máquina" />
                          </SelectTrigger>
                          <SelectContent>
                            {machines?.filter(m => m.status === "producing").map((machine) => (
                              <SelectItem key={machine.id} value={machine.name}>
                                {machine.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Producto</Label>
                        <Input
                          value={formData.product_name}
                          onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                          placeholder="Ej: 52 oz"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tiempo de Ciclo</Label>
                        <Input
                          value={formData.cycle_time}
                          onChange={(e) => setFormData({...formData, cycle_time: e.target.value})}
                          placeholder="Ej: 16.5s"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Meta de Producción</Label>
                          <Input
                            type="number"
                            value={formData.production_goal}
                            onChange={(e) => setFormData({...formData, production_goal: e.target.value})}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Producción Lograda</Label>
                          <Input
                            type="number"
                            value={formData.production_achieved}
                            onChange={(e) => setFormData({...formData, production_achieved: e.target.value})}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Notas</Label>
                        <Input
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          placeholder="Observaciones adicionales..."
                        />
                      </div>
                      <Button onClick={handleSubmit} className="w-full" disabled={addReport.isPending}>
                        {addReport.isPending ? "Guardando..." : editingReport ? "Actualizar" : "Agregar"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button onClick={exportToPDF} variant="outline">
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button onClick={printReport} variant="outline">
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">TURNO {selectedShift}</CardTitle>
            <CardDescription>
              {format(new Date(selectedDate), "dd 'de' MMMM, yyyy", { locale: es })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando...</div>
            ) : reports && reports.length > 0 ? (
              <div className="space-y-3">
                {sortMachines(reports.map(r => ({...r, name: r.machine_name})) as any).map((report: any) => {
                  const percentage = report.production_goal > 0 
                    ? ((report.production_achieved / report.production_goal) * 100).toFixed(1)
                    : "0";
                  return (
                    <Card key={report.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-lg">{report.machine_name}</h3>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(report)}>
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteReport.mutate(report.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <div className="text-muted-foreground text-xs">Producto</div>
                                <div className="font-medium">{report.product_name || "-"}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">Ciclo</div>
                                <div className="font-medium">{report.cycle_time || "-"}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">Meta</div>
                                <div className="font-medium">{report.production_goal.toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">Producido</div>
                                <div className="font-medium text-primary">{report.production_achieved.toLocaleString()}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-primary h-full transition-all"
                                  style={{ width: `${Math.min(parseFloat(percentage), 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold min-w-[45px]">{percentage}%</span>
                            </div>
                            {report.notes && (
                              <div className="text-sm text-muted-foreground border-t pt-2">
                                <strong>Notas:</strong> {report.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay reportes para este turno
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductionReport;
