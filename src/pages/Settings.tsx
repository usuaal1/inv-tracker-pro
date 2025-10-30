import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Edit } from "lucide-react";

const Settings = () => {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [newPiecesPerPackage, setNewPiecesPerPackage] = useState("");
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

  const updateProduct = useMutation({
    mutationFn: async ({ id, piecesPerPackage }: { id: string; piecesPerPackage: number }) => {
      const { error } = await supabase
        .from("products")
        .update({ pieces_per_package: piecesPerPackage })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto actualizado");
      setSelectedProduct(null);
      setNewPiecesPerPackage("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleUpdate = () => {
    if (!selectedProduct || !newPiecesPerPackage) return;
    
    const pieces = parseInt(newPiecesPerPackage);
    if (isNaN(pieces) || pieces <= 0) {
      toast.error("Cantidad inválida");
      return;
    }

    updateProduct.mutate({
      id: selectedProduct.id,
      piecesPerPackage: pieces,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Administra las configuraciones del sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Productos</CardTitle>
          <CardDescription>Modifica las piezas por pallet de cada producto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {products?.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.pieces_per_package} piezas por pallet
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedProduct(product);
                        setNewPiecesPerPackage(product.pieces_per_package.toString());
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Producto</DialogTitle>
                      <DialogDescription>{product.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="piecesPerPackage">Piezas por pallet</Label>
                        <Input
                          id="piecesPerPackage"
                          type="number"
                          value={newPiecesPerPackage}
                          onChange={(e) => setNewPiecesPerPackage(e.target.value)}
                          min="1"
                        />
                      </div>
                      <Button onClick={handleUpdate} className="w-full" disabled={updateProduct.isPending}>
                        {updateProduct.isPending ? "Guardando..." : "Guardar cambios"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
