$en_path = "c:\Users\user\Desktop\Antigravity\voca-app\src\data\vocabulary.json"
$es_jp_path = "c:\Users\user\Desktop\Antigravity\voca-app\es_jp_data.json"

# Use .NET methods to ensure correct UTF-8 handling
$utf8 = New-Object System.Text.UTF8Encoding($false) # UTF8 without BOM

$en_string = [System.IO.File]::ReadAllText($en_path, [System.Text.Encoding]::UTF8)
$es_jp_string = [System.IO.File]::ReadAllText($es_jp_path, [System.Text.Encoding]::UTF8)

# Robustly find the last "]" which closes the "English" array
$last_bracket = $en_string.LastIndexOf("]")
if ($last_bracket -gt 0) {
    # Unwrap the es_jp data
    $es_jp_string = $es_jp_string.Trim()
    if ($es_jp_string.StartsWith("{")) { $es_jp_string = $es_jp_string.Substring(1) }
    if ($es_jp_string.EndsWith("}")) { $es_jp_string = $es_jp_string.Substring(0, $es_jp_string.Length - 1) }
    
    # Extract only the "English": [...] part
    $start_idx = $en_string.IndexOf('"English"')
    $en_voca_part = $en_string.Substring($start_idx, $last_bracket - $start_idx + 1)
    
    # Construct final JSON
    $final_content = "{" + "`r`n" + "  " + $en_voca_part + "," + "`r`n" + $es_jp_string.Trim() + "`r`n" + "}"
    
    # Write back using .NET method to ensure no BOM and UTF8
    [System.IO.File]::WriteAllText($en_path, $final_content, $utf8)
    Write-Host "Merge successful (v6 - UTF8 Safe)."
} else {
    Write-Host "Could not find ']' in vocabulary.json"
}
