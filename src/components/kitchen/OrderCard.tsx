import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Clock, Layers, AlertCircle, CheckCircle2, ChefHat, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInMinutes, parseISO } from "date-fns";
import { useState, useEffect } from "react";

interface OrderCardProps {
  order: any;
  onStatusChange: (orderId: string, status: string) => void;
  onItemStatusChange?: (orderId: string, itemId: string, newStatus: string) => void;
}

export function OrderCard({ order, onStatusChange, onItemStatusChange }: OrderCardProps) {
  const [timeAgo, setTimeAgo] = useState<string>("");

  const getNextStatus = (): string | null => {
    switch (order.status) {
      case 'new': return 'ready';
      case 'preparing': return 'ready';
      case 'ready': return 'completed';
      default: return null;
    }
  };

  const getActionLabel = (): string => {
    switch (order.status) {
      case 'new': return 'Mark Ready';
      case 'preparing': return 'Mark Ready';
      case 'ready': return 'Complete';
      default: return '';
    }
  };

  const nextStatus = getNextStatus();

  // Determine if any items have an updated_at timestamp (newly added)
  const hasNewItems = order.items?.some((item: any) => !!item.updated_at) || false;
  // For backward compatibility, consider items with recent updates (if isRecentlyUpdated flag exists)
  const hasUpdatedItems = order.items?.some((item: any) => item.isRecentlyUpdated) || false;

  // Helper function to check if an item was newly added (based on updated_at)
  const isNewlyAddedItem = (item: any): boolean => {
    // If updated_at exists, consider it newly added
    return !!item.updated_at;
  };

  // Helper function to get time since item was added/updated
  const getItemTimeAgo = (item: any): string => {
    try {
      // Prefer updated_at to show when the item was last modified
      const timestamp = item.updated_at || item.created_at;
      if (!timestamp) return "";

      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return "";
    }
  };

  useEffect(() => {
    const updateTime = () => {
      if (order.createdAt) {
        try {
          setTimeAgo(formatDistanceToNow(new Date(order.createdAt), { addSuffix: true }));
        } catch (e) {
          setTimeAgo("");
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [order.createdAt]);

  // Group items by status
  const groupedItems = order.items?.reduce((acc: any, item: any) => {
    const status = (item.status || 'PENDING').toUpperCase();
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(item);
    return acc;
  }, {});

  // Define status order and styling
  const statusConfig = {
    'PENDING': {
      label: 'Pending',
      icon: AlertCircle,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      headerBg: 'bg-amber-100',
      textColor: 'text-amber-900',
      badgeColor: 'bg-amber-200 text-amber-900'
    },
    'READY': {
      label: 'Ready',
      icon: CheckCircle2,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      headerBg: 'bg-emerald-100',
      textColor: 'text-emerald-900',
      badgeColor: 'bg-emerald-200 text-emerald-900'
    },
    'COMPLETED': {
      label: 'Completed',
      icon: CheckCircle2,
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
      headerBg: 'bg-slate-100',
      textColor: 'text-slate-700',
      badgeColor: 'bg-slate-200 text-slate-700'
    }
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig['PENDING'];
  };

  return (
    <div className={cn(
      "bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-full transition-all duration-300",
      hasNewItems ? "border-blue-400 shadow-blue-200 shadow-lg ring-2 ring-blue-400/50" :
        hasUpdatedItems ? "border-amber-400 shadow-amber-200 shadow-lg ring-2 ring-amber-400/50" :
          "border-slate-200 hover:shadow-lg"
    )}>
      {/* Status Header Strip */}
      <div className={cn(
        "h-1.5 w-full",
        order.status === 'new' && "bg-blue-500",
        order.status === 'preparing' && "bg-amber-500",
        order.status === 'ready' && "bg-emerald-500",
        order.status === 'completed' && "bg-slate-400"
      )} />

      {/* Card Header (Minimized Metadata) */}
      <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
          <span className="text-[10px] sm:text-xs font-black text-slate-400 shrink-0">#{order.invoiceNumber}</span>
          {timeAgo && (
            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded animate-pulse shrink-0">
              <Clock className="h-2.5 w-2.5" />
              <span className="text-[10px] font-black uppercase tracking-tight">{timeAgo}</span>
            </div>
          )}
          {/* UPDATED Order Badge */}
          {(hasNewItems || hasUpdatedItems) && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[9px] font-black uppercase tracking-wider animate-pulse shadow-lg",
              hasNewItems ? "bg-blue-600" : "bg-amber-500"
            )}>
              <AlertCircle className="h-3 w-3" />
              {hasNewItems ? "NEW ITEMS" : "UPDATED"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right flex flex-col items-end gap-1.5">
            {order.tableNumber ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TABLE</span>
                <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 min-w-[30px] text-center shadow-sm">
                  {order.tableNumber}
                </span>
              </div>
            ) : (
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">TAKEAWAY</span>
            )}
            {order.floorName && (
              <div className="flex items-center gap-1.5 bg-primary/5 px-2 py-1 rounded-lg border border-primary/10 shadow-sm mt-1">
                <Layers className="h-3 w-3 text-primary opacity-70" />
                <span className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-tight">
                  {order.floorName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items List Grouped by Status */}
      <div className="p-4 flex-grow space-y-3">
        {groupedItems && Object.keys(groupedItems).length > 0 ? (
          Object.entries(groupedItems)
            .sort(([a], [b]) => {
              // Sort: PENDING first, then READY, then COMPLETED
              const order = ['PENDING', 'READY', 'COMPLETED'];
              return order.indexOf(a) - order.indexOf(b);
            })
            .map(([status, items]: [string, any[]]) => {
              const config = getStatusConfig(status);
              const StatusIcon = config.icon;

              return (
                <div key={status} className={cn("rounded-lg border overflow-hidden", config.borderColor)}>
                  {/* Status Header */}
                  <div className={cn("px-3 py-2 flex items-center gap-2 border-b", config.headerBg)}>
                    <StatusIcon className={cn("h-4 w-4", config.textColor)} />
                    <span className={cn("text-xs font-black uppercase tracking-wider", config.textColor)}>
                      {config.label}
                    </span>
                    <span className={cn("ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full", config.badgeColor)}>
                      {items.length}
                    </span>
                  </div>

                  {/* Items in this status */}
                  <div className={cn("p-2 space-y-1.5", config.bgColor)}>
                    {items.map((item: any, index: number) => {
                      // Use the actual database ID for the item
                      const itemId = String(item.id || `${order.id}-${index}`);
                      const isNewItem = isNewlyAddedItem(item);
                      const itemTimeAgo = getItemTimeAgo(item);

                      return (
                        <div key={item.id || index} className={cn(
                          "flex items-start justify-between gap-2 group p-2.5 rounded-lg border transition-all",
                          isNewItem ? "bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-300 shadow-md animate-pulse" :
                            item.isRecentlyUpdated ? "bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-300 shadow-md" :
                              "bg-white/60 border-slate-100"
                        )}>
                          <div className="flex-1 min-w-0 flex items-start gap-2">
                            {/* Quantity badge - fixed width */}
                            <div className={cn(
                              "flex-shrink-0 min-w-[32px] h-6 px-2 rounded-md flex items-center justify-center text-sm font-black shadow-sm",
                              isNewItem ? "bg-blue-600 text-white border-2 border-blue-700" :
                                item.isRecentlyUpdated ? "bg-amber-500 text-white border-2 border-amber-600" :
                                  "bg-white border-2 border-slate-200 text-slate-900"
                            )}>
                              x{item.quantity}
                            </div>

                            {/* Item name and notes */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2 flex-wrap">
                                <p className="text-sm font-black text-slate-800 leading-tight tracking-tight capitalize break-words">
                                  {item.menuItem.name}
                                </p>
                                {/* NEW badge for newly added items */}
                                {isNewItem && (
                                  <div className="inline-flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-lg">
                                    <Sparkles className="h-3 w-3" />
                                    <span className="text-[9px] font-black uppercase tracking-wider">NEW</span>
                                  </div>
                                )}
                                {/* UPDATED badge for modified items */}
                                {!isNewItem && item.isRecentlyUpdated && (
                                  <div className="inline-flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-lg">
                                    <AlertCircle className="h-3 w-3" />
                                    <span className="text-[9px] font-black uppercase tracking-wider">UPDATED</span>
                                  </div>
                                )}
                              </div>

                              {/* Show timestamp and who updated for updated items */}
                              {(isNewItem || item.isRecentlyUpdated) && itemTimeAgo && (
                                <div className={cn(
                                  "mt-1 flex items-center gap-1 text-[10px] font-bold",
                                  isNewItem ? "text-blue-700" : "text-amber-700"
                                )}>
                                  <Clock className="h-3 w-3" />
                                  <span>{isNewItem ? 'Added' : 'Updated'} {itemTimeAgo}</span>
                                  {item.updated_by_name && (
                                    <span className="ml-1">by {item.updated_by_name}</span>
                                  )}
                                </div>
                              )}

                              {item.notes && (
                                <div className="mt-1.5 flex items-start gap-1 bg-amber-50 px-1.5 py-1 rounded border border-amber-100">
                                  <span className="text-amber-600 text-[9px] font-black uppercase mt-0.5 tracking-tighter flex-shrink-0">NOTE:</span>
                                  <p className="text-[10px] text-amber-700 font-bold italic leading-tight break-words">
                                    {item.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action buttons - always visible, fixed width */}
                          <div className="flex-shrink-0">
                            {onItemStatusChange && status === 'PENDING' && (
                              <Button
                                size="sm"
                                className="h-7 w-16 text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm"
                                onClick={() => onItemStatusChange(order.id, itemId, 'READY')}
                                title="Mark this item as Ready"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                Ready
                              </Button>
                            )}
                            {onItemStatusChange && status === 'READY' && (
                              <Button
                                size="sm"
                                className="h-7 w-16 text-[10px] font-black bg-slate-600 hover:bg-slate-700 text-white rounded-md shadow-sm"
                                onClick={() => onItemStatusChange(order.id, itemId, 'COMPLETED')}
                                title="Mark this item as Completed"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                Done
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
        ) : (
          <div className="text-center py-8 text-slate-400">
            <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">No items in this order</p>
          </div>
        )}

        {order.notes && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-black uppercase text-[10px] tracking-widest mt-0.5">ORDER NOTE:</span>
              <p className="text-red-700 font-bold text-sm italic leading-tight flex-1">
                {order.notes}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {nextStatus && (
        <div className="p-3 border-t border-slate-50 bg-white flex gap-2">
          <Button
            size="lg"
            className={cn(
              "flex-1 font-black shadow-lg shadow-slate-200/50 h-11 rounded-xl text-base transition-all active:scale-95",
              order.status === 'new' && "bg-blue-600 hover:bg-blue-700 shadow-blue-200/50",
              order.status === 'preparing' && "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200/50",
              order.status === 'ready' && "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200/50"
            )}
            onClick={() => onStatusChange(order.id, nextStatus)}
          >
            {getActionLabel()}
          </Button>
          {order.status === 'ready' && (
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl border-slate-100 text-slate-300 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 shadow-sm"
              onClick={() => onStatusChange(order.id, 'new')}
              title="Reverse to New"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
