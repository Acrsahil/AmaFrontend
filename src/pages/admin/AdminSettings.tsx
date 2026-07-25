import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Store, Phone, Mail, MapPin, FileText, Save, Loader2, Link2, ImageUp, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "../../auth/auth";
import { fetchBranch, updateBranch, updateBranchImage } from "../../api";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branchData, setBranchData] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = getCurrentUser();

  useEffect(() => {
    if (user?.branch_id) {
      loadBranchData();
    }
  }, [user?.branch_id]);

  const loadBranchData = async () => {
    setLoading(true);
    try {
      const data = await fetchBranch(user.branch_id);
      if (data.success && data.data) {
        setBranchData(data.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load branch settings");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !branchData?.id) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const response = await updateBranchImage(branchData.id, file);
      if (response.success) {
        toast.success("QR code uploaded successfully");
        // Reload branch data to get updated image_url
        await loadBranchData();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchData) {
      console.warn("⚠️ No branch data to save");
      return;
    }

    console.log("💾 Attempting to save branch settings...", {
      id: branchData.id,
      payload: {
        name: branchData.name,
        location: branchData.location,
        phone: branchData.phone,
        email: branchData.email,
        address: branchData.address,
        receipt_header: branchData.receipt_header,
        receipt_footer: branchData.receipt_footer
      }
    });

    setSaving(true);
    try {
      const response = await updateBranch(branchData.id, {
        name: branchData.name,
        location: branchData.location,
        phone: branchData.phone,
        email: branchData.email,
        address: branchData.address,
        receipt_header: branchData.receipt_header,
        receipt_footer: branchData.receipt_footer
      });
      console.log("✅ Update Branch Response:", response);
      toast.success("Settings updated successfully");
    } catch (err: any) {
      console.error("❌ Failed to update settings:", err);
      toast.error(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Branch Settings</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your restaurant info and receipt details</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="h-12 px-8 rounded-2xl font-bold gap-2 shadow-lg shadow-primary/20">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* General Information */}
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 px-8 py-8">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black">Basic Information</CardTitle>
                  <CardDescription className="font-bold text-slate-400">Branch identity and contact details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-8 py-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Display Name</Label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="h-12 pl-12 rounded-xl font-bold bg-slate-50 border-transparent focus:bg-white transition-all"
                      value={branchData?.name || ""}
                      onChange={(e) => setBranchData({ ...branchData, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="h-12 pl-12 rounded-xl font-bold bg-slate-50 border-transparent focus:bg-white transition-all"
                      value={branchData?.phone || ""}
                      onChange={(e) => setBranchData({ ...branchData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      className="h-12 pl-12 rounded-xl font-bold bg-slate-50 border-transparent focus:bg-white transition-all"
                      value={branchData?.email || ""}
                      onChange={(e) => setBranchData({ ...branchData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Short Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="h-12 pl-12 rounded-xl font-bold bg-slate-50 border-transparent focus:bg-white transition-all"
                      value={branchData?.location || ""}
                      onChange={(e) => setBranchData({ ...branchData, location: e.target.value })}
                    />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Receipt Customization */}
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 px-8 py-8">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black">Receipt Branding</CardTitle>
                  <CardDescription className="font-bold text-slate-400">Configure how your prints look</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-8 py-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Receipt Header Title</Label>
                <Input
                  className="h-12 rounded-xl font-bold bg-slate-50 border-transparent focus:bg-white transition-all px-4"
                  value={branchData?.receipt_header || ""}
                  onChange={(e) => setBranchData({ ...branchData, receipt_header: e.target.value })}
                  placeholder="e.g. AMA BAKERY - MAIN STREET"
                />
                <p className="text-[10px] font-bold text-slate-400">This appears at the very top of the bill</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Receipt Footer Note</Label>
                <Input
                  className="h-12 rounded-xl font-bold bg-slate-50 border-transparent focus:bg-white transition-all px-4"
                  value={branchData?.receipt_footer || ""}
                  onChange={(e) => setBranchData({ ...branchData, receipt_footer: e.target.value })}
                  placeholder="e.g. THANK YOU FOR YOUR VISIT!"
                />
                <p className="text-[10px] font-bold text-slate-400">This appears at the very bottom of the bill</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Sidebar */}
        <div className="space-y-8">
          {/* QR Code / Branch Image Upload */}
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 px-8 py-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <QrCode className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black">QR Code / Logo</CardTitle>
                  <CardDescription className="font-bold text-slate-400 text-xs">Upload your branch QR code or logo</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-8 py-6 space-y-4">
              {/* Image Preview */}
              {branchData?.image_url ? (
                <div className="relative group">
                  <img
                    src={branchData.image_url}
                    alt="Branch QR Code"
                    className="w-full aspect-square object-contain rounded-2xl border-2 border-slate-100 bg-white p-4"
                  />
                </div>
              ) : (
                <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <QrCode className="h-12 w-12" />
                  <p className="text-sm font-bold">No QR code uploaded</p>
                  <p className="text-[10px] font-medium">Upload a QR code image for your branch</p>
                </div>
              )}

              {/* Upload Controls */}
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-12 rounded-xl border-2 border-dashed border-emerald-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 font-bold gap-2 transition-all"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageUp className="h-4 w-4" />
                  )}
                  {uploadingImage ? "Uploading..." : "Upload Image"}
                </Button>
                <p className="text-[10px] text-slate-400 font-medium text-center">
                  Supports JPG, PNG, WEBP. Max 5MB.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 px-8 py-6">
              <CardTitle className="text-white text-lg">Bill Preview</CardTitle>
              <CardDescription className="text-slate-400 text-xs">Real-time receipt preview</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-8 bg-white text-slate-900 border-x border-b mx-4 mb-8 mt-4 shadow-sm font-mono text-[10px] leading-tight space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-[14px] font-black uppercase">{branchData?.receipt_header || "AMA BAKERY"}</p>
                  <p>Tel: {branchData?.phone || "Ph no here"}</p>
                  {branchData?.location && <p>{branchData.location.toUpperCase()}</p>}
                </div>

                <div className="border-y border-dashed py-2 space-y-1">
                  <div className="flex justify-between">
                    <span>INV: #POS-123456</span>
                    <span>CSHR: Admin</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE: {new Date().toLocaleDateString()}</span>
                    <span>CUST: Walk-in</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between border-b border-dashed pb-1 font-black">
                    <span>ITEM</span>
                    <span>QTY</span>
                    <span>TOTAL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sample Product</span>
                    <span>1</span>
                    <span>100.00</span>
                  </div>
                </div>

                <div className="border-t border-dashed pt-2 space-y-1 text-right">
                  <p className="font-black text-[12px]">TOTAL: Rs.100.00</p>
                </div>

                <div className="text-center pt-4 border-t border-dashed">
                  <p className="font-black uppercase">{branchData?.receipt_footer || "THANK YOU FOR YOUR VISIT!"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
