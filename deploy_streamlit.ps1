param(
  [Parameter(Mandatory = $true)]
  [string]$GithubRepoUrl
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
  git init
}

git add .

try {
  git commit -m "Add Streamlit deployment app"
} catch {
  Write-Host "No commit created (likely no changes or git user not configured)."
}

$remoteExists = $false
try {
  git remote get-url origin | Out-Null
  $remoteExists = $true
} catch {
  $remoteExists = $false
}

if ($remoteExists) {
  git remote set-url origin $GithubRepoUrl
} else {
  git remote add origin $GithubRepoUrl
}

git branch -M main
git push -u origin main

Write-Host ""
Write-Host "Push completed."
Write-Host "Next: open https://streamlit.io/cloud and deploy main file streamlit_app.py"
