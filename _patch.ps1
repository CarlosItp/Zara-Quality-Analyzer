$orig = Get-Content 'C:\Users\escor\Desktop\APP\index.html'
$newB = Get-Content 'C:\Users\escor\Desktop\APP\_opts_temp.html'
$out  = $orig[0..314] + $newB + $orig[391..($orig.Length-1)]
Set-Content 'C:\Users\escor\Desktop\APP\index.html' $out -Encoding UTF8
Write-Host "Done lines:" $out.Length
