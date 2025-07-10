import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = 'http://localhost';
const users = new SharedArray('users', () => JSON.parse(open('./users.json')));

export let options = {
    vus: 30,
    duration: '2m',
    thresholds: {
        http_req_failed: ['rate<0.2'], // Expect failures due to degraded DB
        http_req_duration: ['p(95)<2000'], // Expect slow responses under pressure
    },
};

export default function () {
    const user = users[__VU % users.length];

    group('Login under DB pressure', () => {
        const login = http.post(`${BASE_URL}/api/v4/users/login`, JSON.stringify(user), {
            headers: { 'Content-Type': 'application/json' },
        });

        check(login, {
            'logged in or failed gracefully': (r) => r.status === 200 || r.status === 429 || r.status === 500,
        });

        sleep(1);
    });
}
