const http = require('http');

async function run() {
    try {
        console.log('Testing Registration and Login with Cookie retention...');

        const email = `testuser_${Date.now()}@example.com`;

        // 1. Register a new user
        const regRes = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test User', email, password: 'password123', professionalField: 'Computer Science' })
        });

        const regData = await regRes.json();
        const setCookieHeader = regRes.headers.get('set-cookie');

        if (!regData.success) {
            console.error('Registration failed...', regData);
            return;
        }

        console.log('Registration successful, auto-login triggered.');
        const sessionId = setCookieHeader ? setCookieHeader.split(';')[0] : null;

        if (!sessionId) {
            console.error('❌ FAIL: Session cookie not received during registration.');
            return;
        }

        console.log('Got cookie:', sessionId);

        // 2. Fetch protected profile using the session cookie
        const profileRes = await fetch('http://localhost:5000/api/auth/profile', {
            method: 'GET',
            headers: { 'Cookie': sessionId }
        });

        // 3. Log out
        const logoutRes = await fetch('http://localhost:5000/api/auth/logout', {
            method: 'POST',
            headers: { 'Cookie': sessionId }
        });

        const profileData = await profileRes.json();
        const logoutData = await logoutRes.json();

        if (profileData.success && logoutData.success) {
            console.log('✔️ PASS: Profile fetched successfully using session cookie.', profileData.data.user.email);
            console.log('✔️ PASS: Logged out successfully.');
        } else {
            console.error('❌ FAIL: Profile fetch or logout failed.', { profileData, logoutData });
        }

    } catch (err) {
        console.error('Test error:', err);
    }
}

run();
