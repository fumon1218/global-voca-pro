$clean_en_source = 'C:\Users\user\.gemini\antigravity\brain\024b54b3-eadd-4599-b65c-14522d7a11f0\.system_generated\steps\686\content.md'
$es_jp_source = 'c:\Users\user\Desktop\Antigravity\voca-app\es_jp_data.json'
$target_path = 'c:\Users\user\Desktop\Antigravity\voca-app\src\data\vocabulary.json'

$utf8_no_bom = New-Object System.Text.UTF8Encoding($false)

# 1. Read clean English JSON
$full_text = [System.IO.File]::ReadAllText($clean_en_source, [System.Text.Encoding]::UTF8)
$start_idx = $full_text.IndexOf('{')
if ($start_idx -lt 0) {
    Write-Error "Could not find start of JSON in $clean_en_source"
    exit 1
}
$clean_en_json = $full_text.Substring($start_idx)

# 2. Read expanded data
$es_jp_json = [System.IO.File]::ReadAllText($es_jp_source, [System.Text.Encoding]::UTF8)

# 3. Merge safely
# Since PowerShell 5.1 ConvertFrom-Json can be buggy with large JSON or certain characters,
# we will use a robust string-based merge as the structure is simple.
# The clean_en_json starts with { and contains "English": [ ... ]
# We need to find the last ] of the English array.

$last_bracket = $clean_en_json.LastIndexOf(']')
if ($last_bracket -lt 0) {
    Write-Error "Could not find end of English array in $clean_en_source"
    exit 1
}

$en_part = $clean_en_json.Substring(0, $last_bracket + 1)
# Trim outer { if it was taken
if ($en_part.Trim().StartsWith('{')) {
    $en_part = $en_part.Substring($en_part.IndexOf('"English"'))
}

# Unwrap es_jp
$es_jp_trimmed = $es_jp_json.Trim()
if ($es_jp_trimmed.StartsWith('{')) { $es_jp_trimmed = $es_jp_trimmed.Substring(1) }
if ($es_jp_trimmed.EndsWith('}')) { $es_jp_trimmed = $es_jp_trimmed.Substring(0, $es_jp_trimmed.Length - 1) }

# Construct final
$final_json = '{' + "`r`n" + '  ' + $en_part + ',' + "`r`n" + $es_jp_trimmed.Trim() + "`r`n" + '}'

# 4. Write back
[System.IO.File]::WriteAllText($target_path, $final_json, $utf8_no_bom)

Write-Host "Vocabulary safely merged and restored to $target_path"
