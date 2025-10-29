import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Minus, Search, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  packages: number;
  pieces_per_package: number;
  total_pieces: number;
  category: string;
}

const Inventory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [movementType, setMovementType] = useState<"entry" | "exit">("exit");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as Product[];
    },
  });

  const recordMovement = useMutation({
    mutationFn: async ({ productId, quantityPieces }: { productId: string; quantityPieces: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Record movement
      const { error: movementError } = await supabase
        .from("inventory_movements")
        .insert({
          product_id: productId,
          user_id: user?.id,
          movement_type: movementType,
          quantity_pieces: quantityPieces,
        });

      if (movementError) throw movementError;

      // Update product quantity
      const product = products?.find(p => p.id === productId);
      if (!product) throw new Error("Producto no encontrado");

      const newTotalPieces = movementType === "entry" 
        ? product.total_pieces + quantityPieces
        : product.total_pieces - quantityPieces;

      if (newTotalPieces < 0) {
        throw new Error("No hay suficiente inventario");
      }

      const newPackages = newTotalPieces / product.pieces_per_package;

      const { error: updateError } = await supabase
        .from("products")
        .update({
          packages: newPackages,
          total_pieces: newTotalPieces,
        })
        .eq("id", productId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(movementType === "entry" ? "Entrada registrada" : "Salida registrada");
      setIsDialogOpen(false);
      setQuantity("");
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleMovement = () => {
    if (!selectedProduct || !quantity) return;
    
    const quantityPieces = parseInt(quantity);
    if (isNaN(quantityPieces) || quantityPieces <= 0) {
      toast.error("Cantidad inválida");
      return;
    }

    recordMovement.mutate({
      productId: selectedProduct.id,
      quantityPieces,
    });
  };

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToPDF = () => {
    toast.info("Función de exportación en desarrollo");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventario</h1>
          <p className="text-muted-foreground">Gestiona tu inventario de productos</p>
        </div>
        <Button onClick={exportToPDF} variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>Lista completa de productos en inventario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Paquetes</TableHead>
                    <TableHead className="text-right">Pzs/Paq</TableHead>
                    <TableHead className="text-right">Total Piezas</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{product.packages.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{product.pieces_per_package.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={product.total_pieces > 0 ? "default" : "secondary"}>
                          {product.total_pieces.toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Dialog open={isDialogOpen && selectedProduct?.id === product.id} onOpenChange={(open) => {
                            setIsDialogOpen(open);
                            if (!open) setSelectedProduct(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setMovementType("entry");
                                  setIsDialogOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {movementType === "entry" ? "Entrada" : "Salida"} de producto
                                </DialogTitle>
                                <DialogDescription>
                                  {product.name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Tipo de movimiento</Label>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant={movementType === "entry" ? "default" : "outline"}
                                      onClick={() => setMovementType("entry")}
                                      className="flex-1"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Entrada
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={movementType === "exit" ? "default" : "outline"}
                                      onClick={() => setMovementType("exit")}
                                      className="flex-1"
                                    >
                                      <Minus className="mr-2 h-4 w-4" />
                                      Salida
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="quantity">Cantidad (piezas)</Label>
                                  <Input
                                    id="quantity"
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="0"
                                    min="1"
                                  />
                                  <p className="text-sm text-muted-foreground">
                                    {quantity && !isNaN(parseInt(quantity)) 
                                      ? `= ${(parseInt(quantity) / product.pieces_per_package).toFixed(2)} paquetes`
                                      : "Ingresa la cantidad en piezas"}
                                  </p>
                                </div>
                                <Button onClick={handleMovement} className="w-full" disabled={recordMovement.isPending}>
                                  {recordMovement.isPending ? "Procesando..." : "Confirmar"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedProduct(product);
                              setMovementType("exit");
                              setIsDialogOpen(true);
                            }}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
