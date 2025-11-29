import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Vehicle } from "@/components/VehicleCard";

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Economy",
    image: "",
    pricePerDay: "",
    payNowPrice: "",
    mpg: "",
    passengers: "",
    transmission: "Automatic" as const,
    drivetrain: "FWD" as const,
    luggage: "",
    fuelEfficient: false,
    available: true,
  });

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/admin/vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/vehicles");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/vehicles", {
        name: formData.name,
        category: formData.category,
        image: formData.image,
        pricePerDay: parseFloat(formData.pricePerDay),
        payNowPrice: parseFloat(formData.payNowPrice),
        mpg: parseInt(formData.mpg),
        passengers: parseInt(formData.passengers),
        transmission: formData.transmission,
        drivetrain: formData.drivetrain,
        luggage: parseInt(formData.luggage),
        fuelEfficient: formData.fuelEfficient,
        available: formData.available,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vehicle created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicles"] });
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create vehicle", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/admin/vehicles/${id}`, {
        name: formData.name,
        category: formData.category,
        image: formData.image,
        pricePerDay: parseFloat(formData.pricePerDay),
        payNowPrice: parseFloat(formData.payNowPrice),
        mpg: parseInt(formData.mpg),
        passengers: parseInt(formData.passengers),
        transmission: formData.transmission,
        drivetrain: formData.drivetrain,
        luggage: parseInt(formData.luggage),
        fuelEfficient: formData.fuelEfficient,
        available: formData.available,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vehicle updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicles"] });
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/vehicles/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Vehicle deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicles"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category: "Economy",
      image: "",
      pricePerDay: "",
      payNowPrice: "",
      mpg: "",
      passengers: "",
      transmission: "Automatic",
      drivetrain: "FWD",
      luggage: "",
      fuelEfficient: false,
      available: true,
    });
    setEditingVehicle(null);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      name: vehicle.name,
      category: vehicle.category,
      image: vehicle.image,
      pricePerDay: vehicle.pricePerDay.toString(),
      payNowPrice: vehicle.payNowPrice.toString(),
      mpg: vehicle.mpg.toString(),
      passengers: vehicle.passengers.toString(),
      transmission: vehicle.transmission as "Automatic" | "Manual",
      drivetrain: vehicle.drivetrain as "FWD" | "RWD" | "AWD",
      luggage: vehicle.luggage.toString(),
      fuelEfficient: vehicle.fuelEfficient,
      available: vehicle.available,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (editingVehicle) {
      updateMutation.mutate(editingVehicle.id);
    } else {
      createMutation.mutate();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold">Vehicle Management</h1>
        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Toyota Corolla"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Economy"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Regular Price/Day ($)</Label>
                  <Input
                    type="number"
                    value={formData.pricePerDay}
                    onChange={(e) => setFormData({ ...formData, pricePerDay: e.target.value })}
                    placeholder="35"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pay Now Price/Day ($)</Label>
                  <Input
                    type="number"
                    value={formData.payNowPrice}
                    onChange={(e) => setFormData({ ...formData, payNowPrice: e.target.value })}
                    placeholder="29"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>MPG</Label>
                  <Input
                    type="number"
                    value={formData.mpg}
                    onChange={(e) => setFormData({ ...formData, mpg: e.target.value })}
                    placeholder="32"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passengers</Label>
                  <Input
                    type="number"
                    value={formData.passengers}
                    onChange={(e) => setFormData({ ...formData, passengers: e.target.value })}
                    placeholder="5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Luggage</Label>
                  <Input
                    type="number"
                    value={formData.luggage}
                    onChange={(e) => setFormData({ ...formData, luggage: e.target.value })}
                    placeholder="2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transmission</Label>
                  <Select value={formData.transmission} onValueChange={(v: any) => setFormData({ ...formData, transmission: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Automatic">Automatic</SelectItem>
                      <SelectItem value="Manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Drivetrain</Label>
                  <Select value={formData.drivetrain} onValueChange={(v: any) => setFormData({ ...formData, drivetrain: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FWD">FWD</SelectItem>
                      <SelectItem value="RWD">RWD</SelectItem>
                      <SelectItem value="AWD">AWD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.fuelEfficient}
                    onCheckedChange={(c) => setFormData({ ...formData, fuelEfficient: !!c })}
                  />
                  <Label>Fuel Efficient (30+ MPG)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.available}
                    onCheckedChange={(c) => setFormData({ ...formData, available: !!c })}
                  />
                  <Label>Available</Label>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingVehicle ? "Update Vehicle" : "Create Vehicle"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {vehicles.map((vehicle) => (
            <Card key={vehicle.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{vehicle.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.category} • {vehicle.mpg} MPG • {vehicle.drivetrain} • {vehicle.transmission}
                    </p>
                    <p className="text-sm mt-2">
                      ${vehicle.payNowPrice}/day (regular: ${vehicle.pricePerDay}) • {vehicle.passengers} passengers • {vehicle.luggage} bags
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(vehicle)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteMutation.mutate(vehicle.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
