import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = 'http://localhost'; // adjust if running elsewhere

const users = new SharedArray('users', () =>
    JSON.parse(open('./users.json')) // expect at least 1 admin user here
);

export let options = {
    vus: 50,
    duration: '2m',
};

let TEST_TEAM_ID;

export function setup() {
    // Use the first user in users.json to log in (should be admin)
    const adminUser = users[0];
    const res = http.post(`${BASE_URL}/api/v4/users/login`, JSON.stringify(adminUser), {
        headers: { 'Content-Type': 'application/json' },
    });

    if (res.status !== 200 || !res.headers['Token']) {
        fail('Failed to log in as admin to fetch team ID');
    }

    const token = res.headers['Token'];

    const teamsRes = http.get(`${BASE_URL}/api/v4/teams`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    check(teamsRes, {
        'fetched teams': (r) => r.status === 200 && r.json().length > 0,
    });

    const teamId = teamsRes.json()[0].id;

    if (!teamId) {
        fail('Could not find any team from /api/v4/teams');
    }

    return { team_id: teamId };
}

export default function (data) {
    const TEST_TEAM_ID = data.team_id;
    const user = users[__VU % users.length];

    group('Login and create channel', () => {
        // Login
        const loginRes = http.post(`${BASE_URL}/api/v4/users/login`, JSON.stringify(user), {
            headers: { 'Content-Type': 'application/json' },
        });

        const loggedIn = check(loginRes, {
            'logged in': (r) => r.status === 200 && r.headers['Token'],
        });

        if (!loggedIn) {
            console.error(`Login failed for user ${user.login_id}`);
            return;
        }

        const token = loginRes.headers['Token'];

        // Create Channel
        const channelPayload = {
            team_id: TEST_TEAM_ID,
            name: `chan-${__VU}-${Date.now()}`,
            display_name: `Test Channel ${__VU}`,
            type: 'O',
        };

        const createRes = http.post(`${BASE_URL}/api/v4/channels`, JSON.stringify(channelPayload), {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        check(createRes, {
            'channel created': (r) => r.status === 201,
        }) || console.error(`Failed to create channel. ${createRes.status}: ${createRes.body}`);

        sleep(1);
    });
}
