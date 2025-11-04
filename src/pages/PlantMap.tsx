import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type MachineStatus = "producing" | "mold_change" | "minor_stop" | "major_stop";

interface Machine {
  id: string;
  name: string;
  cavities: number;
  status: MachineStatus;
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

export default function PlantMap() {
  const queryClient = useQueryClient();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [productionInput, setProductionInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as Machine[];
    }
  });

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

  // Calculate statistics
  const stats = {
    total: machines?.length || 0,
    producing: machines?.filter(m => m.status === "producing").length || 0,
    stopped: machines?.filter(m => m.status !== "producing").length || 0,
    totalProduction: productionData?.reduce((sum, p) => sum + p.production_count, 0) || 0
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Mapa de la Planta</h1>
        <p className="text-muted-foreground">Vista en tiempo real del estado de todas las máquinas</p>
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
          return (
            <button
              key={machine.id}
              onClick={() => handleMachineClick(machine)}
              className={`${statusColors[machine.status]} text-white rounded-lg p-4 transition-all hover:scale-105 cursor-pointer shadow-lg`}
            >
              <div className="space-y-2">
                <div className="font-bold text-lg">{machine.name}</div>
                <div className="text-xs opacity-90">{machine.cavities} cav.</div>
                <div className="flex items-center justify-center gap-1 text-xs">
                  <Activity className="h-3 w-3" />
                  <span>{production}/h</span>
                </div>
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
    </div>
  );
}
