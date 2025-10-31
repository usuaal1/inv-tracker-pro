import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Minus, Search, FileDown, Filter, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Product {
  id: string;
  name: string;
  pallets: number;
  pieces_per_package: number;
  total_pieces: number;
  category: string;
}

const Inventory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [movementType, setMovementType] = useState<"entry" | "exit">("exit");
  const [quantityType, setQuantityType] = useState<"pieces" | "pallets">("pieces");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", pallets: "", pieces_per_package: "" });
  const [filterQuantity, setFilterQuantity] = useState<"all" | "low" | "high">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
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

      const newPallets = newTotalPieces / product.pieces_per_package;

      const { error: updateError } = await supabase
        .from("products")
        .update({
          pallets: newPallets,
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

  const createProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .insert({
          name: newProduct.name,
          pallets: parseFloat(newProduct.pallets),
          pieces_per_package: parseInt(newProduct.pieces_per_package),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto creado");
      setIsCreateDialogOpen(false);
      setNewProduct({ name: "", pallets: "", pieces_per_package: "" });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleMovement = () => {
    if (!selectedProduct || !quantity) return;
    
    let quantityPieces: number;
    const qty = parseFloat(quantity);
    
    if (isNaN(qty) || qty <= 0) {
      toast.error("Cantidad inválida");
      return;
    }

    if (quantityType === "pallets") {
      quantityPieces = Math.round(qty * selectedProduct.pieces_per_package);
    } else {
      quantityPieces = Math.round(qty);
    }

    recordMovement.mutate({
      productId: selectedProduct.id,
      quantityPieces,
    });
  };

  const handleCreateProduct = () => {
    if (!newProduct.name || !newProduct.pallets || !newProduct.pieces_per_package) {
      toast.error("Completa todos los campos");
      return;
    }
    createProduct.mutate();
  };

  const filteredProducts = products?.filter(p => {
    // Filter by search
    if (!p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // Filter by quantity
    if (filterQuantity === "all") return true;
    if (filterQuantity === "low") return p.total_pieces < 1000;
    if (filterQuantity === "high") return p.total_pieces >= 1000;
    return true;
  }).sort((a, b) => {
    return sortOrder === "asc" 
      ? a.total_pieces - b.total_pieces 
      : b.total_pieces - a.total_pieces;
  });

  const exportToPDF = () => {
    if (!products || products.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Inventario de Productos", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generado: ${format(new Date(), "PPp", { locale: es })}`, 14, 30);

    const tableData = products.map((product) => [
      product.name,
      product.pallets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      product.pieces_per_package.toLocaleString(),
      product.total_pieces.toLocaleString(),
    ]);

    autoTable(doc, {
      head: [["Producto", "Pallets", "Pzs/Pallet", "Total Piezas"]],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`inventario_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    toast.success("PDF generado exitosamente");
  };

  return (
    <div className="space-y-4 p-2 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inventario</h1>
          <p className="text-sm text-muted-foreground">Gestiona tu inventario de productos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Crear Producto</span>
                <span className="sm:hidden">Crear</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Producto</DialogTitle>
                <DialogDescription>Ingresa la información del producto</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Nombre del Producto</Label>
                  <Input
                    id="productName"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pallets">Pallets</Label>
                  <Input
                    id="pallets"
                    type="number"
                    step="0.01"
                    value={newProduct.pallets}
                    onChange={(e) => setNewProduct({ ...newProduct, pallets: e.target.value })}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pieces">Piezas por Pallet</Label>
                  <Input
                    id="pieces"
                    type="number"
                    value={newProduct.pieces_per_package}
                    onChange={(e) => setNewProduct({ ...newProduct, pieces_per_package: e.target.value })}
                    placeholder="0"
                    min="1"
                  />
                </div>
                <Button onClick={handleCreateProduct} className="w-full" disabled={createProduct.isPending}>
                  {createProduct.isPending ? "Creando..." : "Crear Producto"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={exportToPDF} variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle className="text-lg md:text-xl">Productos</CardTitle>
              <CardDescription className="text-xs md:text-sm">Lista completa de productos en inventario</CardDescription>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterQuantity} onValueChange={(v: any) => setFilterQuantity(v)}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="low">&lt; 1000 pzs</SelectItem>
                    <SelectItem value="high">≥ 1000 pzs</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  <ArrowUpDown className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{sortOrder === "asc" ? "Menor" : "Mayor"}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>

          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Cargando...</div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <>
              {/* Desktop table view */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Pallets</TableHead>
                      <TableHead className="text-right">Pzs/Pallet</TableHead>
                      <TableHead className="text-right">Total Piezas</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right">{product.pallets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
                                  <Label>Unidad de medida</Label>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant={quantityType === "pieces" ? "default" : "outline"}
                                      onClick={() => setQuantityType("pieces")}
                                      className="flex-1"
                                    >
                                      Piezas
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={quantityType === "pallets" ? "default" : "outline"}
                                      onClick={() => setQuantityType("pallets")}
                                      className="flex-1"
                                    >
                                      Pallets
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="quantity">Cantidad ({quantityType === "pieces" ? "piezas" : "pallets"})</Label>
                                  <Input
                                    id="quantity"
                                    type="number"
                                    step={quantityType === "pallets" ? "0.01" : "1"}
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="0"
                                    min={quantityType === "pallets" ? "0.01" : "1"}
                                  />
                                  <p className="text-sm text-muted-foreground">
                                    {quantity && !isNaN(parseFloat(quantity)) 
                                      ? quantityType === "pieces"
                                        ? `= ${(parseFloat(quantity) / product.pieces_per_package).toFixed(2)} pallets`
                                        : `= ${(parseFloat(quantity) * product.pieces_per_package).toFixed(0)} piezas`
                                      : `Ingresa la cantidad en ${quantityType === "pieces" ? "piezas" : "pallets"}`}
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
            
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {filteredProducts.map((product) => (
                <div key={product.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                        <div>
                          <p>Pallets</p>
                          <p className="font-medium text-foreground">
                            {product.pallets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p>Pzs/Pallet</p>
                          <p className="font-medium text-foreground">{product.pieces_per_package.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <Badge variant={product.total_pieces > 0 ? "default" : "secondary"} className="shrink-0 ml-2">
                      {product.total_pieces.toLocaleString()} pzs
                    </Badge>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Dialog open={isDialogOpen && selectedProduct?.id === product.id} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) setSelectedProduct(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedProduct(product);
                            setMovementType("entry");
                            setIsDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Entrada
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
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
                            <Label>Unidad de medida</Label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={quantityType === "pieces" ? "default" : "outline"}
                                onClick={() => setQuantityType("pieces")}
                                className="flex-1"
                              >
                                Piezas
                              </Button>
                              <Button
                                type="button"
                                variant={quantityType === "pallets" ? "default" : "outline"}
                                onClick={() => setQuantityType("pallets")}
                                className="flex-1"
                              >
                                Pallets
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="quantity">Cantidad ({quantityType === "pieces" ? "piezas" : "pallets"})</Label>
                            <Input
                              id="quantity"
                              type="number"
                              step={quantityType === "pallets" ? "0.01" : "1"}
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              placeholder="0"
                              min={quantityType === "pallets" ? "0.01" : "1"}
                            />
                            <p className="text-sm text-muted-foreground">
                              {quantity && !isNaN(parseFloat(quantity)) 
                                ? quantityType === "pieces"
                                  ? `= ${(parseFloat(quantity) / product.pieces_per_package).toFixed(2)} pallets`
                                  : `= ${(parseFloat(quantity) * product.pieces_per_package).toFixed(0)} piezas`
                                : `Ingresa la cantidad en ${quantityType === "pieces" ? "piezas" : "pallets"}`}
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
                      className="flex-1"
                      onClick={() => {
                        setSelectedProduct(product);
                        setMovementType("exit");
                        setIsDialogOpen(true);
                      }}
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Salida
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
          ) : (
            <p className="text-center py-8 text-sm text-muted-foreground">
              {searchQuery || filterQuantity !== "all" ? "No se encontraron productos con los filtros aplicados" : "No hay productos en el inventario"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
