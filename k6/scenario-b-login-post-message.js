import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = 'http://localhost'; // adjust as needed
const users = new SharedArray('users', () => JSON.parse(open('./users.json')));

export let options = {
    vus: 100,
    duration: '2m',
};

// Automatically fetch team ID and channel ID before test
export function setup() {
    const adminUser = users[0]; // first user, assumed to have access

    const loginRes = http.post(`${BASE_URL}/api/v4/users/login`, JSON.stringify(adminUser), {
        headers: { 'Content-Type': 'application/json' },
    });

    check(loginRes, { 'admin logged in': (r) => r.status === 200 });

    const token = loginRes.headers['Token'];
    if (!token) {
        fail(' Admin login failed. Cannot proceed.');
    }

    // Step 1: Get the teams the user is in
    const teamsRes = http.get(`${BASE_URL}/api/v4/users/me/teams`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    check(teamsRes, { 'teams fetched': (r) => r.status === 200 });

    const teams = teamsRes.json();
    const teamId = teams.length > 0 ? teams[0].id : null;

    if (!teamId) {
        fail(' No teams found for the admin user.');
    }

    // Step 2: Get the public channels for that team
    const channelsRes = http.get(`${BASE_URL}/api/v4/teams/${teamId}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    check(channelsRes, { 'channels fetched': (r) => r.status === 200 });

    const channels = channelsRes.json().filter((ch) => ch.type === 'O'); // only public channels
    const channelId = channels.length > 0 ? channels[0].id : null;

    if (!channelId) {
        fail(' No public channels found in the team.');
    }

    return { channel_id: channelId };
}

// Main test
export default function (data) {
    const user = users[__VU % users.length];

    group('Login and post message', () => {
        const login = http.post(`${BASE_URL}/api/v4/users/login`, JSON.stringify(user), {
            headers: { 'Content-Type': 'application/json' },
        });

        check(login, { 'logged in': (r) => r.status === 200 });

        const token = login.headers['Token'];
        if (!token) {
            fail(` Token missing for user ${user.login_id}`);
        }

        const messagePayload = {
            channel_id: data.channel_id,
            message: `Benchmark message ${Date.now()} from user ${__VU}`,
        };

        const res = http.post(`${BASE_URL}/api/v4/posts`, JSON.stringify(messagePayload), {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        check(res, {
            'message posted': (r) => r.status === 201,
        });

        sleep(1);
    });
}
