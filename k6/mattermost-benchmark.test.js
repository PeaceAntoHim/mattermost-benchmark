import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

export let loginTrend = new Trend('login_duration');
export let postTrend = new Trend('post_duration');
export let errorRate = new Rate('errors');

export let options = {
    stages: [
        { duration: '30s', target: 20 }, // ramp up
        { duration: '1m', target: 50 },  // steady
        { duration: '30s', target: 0 },  // ramp down
    ],
    thresholds: {
        'errors': ['rate<0.05'], // < 5% errors
        'http_req_duration': ['p(95)<2000'], // 95% of requests < 2000ms
    },
};

// Load users from users.json
const users = new SharedArray('users', () => JSON.parse(open('./users.json')));

const BASE_URL = 'http://localhost'; // Adjust if needed

export default function () {
    const user = users[__VU % users.length];

    group('User Flow', function () {
        // 1. Login
        const loginRes = http.post(`${BASE_URL}/api/v4/users/login`, JSON.stringify(user), {
            headers: { 'Content-Type': 'application/json' },
        });

        loginTrend.add(loginRes.timings.duration);

        const token = loginRes.headers['Token'];
        const userId = loginRes.json('id');

        check(loginRes, {
            'login succeeded': (r) => r.status === 200,
        }) || errorRate.add(1);

        if (!token) return;

        // 2. Get team memberships (needed for posting)
        const teamRes = http.get(`${BASE_URL}/api/v4/users/me/teams`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        check(teamRes, {
            'team fetch ok': (r) => r.status === 200,
        }) || errorRate.add(1);

        const teams = teamRes.json();
        const teamId = teams.length > 0 ? teams[0].id : null;
        if (!teamId) return;

        // 3. Get public channel
        const channelRes = http.get(`${BASE_URL}/api/v4/teams/${teamId}/channels`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        check(channelRes, {
            'channels fetched': (r) => r.status === 200,
        }) || errorRate.add(1);

        const channels = channelRes.json().filter((c) => c.type === 'O');
        const channelId = channels.length > 0 ? channels[0].id : null;
        if (!channelId) return;

        // 4. Post message
        const postRes = http.post(`${BASE_URL}/api/v4/posts`, JSON.stringify({
            channel_id: channelId,
            message: `Hello from K6 user ${__VU} at ${Date.now()}`,
        }), {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        postTrend.add(postRes.timings.duration);

        check(postRes, {
            'post succeeded': (r) => r.status === 201,
        }) || errorRate.add(1);

        sleep(1);
    });
}
