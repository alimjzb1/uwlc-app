
$filePath = "c:/Users/LOQ/OneDrive/Desktop/UMLC APP/src/pages/ProductDetail.tsx"
$content = Get-Content -Path $filePath -Raw

# Prepare the replacement for the header section of each log entry
$newHeader = '                                                  {/* Header */}
                                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-muted/20 pb-2 mb-2">
                                                      <div className="flex items-center gap-2">
                                                          <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wider px-2 py-0">
                                                              {log.action.replace(/_/g, " ")}
                                                          </Badge>
                                                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
                                                              {new Date(log.created_at).toLocaleDateString(undefined, { 
                                                                  month: "short", 
                                                                  day: "numeric", 
                                                                  hour: "2-digit", 
                                                                  minute: "2-digit" 
                                                              })}
                                                          </span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <div className="text-[9px] font-black uppercase text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded-full">
                                                              {log.profiles?.full_name || (log.user_id ? "User" : "System")}
                                                          </div>
                                                          {log.profiles?.role && (
                                                              <Badge 
                                                                  variant="outline" 
                                                                  className={`text-[8px] h-4 px-1 uppercase font-black tracking-tighter ${
                                                                      log.profiles.role === "admin" ? "border-amber-500/50 text-amber-500 bg-amber-500/5" : ""
                                                                  }`}
                                                              >
                                                                  {log.profiles.role}
                                                              </Badge>
                                                          )}
                                                      </div>
                                                  </div>'

# Regex to find the existing header block
$regex = '(?s)\{/\* Header \*/\}\s+<div className="flex flex-wrap items-center justify-between gap-2 border-b border-muted/20 pb-2 mb-2">.*?<div className="flex items-center gap-1.5 text-\[9px\] font-black uppercase text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded-full">.*?\{log\.user_id \? ''User'' : ''System''\}[^<]*</div>\s+</div>'

$result = $content -replace $regex, $newHeader

if ($result -ne $content) {
    $result | Set-Content -Path $filePath -Encoding utf8
    Write-Host "Success: Patched History UI with profile info."
} else {
    Write-Host "Error: Could not find target header in ProductDetail.tsx"
}
