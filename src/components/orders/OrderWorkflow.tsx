import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Package, Camera, Video, X, Loader2, AlertCircle, ShieldCheck, XCircle, Clock, Info } from "lucide-react";
import type { Order } from "@/types";
import { supabase } from "@/lib/supabase";
import { useOrderVerifications } from "@/hooks/use-order-verifications";
import { useInventory } from "@/hooks/use-inventory";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthContext";

import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface OrderWorkflowProps {
    order: Order;
    onOrderUpdated: () => void;
    isPackagable?: boolean;
}

export function OrderWorkflow({ order, onOrderUpdated, isPackagable = true }: OrderWorkflowProps) {
    const { user } = useAuth();
    const { verifications, addVerification, removeVerification } = useOrderVerifications(order.id);
    const { deductStockForOrder } = useInventory();
    const [uploadingItem, setUploadingItem] = useState<string | null>(null); // itemId or 'video'

    const [processingAction, setProcessingAction] = useState(false);
    const [pendingAdminAction, setPendingAdminAction] = useState<{ type: 'approve' | 'reject' | 'override', status: string } | null>(null);
    const [missingStockItems, setMissingStockItems] = useState<any[] | null>(null);
    const [isOverrideMode, setIsOverrideMode] = useState(false);


    // Requirement Calculations
    const itemRequirements = useMemo(() => {
        return order.items?.map(item => ({
            itemId: item.id,
            sku: item.sku,
            name: item.name,
            requiredImages: item.quantity,
            uploadedImages: verifications.filter(v => 
                (v.variant_id === item.sku) || 
                (v.variant_id === item.id)
            ),
        })) || [];
    }, [order.items, verifications]);

    const requiresVideo = (order.items?.length || 0) > 1;
    const uploadedVideo = verifications.find(v => v.media_type === 'video' && v.variant_id === 'video');

    // Check if fully verified
    const isItemsVerified = itemRequirements.every(req => req.uploadedImages.length >= req.requiredImages);
    const isVideoVerified = requiresVideo ? !!uploadedVideo : true;
    const canFinish = isItemsVerified && isVideoVerified;

    const logAudit = async (action: 'UPDATE', newData: any, oldData: any) => {
        if (!user) return;
        const { error } = await supabase.from('audit_logs').insert({
            table_name: 'orders',
            record_id: order.id,
            action: action,
            new_data: newData,
            old_data: oldData,
            user_id: user.id
        });
        if (error) console.error("Audit Log Error:", error);
    };

    const handleStartPackaging = async () => {
        setProcessingAction(true);
        
        // Compute and deduct stock FIRST
        const deduction = await deductStockForOrder(order.id);
        if (!deduction?.success) {
            setProcessingAction(false);
            setMissingStockItems(deduction?.missingItems || []);
            return;
        }

        const { error } = await supabase
            .from('orders')
            .update({ internal_status: 'packaging' })
            .eq('id', order.id);
        
        if (error) {
            console.error("Error starting packaging:", error);
        } else {
            await logAudit('UPDATE', { internal_status: 'packaging' }, { internal_status: order.internal_status });
            onOrderUpdated();
        }
        setProcessingAction(false);
    };

    const handleFinishPackaging = async () => {
         setProcessingAction(true);
         const { error } = await supabase
            .from('orders')
            .update({ internal_status: 'needs_approval' })
            .eq('id', order.id);
        
        if (error) {
            console.error("Error finishing packaging:", error);
        } else {
            await logAudit('UPDATE', { internal_status: 'needs_approval' }, { internal_status: order.internal_status });
            onOrderUpdated();
        }
        setProcessingAction(false);
    };

    const confirmAdminAction = (approved: boolean) => {
         const newStatus = approved ? 'ready_to_ship' : 'packaging';
         setPendingAdminAction({ type: approved ? 'approve' : 'reject', status: newStatus });
    }

    const executeAdminAction = async () => {
        if (!user || !pendingAdminAction) return;
        setProcessingAction(true);
        
        try {
            const { error } = await supabase
                .from('orders')
                .update({ internal_status: pendingAdminAction.status })
                .eq('id', order.id);

            if (error) {
                alert("Action failed: " + error.message);
            } else {
                await logAudit('UPDATE', { internal_status: pendingAdminAction.status }, { internal_status: order.internal_status });
                onOrderUpdated();
                setIsOverrideMode(false);
            }
        } catch (err: any) {
            alert("Approval failed: " + err.message);
        } finally {
            setProcessingAction(false);
            setPendingAdminAction(null);
        }
    };



    const handleManualStatusChange = (newStatus: string) => {
        setPendingAdminAction({ type: 'override', status: newStatus });
    };


    const onFileUpload = async (file: File, type: 'image' | 'video', contextId: string, variantId?: string | null) => {
        setUploadingItem(contextId);
        try {
            await addVerification(file, type, variantId);
        } catch (e) {
            alert("Upload failed");
        } finally {
            setUploadingItem(null);
        }
    };

    // Shared Verification View Component
    const VerificationView = ({ readOnly }: { readOnly: boolean }) => (
        <CardContent className="space-y-8 pt-6">
            {/* 1. Item Verification (1 img per qty) */}
            <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center">
                    1. Item Verification 
                    <Badge variant="secondary" className="ml-2 font-normal">
                        {itemRequirements.filter(r => r.uploadedImages.length >= r.requiredImages).length}/{itemRequirements.length} Completed
                    </Badge>
                </h3>
                <div className="space-y-6">
                    {itemRequirements.map((req) => (
                        <div key={req.itemId} className="border rounded-lg p-4 bg-card/50">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-medium text-foreground">{req.name}</h4>
                                    <p className="text-sm text-muted-foreground font-mono">SKU: {req.sku}</p>
                                </div>
                                <Badge variant={req.uploadedImages.length >= req.requiredImages ? "default" : "outline"}>
                                    {req.uploadedImages.length} / {req.requiredImages} photos
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {/* Uploaded Photos */}
                                {req.uploadedImages.map(img => (
                                    <Dialog key={img.id}>
                                        <DialogTrigger asChild>
                                            <div className="relative aspect-square rounded-md overflow-hidden group border bg-background cursor-zoom-in">
                                                <img src={img.media_url} alt="Verification" className="object-cover w-full h-full" />
                                                
                                                {/* Timestamp Overlay */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white text-[10px] p-1 truncate flex items-center justify-center">
                                                    {format(new Date(img.created_at), 'MM/dd HH:mm')}
                                                </div>

                                                {!readOnly && (
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeVerification(img.id, img.media_url);
                                                        }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                                            <DialogHeader className="hidden">
                                                <DialogTitle>Verification Preview</DialogTitle>
                                            </DialogHeader>
                                            <div className="relative w-full h-full flex items-center justify-center p-4">
                                                <img src={img.media_url} alt="Verification Full" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl ring-1 ring-white/20" />
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                ))}

                                {/* Upload Button */}
                                {!readOnly && req.uploadedImages.length < req.requiredImages && (
                                    <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-muted-foreground/25 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                        {uploadingItem === req.itemId ? (
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        ) : (
                                            <>
                                                <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                                                <span className="text-[10px] text-muted-foreground text-center px-1">Add Photo</span>
                                            </>
                                        )}
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden"
                                            disabled={!!uploadingItem}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                const vId = req.sku; 
                                                if (file) onFileUpload(file, 'image', req.itemId, vId);
                                            }} 
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* 2. Box Verification (Video) */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold flex items-center">
                        2. Final Package Verification
                        {!requiresVideo && <Badge variant="secondary" className="ml-2">Optional</Badge>}
                    </h3>
                    {requiresVideo && (
                        <Badge variant={isVideoVerified ? "default" : "destructive"}>
                            {isVideoVerified ? "Verified" : "Video Required"}
                        </Badge>
                    )}
                </div>
                
                {requiresVideo && (
                        <div className="border rounded-lg p-4 bg-muted/10">
                        <p className="text-sm text-muted-foreground mb-4">
                            Since this order contains multiple items, a video of the packaging process functionality is required.
                        </p>
                        
                        {uploadedVideo ? (
                            <div className="relative aspect-video rounded-md overflow-hidden bg-black group border">
                                <video src={uploadedVideo.media_url} controls className="w-full h-full" />
                                
                                {/* Timestamp Overlay for Video */}
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {format(new Date(uploadedVideo.created_at), 'MM/dd HH:mm')}
                                </div>

                                {!readOnly && (
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => removeVerification(uploadedVideo.id, uploadedVideo.media_url)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ) : (
                            !readOnly && (
                                <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-muted-foreground/25 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                {uploadingItem === 'video' ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                ) : (
                                    <>
                                        <Video className="h-8 w-8 text-muted-foreground mb-2" />
                                        <span className="text-sm text-muted-foreground">Upload Video Evidence</span>
                                    </>
                                )}
                                <input 
                                    type="file" 
                                    accept="video/*" 
                                    className="hidden"
                                    disabled={!!uploadingItem}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) onFileUpload(file, 'video', 'video', 'video');
                                    }} 
                                />
                            </label>
                            )
                        )}
                        </div>
                )}
                    {!requiresVideo && (
                    <div className="flex items-center text-muted-foreground text-sm italic">
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Single item order - No video required.
                    </div>
                    )}
            </div>
        </CardContent>
    );

    if (order.internal_status === 'new') {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                        <CardTitle>Order Workflow</CardTitle>
                        <CardDescription>Start packaging to begin verification process.</CardDescription>
                    </div>
                    {user?.role === 'admin' && (
                        <Button 
                            variant={isOverrideMode ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setIsOverrideMode(!isOverrideMode)}
                            className="text-[10px] font-black uppercase tracking-widest h-8"
                        >
                            {isOverrideMode ? "Cancel Edit" : "Edit Status"}
                        </Button>
                    )}
                </CardHeader>
                {isOverrideMode && (
                    <CardContent className="pt-2 pb-6 border-b border-muted/20 bg-primary/5">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest">Manual Status Change (Admin)</Label>
                            <div className="flex flex-wrap gap-2">
                                {["new", "packaging", "needs_approval", "ready_to_ship", "shipped", "delivered", "cancelled"].map(s => (
                                    <Button 
                                        key={s} 
                                        variant={order.internal_status === s ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleManualStatusChange(s)}
                                        className="h-8 text-[10px] font-bold uppercase"
                                    >
                                        {s.replace(/_/g, ' ')}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                )}

                <CardFooter className="flex-col items-start gap-3">
                    {!isPackagable && (
                        <div className="flex items-start gap-2 text-destructive bg-destructive/5 p-3 rounded-md text-xs font-bold border border-destructive/10 w-full mb-1">
                            <AlertCircle className="h-4 w-4 mt-0.5" />
                            <span>This order is blocked due to insufficient stock or unlinked products. Correct inventory before proceeding.</span>
                        </div>
                    )}
                    <Button 
                        onClick={handleStartPackaging} 
                        disabled={processingAction || !isPackagable} 
                        className="w-full sm:w-auto"
                        variant={!isPackagable ? "secondary" : "default"}
                    >
                        {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Package className="mr-2 h-4 w-4" /> Start Packaging
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    if (order.internal_status === 'packaging') {
        return (
            <Card className="border-l-4 border-l-blue-500">
                 <CardHeader>
                    <CardTitle className="flex items-center text-blue-600 dark:text-blue-400">
                        <Package className="mr-2 h-5 w-5" />
                        Packaging & Verification
                    </CardTitle>
                    <CardDescription>
                        Complete the following requirements to proceed.
                    </CardDescription>
                </CardHeader>
                
                <VerificationView readOnly={false} />

                <CardFooter className="flex-col gap-2 pt-6">
                    {!canFinish && (
                         <div className="flex items-center text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-3 py-2 rounded-md text-sm w-full mb-2">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Please complete all verification steps above.
                        </div>
                    )}
                    <Button 
                        onClick={handleFinishPackaging} 
                        className="w-full" 
                        disabled={!canFinish || processingAction}
                    >
                         {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <CheckCircle2 className="mr-2 h-4 w-4" /> 
                        Submit for Approval
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    if (order.internal_status === 'needs_approval') {
         return (
             <>
                <Card className="border-l-4 border-l-amber-500 bg-background">
                    <CardHeader>
                        <CardTitle className="text-amber-600 dark:text-amber-500 flex items-center">
                            <AlertCircle className="mr-2 h-5 w-5" /> Waiting for Approval
                        </CardTitle>
                        <CardDescription>
                            Review the verifications below before approving this order for shipment.
                        </CardDescription>
                    </CardHeader>
                    
                    <VerificationView readOnly={true} />

                    <CardFooter className="flex gap-2 justify-end bg-muted/50 pt-6 rounded-b-lg">
                        <Button variant="outline" onClick={() => confirmAdminAction(false)} disabled={processingAction} className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50">
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                        </Button>
                        <Button onClick={() => confirmAdminAction(true)} disabled={processingAction} className="bg-green-600 hover:bg-green-700 text-white">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Approve
                        </Button>
                    </CardFooter>
                </Card>

                <AlertDialog open={!!pendingAdminAction} onOpenChange={() => setPendingAdminAction(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {pendingAdminAction?.type === 'approve' && 'Approve for Shipping?'}
                                {pendingAdminAction?.type === 'reject' && 'Reject and Re-open?'}
                                {pendingAdminAction?.type === 'override' && 'Override Order Status?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {pendingAdminAction?.type === 'approve' && "This will mark the order as ready to ship. Please ensure all verification photos and videos meet quality standards."}
                                {pendingAdminAction?.type === 'reject' && "This will move the order back to 'Packaging' status. The team will need to re-verify items."}
                                {pendingAdminAction?.type === 'override' && `You are manually changing the status to ${pendingAdminAction.status.toUpperCase()}. This bypasses standard workflow checks.`}
                                
                                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 text-sm flex items-start">
                                    <Info className="h-4 w-4 mr-2 mt-0.5" />
                                    <span>Warning: Manually changing order status is not recommended unless you are certain. Ensure all checks are complete.</span>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={executeAdminAction}
                                className={pendingAdminAction?.type === 'approve' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                            >
                                {pendingAdminAction?.type === 'approve' ? 'Confirm Approval' : (pendingAdminAction?.type === 'override' ? 'Confirm Override' : 'Confirm Rejection')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog open={!!missingStockItems} onOpenChange={() => setMissingStockItems(null)}>
                    <AlertDialogContent className="border-red-500/30">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5" /> Insufficient Global Inventory
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Could not move this order to packaging. You don't have enough physical stock (Shopify + Internal) to satisfy the required items:
                                <div className="mt-4 space-y-2">
                                    {missingStockItems?.map((m: any, idx: number) => (
                                         <div key={idx} className="bg-red-50 text-red-800 p-2 rounded text-xs font-mono font-bold flex justify-between">
                                             <span>{m.name} (SKU: {m.sku})</span>
                                             <span>Available: {m.available} / Required: {m.required}</span>
                                         </div>
                                    ))}
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Dismiss</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </>
         )
    }

    if (order.internal_status === 'ready_to_ship' || order.internal_status === 'shipped' || order.internal_status === 'delivered') {
        return (
            <Card className="border-l-4 border-l-green-500 bg-background">
                <CardHeader>
                    <CardTitle className="text-green-600 dark:text-green-500 flex items-center">
                        <CheckCircle2 className="mr-2 h-5 w-5" /> Verified & Approved
                    </CardTitle>
                    <CardDescription>
                        This order has been verified and approved for shipping.
                    </CardDescription>
                </CardHeader>

                <VerificationView readOnly={true} />
            </Card>
        );
    }

    return null;
}
