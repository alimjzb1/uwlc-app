import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import type { Order } from "@/types";
import { supabase } from "@/lib/supabase";

interface OrderApprovalProps {
    order: Order;
    onOrderUpdated: () => void;
}

export function OrderApproval({ order, onOrderUpdated }: OrderApprovalProps) {
    const [note, setNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleApprove = async () => {
        setIsSubmitting(true);
        const { error } = await supabase
            .from('orders')
            .update({ 
                internal_status: 'ready_to_ship',
                note: note ? `${order.note || ''}\nApproval Note: ${note}` : order.note
            })
            .eq('id', order.id);

        setIsSubmitting(false);
        if (!error) {
            onOrderUpdated();
        } else {
            console.error("Error approving order:", error);
        }
    };

    const handleReject = async () => {
        setIsSubmitting(true);
        const { error } = await supabase
            .from('orders')
            .update({ 
                internal_status: 'cancelled',
                note: note ? `${order.note || ''}\nRejection Reason: ${note}` : order.note
            })
            .eq('id', order.id);

        setIsSubmitting(false);
        if (!error) {
            onOrderUpdated();
        } else {
             console.error("Error rejecting order:", error);
        }
    };

    if (order.internal_status !== 'needs_approval') {
        return null;
    }

    return (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <AlertCircle className="h-5 w-5" />
                    Approval Required
                </CardTitle>
                <CardDescription className="text-orange-600/80 dark:text-orange-500/80">
                    This order has been flagged and requires manual approval before processing.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Textarea 
                    placeholder="Add a note (optional)..." 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-white dark:bg-slate-950"
                />
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
                <Button 
                    variant="destructive" 
                    onClick={handleReject} 
                    disabled={isSubmitting}
                >
                    <XCircle className="mr-2 h-4 w-4" /> Reject Order
                </Button>
                <Button 
                    onClick={handleApprove} 
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white"
                >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Order
                </Button>
            </CardFooter>
        </Card>
    );
}
