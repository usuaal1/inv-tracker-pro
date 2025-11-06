import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, TrendingUp, FileDown, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import logo from "@/assets/logo.png";

type MachineStatus = "producing" | "mold_change" | "minor_stop" | "major_stop";

interface Machine {
  id: string;
  name: string;
  cavities: number;
  status: MachineStatus;
  current_product_id: string | null;
  quantity_ordered: number;
  quantity_produced: number;
  products?: {
    id: string;
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
}

interface ProductionData {
  id: string;
  machine_id: string;
  production_count: number;
  hour_timestamp: string;
}

const statusLabels: Record<MachineStatus, string> = {
  producing: "Produciendo",
  mold_change: "Cambio de Molde",
  minor_stop: "Paro Menor",
  major_stop: "Mantenimiento"
};

const statusColors: Record<MachineStatus, string> = {
  producing: "bg-green-500 hover:bg-green-600",
  mold_change: "bg-blue-500 hover:bg-blue-600",
  minor_stop: "bg-yellow-500 hover:bg-yellow-600",
  major_stop: "bg-red-500 hover:bg-red-600"
};

const statusTextColors: Record<MachineStatus, string> = {
  producing: "text-green-500",
  mold_change: "text-blue-500",
  minor_stop: "text-yellow-500",
  major_stop: "text-red-500"
};

// Helper function to sort machines numerically
const sortMachines = (machines: Machine[]) => {
  return machines.sort((a, b) => {
    const aMatch = a.name.match(/(\D+)(\d+)/);
    const bMatch = b.name.match(/(\D+)(\d+)/);
    
    if (!aMatch || !bMatch) return a.name.localeCompare(b.name);
    
    const [, aPrefix, aNum] = aMatch;
    const [, bPrefix, bNum] = bMatch;
    
    if (aPrefix !== bPrefix) {
      return aPrefix.localeCompare(bPrefix);
    }
    
    return parseInt(aNum) - parseInt(bNum);
  });
};

export default function PlantMap() {
  const queryClient = useQueryClient();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [productionInput, setProductionInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<number>(1);
  const [shiftComment, setShiftComment] = useState("");

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select(`
          *,
          products:current_product_id (
            id,
            name
          )
        `)
        .order("name");
      
      if (error) throw error;
      return sortMachines(data as any[]);
    }
  });

  const { data: currentComment } = useQuery({
    queryKey: ["shift-comment", selectedShift],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("shift_comments")
        .select("*")
        .eq("comment_date", today)
        .eq("shift_number", selectedShift)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    }
  });

  useEffect(() => {
    if (currentComment) {
      setShiftComment(currentComment.comments || "");
    } else {
      setShiftComment("");
    }
  }, [currentComment]);

  const { data: productionData } = useQuery({
    queryKey: ["machine_production"],
    queryFn: async () => {
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);
      
      const { data, error } = await supabase
        .from("machine_production")
        .select("*")
        .gte("hour_timestamp", currentHour.toISOString());
      
      if (error) throw error;
      return data as ProductionData[];
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const addProduction = useMutation({
    mutationFn: async ({ machineId, count }: { machineId: string; count: number }) => {
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);
      
      // Check if record exists for this hour
      const { data: existing } = await supabase
        .from("machine_production")
        .select("*")
        .eq("machine_id", machineId)
        .eq("hour_timestamp", currentHour.toISOString())
        .single();
      
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from("machine_production")
          .update({ production_count: existing.production_count + count })
          .eq("id", existing.id);
        
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from("machine_production")
          .insert({
            machine_id: machineId,
            production_count: count,
            hour_timestamp: currentHour.toISOString()
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine_production"] });
      toast.success("Producción registrada");
      setDialogOpen(false);
      setProductionInput("");
    },
    onError: (error) => {
      toast.error("Error al registrar producción");
      console.error(error);
    }
  });

  const getProductionForMachine = (machineId: string): number => {
    if (!productionData) return 0;
    return productionData
      .filter(p => p.machine_id === machineId)
      .reduce((sum, p) => sum + p.production_count, 0);
  };

  const handleMachineClick = (machine: Machine) => {
    setSelectedMachine(machine);
    setDialogOpen(true);
  };

  const handleAddProduction = () => {
    if (selectedMachine && productionInput) {
      const count = parseInt(productionInput);
      if (count > 0) {
        addProduction.mutate({ machineId: selectedMachine.id, count });
      }
    }
  };

  const saveComment = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      if (currentComment) {
        const { error } = await supabase
          .from("shift_comments")
          .update({ comments: shiftComment })
          .eq("id", currentComment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shift_comments")
          .insert({
            comment_date: today,
            shift_number: selectedShift,
            comments: shiftComment
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-comment"] });
      toast.success("Comentario guardado");
      setCommentsDialogOpen(false);
    }
  });

  const exportMapToPDF = () => {
    if (!machines || machines.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const doc = new jsPDF();
    
    const img = new Image();
    img.src = logo;
    doc.addImage(img, "PNG", 170, 10, 25, 10);
    
    doc.setFontSize(18);
    doc.text("MAPA DE PLANTA", 14, 20);
    doc.setFontSize(12);
    doc.text(`Fecha: ${format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}`, 14, 28);
    doc.text(`Hora: ${format(new Date(), "HH:mm")}`, 14, 35);

    const tableData = machines.map((machine) => [
      machine.name,
      statusLabels[machine.status],
      machine.products?.name || "-",
      machine.cavities.toString(),
      getProductionForMachine(machine.id).toString(),
      machine.quantity_ordered > 0 
        ? `${machine.quantity_produced}/${machine.quantity_ordered}`
        : "-"
    ]);

    autoTable(doc, {
      head: [["Máquina", "Estado", "Producto", "Cav.", "Prod/h", "Progreso"]],
      body: tableData,
      startY: 42,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 168, 89] },
    });

    if (currentComment && currentComment.comments) {
      const finalY = (doc as any).lastAutoTable.finalY || 42;
      doc.setFontSize(12);
      doc.text("Comentarios para siguiente turno:", 14, finalY + 10);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(currentComment.comments, 180);
      doc.text(lines, 14, finalY + 18);
    }

    doc.save(`mapa_planta_${format(new Date(), "dd-MM-yyyy_HH-mm")}.pdf`);
    toast.success("PDF generado exitosamente");
  };

  // Calculate statistics
  const stats = {
    total: machines?.length || 0,
    producing: machines?.filter(m => m.status === "producing").length || 0,
    stopped: machines?.filter(m => m.status !== "producing").length || 0,
    totalProduction: productionData?.reduce((sum, p) => sum + p.production_count, 0) || 0
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mapa de la Planta</h1>
          <p className="text-muted-foreground">Vista en tiempo real del estado de todas las máquinas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportMapToPDF} variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button onClick={() => setCommentsDialogOpen(true)} variant="outline">
            <MessageSquare className="mr-2 h-4 w-4" />
            Comentarios
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Máquinas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produciendo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.producing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Detenidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.stopped}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Producción/Hora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <TrendingUp className="h-5 w-5 text-primary" />
              {stats.totalProduction}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Leyenda de Estados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statusLabels).map(([status, label]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${statusColors[status as MachineStatus]}`} />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Machine Map Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {machines?.map((machine) => {
          const production = getProductionForMachine(machine.id);
          const productName = machine.products?.name;
          const isAlmostDone = machine.quantity_ordered > 0 && 
            machine.quantity_produced >= machine.quantity_ordered * 0.9;
          
          return (
            <button
              key={machine.id}
              onClick={() => handleMachineClick(machine)}
              className={`${statusColors[machine.status]} text-white rounded-lg p-4 transition-all hover:scale-105 cursor-pointer shadow-lg relative`}
            >
              {isAlmostDone && (
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                  ⚠️
                </div>
              )}
              <div className="space-y-2">
                <div className="font-bold text-lg">{machine.name}</div>
                <div className="text-xs opacity-90">{machine.cavities} cav.</div>
                {productName && (
                  <div className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">
                    {productName}
                  </div>
                )}
                <div className="flex items-center justify-center gap-1 text-xs">
                  <Activity className="h-3 w-3" />
                  <span>{production}/h</span>
                </div>
                {machine.quantity_ordered > 0 && (
                  <div className="text-xs opacity-90">
                    {machine.quantity_produced}/{machine.quantity_ordered}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Machine Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${selectedMachine ? statusColors[selectedMachine.status] : ""}`} />
              {selectedMachine?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedMachine && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Estado</Label>
                  <p className={`font-medium ${statusTextColors[selectedMachine.status]}`}>
                    {statusLabels[selectedMachine.status]}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Cavidades</Label>
                  <p className="font-medium">{selectedMachine.cavities}</p>
                </div>
              </div>
              
              {selectedMachine.products?.name && (
                <div>
                  <Label className="text-sm text-muted-foreground">Producto Actual</Label>
                  <p className="font-medium text-lg">{selectedMachine.products.name}</p>
                </div>
              )}
              
              {selectedMachine.quantity_ordered > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground">Progreso de Orden</Label>
                  <div className="space-y-1">
                    <p className="text-lg font-bold">
                      {selectedMachine.quantity_produced} / {selectedMachine.quantity_ordered}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(100, (selectedMachine.quantity_produced / selectedMachine.quantity_ordered) * 100)}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {((selectedMachine.quantity_produced / selectedMachine.quantity_ordered) * 100).toFixed(1)}% completado
                    </p>
                  </div>
                </div>
              )}
              
              <div>
                <Label className="text-sm text-muted-foreground">Producción esta hora</Label>
                <p className="text-2xl font-bold">{getProductionForMachine(selectedMachine.id)} piezas</p>
              </div>

              <div className="border-t pt-4">
                <Label>Registrar Producción</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Cantidad de piezas"
                    value={productionInput}
                    onChange={(e) => setProductionInput(e.target.value)}
                  />
                  <Button onClick={handleAddProduction}>
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comentarios para el Siguiente Turno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
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
              <Label>Comentarios</Label>
              <Textarea
                value={shiftComment}
                onChange={(e) => setShiftComment(e.target.value)}
                placeholder="Escribe los comentarios para el siguiente turno..."
                className="min-h-[150px]"
              />
            </div>
            <Button onClick={() => saveComment.mutate()} className="w-full" disabled={saveComment.isPending}>
              {saveComment.isPending ? "Guardando..." : "Guardar Comentario"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
