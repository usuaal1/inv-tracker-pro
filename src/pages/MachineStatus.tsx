import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

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

const statusLabels: Record<MachineStatus, string> = {
  producing: "Produciendo",
  mold_change: "Cambio de Molde",
  minor_stop: "Paro Menor / Alarma",
  major_stop: "Paro Mayor / Mantenimiento"
};

const statusColors: Record<MachineStatus, string> = {
  producing: "bg-green-500",
  mold_change: "bg-blue-500",
  minor_stop: "bg-yellow-500",
  major_stop: "bg-red-500"
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

export default function MachineStatus() {
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [newMachine, setNewMachine] = useState({ name: "", cavities: "" });

  const { data: machines, isLoading } = useQuery({
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

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as Product[];
    }
  });

  const updateMachine = useMutation({
    mutationFn: async ({ id, cavities, status, current_product_id, quantity_ordered, quantity_produced }: { 
      id: string; 
      cavities?: number; 
      status?: MachineStatus;
      current_product_id?: string | null;
      quantity_ordered?: number;
      quantity_produced?: number;
    }) => {
      const updates: any = {};
      if (cavities !== undefined) updates.cavities = cavities;
      if (status !== undefined) updates.status = status;
      if (current_product_id !== undefined) updates.current_product_id = current_product_id;
      if (quantity_ordered !== undefined) updates.quantity_ordered = quantity_ordered;
      if (quantity_produced !== undefined) updates.quantity_produced = quantity_produced;
      
      const { error } = await supabase
        .from("machines")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Máquina actualizada");
      setEditDialogOpen(false);
      setProductDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Error al actualizar máquina");
      console.error(error);
    }
  });

  const addMachine = useMutation({
    mutationFn: async ({ name, cavities }: { name: string; cavities: number }) => {
      const { error } = await supabase
        .from("machines")
        .insert({ name, cavities, status: "producing" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Máquina agregada");
      setAddDialogOpen(false);
      setNewMachine({ name: "", cavities: "" });
    },
    onError: (error) => {
      toast.error("Error al agregar máquina");
      console.error(error);
    }
  });

  const handleEdit = (machine: Machine) => {
    setSelectedMachine(machine);
    setEditDialogOpen(true);
  };

  const handleProductAssignment = (machine: Machine) => {
    setSelectedMachine(machine);
    setProductDialogOpen(true);
  };

  const handleUpdateProduct = (productId: string | null, quantityOrdered: string) => {
    if (selectedMachine) {
      const qty = quantityOrdered ? parseFloat(quantityOrdered) : 0;
      updateMachine.mutate({ 
        id: selectedMachine.id, 
        current_product_id: productId,
        quantity_ordered: qty,
        quantity_produced: 0
      });
    }
  };

  const handleUpdateCavities = () => {
    if (selectedMachine && selectedMachine.cavities > 0) {
      updateMachine.mutate({ id: selectedMachine.id, cavities: selectedMachine.cavities });
    }
  };

  const handleAddMachine = () => {
    if (newMachine.name && newMachine.cavities) {
      const cavities = parseInt(newMachine.cavities);
      if (cavities > 0) {
        addMachine.mutate({ name: newMachine.name, cavities });
      }
    }
  };

  if (isLoading) {
    return <div className="p-8">Cargando...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold">Estado de Máquinas</h1>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Máquina
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nueva Máquina</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nombre de la Máquina</Label>
                <Input
                  value={newMachine.name}
                  onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })}
                  placeholder="Ej: ISBM 10"
                />
              </div>
              <div>
                <Label>Número de Cavidades</Label>
                <Input
                  type="number"
                  min="1"
                  value={newMachine.cavities}
                  onChange={(e) => setNewMachine({ ...newMachine, cavities: e.target.value })}
                  placeholder="Ej: 5"
                />
              </div>
              <Button onClick={handleAddMachine} className="w-full">
                Agregar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines?.map((machine) => (
          <Card key={machine.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{machine.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {machine.cavities} {machine.cavities === 1 ? "cavidad" : "cavidades"}
                  </p>
                  {machine.products?.name && (
                    <p className="text-sm font-medium text-primary">
                      📦 {machine.products.name}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(machine)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Estado Actual</Label>
                  <Select
                    value={machine.status}
                    onValueChange={(value) => updateMachine.mutate({ id: machine.id, status: value as MachineStatus })}
                  >
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${statusColors[machine.status]}`} />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${statusColors[value as MachineStatus]}`} />
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleProductAssignment(machine)}
                  className="w-full"
                >
                  {machine.current_product_id ? "Cambiar Producto" : "Asignar Producto"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cavidades - {selectedMachine?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Número de Cavidades</Label>
              <Input
                type="number"
                min="1"
                value={selectedMachine?.cavities || ""}
                onChange={(e) => setSelectedMachine(prev => 
                  prev ? { ...prev, cavities: parseInt(e.target.value) || 1 } : null
                )}
              />
            </div>
            <Button onClick={handleUpdateCavities} className="w-full">
              Actualizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Producto - {selectedMachine?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Producto</Label>
              <Select
                value={selectedMachine?.current_product_id || "none"}
                onValueChange={(value) => {
                  if (selectedMachine) {
                    setSelectedMachine({
                      ...selectedMachine,
                      current_product_id: value === "none" ? null : value,
                      quantity_ordered: value === "none" ? 0 : selectedMachine.quantity_ordered
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Quitar producto</SelectItem>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedMachine?.current_product_id && (
              <div>
                <Label>Cantidad Ordenada</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={selectedMachine?.quantity_ordered || 0}
                  onChange={(e) => setSelectedMachine(prev => 
                    prev ? { ...prev, quantity_ordered: parseFloat(e.target.value) || 0 } : null
                  )}
                  placeholder="Cantidad a producir"
                />
              </div>
            )}
            <Button 
              onClick={() => handleUpdateProduct(
                selectedMachine?.current_product_id || null,
                selectedMachine?.quantity_ordered?.toString() || "0"
              )} 
              className="w-full"
            >
              Actualizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
