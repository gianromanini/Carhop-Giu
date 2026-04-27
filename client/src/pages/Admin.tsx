import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Vehicle } from "@/components/VehicleCard";

interface Host {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
}

interface VehicleWithHost extends Vehicle {
  hostInfo?: {
    id: number;
    firstName: string;
    lastName: string;
    city: string;
    state: string;
  } | null;
}

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("vehicles");
  const [editingVehicle, setEditingVehicle] = useState<VehicleWithHost | null>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<{ open: boolean; action: 'edit' | 'delete'; vehicle: VehicleWithHost | null }>({ 
    open: false, 
    action: 'edit', 
    vehicle: null 
  });
  const [formData, setFormData] = useState({
    name: "",
    category: "Economy",
    image: "",
    pricePerDay: "",
    payNowPrice: "",
    mpg: "",
    passengers: "",
    luggage: "",
    fuelEfficient: false,
  });

  const { data: vehicles = [], isLoading } = useQuery<VehicleWithHost[]>({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: hosts = [], isLoading: hostsLoading } = useQuery<Host[]>({
    queryKey: ["/api/hosts"],
    queryFn: async () => {
      const res = await fetch("/api/hosts");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const toggleHostStatus = useMutation({
    mutationFn: async (host: Host) => {
      const newStatus = host.status === 'active' ? 'inactive' : 'active';
      const res = await apiRequest("PATCH", `/api/hosts/${host.id}`, { status: newStatus });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Host status updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });
    },
    onError: () => {
      toast({ title: "Failed to update host status", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/vehicles", {
        name: formData.name,
        category: formData.category,
        image: formData.image,
        pricePerDay: parseFloat(formData.pricePerDay),
        payNowPrice: parseFloat(formData.payNowPrice),
        mpg: parseInt(formData.mpg),
        passengers: parseInt(formData.passengers),
        luggage: parseInt(formData.luggage),
        fuelEfficient: formData.fuelEfficient,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vehicle created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create vehicle", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/vehicles/${id}`, {
        name: formData.name,
        category: formData.category,
        image: formData.image,
        pricePerDay: parseFloat(formData.pricePerDay),
        payNowPrice: parseFloat(formData.payNowPrice),
        mpg: parseInt(formData.mpg),
        passengers: parseInt(formData.passengers),
        luggage: parseInt(formData.luggage),
        fuelEfficient: formData.fuelEfficient,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vehicle updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setOpen(false);
      resetForm();
      setConfirmationDialog({ open: false, action: 'edit', vehicle: null });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update vehicle", 
        description: error.message || "An error occurred while updating the vehicle",
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/vehicles/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Vehicle deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setConfirmationDialog({ open: false, action: 'delete', vehicle: null });
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
      luggage: "",
      fuelEfficient: false,
    });
    setEditingVehicle(null);
  };

  const handleEdit = (vehicle: VehicleWithHost) => {
    setConfirmationDialog({ open: true, action: 'edit', vehicle });
  };

  const proceedEdit = () => {
    if (confirmationDialog.vehicle) {
      setEditingVehicle(confirmationDialog.vehicle);
      setFormData({
        name: confirmationDialog.vehicle.name,
        category: confirmationDialog.vehicle.category,
        image: confirmationDialog.vehicle.image,
        pricePerDay: confirmationDialog.vehicle.pricePerDay.toString(),
        payNowPrice: confirmationDialog.vehicle.payNowPrice.toString(),
        mpg: confirmationDialog.vehicle.mpg.toString(),
        passengers: confirmationDialog.vehicle.passengers.toString(),
        luggage: confirmationDialog.vehicle.luggage.toString(),
        fuelEfficient: confirmationDialog.vehicle.fuelEfficient,
      });
      setOpen(true);
      setConfirmationDialog({ open: false, action: 'edit', vehicle: null });
    }
  };

  const handleDelete = (vehicle: VehicleWithHost) => {
    setConfirmationDialog({ open: true, action: 'delete', vehicle });
  };

  const proceedDelete = () => {
    if (confirmationDialog.vehicle) {
      deleteMutation.mutate(confirmationDialog.vehicle.id);
    }
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="hosts">Hosts</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles">
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
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEDAN">SEDAN</SelectItem>
                      <SelectItem value="SUV">SUV</SelectItem>
                      <SelectItem value="HATCHBACK">HATCHBACK</SelectItem>
                      <SelectItem value="MINIVAN">MINIVAN</SelectItem>
                    </SelectContent>
                  </Select>
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

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.fuelEfficient}
                    onCheckedChange={(c) => setFormData({ ...formData, fuelEfficient: !!c })}
                  />
                  <Label>Fuel Efficient (30+ MPG)</Label>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
                      {vehicle.category} • {vehicle.mpg} MPG
                    </p>
                    {vehicle.hostInfo && (
                      <p className="text-sm mt-2 text-blue-600 dark:text-blue-400 font-medium">
                        Host: {vehicle.hostInfo.firstName} {vehicle.hostInfo.lastName}
                        {vehicle.hostInfo.city && vehicle.hostInfo.state && (
                          <span className="text-blue-600 dark:text-blue-400 ml-2">• {vehicle.hostInfo.city}, {vehicle.hostInfo.state}</span>
                        )}
                      </p>
                    )}
                    <p className="text-sm mt-2">
                      ${vehicle.payNowPrice}/day (regular: ${vehicle.pricePerDay}) • {vehicle.passengers} passengers • {vehicle.luggage} bags
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(vehicle)}
                      data-testid="button-edit-vehicle"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(vehicle)}
                      data-testid="button-delete-vehicle"
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
        </TabsContent>

        <TabsContent value="hosts">
          <div className="mb-6">
            <h1 className="font-display text-3xl font-bold">Host Management</h1>
          </div>

          {hostsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {hosts.map((host) => (
                <Card key={host.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{host.firstName} {host.lastName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {host.email} • {host.phone}
                        </p>
                        {host.city && host.state && (
                          <p className="text-sm mt-2 text-muted-foreground">
                            {host.city}, {host.state}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            host.status === 'active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {host.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {host.status === 'active' ? 'Deactivate' : 'Activate'}
                          </span>
                          <Switch
                            checked={host.status === 'active'}
                            onCheckedChange={() => toggleHostStatus.mutate(host)}
                            disabled={toggleHostStatus.isPending}
                            data-testid="switch-host-status"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmationDialog.open} onOpenChange={(open) => setConfirmationDialog({ ...confirmationDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {confirmationDialog.action === 'edit' ? 'Edit' : 'Delete'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDialog.vehicle?.hostInfo ? (
                <span>
                  This vehicle belongs to host <span className="font-semibold text-foreground">{confirmationDialog.vehicle.hostInfo.firstName} {confirmationDialog.vehicle.hostInfo.lastName}</span>. Are you sure you want to continue?
                </span>
              ) : (
                `Are you sure you want to ${confirmationDialog.action} this vehicle?`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel data-testid="button-cancel-confirmation">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmationDialog.action === 'edit' ? proceedEdit : proceedDelete}
              data-testid="button-confirm-action"
            >
              {confirmationDialog.action === 'edit' ? 'Edit Vehicle' : 'Delete Vehicle'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
