
$filePath = "c:/Users/LOQ/OneDrive/Desktop/UMLC APP/src/pages/ProductDetail.tsx"
$content = Get-Content -Path $filePath -Raw

# Prepare the replacement content
$historyTabReplacement = '              <TabsContent value="history" className="pt-6 space-y-6">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-xl font-black tracking-tight">Audit History</h3>
                        <p className="text-sm text-muted-foreground">Record of changes to this product.</p>
                     </div>
                     <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchHistory}
                        className="gap-2"
                     >
                        <History className="h-4 w-4" />
                        Refresh
                     </Button>
                  </div>
                  
                  <div className="space-y-4">
                      {auditError && (
                          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
                              <p className="font-bold mb-1">Error loading history:</p>
                              <code>{auditError}</code>
                          </div>
                      )}

                      {auditLogs.length === 0 && !auditError ? (
                          <div className="p-12 text-center border-2 border-dashed rounded-2xl opacity-50">
                              <History className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">No history recorded yet</p>
                          </div>
                      ) : (
                          <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/20 before:via-muted/20 before:to-transparent">
                              {auditLogs.map((log) => {
                                  const isAdjustment = log.action === "adjust_stock" || log.action === "transfer_stock";
                                  const isUpdate = log.action.includes("UPDATE") || log.action.includes("price");
                                  const oldData = log.old_data;
                                  const newData = log.new_data || log.metadata;
                                  
                                  return (
                                      <div key={log.id} className="relative flex items-start gap-6 group">
                                          <div className={`mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-lg ring-4 ring-background transition-all group-hover:scale-110 z-10 ${
                                              isAdjustment ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : 
                                              isUpdate ? "bg-primary/10 border-primary/30 text-primary" : 
                                              "bg-muted border-muted-foreground/20 text-muted-foreground"
                                          }`}>
                                              {isAdjustment ? <TrendingUp className="h-5 w-5" /> : isUpdate ? <Edit3 className="h-5 w-5" /> : <History className="h-5 w-5" />}
                                          </div>

                                          <Card className="flex-1 bg-card/40 border-muted/50 shadow-sm hover:shadow-md transition-all hover:bg-card/60">
                                              <CardContent className="p-4 space-y-3">
                                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                                      <div className="flex items-center gap-2">
                                                          <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wider px-2 py-0">
                                                              {log.action.replace(/_/g, " ")}
                                                          </Badge>
                                                          <span className="text-[10px] font-medium text-muted-foreground">
                                                              {new Date(log.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                          </span>
                                                      </div>
                                                      <div className="text-[9px] font-black uppercase text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded-full">
                                                          {log.user_id ? "User" : "System"}
                                                      </div>
                                                  </div>

                                                  {log.record_id !== product.id && (
                                                      <div className="flex items-center gap-2 px-2 py-1 bg-primary/5 border border-primary/10 rounded-lg w-fit">
                                                          <Package className="h-3 w-3 text-primary" />
                                                          <span className="text-[10px] font-bold text-primary uppercase">
                                                              {variants.find(v => v.id === log.record_id)?.name || "Variant Adjustment"}
                                                          </span>
                                                      </div>
                                                  )}

                                                  <div className="space-y-2">
                                                      {(log.reason || log.metadata?.reason || log.new_data?.reason) && (
                                                          <div className="text-sm font-semibold flex items-baseline gap-2">
                                                              <span className="text-xs text-muted-foreground font-normal">Reason:</span>
                                                              {log.reason || log.metadata?.reason || log.new_data?.reason}
                                                          </div>
                                                      )}

                                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                           {(oldData?.quantity !== undefined || newData?.quantity !== undefined) && (
                                                                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/20 border border-muted/30">
                                                                    <span className="text-[9px] uppercase font-black opacity-50">Stock Change</span>
                                                                    <div className="flex items-center gap-3 font-mono">
                                                                        <span className="line-through opacity-40">{oldData?.quantity ?? "?"}</span>
                                                                        <span className="text-muted-foreground/30">→</span>
                                                                        <span className={`font-bold ${(newData?.quantity || 0) > (oldData?.quantity || 0) ? "text-emerald-500" : "text-red-500"}`}>
                                                                            {newData?.quantity ?? "?"}
                                                                        </span>
                                                                        {oldData?.quantity !== undefined && newData?.quantity !== undefined && (
                                                                            <Badge variant="outline" className={`ml-auto text-[9px] ${newData.quantity > oldData.quantity ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20" : "bg-red-500/5 text-red-500 border-red-500/20"}`}>
                                                                                {newData.quantity > oldData.quantity ? "+" : ""}{newData.quantity - oldData.quantity}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                           )}

                                                           {(newData?.oldPrice !== undefined || newData?.newPrice !== undefined) && (
                                                                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/20 border border-muted/30">
                                                                    <span className="text-[9px] uppercase font-black opacity-50">Price Update</span>
                                                                    <div className="flex items-center gap-3 font-mono">
                                                                        <span className="line-through opacity-40">${newData?.oldPrice}</span>
                                                                        <span className="text-muted-foreground/30">→</span>
                                                                        <span className="text-primary font-bold">${newData?.newPrice}</span>
                                                                    </div>
                                                                </div>
                                                           )}
                                                      </div>
                                                  </div>

                                                  {(log.metadata?.notes || log.new_data?.notes) && (
                                                      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/10 p-2 rounded-md italic">
                                                          <CheckSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                                          <span>{log.metadata?.notes || log.new_data?.notes}</span>
                                                      </div>
                                                  )}
                                              </CardContent>
                                          </Card>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </TabsContent>'

# Regex to find the entire history tab content
$regex = '(?s)<TabsContent\s+value="history".*?</TabsContent>'

$newContent = $content -replace $regex, $historyTabReplacement
$newContent | Set-Content -Path $filePath
