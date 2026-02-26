# CMT Tool Backend API Test Suite (PowerShell)
# Usage: .\test_api_curl.ps1
# Requires: backend running on http://localhost:5000

$BASE = "http://localhost:5000/api"
$passed = 0
$failed = 0
$TS = [int](Get-Date -UFormat %s)

function Test-API {
    param($Name, $Status, $Body, $ExpectedStatus)
    $ok = $Status -eq $ExpectedStatus
    if ($ok) {
        Write-Host "PASS [$Status] $Name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "FAIL [$Status] $Name  (expected $ExpectedStatus)" -ForegroundColor Red
        if ($Body) {
            $short = $Body.Substring(0, [Math]::Min(200, $Body.Length))
            Write-Host "     Body: $short" -ForegroundColor Yellow
        }
        $script:failed++
    }
}

function Invoke-Api {
    param($Method, $Path, $Body, $Token)
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $jsonBody = if ($Body) { $Body | ConvertTo-Json -Depth 10 } else { $null }
    try {
        if ($jsonBody) {
            $resp = Invoke-WebRequest -Uri "$BASE$Path" -Method $Method -Headers $headers -Body $jsonBody -ErrorAction Stop
        } else {
            $resp = Invoke-WebRequest -Uri "$BASE$Path" -Method $Method -Headers $headers -ErrorAction Stop
        }
        return @{ Status = [int]$resp.StatusCode; Body = $resp.Content }
    } catch {
        $sc = 0
        try { $sc = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        $b = ""
        try { $b = $_.ErrorDetails.Message } catch {}
        return @{ Status = $sc; Body = $b }
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  CMT Tool Backend - Full API Test Suite" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Health
Write-Host "-- Health Check --" -ForegroundColor Magenta
$r = Invoke-Api "GET" "/health"
Test-API "GET /health" $r.Status $r.Body 200

# Public Fields
Write-Host ""
Write-Host "-- Fields (Public) --" -ForegroundColor Magenta
$r = Invoke-Api "GET" "/fields"
Test-API "GET /fields (public, no auth)" $r.Status $r.Body 200

# Auth - Register Author
Write-Host ""
Write-Host "-- Auth --" -ForegroundColor Magenta
$authorEmail = "author_$TS@test.com"
$r = Invoke-Api "POST" "/auth/register" @{name="Test Author"; email=$authorEmail; password="password123"; professionalField="Computer Science"}
Test-API "POST /auth/register (Author)" $r.Status $r.Body 201
$authorToken = $null
if ($r.Status -eq 201) {
    $authorToken = ($r.Body | ConvertFrom-Json).data.token
}

# Duplicate registration
$r = Invoke-Api "POST" "/auth/register" @{name="Test Author"; email=$authorEmail; password="password123"; professionalField="Computer Science"}
Test-API "POST /auth/register (duplicate -> 400)" $r.Status $r.Body 400

# Missing required field
$r = Invoke-Api "POST" "/auth/register" @{name="Bad"; email="bad_$TS@test.com"; password="password123"}
Test-API "POST /auth/register (missing professionalField -> 400)" $r.Status $r.Body 400

# Login
$r = Invoke-Api "POST" "/auth/login" @{email=$authorEmail; password="password123"}
Test-API "POST /auth/login (success)" $r.Status $r.Body 200

# Wrong password
$r = Invoke-Api "POST" "/auth/login" @{email=$authorEmail; password="wrongpassword"}
Test-API "POST /auth/login (wrong password -> 401)" $r.Status $r.Body 401

# Profile with token
$r = Invoke-Api "GET" "/auth/profile" $null $authorToken
Test-API "GET /auth/profile (with token)" $r.Status $r.Body 200

# Profile without token
$r = Invoke-Api "GET" "/auth/profile"
Test-API "GET /auth/profile (no token -> 401)" $r.Status $r.Body 401

# Secretary
Write-Host ""
Write-Host "-- Secretary Workflow --" -ForegroundColor Magenta
$r = Invoke-Api "POST" "/auth/login" @{email="secretary@cmt.com"; password="secretary123"}
$secretaryToken = $null
if ($r.Status -eq 200) {
    Test-API "POST /auth/login (Secretary)" $r.Status $r.Body 200
    $secretaryToken = ($r.Body | ConvertFrom-Json).data.token
} else {
    Write-Host "WARNING: Secretary account not found. Run: npm run create-secretary" -ForegroundColor Yellow
    Write-Host "         Skipping Secretary-only tests..."
}

if ($secretaryToken) {
    # Create Editor
    $editorEmail = "editor_$TS@test.com"
    $r = Invoke-Api "POST" "/auth/admin/create-user" @{name="Test Editor"; email=$editorEmail; password="password123"; role="Editor"} $secretaryToken
    Test-API "POST /auth/admin/create-user (Editor)" $r.Status $r.Body 201
    $editorToken = $null
    $r2 = Invoke-Api "POST" "/auth/login" @{email=$editorEmail; password="password123"}
    if ($r2.Status -eq 200) { $editorToken = ($r2.Body | ConvertFrom-Json).data.token }

    # Create Reviewer
    $reviewerEmail = "reviewer_$TS@test.com"
    $r = Invoke-Api "POST" "/auth/admin/create-user" @{name="Test Reviewer"; email=$reviewerEmail; password="password123"; role="Reviewer"; professionalField="Computer Science"} $secretaryToken
    Test-API "POST /auth/admin/create-user (Reviewer)" $r.Status $r.Body 201
    $reviewerToken = $null
    $r2 = Invoke-Api "POST" "/auth/login" @{email=$reviewerEmail; password="password123"}
    if ($r2.Status -eq 200) { $reviewerToken = ($r2.Body | ConvertFrom-Json).data.token }

    # Create Sub-Editor
    $subEditorEmail = "subeditor_$TS@test.com"
    $r = Invoke-Api "POST" "/auth/admin/create-user" @{name="Test SubEditor"; email=$subEditorEmail; password="password123"; role="Sub Editor"; professionalField="Computer Science"} $secretaryToken
    Test-API "POST /auth/admin/create-user (Sub Editor)" $r.Status $r.Body 201
    $subEditorId = ($r.Body | ConvertFrom-Json).data.user.id

    # Author cannot create users
    $r = Invoke-Api "POST" "/auth/admin/create-user" @{name="Hack"; email="hack_$TS@test.com"; password="pass123"; role="Editor"} $authorToken
    Test-API "POST /auth/admin/create-user (Author -> 403)" $r.Status $r.Body 403

    # Sub-editors list
    $r = Invoke-Api "GET" "/auth/sub-editors" $null $editorToken
    Test-API "GET /auth/sub-editors (Editor)" $r.Status $r.Body 200

    # Fields CRUD
    Write-Host ""
    Write-Host "-- Professional Fields --" -ForegroundColor Magenta
    $fieldName = "TestField_$TS"
    $r = Invoke-Api "POST" "/fields" @{name=$fieldName} $secretaryToken
    Test-API "POST /fields (create)" $r.Status $r.Body 201
    $fieldId = ($r.Body | ConvertFrom-Json).data.field._id

    $r = Invoke-Api "POST" "/fields" @{name=$fieldName} $secretaryToken
    Test-API "POST /fields (duplicate -> 400)" $r.Status $r.Body 400

    $r = Invoke-Api "PUT" "/fields/$fieldId" @{name="$fieldName`_updated"} $secretaryToken
    Test-API "PUT /fields/:id (update)" $r.Status $r.Body 200

    $r = Invoke-Api "PUT" "/fields/$fieldId/subeditor" @{subEditorId=$subEditorId} $editorToken
    Test-API "PUT /fields/:id/subeditor (Editor assign)" $r.Status $r.Body 200

    $r = Invoke-Api "DELETE" "/fields/$fieldId" $null $secretaryToken
    Test-API "DELETE /fields/:id (delete)" $r.Status $r.Body 200

    # Conferences
    Write-Host ""
    Write-Host "-- Conferences --" -ForegroundColor Magenta
    $futureDate = (Get-Date).AddDays(30).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $confDate = (Get-Date).AddDays(60).ToString("yyyy-MM-ddTHH:mm:ssZ")

    $r = Invoke-Api "POST" "/conferences" @{title="Test Conf $TS"; professionalFields=@("Computer Science"); submissionDeadline=$futureDate; conferenceDate=$confDate} $secretaryToken
    Test-API "POST /conferences (Secretary create)" $r.Status $r.Body 201
    $conferenceId = ($r.Body | ConvertFrom-Json).data._id

    $r = Invoke-Api "POST" "/conferences" @{title="Hack Conf"; professionalFields=@("Other"); submissionDeadline=$futureDate; conferenceDate=$confDate} $authorToken
    Test-API "POST /conferences (Author -> 403)" $r.Status $r.Body 403

    $r = Invoke-Api "GET" "/conferences" $null $authorToken
    Test-API "GET /conferences (authenticated)" $r.Status $r.Body 200

    $r = Invoke-Api "GET" "/conferences"
    Test-API "GET /conferences (no token -> 401)" $r.Status $r.Body 401

    $r = Invoke-Api "PUT" "/conferences/$conferenceId" @{title="Updated Conf $TS"; professionalFields=@("Computer Science"); submissionDeadline=$futureDate; conferenceDate=$confDate} $secretaryToken
    Test-API "PUT /conferences/:id (update)" $r.Status $r.Body 200

    # Papers
    Write-Host ""
    Write-Host "-- Papers --" -ForegroundColor Magenta
    $r = Invoke-Api "GET" "/papers" $null $authorToken
    Test-API "GET /papers (Author -> 403)" $r.Status $r.Body 403

    $r = Invoke-Api "GET" "/papers" $null $secretaryToken
    Test-API "GET /papers (Secretary)" $r.Status $r.Body 200

    $r = Invoke-Api "GET" "/papers/my-papers" $null $authorToken
    Test-API "GET /papers/my-papers (Author)" $r.Status $r.Body 200

    $r = Invoke-Api "GET" "/papers/reviewers" $null $editorToken
    Test-API "GET /papers/reviewers (Editor)" $r.Status $r.Body 200

    $r = Invoke-Api "GET" "/papers/assigned" $null $reviewerToken
    Test-API "GET /papers/assigned (Reviewer)" $r.Status $r.Body 200

    Write-Host "INFO: POST /papers/upload is Skipped (requires multipart PDF binary)" -ForegroundColor Cyan

    # Reviews
    Write-Host ""
    Write-Host "-- Reviews --" -ForegroundColor Magenta
    $nullId = "000000000000000000000000"
    $r = Invoke-Api "POST" "/reviews/$nullId" @{recommendation="Accept"} $reviewerToken
    Test-API "POST /reviews/:paperId (non-existent -> 404)" $r.Status $r.Body 404

    $r = Invoke-Api "GET" "/reviews/paper/$nullId" $null $secretaryToken
    Test-API "GET /reviews/paper/:paperId (non-existent -> 404)" $r.Status $r.Body 404

    $r = Invoke-Api "GET" "/reviews/$nullId" $null $secretaryToken
    Test-API "GET /reviews/:id (non-existent -> 404)" $r.Status $r.Body 404

    # Cleanup
    Write-Host ""
    Write-Host "-- Cleanup --" -ForegroundColor Magenta
    $r = Invoke-Api "DELETE" "/conferences/$conferenceId" $null $secretaryToken
    Test-API "DELETE /conferences/:id" $r.Status $r.Body 200
}

# Summary
$total = $passed + $failed
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $passed / $total passed  |  $failed failed" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
if ($failed -gt 0) { exit 1 } else { exit 0 }
