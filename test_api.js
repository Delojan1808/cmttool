/**
 * CMT Tool Backend API Test Suite
 * Run: node test_api.js
 * Requires the backend to be running on http://localhost:5000
 */

const BASE_URL = 'http://localhost:5000/api';

// ── helpers ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const results = [];

async function req(method, path, body, cookieJar = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (cookieJar) headers['Cookie'] = cookieJar;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, opts);
    const data = await res.json().catch(() => ({}));

    // Extract set-cookie for subsequent requests
    let newCookieJar = cookieJar;
    const setCookieHeader = res.headers.get('set-cookie');

    // fetch's set-cookie can contain multiple cookies separated by comma and space.
    if (setCookieHeader) {
        const cookies = setCookieHeader.split(/,\s*/);
        for (const cookie of cookies) {
            if (cookie.startsWith('connect.sid=')) {
                newCookieJar = cookie.split(';')[0];
                break;
            }
        }
    }

    return { status: res.status, data, cookieJar: newCookieJar };
}

function test(name, status, data, expectedStatus, expectSuccess) {
    const ok = status === expectedStatus && data.success === expectSuccess;
    const icon = ok ? '✅' : '❌';
    const result = `${icon} [${status}] ${name}`;
    console.log(result);
    if (!ok) {
        console.log(`   Expected status=${expectedStatus} success=${expectSuccess}, got status=${status} success=${data.success}`);
        console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}`);
        failed++;
    } else {
        passed++;
    }
    results.push({ name, ok, status, expected: expectedStatus });
    return data;
}

// ── main ───────────────────────────────────────────────────────────────────
(async () => {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  CMT Tool Backend – Full API Test Suite');
    console.log('═══════════════════════════════════════════════════\n');

    // ── HEALTH ──────────────────────────────────────────────────────────
    console.log('── Health Check ──────────────────────────────────');
    { const { status, data } = await req('GET', '/health'); test('GET /health', status, data, 200, true); }

    // ── PUBLIC FIELDS ───────────────────────────────────────────────────
    console.log('\n── Fields (Public) ───────────────────────────────');
    { const { status, data } = await req('GET', '/fields'); test('GET /fields (public)', status, data, 200, true); }

    // ── AUTH ─────────────────────────────────────────────────────────────
    console.log('\n── Auth ──────────────────────────────────────────');

    // Register a new Author
    const ts = Date.now();
    const authorEmail = `author_${ts}@test.com`;
    let authorCookie, authorId;
    {
        const { status, data, cookieJar } = await req('POST', '/auth/register', {
            name: 'Test Author',
            email: authorEmail,
            password: 'password123',
            professionalField: 'Computer Science' // Just to make it valid for authors
        });
        test('POST /auth/register (Author)', status, data, 201, true);
        authorCookie = cookieJar;
        authorId = data.data?.user?.id;
    }

    // Register duplicate
    {
        const { status, data } = await req('POST', '/auth/register', {
            name: 'Test Author',
            email: authorEmail,
            password: 'password123',
            professionalField: 'Computer Science'
        });
        test('POST /auth/register (duplicate → 400)', status, data, 400, false);
    }

    // Register with validation error (no professionalField)
    {
        const { status, data } = await req('POST', '/auth/register', {
            name: 'Bad Author',
            email: `bad_${ts}@test.com`,
            password: 'password123'
        });
        test('POST /auth/register (missing field → 400)', status, data, 400, false);
    }

    // Login success
    {
        const { status, data, cookieJar } = await req('POST', '/auth/login', { email: authorEmail, password: 'password123' });
        test('POST /auth/login (success)', status, data, 200, true);
        authorCookie = cookieJar; // Update cookie to make sure we have a fresh session
    }

    // Login wrong password
    {
        const { status, data } = await req('POST', '/auth/login', { email: authorEmail, password: 'wrongpassword' });
        test('POST /auth/login (wrong password → 401)', status, data, 401, false);
    }

    // Get profile (authenticated)
    {
        const { status, data } = await req('GET', '/auth/profile', null, authorCookie);
        test('GET /auth/profile (authenticated)', status, data, 200, true);
    }

    // Get profile (no token)
    {
        const { status, data } = await req('GET', '/auth/profile');
        test('GET /auth/profile (no token → 401)', status, data, 401, false);
    }

    // ── SECRETARY LOGIN ─────────────────────────────────────────────────
    console.log('\n── Secretary Workflow ────────────────────────────');
    // Try to login with default secretary credentials
    let secretaryCookie;
    {
        const { status, data, cookieJar } = await req('POST', '/auth/login', {
            email: 'admin@cmt.com',
            password: 'Admin@123'
        });
        if (status === 200 && data.success) {
            test('POST /auth/login (Secretary)', status, data, 200, true);
            secretaryCookie = cookieJar;
        } else {
            console.log('⚠️  Secretary account not found. Run: npm run create-secretary');
            console.log('   Skipping Secretary-only tests...');
        }
    }

    if (secretaryCookie) {
        // Create user (Editor) via Secretary
        const editorEmail = `editor_${ts}@test.com`;
        let editorCookie;
        {
            const { status, data } = await req('POST', '/auth/admin/create-user', {
                name: 'Test Editor',
                email: editorEmail,
                password: 'password123',
                role: 'Editor'
            }, secretaryCookie);
            test('POST /auth/admin/create-user (Editor)', status, data, 201, true);
        }

        { // Try Editor login
            const { status, data, cookieJar } = await req('POST', '/auth/login', { email: editorEmail, password: 'password123' });
            test('POST /auth/login (Editor)', status, data, 200, true);
            editorCookie = cookieJar;
        }

        // Create Reviewer
        const reviewerEmail = `reviewer_${ts}@test.com`;
        let reviewerCookie, reviewerId;
        {
            const { status, data } = await req('POST', '/auth/admin/create-user', {
                name: 'Test Reviewer',
                email: reviewerEmail,
                password: 'password123',
                role: 'Reviewer',
                professionalField: 'Computer Science'
            }, secretaryCookie);
            test('POST /auth/admin/create-user (Reviewer)', status, data, 201, true);
            reviewerId = data.data?.user?.id;
        }

        { // Reviewer login
            const { status, data, cookieJar } = await req('POST', '/auth/login', { email: reviewerEmail, password: 'password123' });
            test('POST /auth/login (Reviewer)', status, data, 200, true);
            reviewerCookie = cookieJar;
        }

        // Create Sub-Editor
        const subEditorEmail = `subeditor_${ts}@test.com`;
        let subEditorCookie, subEditorId;
        {
            const { status, data } = await req('POST', '/auth/admin/create-user', {
                name: 'Test SubEditor',
                email: subEditorEmail,
                password: 'password123',
                role: 'Sub Editor',
                professionalField: 'Computer Science'
            }, secretaryCookie);
            test('POST /auth/admin/create-user (Sub Editor)', status, data, 201, true);
            subEditorId = data.data?.user?.id;
        }

        { // Sub-Editor login
            const { status, data, cookieJar } = await req('POST', '/auth/login', { email: subEditorEmail, password: 'password123' });
            test('POST /auth/login (Sub Editor)', status, data, 200, true);
            subEditorCookie = cookieJar;
        }

        // Author should NOT be able to create users
        {
            const { status, data } = await req('POST', '/auth/admin/create-user', {
                name: 'Hack', email: `hack_${ts}@test.com`, password: 'pass123', role: 'Editor'
            }, authorCookie);
            test('POST /auth/admin/create-user (Author → 403)', status, data, 403, false);
        }

        // Editor sub-editors list
        if (editorCookie) {
            const { status, data } = await req('GET', '/auth/sub-editors', null, editorCookie);
            test('GET /auth/sub-editors (Editor)', status, data, 200, true);
        }

        // ── FIELDS ─────────────────────────────────────────────────────
        console.log('\n── Professional Fields ───────────────────────────');
        const fieldName = `TestField_${ts}`;
        let fieldId;

        {
            const { status, data } = await req('POST', '/fields', { name: fieldName }, secretaryCookie);
            test('POST /fields (Secretary - create)', status, data, 201, true);
            fieldId = data.data?.field?._id;
        }

        {
            const { status, data } = await req('POST', '/fields', { name: fieldName }, secretaryCookie);
            test('POST /fields (duplicate → 400)', status, data, 400, false);
        }

        if (fieldId) {
            {
                const { status, data } = await req('PUT', `/fields/${fieldId}`, { name: fieldName + '_updated' }, secretaryCookie);
                test('PUT /fields/:id (Secretary - update)', status, data, 200, true);
            }

            if (subEditorId && editorCookie) {
                {
                    const { status, data } = await req('PUT', `/fields/${fieldId}/subeditor`, { subEditorId }, editorCookie);
                    test('PUT /fields/:id/subeditor (Editor - assign sub-editor)', status, data, 200, true);
                }
            }

            {
                const { status, data } = await req('DELETE', `/fields/${fieldId}`, null, secretaryCookie);
                test('DELETE /fields/:id (Secretary - delete)', status, data, 200, true);
            }
        }

        // ── CONFERENCES ─────────────────────────────────────────────────
        console.log('\n── Conferences ───────────────────────────────────');
        let conferenceId;
        const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const confDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

        {
            const { status, data } = await req('POST', '/conferences', {
                title: `Test Conference ${ts}`,
                professionalFields: ['Computer Science'],
                submissionDeadline: futureDate,
                conferenceDate: confDate
            }, secretaryCookie);
            test('POST /conferences (Secretary - create)', status, data, 201, true);
            conferenceId = data.data?._id;
        }

        // Author should NOT create conferences
        {
            const { status, data } = await req('POST', '/conferences', {
                title: 'Hacked Conf', professionalFields: ['Other'],
                submissionDeadline: futureDate, conferenceDate: confDate
            }, authorCookie);
            test('POST /conferences (Author → 403)', status, data, 403, false);
        }

        {
            const { status, data } = await req('GET', '/conferences', null, authorCookie);
            test('GET /conferences (authenticated)', status, data, 200, true);
        }

        {
            const { status, data } = await req('GET', '/conferences');
            test('GET /conferences (no token → 401)', status, data, 401, false);
        }

        if (conferenceId) {
            {
                const { status, data } = await req('PUT', `/conferences/${conferenceId}`, {
                    title: `Updated Conf ${ts}`,
                    professionalFields: ['Computer Science'],
                    submissionDeadline: futureDate,
                    conferenceDate: confDate
                }, secretaryCookie);
                test('PUT /conferences/:id (Secretary - update)', status, data, 200, true);
            }

            // ── PAPERS ──────────────────────────────────────────────────
            console.log('\n── Papers ────────────────────────────────────────');

            // Author cannot access getAllPapers
            {
                const { status, data } = await req('GET', '/papers', null, authorCookie);
                test('GET /papers (Author → 403)', status, data, 403, false);
            }

            // Secretary can access getAllPapers
            {
                const { status, data } = await req('GET', '/papers', null, secretaryCookie);
                test('GET /papers (Secretary)', status, data, 200, true);
            }

            // Get my papers (Author - empty)
            {
                const { status, data } = await req('GET', '/papers/my-papers', null, authorCookie);
                test('GET /papers/my-papers (Author - empty)', status, data, 200, true);
            }

            // Get reviewers (Secretary accessible)
            if (secretaryCookie) {
                const { status, data } = await req('GET', '/papers/reviewers', null, secretaryCookie);
                test('GET /papers/reviewers (Secretary)', status, data, 200, true);
            }

            // Reviewer: get assigned papers (should be empty)
            if (reviewerCookie) {
                const { status, data } = await req('GET', '/papers/assigned', null, reviewerCookie);
                test('GET /papers/assigned (Reviewer - empty)', status, data, 200, true);
            }

            // NOTE: Cannot test paper upload via JSON-only fetch (requires multipart/form-data with PDF file)
            console.log('ℹ️  POST /papers/upload — Skipped (requires multipart/form-data with PDF binary)');

            // ── REVIEWS ──────────────────────────────────────────────────
            console.log('\n── Reviews ───────────────────────────────────────');
            // Without a real paper + assignment, we just test the 404 path
            {
                const { status, data } = await req('POST', '/reviews/000000000000000000000000', {
                    recommendation: 'Accept', reviewerInfo: {}
                }, reviewerCookie || authorCookie);
                test('POST /reviews/:paperId (non-existent paper → 404)', status, data, 404, false);
            }

            {
                const { status, data } = await req('GET', '/reviews/paper/000000000000000000000000', null, secretaryCookie);
                test('GET /reviews/paper/:paperId (non-existent → 404)', status, data, 404, false);
            }

            {
                const { status, data } = await req('GET', '/reviews/000000000000000000000000', null, secretaryCookie);
                test('GET /reviews/:id (non-existent → 404)', status, data, 404, false);
            }

            // ── CLEANUP ──────────────────────────────────────────────────
            console.log('\n── Cleanup ───────────────────────────────────────');
            {
                const { status, data } = await req('DELETE', `/conferences/${conferenceId}`, null, secretaryCookie);
                test('DELETE /conferences/:id (Secretary - delete)', status, data, 200, true);
            }
        }
    }

    // Logout cleanup
    if (authorCookie) await req('POST', '/auth/logout', null, authorCookie);
    if (secretaryCookie) await req('POST', '/auth/logout', null, secretaryCookie);

    // ── SUMMARY ──────────────────────────────────────────────────────────
    const total = passed + failed;
    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  RESULTS: ${passed}/${total} passed  |  ${failed} failed`);
    console.log('═══════════════════════════════════════════════════\n');

    if (failed > 0) {
        console.log('Failed tests:');
        results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.name}  (got ${r.status}, expected ${r.expected})`));
    }

    process.exit(failed > 0 ? 1 : 0);
})().catch(err => {
    console.error('\n🔥 FATAL ERROR:', err.message);
    console.error('Make sure the backend is running: npm run dev\n');
    process.exit(1);
});
